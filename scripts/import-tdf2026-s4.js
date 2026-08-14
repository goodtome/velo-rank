/**
 * Import TDF 2026 Stage 4 to local MySQL + production TiDB
 * Data source: Python-fetched stage_data.json (PCS HTML table parsing)
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const LOCAL = {
  host: '127.0.0.1', port: 13306,
  user: 'root', password: 'mysql123456',
  database: 'jersey_db', charset: 'utf8mb4'
};

const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true },
  connectTimeout: 15000
};

const RACE_CODE = 'tdf-2026';
const STAGE_NUM = 4;

// Load JSON data
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stage_data.json'), 'utf-8'));

// ==================== Helper Functions ====================

async function findRider(conn, name) {
  // Try exact match first
  let [r] = await conn.query('SELECT id, rider_name FROM riders WHERE rider_name=? LIMIT 1', [name]);
  if (r.length) return { id: r[0].id, name: r[0].rider_name };

  // Try surname-only match
  const parts = name.split(' ');
  const surname = parts[0];
  const firstname = parts.slice(1).join(' ');
  
  // Try "Surname Firstname"
  [r] = await conn.query('SELECT id, rider_name FROM riders WHERE rider_name=? LIMIT 1', [`${surname} ${firstname}`]);
  if (r.length) return { id: r[0].id, name: r[0].rider_name };
  
  // Try "Firstname Surname"
  [r] = await conn.query('SELECT id, rider_name FROM riders WHERE rider_name=? LIMIT 1', [`${firstname} ${surname}`]);
  if (r.length) return { id: r[0].id, name: r[0].rider_name };
  
  // Fuzzy: last name match
  [r] = await conn.query('SELECT id, rider_name FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${surname}%`]);
  if (r.length) return { id: r[0].id, name: r[0].rider_name };
  
  // Try removing special chars
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  [r] = await conn.query('SELECT id, rider_name FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${normalized.split(' ').pop()}%`]);
  if (r.length) return { id: r[0].id, name: r[0].rider_name };
  
  return null;
}

async function findTeam(conn, name) {
  // PCS → DB team name mapping for TDF 2026 men's teams
  // DB has both men's and women's team records - must match to men's
  const MEN_TEAM_MAP = {
    'Lidl - Trek': 'Lidl-Trek',
    'UAE Team Emirates - XRG': 'UAE Team Emirates-XRG',
    'Alpecin - Premier Tech': 'ALPECIN-PREMIER TECH',
    'Red Bull - BORA - hansgrohe': 'Red Bull-BORA-hansgrohe',
    'Decathlon CMA CGM Team': 'DECATHLON CMA CGM TEAM',
    'EF Education - EasyPost': 'EF Education-EasyPost',
    'Groupama - FDJ United': 'GROUPAMA-FDJ UNITED',
    'Bahrain - Victorious': 'Bahrain Victorious',
    'Caja Rural - Seguros RGA': 'Caja Rural',
    'Movistar Team': 'Movistar Team',
    'Uno-X Mobility': 'Uno-X Mobility',
    'Soudal Quick-Step': 'Soudal Quick-Step',
    'Lotto Intermarché': 'Lotto Intermarché',
    'TotalEnergies': 'TotalEnergies',
    'Cofidis': 'Cofidis',
    'Netcompany INEOS': 'Netcompany INEOS',
    'Team Jayco AlUla': 'Team Jayco AlUla',
    'Team Picnic PostNL': 'Team Picnic PostNL',
    'Tudor Pro Cycling Team': 'Tudor Pro Cycling Team',
    'XDS Astana Team': 'XDS Astana Team',
    'NSN Cycling Team': 'NSN Cycling Team',
    'Pinarello Q36.5 Pro Cycling Team': 'Pinarello Q36.5 Pro Cycling Team',
    'Team Visma | Lease a Bike': 'Team Visma | Lease a Bike',
  };
  
  // Try mapped name first
  const mappedName = MEN_TEAM_MAP[name];
  if (mappedName) {
    let [r] = await conn.query('SELECT id, team_name FROM teams WHERE team_name=? LIMIT 1', [mappedName]);
    if (r.length) return { id: r[0].id, name: r[0].team_name };
  }
  
  // Try exact PCS name
  let [r] = await conn.query('SELECT id, team_name FROM teams WHERE team_name=? LIMIT 1', [name]);
  if (r.length) return { id: r[0].id, name: r[0].team_name };
  
  // Try with pipe → dash
  if (name.includes('|')) {
    const alt = name.replace(/\s*\|\s*/g, ' - ');
    [r] = await conn.query('SELECT id, team_name FROM teams WHERE team_name=? LIMIT 1', [alt]);
    if (r.length) return { id: r[0].id, name: r[0].team_name };
  }
  
  // Try dash → no spaces
  const noDashSpaces = name.replace(/\s*-\s*/g, '-');
  if (noDashSpaces !== name) {
    [r] = await conn.query('SELECT id, team_name FROM teams WHERE team_name=? LIMIT 1', [noDashSpaces]);
    if (r.length) return { id: r[0].id, name: r[0].team_name };
  }
  
  // Try LIKE with first 2 keywords
  const key = name.split(/[\s|-]+/).slice(0, 2).join(' ');
  [r] = await conn.query('SELECT id, team_name FROM teams WHERE team_name LIKE ? AND team_name NOT LIKE ? LIMIT 1', [`%${key}%`, '%(WTW)%']);
  if (r.length) return { id: r[0].id, name: r[0].team_name };
  
  return null;
}

