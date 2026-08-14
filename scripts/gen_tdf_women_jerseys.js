/**
 * Generate jerseys (leader jerseys) for tdf-women-2026 stages from the
 * classification rank-1 rows, and sync them LOCAL -> PROD.
 * Types match the men's TDF convention: YELLOW / GREEN / POLKA_DOT / WHITE.
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 30000,
};
const RACE_CODE = 'tdf-women-2026';
const STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// classification table -> jersey type + value column
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

async function gen(conn) {
  const [race] = await q(conn, 'SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const out = {};
  for (const n of STAGES) {
    const [s] = await q(conn, 'SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, n]);
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
      if (!teamId) { console.log(`  S${n} ${type}: no team_id for rider ${r[0].rider_id}, skip`); continue; }
      rows.push({ type, rider_id: r[0].rider_id, team_id: teamId, val: r[0].val });
    }
    out[n] = { stageId, rows };
  }
  return out;
}

async function apply(conn, data) {
  for (const n of STAGES) {
    const { stageId, rows } = data[n];
    await q(conn, 'DELETE FROM jerseys WHERE stage_id=?', [stageId]);
    for (const r of rows) {
      await q(conn,
        'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id, time_gap, points, is_active) VALUES (?,?,?,?,?,?,?,1)',
        [uuidv4(), stageId, r.type, r.rider_id, r.team_id, r.type === 'YELLOW' || r.type === 'WHITE' ? String(r.val || '') : null, r.type === 'GREEN' || r.type === 'POLKA_DOT' ? (r.val ? parseInt(r.val) : 0) : null]);
    }
    console.log(`S${n}: jerseys ${rows.map(r => r.type).join(',')}`);
  }
}

(async () => {
  const l = await mysql.createConnection(LOCAL);
  const data = await gen(l);
  await apply(l, data);
  await l.end();

  const p = await mysql.createConnection(PROD);
  p.on('error', () => {});
  await apply(p, data);
  await p.end();
  console.log('done');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
