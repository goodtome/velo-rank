/** Inspect S4 points/kom/youth rank distribution to distinguish ties vs dropped rows. */
const mysql = require('mysql2/promise');
const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const RACE_CODE = 'tdf-2026';

async function getStageId(conn, num) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, num]);
  return s[0].id;
}

async function dist(conn, table, stageId) {
  const [rows] = await conn.query(
    `SELECT \`rank\`, COUNT(*) c FROM ${table} WHERE stage_id=? GROUP BY \`rank\` ORDER BY \`rank\``, [stageId]);
  const ranks = rows.map(r => r.rank);
  const max = Math.max(...ranks);
  const present = new Set(ranks);
  const missing = [];
  for (let r = 1; r <= max; r++) if (!present.has(r)) missing.push(r);
  console.log(`\n[${table}] rows=${rows.length} maxRank=${max}`);
  console.log('  rank histogram (rank:count):', rows.map(r => `${r.rank}:${r.c}`).join(' '));
  if (missing.length) console.log('  ⚠️ MISSING ranks in 1..max:', missing.join(','));
  else console.log('  ✅ no gaps in 1..max (non-contiguity is due to ties at the end, which is normal)');
}

async function run() {
  const conn = await mysql.createConnection(LOCAL);
  const sid = await getStageId(conn, 4);
  await dist(conn, 'points_classification', sid);
  await dist(conn, 'mountains_classification', sid);
  await dist(conn, 'youth_classification', sid);
  await conn.end();
}
run().catch(e => { console.error(e); process.exit(1); });
