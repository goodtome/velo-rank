/**
 * Resilient LOCAL -> PROD copy of classification tables for given stages.
 * LOCAL and PROD share identical stage UUIDs, so rows (incl. stage_id) copy
 * directly. Per-query timeout + per-(table,stage) retry so a flaky PROD
 * socket cannot hang the process.
 *
 * Usage: node scripts/sync_prod_classifications.js 4 5
 */
const mysql = require('mysql2/promise');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 30000,
};
const RACE_CODE = process.env.RACE_CODE || 'tdf-2026';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// table -> column list to copy (auto-increment id excluded; UUID id included)
const TABLES = {
  general_classification: ['id', 'stage_id', '`rank`', 'rider_id', 'team_id', 'nationality', 'total_time', 'time_gap'],
  points_classification: ['stage_id', 'rider_id', '`rank`', 'points', 'jersey_type', 'is_active'],
  mountains_classification: ['stage_id', 'rider_id', '`rank`', 'points', 'jersey_type', 'is_active'],
  youth_classification: ['stage_id', 'rider_id', '`rank`', '`time`', 'time_gap', 'jersey_type', 'is_active'],
  team_classification: ['id', 'stage_id', '`rank`', 'team_id', 'total_time', 'time_gap', 'is_active', 'created_at'],
};

function q(conn, sql, params, ms = 25000) {
  return Promise.race([
    conn.query(sql, params),
    new Promise((_, rej) => setTimeout(() => rej(new Error('query timeout')), ms)),
  ]);
}

async function dumpLocal(stages) {
  const l = await mysql.createConnection(LOCAL);
  const [race] = await l.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const dump = {};
  for (const n of stages) {
    const [s] = await l.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, n]);
    const sid = s[0].id;
    dump[n] = { sid, tables: {} };
    for (const [t, cols] of Object.entries(TABLES)) {
      const [rows] = await l.query(`SELECT ${cols.join(',')} FROM ${t} WHERE stage_id=? ORDER BY \`rank\``, [sid]);
      dump[n].tables[t] = rows.map(r => cols.map(c => r[c.replace(/`/g, '')]));
      console.log(`LOCAL S${n} ${t}: ${rows.length}`);
    }
  }
  await l.end();
  return dump;
}

async function syncTable(conn, sid, table, cols, rows) {
  await q(conn, `DELETE FROM ${table} WHERE stage_id=?`, [sid]);
  if (rows.length) {
    await q(conn, `INSERT INTO ${table} (${cols.join(',')}) VALUES ?`, [rows], 40000);
  }
  const [c] = await q(conn, `SELECT COUNT(*) c FROM ${table} WHERE stage_id=?`, [sid]);
  return c[0].c;
}

async function main() {
  const stages = process.argv.slice(2).map(Number).filter(n => n > 0);
  if (!stages.length) { console.log('no stages'); return; }
  const dump = await dumpLocal(stages);

  for (const n of stages) {
    const sid = dump[n].sid;
    for (const [table, cols] of Object.entries(TABLES)) {
      const rows = dump[n].tables[table];
      const MAX = 8;
      let ok = false;
      for (let a = 1; a <= MAX && !ok; a++) {
        let conn;
        try {
          conn = await mysql.createConnection(PROD);
          conn.on('error', () => {});
          const cnt = await syncTable(conn, sid, table, cols, rows);
          console.log(`  PROD S${n} ${table}: copied ${rows.length}, count=${cnt}`);
          ok = true;
        } catch (e) {
          console.log(`  PROD S${n} ${table} attempt ${a} failed: ${e && e.message}`);
          if (a < MAX) await sleep(1500 * a);
        } finally {
          try { if (conn) await conn.destroy(); } catch {}
        }
      }
      if (!ok) console.log(`  PROD S${n} ${table} FAILED`);
    }
  }
  console.log('done');
}
main().catch(e => { console.error('FATAL', e && e.message); process.exitCode = 1; });
