/**
 * Import TDF 2026 stage RESULTS (only the stage_results table) from the
 * fresh tdf_sN_results.json produced by fetch_tdf_stage_results.py.
 * Uses token-set global rider matching so 'van'/Van particle names match
 * regardless of first/last-name order. Writes LOCAL + PROD.
 * Does NOT touch classifications / GC / jerseys.
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
const TDF_RESULTS_DIR = process.env.TDF_RESULTS_DIR
  ? path.resolve(process.env.TDF_RESULTS_DIR)
  : path.join(__dirname, '..', 'archive', 'generated', '2026-tdf', 'results');

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
  'MAYENNE MONBANA MY PIE': 'Mayenne-Monbana-Mypie',
  'Mayenne Monbana My Pie': 'Mayenne-Monbana-Mypie',
  'Bahrain Victorious': 'Bahrain Victorious',
};

const normTokens = (s) => {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
  const mappedName = RIDER_NAME_MAP[name] || name;
  if (idx.byExact.has(mappedName)) return idx.byExact.get(mappedName);
  const k = keyOf(mappedName);
  if (idx.byKey.has(k)) return idx.byKey.get(k);
  // surname fallback (last token)
  const sur = mappedName.split(/[\s]+/).slice(-1)[0];
  const [r] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${sur}%`]);
  return r.length ? r[0].id : null;
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
  if (MEN_TEAM_MAP[name] && idx.byExact.has(MEN_TEAM_MAP[name])) return idx.byExact.get(MEN_TEAM_MAP[name]);
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

async function getStageId(conn, num) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, num]);
  return s[0].id;
}

async function importStage(conn, dbName, stageNum, riderIdx, teamIdx) {
  const data = JSON.parse(fs.readFileSync(path.join(TDF_RESULTS_DIR, `tdf_s${stageNum}_results.json`), 'utf-8'));
  const stageId = await getStageId(conn, stageNum);
  // DELETE only stage_results
  await conn.query('DELETE FROM stage_results WHERE stage_id=?', [stageId]);
  const gaps = computeStageGaps(data.results);
  let skipped = 0;
  const seen = new Set();
  const rows = [];
  for (const r of data.results) {
    const gi = gaps.find(g => g.rank === r.rank);
    if (!gi) { skipped++; continue; }
    const riderId = await findRider(conn, riderIdx, r.rider);
    if (!riderId) { console.log(`  [${dbName}] S${stageNum} rider not found: ${r.rider}`); skipped++; continue; }
    if (seen.has(riderId)) { skipped++; continue; }
    seen.add(riderId);
    const teamId = await findTeam(conn, teamIdx, r.team);
    if (!teamId) { console.log(`  [${dbName}] S${stageNum} team not found: ${r.team} (rider ${r.rider})`); skipped++; continue; }
    rows.push([uuidv4(), stageId, r.rank, riderId, teamId, r.nationality || 'UNK', gi.gap, gi.isSameTime ? 1 : 0]);
  }
  // Single bulk INSERT to minimise round-trips over flaky PROD link
  if (rows.length) {
    await conn.query(
      'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES ?',
      [rows]
    );
  }
  console.log(`  [${dbName}] S${stageNum} stage_results: ${rows.length} imported, ${skipped} skipped`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const LOG = [];
function log(msg) { LOG.push(msg); console.log(msg); }
function flushLog() { try { fs.writeFileSync(path.join(__dirname, '..', 'temp', 'import_sr_log.txt'), LOG.join('\n') + '\n'); } catch {} }

async function runDb(cfg, name, stages) {
  const MAX = 6;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let conn;
    try {
      conn = await mysql.createConnection(cfg);
      conn.on('error', () => {}); // swallow socket-level ECONNRESET so it doesn't crash the process
      const riderIdx = await buildRiderIndex(conn);
      const teamIdx = await buildTeamIndex(conn);
      log(`\n===== ${name} (attempt ${attempt}) =====`);
      for (const s of stages) {
        await importStage(conn, name, s, riderIdx, teamIdx);
      }
      await conn.end();
      return true;
    } catch (e) {
      log(`  [${name}] attempt ${attempt} failed: ${e && e.message}`);
      try { if (conn) await conn.destroy(); } catch {}
      if (attempt < MAX) await sleep(2000 * attempt);
    }
  }
  log(`  [${name}] FAILED after ${MAX} attempts`);
  return false;
}

async function run() {
  const stages = process.argv.slice(2).map(Number).filter(n => n > 0);
  if (!stages.length) stages.push(4);
  const ONLY_LOCAL = process.argv.includes('--local');
  const ONLY_PROD = process.argv.includes('--prod');
  const dbs = ONLY_LOCAL ? [[LOCAL, 'LOCAL']] : ONLY_PROD ? [[PROD, 'PROD']] : [[LOCAL, 'LOCAL'], [PROD, 'PROD']];
  for (const [cfg, name] of dbs) {
    await runDb(cfg, name, stages);
  }
  log('\n✅ Done stage_results import.');
  flushLog();
}
process.on('unhandledRejection', (e) => { log('UNHANDLED ' + (e && e.message)); });
process.on('uncaughtException', (e) => { log('UNCAUGHT ' + (e && e.message)); });
run().catch(e => { log('FATAL ' + (e && e.message)); flushLog(); process.exitCode = 1; });