function computeStageGaps(results) {
  // PCS time format: rank 1 = absolute time (e.g. "4:10:45" = H:MM:SS)
  // Subsequent non-s.t. values = gaps from winner (e.g. "2:27" = +2:27)
  const gaps = [];
  let currentGapSec = 0;
  let isFirstTime = true;
  
  for (const r of results) {
    if (r.stage_time && r.stage_time !== 's.t.') {
      if (isFirstTime) {
        // First non-s.t. = winner's absolute time → gap 0
        currentGapSec = 0;
        isFirstTime = false;
      } else {
        // Subsequent non-s.t. values are gaps from winner in M:SS or H:MM:SS
        currentGapSec = timeToSeconds(r.stage_time);
      }
    }
    // s.t. = same gap as previous group
    
    const h = Math.floor(currentGapSec / 3600);
    const m = Math.floor((currentGapSec % 3600) / 60);
    const s = currentGapSec % 60;
    let gapStr;
    if (currentGapSec === 0) {
      gapStr = '+0:00';
    } else if (h > 0) {
      gapStr = `+${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } else {
      gapStr = `+${m}:${String(s).padStart(2,'0')}`;
    }
    
    gaps.push({ rank: r.rank, gap: gapStr, isSameTime: currentGapSec === 0 });
  }
  return gaps;
}

function timeToSeconds(t) {
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// ==================== Import Logic ====================

async function importToDB(conn, dbName) {
  const { v4: uuidv4 } = require('uuid');
  
  // Get stage ID
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  if (!race.length) throw new Error('Race not found');
  const raceId = race[0].id;
  
  const [stages] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [raceId, STAGE_NUM]);
  if (!stages.length) throw new Error('Stage not found');
  const stageId = stages[0].id;
  
  console.log(`[${dbName}] Stage ID: ${stageId}, Stage ${STAGE_NUM}`);
  
  // Clear previous data
  await conn.query('DELETE FROM stage_results WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM points_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM mountains_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM youth_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM jerseys WHERE stage_id=?', [stageId]);
  
  // ===== 1. Stage Results =====
  // Check DELETE actually worked
  const [checkDel] = await conn.query('SELECT COUNT(*) as c FROM stage_results WHERE stage_id=?', [stageId]);
  console.log(`[${dbName}] After DELETE, stage_results count: ${checkDel[0].c}`);
  
  const stageGaps = computeStageGaps(data.results);
  let imported = 0, skipped = 0;
  const riderTeamMap = {}; // rider_id → {team_id, nationality}
  const seenRiders = new Set(); // dedup within stage
  
  for (let i = 0; i < data.results.length; i++) {
    const r = data.results[i];
    const gapInfo = stageGaps.find(g => g.rank === r.rank);
    if (!gapInfo) { skipped++; continue; }
    
    const rider = await findRider(conn, r.rider);
    if (!rider) { skipped++; continue; }
    
    // Dedup: skip if rider already imported for this stage
    if (seenRiders.has(rider.id)) { skipped++; continue; }
    seenRiders.add(rider.id);
    
    const team = await findTeam(conn, r.team);
    if (!team) { skipped++; continue; }
    
    try {
      await conn.query(
        'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), stageId, parseInt(r.rank), rider.id, team.id, r.nationality || 'UNK', gapInfo.gap, gapInfo.isSameTime ? 1 : 0]
      );
      riderTeamMap[rider.id] = { team_id: team.id, nationality: r.nationality || 'UNK' };
      imported++;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`[${dbName}]   DUP: #${r.rank} ${r.rider} (${rider.name})`);
        skipped++;
      } else {
        throw e;
      }
    }
  }
  console.log(`[${dbName}] Stage results: ${imported} imported, ${skipped} skipped`);
  
  // ===== 2. GC =====
  let gcImported = 0, gcSkipped = 0;
  const gcSeen = new Set();
  for (const g of data.gc) {
    const rider = await findRider(conn, g.rider);
    if (!rider) { gcSkipped++; continue; }
    
    if (gcSeen.has(rider.id)) { gcSkipped++; continue; }
    gcSeen.add(rider.id);
    
    const team = await findTeam(conn, g.team);
    if (!team) { gcSkipped++; continue; }
    
    await conn.query(
      'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), stageId, parseInt(g.rank), rider.id, team.id, g.nationality || 'UNK', g.total_time || null, g.time_gap || '+0:00']
    );
    gcImported++;
  }
  console.log(`[${dbName}] GC: ${gcImported} imported, ${gcSkipped} skipped`);
  
  // ===== 3. Points =====
  let ptsImported = 0, ptsSkipped = 0;
  const ptsSeen = new Set();
  for (const p of data.points) {
    const rider = await findRider(conn, p.rider);
    if (!rider) { ptsSkipped++; continue; }
    
    if (ptsSeen.has(rider.id)) { ptsSkipped++; continue; }
    ptsSeen.add(rider.id);
    
    await conn.query(
      'INSERT INTO points_classification (stage_id, rider_id, `rank`, points) VALUES (?,?,?,?)',
      [stageId, rider.id, parseInt(p.rank), parseInt(p.points) || 0]
    );
    ptsImported++;
  }
  console.log(`[${dbName}] Points: ${ptsImported} imported, ${ptsSkipped} skipped`);
  
  // ===== 4. KOM =====
  let komImported = 0, komSkipped = 0;
  const komSeen = new Set();
  for (const k of data.kom) {
    const rider = await findRider(conn, k.rider);
    if (!rider) { komSkipped++; continue; }
    
    if (komSeen.has(rider.id)) { komSkipped++; continue; }
    komSeen.add(rider.id);
    
    await conn.query(
      'INSERT INTO mountains_classification (stage_id, rider_id, `rank`, points) VALUES (?,?,?,?)',
      [stageId, rider.id, parseInt(k.rank), parseInt(k.points) || 0]
    );
    komImported++;
  }
  console.log(`[${dbName}] KOM: ${komImported} imported, ${komSkipped} skipped`);
  
  // ===== 5. Youth =====
  let youthImported = 0, youthSkipped = 0;
  const youthSeen = new Set();
  for (const y of data.youth) {
    const rider = await findRider(conn, y.rider);
    if (!rider) { youthSkipped++; continue; }
    
    if (youthSeen.has(rider.id)) { youthSkipped++; continue; }
    youthSeen.add(rider.id);
    
    await conn.query(
      'INSERT INTO youth_classification (stage_id, rider_id, `rank`, time, time_gap) VALUES (?,?,?,?,?)',
      [stageId, rider.id, parseInt(y.rank), y.total_time || null, y.time_gap || '+0:00']
    );
    youthImported++;
  }
  console.log(`[${dbName}] Youth: ${youthImported} imported, ${youthSkipped} skipped`);
  
  // ===== 6. Jerseys =====
  // Hardcode based on actual data (Python PCS jersey extraction unreliable for colors)
  // After Stage 4: Yellow=Træen (GC#1), Green=Pedersen (Points#1), PolkaDot=Baudin (KOM#1), White=Vacek (Youth#1)
  const jerseys = [
    { type: 'YELLOW', rider: 'Træen Torstein', team: 'Uno-X Mobility' },
    { type: 'GREEN', rider: 'Pedersen Mads', team: 'Lidl - Trek' },
    { type: 'POLKA_DOT', rider: 'Baudin Alex', team: 'EF Education - EasyPost' },
    { type: 'WHITE', rider: 'Vacek Mathias', team: 'Lidl - Trek' },
  ];
  
  let jImported = 0;
  for (const j of jerseys) {
    const rider = await findRider(conn, j.rider);
    if (!rider) { console.log(`[${dbName}]   ${j.type}: rider not found - ${j.rider}`); continue; }
    
    const team = await findTeam(conn, j.team);
    if (!team) { console.log(`[${dbName}]   ${j.type}: team not found - ${j.team}`); continue; }
    
    try {
      await conn.query(
        'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, j.type, rider.id, team.id]
      );
      jImported++;
      console.log(`[${dbName}]   ${j.type}: ${j.rider}`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`[${dbName}]   ${j.type}: ${j.rider} (already exists)`);
      } else {
        console.log(`[${dbName}]   ${j.type}: ERROR - ${e.message}`);
      }
    }
  }
  console.log(`[${dbName}] Jerseys: ${jImported} imported`);
  
  return { stageId, imported, gcImported, ptsImported, komImported, youthImported, jImported };
}

