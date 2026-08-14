/**
 * Import TDF 2026 classification data (points / KOM / youth / team) into
 * local MySQL + production TiDB.
 *
 * Source: tdf_sN_data.json produced by fetch_tdf_full.py
 * Strategy:
 *   - S1 (TTT): only team classification, DERIVED from the TTT stage_results
 *              (PCS team page is unreliable for a TTT). points/kom/youth N/A.
 *   - S2, S3  : points + kom + youth + team (all were missing).
 *   - S4       : only team (points/kom/youth already present & verified).
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
const RACE_CODE = process.env.RACE_CODE || 'tdf-2026';
const TDF_DATA_DIR = process.env.TDF_DATA_DIR
  ? path.resolve(process.env.TDF_DATA_DIR)
  : path.join(__dirname, '..', 'archive', 'generated', '2026-tdf', 'classifications');

process.on('unhandledRejection', (e) => { console.error('UNHANDLED_REJECTION:', e && e.message ? e.message : e); });
process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e && e.message ? e.message : e); });

// Official-site full/abbreviated name -> DB rider name overrides
const RIDER_NAME_MAP = {
  'Kim LE COURT DE BILLOT-PIENAAR': 'Kimberley Le Court de Billot',
  'K. LE COURT PIENAAR': 'Kim Le Court',
  'P. BLASI CAIROL': 'Paula Blasi',
  'Paula BLASI CAIROL': 'Paula Blasi',
  'P. PATIÑO BEDOYA': 'Paula Patino',
  'A. SIERRA CANADILLA': 'Arlenis Sierra',
  'M. BENITO PELLICER': 'Mireia Benito',
  'N. AMONDARAIN GAZTAÑAGA': 'Naia Amondarain',
};

// Which classifications to import per stage
const PLAN = {
  1: ['points', 'kom', 'youth', 'team'],
  2: ['points', 'kom', 'youth', 'team'],
  3: ['points', 'kom', 'youth', 'team'],
  4: ['points', 'kom', 'youth', 'team'],
  5: ['points', 'kom', 'youth', 'team'],
  6: ['points', 'kom', 'youth', 'team'],
  7: ['points', 'kom', 'youth', 'team'],
  8: ['points', 'kom', 'youth', 'team'],
  9: ['points', 'kom', 'youth', 'team'],
  10: ['points', 'kom', 'youth', 'team'],
  11: ['points', 'kom', 'youth', 'team'],
  12: ['points', 'kom', 'youth', 'team'],
  13: ['points', 'kom', 'youth', 'team'],
  14: ['points', 'kom', 'youth', 'team'],
  15: ['points', 'kom', 'youth', 'team'],
  16: ['points', 'kom', 'youth', 'team'],
  17: ['points', 'kom', 'youth', 'team'],
  18: ['points', 'kom', 'youth', 'team'],
  19: ['points', 'kom', 'youth', 'team'],
  20: ['points', 'kom', 'youth', 'team'],
  21: ['points', 'kom', 'youth', 'team'],
};

// PCS -> DB men's team name mapping
const MEN_TEAM_MAP = {
  'Lidl - Trek': 'Lidl-Trek',
  'LIDL - TREK': 'Lidl-Trek',
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
  'MAYENNE MONBANA MY PIE': 'Mayenne-Monbana-Mypie',
  'Mayenne Monbana My Pie': 'Mayenne-Monbana-Mypie',
};

const normTokens = (s) => {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(n.split(/[^a-z0-9]+/).filter(Boolean));
};

async function findTeam(conn, name) {
  const mapped = MEN_TEAM_MAP[name];
  if (mapped) {
    let [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [mapped]);
    if (r.length) return r[0].id;
  }
  let [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [name]);
  if (r.length) return r[0].id;
  if (name.includes('|')) {
    const alt = name.replace(/\s*\|\s*/g, ' - ');
    [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [alt]);
    if (r.length) return r[0].id;
  }
  const key = name.split(/[\s|-]+/).slice(0, 2).join(' ');
  [r] = await conn.query('SELECT id FROM teams WHERE team_name LIKE ? AND team_name NOT LIKE ? LIMIT 1', [`%${key}%`, '%(WTW)%']);
  return r.length ? r[0].id : null;
}

