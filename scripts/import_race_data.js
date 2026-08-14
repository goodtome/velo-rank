/**
 * General-purpose race data importer for velo-rank.
 * Imports stage results + classifications from JSON data files produced by
 * fetch_race_data.py into LOCAL and/or PROD databases.
 *
 * Usage:
 *   node scripts/import_race_data.js <race-code> [--local] [--prod] [--stages-only]
 *
 * Expects files in temp/:
 *   <race-code>_s<N>_results.json  (stage results)
 *   <race-code>_s<N>_data.json     (classifications: gc/points/kom/youth/team)
 *
 * Stage numbers can be integers or strings like '1a', '1b'.
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 15000
};

const TEMP_DIR = path.join(__dirname, '..', 'temp');

// PCS -> DB team name mapping (men's WT teams)
// Explicit PCS/foreign name -> DB rider name overrides (avoids same-surname
// mis-matching, e.g. 'Yang Zhibin' vs 'Cang Yang')
const RIDER_NAME_MAP = {
  'Yang Zhibin': 'Zhibin Yang',
};

const TEAM_MAP = {
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
  'Poland': 'POLISH NATIONAL TEAM',
  'United States': 'UNITED STATES NATIONAL TEAM',
};

const normTokens = (s) => {
  const n = (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return new Set(n.split(/[^a-z0-9]+/).filter(Boolean));
};
const keyOf = (s) => [...normTokens(s)].sort().join('|');

async function buildRiderIndex(conn) {
  const [rows] = await conn.query('SELECT id, rider_name FROM riders');
  const byKey = new Map(), byExact = new Map();
  for (const r of rows) {
    byExact.set(r.rider_name, r.id);
    const k = keyOf(r.rider_name);
    if (!byKey.has(k)) byKey.set(k, r.id);
  }
  return { byKey, byExact };
}

async function findRider(conn, idx, name) {
  if (!name) return null;
  name = RIDER_NAME_MAP[name] || name;
  if (idx.byExact.has(name)) return idx.byExact.get(name);
  const k = keyOf(name);
  if (idx.byKey.has(k)) return idx.byKey.get(k);
  // surname fallback: PCS-style names are 'SURNAME Given'. Try, in order:
  //  1. last real token (skip initials like 'J.')
  //  2. first AND last token together (avoids matching a same-surname other rider)
  //  3. first token (all-caps PCS style)
  const tokens = name.split(/[\s]+/);
  const first = tokens.length && tokens[0].length >= 3 ? tokens[0] : null;
  let last = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].length >= 3) { last = tokens[i]; break; }
  }
  if (last) {
    // Prefer surname-ending match ('Forbes James' should not hit 'Felix James Meo')
    const [r] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`% ${last}`]);
    if (r.length) return r[0].id;
    const [r2] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${last}%`]);
    if (r2.length) return r2[0].id;
  }
  if (first && last && first !== last) {
    const [r] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? AND rider_name LIKE ? LIMIT 1', [`%${first}%`, `%${last}%`]);
    if (r.length) return r[0].id;
  }
  if (first && first !== last) {
    const [r] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${first}%`]);
    if (r.length) return r[0].id;
  }
  return null;
}

async function buildTeamIndex(conn) {
  const [rows] = await conn.query('SELECT id, team_name FROM teams');
  const byKey = new Map(), byExact = new Map();
  for (const r of rows) {
    byExact.set(r.team_name, r.id);
    const k = keyOf(r.team_name);
    if (!byKey.has(k)) byKey.set(k, r.id);
  }
  return { byKey, byExact };
}

async function findTeam(conn, idx, name) {
  if (!name) return null;
  if (TEAM_MAP[name] && idx.byExact.has(TEAM_MAP[name])) return idx.byExact.get(TEAM_MAP[name]);
  if (idx.byExact.has(name)) return idx.byExact.get(name);
  const k = keyOf(name);
  if (idx.byKey.has(k)) return idx.byKey.get(k);
  if (name.includes('|')) {
    const alt = name.replace(/\s*\|\s*/g, ' - ');
    if (idx.byExact.has(alt)) return idx.byExact.get(alt);
  }
  const key = name.split(/[\s|-]+/).slice(0, 2).join(' ');
  const [r] = await conn.query('SELECT id FROM teams WHERE team_name LIKE ? AND team_name NOT LIKE ? LIMIT 1', [`%${key}%`, '%(WTW)%']);
  return r.length ? r[0].id : null;
}