async function verify(conn, name) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s4] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, STAGE_NUM]);
  const stageId = s4[0].id;
  
  const [sr] = await conn.query('SELECT COUNT(*) as c FROM stage_results WHERE stage_id=?', [stageId]);
  const [gc] = await conn.query('SELECT COUNT(*) as c FROM general_classification WHERE stage_id=?', [stageId]);
  const [pts] = await conn.query('SELECT COUNT(*) as c FROM points_classification WHERE stage_id=?', [stageId]);
  const [kom] = await conn.query('SELECT COUNT(*) as c FROM mountains_classification WHERE stage_id=?', [stageId]);
  const [yth] = await conn.query('SELECT COUNT(*) as c FROM youth_classification WHERE stage_id=?', [stageId]);
  const [j] = await conn.query('SELECT COUNT(*) as c FROM jerseys WHERE stage_id=?', [stageId]);
  
  console.log(`[${name}] SR:${sr[0].c} GC:${gc[0].c} PTS:${pts[0].c} KOM:${kom[0].c} YTH:${yth[0].c} J:${j[0].c}`);
}

// ==================== Main ====================

async function main() {
  console.log(`TDF 2026 Stage 4 Import`);
  console.log(`Data: ${data.results.length} stage, ${data.gc.length} GC, ${data.points.length} Pts, ${data.kom.length} KOM, ${data.youth.length} Youth, ${data.jersey_holders.length} Jerseys\n`);
  
  // Import to local
  console.log('--- LOCAL ---');
  const l = await mysql.createConnection(LOCAL);
  const localResult = await importToDB(l, 'LOCAL');
  await l.end();
  
  // Import to production
  console.log('\n--- PRODUCTION ---');
  const p = await mysql.createConnection(PROD);
  const prodResult = await importToDB(p, 'PROD');
  await p.end();
  
  // Verify
  console.log('\n--- VERIFY ---');
  const l2 = await mysql.createConnection(LOCAL);
  const p2 = await mysql.createConnection(PROD);
  await verify(l2, 'LOCAL');
  await verify(p2, 'PROD');
  await l2.end();
  await p2.end();
  
  console.log('\n✅ Done');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
