/**
 * Generate leader jerseys for Aug-2026 races from classification rank-1 rows,
 * sync LOCAL -> PROD. Types: YELLOW / GREEN / POLKA_DOT / WHITE.
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const PROD = {
  host: process.env.PROD_DB_HOST,
  port: Number(process.env.PROD_DB_PORT || 4000),
  user: process.env.PROD_DB_USER,
  password: process.env.PROD_DB_PASSWORD,
  database: process.env.PROD_DB_NAME || 'jersey_db',
  ssl: { rejectUnauthorized: true },
  connectTimeout: 30000,
};

for (const [name, value] of Object.entries({
  PROD_DB_HOST: PROD.host,
  PROD_DB_USER: PROD.user,
  PROD_DB_PASSWORD: PROD.password,
})) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

const RACES = {
  'arctic-norway-2026': [1, 2, 3, 4],
  'czech-tour-2026': [1, 2, 3, 4],
  'vuelta-burgos-2026': [1, 2, 3, 4, 5],
  'cyclassics-hamburg-2026': [1],
};

const LEADERS = [
  ['general_classification', 'YELLOW', 'total_time'],
  ['points_classification', 'GREEN', 'points'],
  ['mountains_classification', 'POLKA_DOT', 'points'],
  ['youth_classification', 'WHITE', 'time'],
];

async function q(conn, sql, params, ms = 25000) {
  return Promise.race([
    conn.query(sql, params),
    new Promise((_, rej) => setTimeout(() => rej(new Error('query timeout')), ms)),
  ]);
}

async function gen(conn, raceCode, stages) {
  const [race] = await q(conn, 'SELECT id FROM races WHERE race_code=?', [raceCode]);
  const out = {};
  for (const n of stages) {
    const [s] = await q(conn, 'SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, n]);
    if (!s.length) { console.log(`  ${raceCode} S${n}: stage missing, skip`); continue; }
    const stageId = s[0].id;
    const rows = [];
    for (const [table, type, valueCol] of LEADERS) {
      const [r] = await q(conn,
        `SELECT rider_id, \`${valueCol}\` AS val FROM \`${table}\` WHERE stage_id=? AND \`rank\`=1 LIMIT 1`,
        [stageId]);
      if (!r.length) continue;
      let teamId = null;
      const [gc] = await q(conn, 'SELECT team_id FROM general_classification WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, r[0].rider_id]);
      if (gc.length) teamId = gc[0].team_id;
      if (!teamId) {
        const [sr] = await q(conn, 'SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, r[0].rider_id]);
        if (sr.length) teamId = sr[0].team_id;
      }
      // Fallback: rider DNF'd this stage but still leads a classification -> look up
      // team from the most recent stage where he has a result (stage_number desc).
      if (!teamId) {
        const [race2] = await q(conn, 'SELECT id FROM races WHERE race_code=?', [raceCode]);
        const [prev] = await q(conn,
          'SELECT sr.team_id FROM stage_results sr JOIN stages s ON s.id=sr.stage_id ' +
          'WHERE s.race_id=? AND sr.rider_id=? AND s.stage_number<? ORDER BY s.stage_number DESC LIMIT 1',
          [race2[0].id, r[0].rider_id, n]);
        if (prev.length) teamId = prev[0].team_id;
      }
      if (!teamId) { console.log(`  ${raceCode} S${n} ${type}: no team_id for rider ${r[0].rider_id}, skip`); continue; }
      rows.push({ type, rider_id: r[0].rider_id, team_id: teamId, val: r[0].val });
    }
    out[n] = { stageId, rows };
  }
  return out;
}

async function apply(conn, data, raceCode) {
  for (const n of Object.keys(data)) {
    const { stageId, rows } = data[n];
    await q(conn, 'DELETE FROM jerseys WHERE stage_id=?', [stageId]);
    for (const r of rows) {
      await q(conn,
        'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id, time_gap, points, is_active) VALUES (?,?,?,?,?,?,?,1)',
        [uuidv4(), stageId, r.type, r.rider_id, r.team_id,
         (r.type === 'YELLOW' || r.type === 'WHITE') ? String(r.val || '') : null,
         (r.type === 'GREEN' || r.type === 'POLKA_DOT') ? (r.val ? parseInt(r.val) : 0) : null]);
    }
    console.log(`  ${raceCode} S${n}: jerseys ${rows.map(r => r.type).join(',')}`);
  }
}

(async () => {
  const l = await mysql.createConnection(LOCAL);
  const p = await mysql.createConnection(PROD);
  p.on('error', () => {});
  for (const [raceCode, stages] of Object.entries(RACES)) {
    const data = await gen(l, raceCode, stages);
    await apply(l, data, raceCode);
    await apply(p, data, raceCode);
    console.log(`${raceCode}: done`);
  }
  await l.end();
  await p.end();
  console.log('ALL DONE');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