async function buildRiderMap(conn, stageId) {
  const [rows] = await conn.query(
    'SELECT rider_id, rd.rider_name FROM stage_results sr JOIN riders rd ON sr.rider_id=rd.id WHERE sr.stage_id=?',
    [stageId]
  );
  const map = new Map();
  for (const row of rows) {
    map.set([...normTokens(row.rider_name)].sort().join('|'), row.rider_id);
  }
  return map;
}

async function buildGlobalRiderIndex(conn) {
  const [rows] = await conn.query('SELECT id, rider_name FROM riders');
  const byKey = new Map(), byExact = new Map();
  for (const r of rows) {
    byExact.set(r.rider_name, r.id);
    const k = [...normTokens(r.rider_name)].sort().join('|');
    if (!byKey.has(k)) byKey.set(k, r.id);
  }
  return { byKey, byExact };
}

async function findRider(map, globalIdx, conn, name) {
  const mapped = RIDER_NAME_MAP[name] || name;
  const key = [...normTokens(mapped)].sort().join('|');
  if (map.has(key)) return map.get(key);
  // fallback to global riders table (handles riders missing from stage_results,
  // e.g. DNF but still in cumulative classification; robust to name order/diacritics)
  if (globalIdx.byExact.has(mapped)) return globalIdx.byExact.get(mapped);
  if (globalIdx.byKey.has(key)) return globalIdx.byKey.get(key);
  // last-resort surname match
  const surname = mapped.split(/[\s]+/).slice(-1)[0];
  let [r] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${surname}%`]);
  return r.length ? r[0].id : null;
}

async function findTeam(conn, name) {
  if (MEN_TEAM_MAP[name]) {
    let [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [MEN_TEAM_MAP[name]]);
    if (r.length) return r[0].id;
  }
  let [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [name]);
  if (r.length) return r[0].id;
  if (name.includes('|')) {
    const alt = name.replace(/\s*\|\s*/g, ' - ');
    [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [alt]);
    if (r.length) return r[0].id;
  }
  const key = name.split(/[\s|-]+/).slice(0, 2).join(' ');
  [r] = await conn.query('SELECT id FROM teams WHERE team_name LIKE ? AND team_name NOT LIKE ? LIMIT 1', [`%${key}%`, '%(WTW)%']);
  return r.length ? r[0].id : null;
}

async function getStageId(conn, num) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, num]);
  return s[0].id;
}

async function importStage(conn, dbName, stageNum, stageId, data, globalIdx) {
  const tables = PLAN[stageNum];
  const riderMap = await buildRiderMap(conn, stageId);
  console.log(`\n[${dbName}] Stage ${stageNum} (${dbName})`);

  // ---- POINTS ----
  if (tables.includes('points')) {
    await conn.query('DELETE FROM points_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    for (const p of data.points) {
      const riderId = await findRider(riderMap, globalIdx, conn, p.rider);
      if (!riderId) { skip++; continue; }
      await conn.query(
        'INSERT INTO points_classification (stage_id, rider_id, `rank`, points, jersey_type, is_active) VALUES (?,?,?,?,?,1)',
        [stageId, riderId, parseInt(p.rank), parseInt(p.points) || 0, 'green']
      );
      n++;
    }
    console.log(`  points: ${n} inserted, ${skip} skipped`);
  }

  // ---- KOM ----
  if (tables.includes('kom')) {
    await conn.query('DELETE FROM mountains_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    for (const k of data.kom) {
      const riderId = await findRider(riderMap, globalIdx, conn, k.rider);
      if (!riderId) { skip++; continue; }
      await conn.query(
        'INSERT INTO mountains_classification (stage_id, rider_id, `rank`, points, jersey_type, is_active) VALUES (?,?,?,?,?,1)',
        [stageId, riderId, parseInt(k.rank), parseInt(k.points) || 0, 'polkadot']
      );
      n++;
    }
    console.log(`  kom: ${n} inserted, ${skip} skipped`);
  }

  // ---- YOUTH ----
  if (tables.includes('youth')) {
    await conn.query('DELETE FROM youth_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    for (const y of data.youth) {
      const riderId = await findRider(riderMap, globalIdx, conn, y.rider);
      if (!riderId) { skip++; continue; }
      await conn.query(
        'INSERT INTO youth_classification (stage_id, rider_id, `rank`, `time`, time_gap, jersey_type, is_active) VALUES (?,?,?,?,?,?,1)',
        [stageId, riderId, parseInt(y.rank), y.total_time || null, y.time_gap || null, 'white']
      );
      n++;
    }
    console.log(`  youth: ${n} inserted, ${skip} skipped`);
  }

  // ---- GC (general classification) ----
  if (data.gc && data.gc.length) {
    await conn.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
    let n = 0, skip = 0;
    const seen = new Set();
    for (const g of data.gc) {
      const riderId = await findRider(riderMap, globalIdx, conn, g.rider);
      if (!riderId) { skip++; continue; }
      // Official site sometimes lists the same rider twice under a short and
      // a full name; unique (stage_id, rider_id) forbids the second row.
      if (seen.has(riderId)) { console.log(`    ⚠️ gc dup rider skipped: ${g.rider}`); skip++; continue; }
      seen.add(riderId);
      const teamId = await findTeam(conn, g.team);
      if (!teamId) { console.log(`    ⚠️ gc team not found: ${g.team}`); skip++; continue; }
      await conn.query(
        'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), stageId, parseInt(g.rank), riderId, teamId, g.nationality || 'UNK', g.total_time || null, g.time_gap || '+0:00']
      );
      n++;
    }
    console.log(`  gc: ${n} inserted, ${skip} skipped`);
  }

  // ---- TEAM ----
  if (tables.includes('team')) {
    await conn.query('DELETE FROM team_classification WHERE stage_id=?', [stageId]);
    let rows;
    if (stageNum === 1 && data.team.length === 0) {
      // Only derive S1 team classification from TTT stage_results when no
      // official team table is available (men's TDF S1 was a TTT).
      rows = await deriveS1Team(conn, stageId);
    } else {
      rows = [];
      for (const t of data.team) {
        const teamId = await findTeam(conn, t.team);
        if (!teamId) { console.log(`    ⚠️ team not found: ${t.team}`); continue; }
        rows.push({ rank: parseInt(t.rank), teamId, total_time: t.total_time || null });
      }
    }
    let n = 0;
    for (const r of rows) {
      await conn.query(
        'INSERT INTO team_classification (id, stage_id, `rank`, team_id, total_time, time_gap, is_active, created_at) VALUES (?,?,?,?,?,?,1,NOW())',
        [uuidv4(), stageId, r.rank, r.teamId, r.total_time, null]
      );
      n++;
    }
    console.log(`  team: ${n} inserted`);
  }
}

async function deriveS1Team(conn, stageId) {
  // TTT: team order = best stage_results rank; time = that rider's TTT time_gap
  const [rows] = await conn.query(
    `SELECT sr.team_id, MIN(sr.rank_pos) as best_rank,
            MIN(sr.time_gap) as tt_gap
     FROM stage_results sr
     WHERE sr.stage_id=?
     GROUP BY sr.team_id
     ORDER BY best_rank`,
    [stageId]
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    teamId: r.team_id,
    total_time: r.tt_gap || '+0:00',
  }));
}

async function run() {
  const stageArgs = process.argv.map(Number).filter(n => n >= 1 && n <= 21);
  const stages = stageArgs.length ? stageArgs : [1, 2, 3, 4, 5, 6];
  // Load only requested stage files so a partial race update is supported.
  const all = {};
  for (const s of stages) {
    const file = path.join(TDF_DATA_DIR, `tdf_s${s}_data.json`);
    all[s] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  const ONLY_LOCAL = process.argv.includes('--local');
  const ONLY_PROD = process.argv.includes('--prod');
  let dbs;
  if (ONLY_PROD) dbs = [[await mysql.createConnection(PROD), 'PROD']];
  else if (ONLY_LOCAL) dbs = [[await mysql.createConnection(LOCAL), 'LOCAL']];
  else dbs = [[await mysql.createConnection(LOCAL), 'LOCAL'], [await mysql.createConnection(PROD), 'PROD']];
  for (const [conn, dbName] of dbs) {
    try {
      const globalIdx = await buildGlobalRiderIndex(conn);
      for (const s of stages) {
        if (PLAN[s] === undefined || PLAN[s].length === 0) continue;
        const stageId = await getStageId(conn, s);
        try {
          await importStage(conn, dbName, s, stageId, all[s], globalIdx);
        } catch (e) {
          console.error(`  [${dbName}] S${s} FAILED: ${e.message}`);
        }
      }
      await conn.end();
    } catch (e) {
      console.error(`[${dbName}] CONNECTION ERROR: ${e.message}`);
    }
  }
  console.log('\n✅ Done.');
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