function timeToSeconds(t) {
  if (!t || t === 's.t.') return 0;
  const parts = String(t).split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function computeStageGaps(results) {
  const gaps = [];
  let currentGapSec = 0, isFirst = true;
  for (const r of results) {
    if (r.stage_time && r.stage_time !== 's.t.') {
      if (isFirst) { currentGapSec = 0; isFirst = false; }
      else currentGapSec = timeToSeconds(r.stage_time);
    }
    const h = Math.floor(currentGapSec / 3600), m = Math.floor((currentGapSec % 3600) / 60), s = currentGapSec % 60;
    let gapStr;
    if (currentGapSec === 0) gapStr = '+0:00';
    else if (h > 0) gapStr = `+${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    else gapStr = `+${m}:${String(s).padStart(2,'0')}`;
    gaps.push({ rank: r.rank, gap: gapStr, isSameTime: currentGapSec === 0 });
  }
  return gaps;
}

// Discover stage files for a race
function discoverStages(raceCode) {
  const files = fs.readdirSync(TEMP_DIR);
  const stages = [];
  const re = new RegExp(`^${raceCode}_s(.+?)_(results|data)\\.json$`);
  const stageSet = new Set();
  for (const f of files) {
    const m = f.match(re);
    if (m) stageSet.add(m[1]);
  }
  // Sort: numeric first, then alphanumeric
  return [...stageSet].sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

async function ensureStage(conn, raceId, stageSlug, stageNumber, raceCode) {
  // Check if stage exists
  const [existing] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [raceId, stageNumber]);
  if (existing.length) return existing[0].id;
  // Get race start_date to compute stage date
  const [race] = await conn.query('SELECT start_date FROM races WHERE id=?', [raceId]);
  const startDate = race.length ? new Date(race[0].start_date) : new Date();
  const stageDate = new Date(startDate);
  stageDate.setDate(stageDate.getDate() + stageNumber - 1);
  const dateStr = stageDate.toISOString().slice(0, 10);
  // Create stage
  const id = uuidv4();
  const stageCode = `${raceCode}-s${String(stageNumber).padStart(2, '0')}`;
  await conn.query(
    'INSERT INTO stages (id, race_id, stage_number, stage_name, stage_code, `date`) VALUES (?,?,?,?,?,?)',
    [id, raceId, stageNumber, `Stage ${stageSlug}`, stageCode, dateStr]
  );
  console.log(`  Created stage ${stageSlug} (number=${stageNumber}, date=${dateStr})`);
  return id;
}

async function importStageResults(conn, dbName, stageId, resultsFile, riderIdx, teamIdx) {
  const data = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, resultsFile), 'utf-8'));
  await conn.query('DELETE FROM stage_results WHERE stage_id=?', [stageId]);
  const gaps = computeStageGaps(data.results);
  const rows = [];
  const seen = new Set();
  let skipped = 0;
  for (const r of data.results) {
    const gi = gaps.find(g => g.rank === r.rank);
    if (!gi) { skipped++; continue; }
    const riderId = await findRider(conn, riderIdx, r.rider);
    if (!riderId) { skipped++; continue; }
    if (seen.has(riderId)) { skipped++; continue; }
    seen.add(riderId);
    const teamId = await findTeam(conn, teamIdx, r.team);
    if (!teamId) { skipped++; continue; }
    rows.push([uuidv4(), stageId, r.rank, riderId, teamId, r.nationality || 'UNK', gi.gap, gi.isSameTime ? 1 : 0]);
  }
  if (rows.length) {
    await conn.query(
      'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES ?',
      [rows]
    );
  }
  console.log(`  [${dbName}] stage_results: ${rows.length} imported, ${skipped} skipped`);
}

async function importClassifications(conn, dbName, stageId, dataFile, riderIdx, teamIdx) {
  const data = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, dataFile), 'utf-8'));

  // GC
  if (data.gc && data.gc.length) {
    await conn.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    const seenGc = new Set();
    for (const g of data.gc) {
      const riderId = await findRider(conn, riderIdx, g.rider);
      if (!riderId) { skip++; continue; }
      if (seenGc.has(riderId)) { skip++; continue; }
      seenGc.add(riderId);
      const teamId = await findTeam(conn, teamIdx, g.team);
      if (!teamId) { skip++; continue; }
      await conn.query(
        'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), stageId, parseInt(g.rank), riderId, teamId, g.nationality || 'UNK', g.total_time || null, g.time_gap || '+0:00']
      );
      n++;
    }
    console.log(`  [${dbName}] gc: ${n} inserted, ${skip} skipped`);
  }

  // Points
  if (data.points && data.points.length) {
    await conn.query('DELETE FROM points_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    const seenPts = new Set();
    for (const p of data.points) {
      const riderId = await findRider(conn, riderIdx, p.rider);
      if (!riderId) { skip++; continue; }
      if (seenPts.has(riderId)) { skip++; continue; }
      seenPts.add(riderId);
      await conn.query(
        'INSERT INTO points_classification (stage_id, rider_id, `rank`, points, jersey_type, is_active) VALUES (?,?,?,?,?,1)',
        [stageId, riderId, parseInt(p.rank), parseInt(p.points) || 0, 'green']
      );
      n++;
    }
    console.log(`  [${dbName}] points: ${n} inserted, ${skip} skipped`);
  }

  // KOM
  if (data.kom && data.kom.length) {
    await conn.query('DELETE FROM mountains_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    const seenKom = new Set();
    for (const k of data.kom) {
      const riderId = await findRider(conn, riderIdx, k.rider);
      if (!riderId) { skip++; continue; }
      if (seenKom.has(riderId)) { skip++; continue; }
      seenKom.add(riderId);
      await conn.query(
        'INSERT INTO mountains_classification (stage_id, rider_id, `rank`, points, jersey_type, is_active) VALUES (?,?,?,?,?,1)',
        [stageId, riderId, parseInt(k.rank), parseInt(k.points) || 0, 'polkadot']
      );
      n++;
    }
    console.log(`  [${dbName}] kom: ${n} inserted, ${skip} skipped`);
  }

  // Youth
  if (data.youth && data.youth.length) {
    await conn.query('DELETE FROM youth_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    const seenYouth = new Set();
    for (const y of data.youth) {
      const riderId = await findRider(conn, riderIdx, y.rider);
      if (!riderId) { skip++; continue; }
      if (seenYouth.has(riderId)) { skip++; continue; }
      seenYouth.add(riderId);
      await conn.query(
        'INSERT INTO youth_classification (stage_id, rider_id, `rank`, `time`, time_gap, jersey_type, is_active) VALUES (?,?,?,?,?,?,1)',
        [stageId, riderId, parseInt(y.rank), y.total_time || null, y.time_gap || null, 'white']
      );
      n++;
    }
    console.log(`  [${dbName}] youth: ${n} inserted, ${skip} skipped`);
  }

  // Team
  if (data.team && data.team.length) {
    await conn.query('DELETE FROM team_classification WHERE stage_id=?', [stageId]);
    let n = 0;
    const seenTeam = new Set();
    for (const t of data.team) {
      const teamId = await findTeam(conn, teamIdx, t.team);
      if (!teamId) continue;
      if (seenTeam.has(teamId)) continue;
      seenTeam.add(teamId);
      await conn.query(
        'INSERT INTO team_classification (id, stage_id, `rank`, team_id, total_time, time_gap, is_active, created_at) VALUES (?,?,?,?,?,?,1,NOW())',
        [uuidv4(), stageId, parseInt(t.rank), teamId, t.total_time || null, null]
      );
      n++;
    }
    console.log(`  [${dbName}] team: ${n} inserted`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const raceCode = args.find(a => !a.startsWith('--'));
  if (!raceCode) { console.error('Usage: node import_race_data.js <race-code> [--local] [--prod]'); process.exit(1); }

  const ONLY_LOCAL = args.includes('--local');
  const ONLY_PROD = args.includes('--prod');

  // Discover stages
  const stageSlugs = discoverStages(raceCode);
  if (!stageSlugs.length) { console.error(`No data files found for ${raceCode} in temp/`); process.exit(1); }
  console.log(`Race: ${raceCode}, stages: ${stageSlugs.join(', ')}`);

  let dbs;
  if (ONLY_PROD) dbs = [[await mysql.createConnection(PROD), 'PROD']];
  else if (ONLY_LOCAL) dbs = [[await mysql.createConnection(LOCAL), 'LOCAL']];
  else dbs = [[await mysql.createConnection(PROD), 'PROD']]; // default to PROD only (local MySQL often down)

  for (const [conn, dbName] of dbs) {
    try {
      // Find race
      const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [raceCode]);
      if (!race.length) { console.error(`[${dbName}] Race ${raceCode} not found in DB`); continue; }
      const raceId = race[0].id;

      const riderIdx = await buildRiderIndex(conn);
      const teamIdx = await buildTeamIndex(conn);

      for (let i = 0; i < stageSlugs.length; i++) {
        const slug = stageSlugs[i];
        const stageNumber = i + 1; // sequential numbering
        console.log(`\n[${dbName}] Stage ${slug} (number=${stageNumber})`);

        const stageId = await ensureStage(conn, raceId, slug, stageNumber, raceCode);

        const resultsFile = `${raceCode}_s${slug}_results.json`;
        const dataFile = `${raceCode}_s${slug}_data.json`;

        if (fs.existsSync(path.join(TEMP_DIR, resultsFile))) {
          await importStageResults(conn, dbName, stageId, resultsFile, riderIdx, teamIdx);
        }
        if (fs.existsSync(path.join(TEMP_DIR, dataFile))) {
          await importClassifications(conn, dbName, stageId, dataFile, riderIdx, teamIdx);
        }
      }
      await conn.end();
    } catch (e) {
      console.error(`[${dbName}] ERROR: ${e.message}`);
    }
  }
  console.log('\n✅ Done.');
}

process.on('unhandledRejection', (e) => { console.error('UNHANDLED:', e && e.message ? e.message : e); });
process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e && e.message ? e.message : e); });
run().catch(e => { console.error('FATAL', e); process.exit(1); });
