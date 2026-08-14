/**
 * Resilient PROD sync for stage_results of specified TDF stages.
 * Reads the rows directly from LOCAL DB (no stale dump file), looks up PROD
 * stage ids, deletes, and bulk-inserts. Per-query timeout via Promise.race
 * so a stalled socket cannot hang forever; whole op retried on failure.
 *
 * Usage: node scripts/sync_prod_stage_results.js 6
 */
const mysql = require('mysql2/promise');
const LOCAL = {
  host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456',
  database: 'jersey_db', charset: 'utf8mb4', connectTimeout: 20000,
};
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 30000,
};
const RACE_CODE = process.env.RACE_CODE || 'tdf-2026';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function q(conn, sql, params, ms = 25000) {
  return Promise.race([
    conn.query(sql, params),
    new Promise((_, rej) => setTimeout(() => rej(new Error('query timeout')), ms)),
  ]);
}

async function getStageId(conn, n) {
  const [race] = await q(conn, 'SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s] = await q(conn, 'SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, n]);
  return s[0].id;
}

async function fetchLocalRows(localConn, n) {
  const sid = await getStageId(localConn, n);
  const [rows] = await q(localConn,
    'SELECT id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time FROM stage_results WHERE stage_id=? ORDER BY rank_pos',
    [sid]);
  return { sid, rows };
}

async function syncStage(prodConn, n, rows) {
  const sid = await getStageId(prodConn, n);
  await q(prodConn, 'DELETE FROM stage_results WHERE stage_id=?', [sid]);
  const values = rows.map(r => [r.id, sid, r.rank_pos, r.rider_id, r.team_id, r.nationality, r.time_gap, r.is_same_time]);
  await q(prodConn, 'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES ?', [values], 40000);
  const [cnt] = await q(prodConn, 'SELECT COUNT(*) c FROM stage_results WHERE stage_id=?', [sid]);
  console.log(`  PROD S${n}: inserted ${rows.length}, now count=${cnt[0].c}`);
}

async function main() {
  const stages = process.argv.slice(2).map(Number).filter(n => n > 0);
  if (!stages.length) { console.log('no stages given'); return; }
  const localConn = await mysql.createConnection(LOCAL);
  const localData = {};
  for (const n of stages) {
    try {
      localData[n] = await fetchLocalRows(localConn, n);
      console.log(`LOCAL S${n}: stage_results ${localData[n].rows.length}`);
    } catch (e) {
      console.log(`S${n}: cannot read LOCAL (${e.message}), skip`);
    }
  }
  await localConn.end();

  for (const n of stages) {
    const data = localData[n];
    if (!data || !data.rows.length) continue;
    const MAX = 8;
    let ok = false;
    for (let a = 1; a <= MAX && !ok; a++) {
      let conn;
      try {
        conn = await mysql.createConnection(PROD);
        conn.on('error', () => {});
        await syncStage(conn, n, data.rows);
        ok = true;
      } catch (e) {
        console.log(`  S${n} attempt ${a} failed: ${e && e.message}`);
        if (a < MAX) await sleep(1500 * a);
      } finally {
        try { if (conn) await conn.destroy(); } catch {}
      }
    }
    if (!ok) console.log(`  S${n} FAILED after ${MAX} attempts`);
  }
  console.log('done');
}
main().catch(e => { console.error('FATAL', e && e.message); process.exitCode = 1; });
