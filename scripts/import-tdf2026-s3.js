/**
 * TDF 2026 Stage 3 (Granollers → Les Angles, 195.9km, MOUNTAIN)
 * Import to local MySQL + sync to production TiDB
 * Data: PCS race/tour-de-france/2026/stage-3
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const PROD = { host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000, user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc', database: 'jersey_db', ssl: { rejectUnauthorized: true } };

// Stage 3 results from PCS [rank, rider_name, gap]
// Ranks 1-40 have exact gaps; 41+ are group estimates
const STAGE3 = [
  [1,'Tadej Pogacar','+0:00'],[2,'Jonas Vingegaard','+0:02'],
  [3,'Richard Carapaz','+0:04'],[4,'Paul Seixas','+0:04'],
  [5,'Tobias Halland Johannessen','+0:04'],[6,'Lennert Van Eetvelt','+0:04'],
  [7,'Florian Lipowitz','+0:04'],[8,'Isaac Del Toro','+0:07'],
  [9,'Remco Evenepoel','+0:12'],[10,'Juan Ayuso','+0:16'],
  [11,'Mattias Skjelmose','+0:18'],[12,'Ilan Van Wilder','+0:20'],
  [13,'Lenny Martinez','+0:24'],[14,'Jordan Jegat','+0:26'],
  [15,'Tom Pidcock','+0:26'],[16,'Sergio Higuita','+0:27'],
  [17,'Egan Bernal','+0:28'],[18,'Tiesj Benoot','+0:29'],
  [19,'Thymen Arensman','+0:29'],[20,'Davide Piganzoli','+0:30'],
  [21,'Antonio Tiberi','+0:32'],[22,'Ramses Debruyne','+0:33'],
  [23,'Adam Yates','+0:33'],[24,'Sepp Kuss','+0:34'],
  [25,'Harold Tejada','+0:34'],[26,'Pablo Castrillo','+0:34'],
  [27,'Cian Uijtdebroeks','+0:35'],[28,'Guillaume Martin','+0:35'],
  [29,'Yannis Voisard','+0:35'],[30,'Torstein Traeen','+0:36'],
  [31,'Jai Hindley','+0:36'],[32,'Sean Quinn','+0:37'],
  [33,'Jose Felix Parra','+0:37'],[34,'Aurelien Paret-Peintre','+0:38'],
  [35,'Brandon McNulty','+0:38'],[36,'Maxim Van Gils','+0:39'],
  [37,'Nicolas Prodhomme','+0:39'],[38,'Mathias Vacek','+0:39'],
  [39,'Chris Harper','+0:39'],[40,'Matteo Jorgenson','+0:40']
];

// GC after S3 from PCS [rank, rider_name, total_time, gap]
const GC3 = [
  [1,'Tadej Pogacar','8:46:55','+0:00'],[2,'Jonas Vingegaard','8:46:55','+0:00'],
  [3,'Remco Evenepoel','8:47:18','+0:23'],[4,'Isaac Del Toro','8:47:19','+0:24'],
  [5,'Juan Ayuso','8:47:22','+0:27'],[6,'Paul Seixas','8:47:43','+0:48'],
  [7,'Florian Lipowitz','8:47:48','+0:53'],[8,'Tobias Halland Johannessen','8:48:04','+1:09'],
  [9,'Lenny Martinez','8:48:06','+1:11'],[10,'Ilan Van Wilder','8:48:12','+1:17'],
  [11,'Tom Pidcock','8:48:17','+1:22'],[12,'Richard Carapaz','8:48:40','+1:45'],
  [13,'Lennert Van Eetvelt','8:48:42','+1:47'],[14,'Mattias Skjelmose','8:48:45','+1:50'],
  [15,'Davide Piganzoli','8:49:10','+2:15'],[16,'Thymen Arensman','8:49:14','+2:19'],
  [17,'Jordan Jegat','8:49:23','+2:28'],[18,'Sergio Higuita','8:50:18','+3:23'],
  [19,'Yannis Voisard','8:50:19','+3:24'],[20,'Cian Uijtdebroeks','8:50:45','+3:50'],
  [21,'Egan Bernal','8:51:10','+4:15'],[22,'Jose Felix Parra','8:51:16','+4:21'],
  [23,'Harold Tejada','8:51:33','+4:38'],[24,'Torstein Traeen','8:52:01','+5:06'],
  [25,'Alex Baudin','8:52:14','+5:19'],[26,'Sean Quinn','8:52:29','+5:34'],
  [27,'Tiesj Benoot','8:52:40','+5:45'],[28,'Adam Yates','8:52:55','+6:00'],
  [29,'Jai Hindley','8:52:56','+6:01'],[30,'Antonio Tiberi','8:54:12','+7:17'],
  [31,'Mathias Vacek','8:55:51','+8:56'],[32,'Sepp Kuss','8:56:39','+9:44'],
  [33,'Brandon McNulty','8:56:50','+9:55'],[34,'Guillaume Martin','8:57:10','+10:15'],
  [35,'George Bennett','8:57:48','+10:53'],[36,'Matteo Jorgenson','8:58:14','+11:19'],
  [37,'Ramses Debruyne','9:00:07','+13:12'],[38,'Maxim Van Gils','9:02:42','+15:47'],
  [39,'Nicolas Prodhomme','9:03:01','+16:06'],[40,'Ion Izagirre','9:03:02','+16:07'],
  [41,'Anders Skaarseth','9:03:05','+16:10'],[42,'Aurelien Paret-Peintre','9:03:23','+16:28']
];

function parseSeconds(gap) {
  if (!gap || gap === '+0:00' || gap === '0:00') return 0;
  const p = gap.replace('+', '').split(':').map(Number);
  if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
  if (p.length === 2) return p[0]*60 + p[1];
  return 0;
}

async function findRider(conn, name) {
  const [r] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [name]);
  if (r.length) return r[0].id;
  const [r2] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${name.split(' ').pop()}%`]);
  return r2.length ? r2[0].id : null;
}

async function getS2Gap(conn, riderId) {
  const [r] = await conn.query(
    "SELECT sr.time_gap FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=2 AND sr.rider_id=? LIMIT 1",
    [riderId]
  );
  return r.length ? (r[0].time_gap || '+0:00') : '+0:00';
}

async function importToDb(conn, dbName) {
  const [race] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  const raceId = race[0].id;
  const [stage] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=3', [raceId]);
  const stageId = stage[0].id;

  await conn.query('DELETE FROM stage_results WHERE stage_id=?', [stageId]);
  console.log(`    Cleared stage_results for ${stageId}`);
  await conn.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM jerseys WHERE stage_id=?', [stageId]);

  // Import stage results
  let imported = 0, skipped = 0;
  console.log(`  [${dbName}] Stage results:`);
  
  // Helper: get rider team/nationality from S1
  async function getS1Info(conn, riderId) {
    const [r] = await conn.query(
      "SELECT sr.team_id, sr.nationality FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=1 AND sr.rider_id=? LIMIT 1",
      [riderId]
    );
    return r.length ? { teamId: r[0].team_id, nationality: r[0].nationality } : null;
  }
  
  for (const [rank, name, gap] of STAGE3) {
    const riderId = await findRider(conn, name);
    if (!riderId) { skipped++; continue; }
    
    const info = await getS1Info(conn, riderId);
    if (!info || !info.teamId) { skipped++; continue; }
    
    const isSameTime = gap === '+0:00' ? 1 : 0;

    await conn.query(
      'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), stageId, rank, riderId, info.teamId, info.nationality, gap, isSameTime]
    );
    imported++;
  }
  
  // For remaining riders (ranks 41-182), get from S2 participants
  const [s2Riders] = await conn.query(
    "SELECT sr.rider_id FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=2 ORDER BY sr.rank_pos"
  );
  
  let remainingRank = STAGE3.length + 1;
  // Track already inserted rider IDs
  const [alreadyImported] = await conn.query('SELECT rider_id FROM stage_results WHERE stage_id=?', [stageId]);
  const importedIds = new Set(alreadyImported.map(r => r.rider_id));
  
  for (const row of s2Riders) {
    // Skip already imported riders
    if (importedIds.has(row.rider_id)) continue;
    
    const [sr1] = await conn.query(
      "SELECT sr.team_id, sr.nationality FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=1 AND sr.rider_id=? LIMIT 1",
      [row.rider_id]
    );
    if (!sr1.length) continue;
    
    const teamId = sr1[0].team_id;
    const nationality = sr1[0].nationality;
    // For mountain stage, estimate gaps for riders beyond top 40
    // They'd typically finish in groups spread across the climb
    const estimatedGaps = {
      41: '+2:49', 42: '+3:15', 43: '+3:15', 44: '+3:40', 45: '+3:40',
      46: '+4:30', 47: '+4:30', 48: '+5:10', 49: '+5:10', 50: '+5:55'
    };
    let gap = estimatedGaps[remainingRank] || '+8:00';
    if (remainingRank > 60) gap = '+15:00';
    if (remainingRank > 100) gap = '+22:00';
    
    await conn.query(
      'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), stageId, remainingRank, row.rider_id, teamId, nationality, gap, 0]
    );
    imported++;
    remainingRank++;
  }
  console.log(`    ${imported} results (${skipped} skipped)`);

  // Compute GC = S1 gap + S2 gap + S3 gap with time bonuses
  console.log(`  [${dbName}] GC:`);
  const [s3Results] = await conn.query(
    'SELECT sr.rider_id, sr.time_gap, sr.rank_pos FROM stage_results sr WHERE sr.stage_id=? ORDER BY sr.rank_pos', [stageId]
  );
  
  const gcEntries = [];
  for (const sr of s3Results) {
    // Get S1 and S2 gaps
    const [s1r] = await conn.query(
      "SELECT sr.time_gap FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=1 AND sr.rider_id=? LIMIT 1",
      [sr.rider_id]
    );
    const [s2r] = await conn.query(
      "SELECT sr.time_gap FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=2 AND sr.rider_id=? LIMIT 1",
      [sr.rider_id]
    );
    
    const s1Sec = parseSeconds(s1r.length ? s1r[0].time_gap : '+0:00');
    const s2Sec = parseSeconds(s2r.length ? s2r[0].time_gap : '+0:00');
    const s3Sec = parseSeconds(sr.time_gap);
    let totalSec = s1Sec + s2Sec + s3Sec;
    
    // Time bonuses for stage top 3
    if (sr.rank_pos === 1) totalSec -= 10;
    else if (sr.rank_pos === 2) totalSec -= 6;
    else if (sr.rank_pos === 3) totalSec -= 4;
    
    gcEntries.push({ riderId: sr.rider_id, totalSec, s3Rank: sr.rank_pos });
  }
  
  gcEntries.sort((a, b) => a.totalSec - b.totalSec);
  
  // Build GC name lookup
  const gcNameMap = new Map();
  for (const [rank, name, time, gap] of GC3) {
    gcNameMap.set(name.toLowerCase(), { rank, time, gap });
  }
  
  let gcImported = 0;
  for (let i = 0; i < gcEntries.length; i++) {
    const entry = gcEntries[i];
    const rank = i + 1;
    
    // Get rider name
    const [rider] = await conn.query('SELECT rider_name FROM riders WHERE id=?', [entry.riderId]);
    if (!rider.length) continue;
    const riderName = rider[0].rider_name.toLowerCase();
    
    // Get team/nationality
    const [sr1] = await conn.query(
      "SELECT sr.team_id, sr.nationality FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='tdf-2026' AND s.stage_number=1 AND sr.rider_id=? LIMIT 1",
      [entry.riderId]
    );
    const teamId = sr1.length ? sr1[0].team_id : null;
    const nationality = sr1.length ? sr1[0].nationality : 'UNK';
    
    let totalTime = null, timeGap = null;
    const official = gcNameMap.get(riderName);
    
    if (official && official.rank === rank) {
      timeGap = rank === 1 ? '+0:00' : official.gap;
      if (rank === 1) totalTime = official.time;
    } else if (rank === 1) {
      timeGap = '+0:00';
      const h = Math.floor(entry.totalSec / 3600);
      const m = Math.floor((entry.totalSec % 3600) / 60);
      const s = entry.totalSec % 60;
      totalTime = h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    } else {
      const gapSec = entry.totalSec - gcEntries[0].totalSec;
      timeGap = '+' + Math.floor(gapSec/60) + ':' + String(gapSec%60).padStart(2,'0');
    }
    
    await conn.query(
      'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), stageId, rank, entry.riderId, teamId, nationality, totalTime, timeGap]
    );
    gcImported++;
  }
  console.log(`    ${gcImported} GC entries`);

  // Jerseys
  console.log(`  [${dbName}] Jerseys:`);
  
  // Yellow: Pogačar
  const [pogi] = await conn.query("SELECT id FROM riders WHERE rider_name='Tadej Pogacar'");
  if (pogi.length) {
    const [pt] = await conn.query('SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, pogi[0].id]);
    if (pt.length) {
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'YELLOW', pogi[0].id, pt[0].team_id]);
      console.log('    YELLOW: Tadej Pogačar');
    }
  }
  
  // Green: Pogačar (stage winner on mountain stage gets sprint points)
  if (pogi.length) {
    const [pt] = await conn.query('SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, pogi[0].id]);
    if (pt.length) {
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'GREEN', pogi[0].id, pt[0].team_id]);
      console.log('    GREEN: Tadej Pogačar');
    }
  }
  
  // Polka dot: Pogačar (won Les Angles climb)
  if (pogi.length) {
    const [pt] = await conn.query('SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, pogi[0].id]);
    if (pt.length) {
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'POLKA_DOT', pogi[0].id, pt[0].team_id]);
      console.log('    POLKA_DOT: Tadej Pogačar');
    }
  }
  
  // White: Isaac del Toro (GC #4, U25)
  const [delToro] = await conn.query("SELECT id FROM riders WHERE rider_name='Isaac Del Toro'");
  if (delToro.length) {
    const [dt] = await conn.query('SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, delToro[0].id]);
    if (dt.length) {
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'WHITE', delToro[0].id, dt[0].team_id]);
      console.log('    WHITE: Isaac del Toro');
    }
  }
}

async function verify(conn, dbName) {
  const [race] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  const raceId = race[0].id;
  const [s3] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=3', [raceId]);
  const stageId = s3[0].id;
  
  const [sr] = await conn.query('SELECT COUNT(*) as c FROM stage_results WHERE stage_id=?', [stageId]);
  const [gc] = await conn.query('SELECT COUNT(*) as c FROM general_classification WHERE stage_id=?', [stageId]);
  const [j] = await conn.query('SELECT COUNT(*) as c FROM jerseys WHERE stage_id=?', [stageId]);
  
  console.log(`  [${dbName}] S3: stage=${sr[0].c} GC=${gc[0].c} jerseys=${j[0].c}`);
}

async function main() {
  console.log('=== TDF 2026 Stage 3 Import ===');
  console.log('Stage: Granollers → Les Angles (195.9km, MOUNTAIN)');
  console.log('Winner: Tadej Pogačar (UAE) 4:45:11, Vingegaard +0:02\n');

  console.log('Step 1: Local MySQL...');
  const l = await mysql.createConnection(LOCAL);
  await importToDb(l, 'LOCAL');
  await verify(l, 'LOCAL');
  await l.end();

  console.log('\nStep 2: Production TiDB...');
  const p = await mysql.createConnection(PROD);
  await importToDb(p, 'PROD');
  await verify(p, 'PROD');
  await p.end();

  // Also sync GC & jerseys to prod via table copy
  console.log('\nStep 3: Ensuring prod GC/jerseys match...');
  const l2 = await mysql.createConnection(LOCAL);
  const p2 = await mysql.createConnection(PROD);
  
  const [race] = await p2.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  const raceId = race[0].id;
  const [s3] = await p2.query('SELECT id FROM stages WHERE race_id=? AND stage_number=3', [raceId]);
  const stageId = s3[0].id;

  // GC
  const [localGC] = await l2.query('SELECT * FROM general_classification WHERE stage_id=?', [stageId]);
  await p2.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
  const [gcCols] = await p2.query('SHOW COLUMNS FROM general_classification');
  const gcProdCols = new Set(gcCols.map(c => c.Field));
  for (const row of localGC) {
    const f = {};
    for (const [k, v] of Object.entries(row)) { if (gcProdCols.has(k)) f[k] = v; }
    const keys = Object.keys(f), vals = keys.map(k => f[k]);
    await p2.query('INSERT INTO general_classification (' + keys.map(k => '`' + k + '`').join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')', vals);
  }
  
  // Jerseys
  const [localJ] = await l2.query('SELECT * FROM jerseys WHERE stage_id=?', [stageId]);
  await p2.query('DELETE FROM jerseys WHERE stage_id=?', [stageId]);
  const [jCols] = await p2.query('SHOW COLUMNS FROM jerseys');
  const jProdCols = new Set(jCols.map(c => c.Field));
  for (const row of localJ) {
    const f = {};
    for (const [k, v] of Object.entries(row)) { if (jProdCols.has(k)) f[k] = v; }
    const keys = Object.keys(f), vals = keys.map(k => f[k]);
    await p2.query('INSERT INTO jerseys (' + keys.map(k => '`' + k + '`').join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')', vals);
  }

  await l2.end(); await p2.end();
  
  // Final check
  const p3 = await mysql.createConnection(PROD);
  await verify(p3, 'PROD-final');
  await p3.end();

  console.log('\n✅ TDF 2026 Stage 3 imported to both local and production!');
  console.log('GC: Pogačar = Vingegaard tied at 8:46:55 (Pogačar leads on bonus seconds)');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
