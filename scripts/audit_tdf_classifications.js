/**
 * Audit TDF 2026 classification coverage in LOCAL + PROD.
 * Prints a matrix: stage -> counts in stage_results / points / kom / youth / team.
 */
const mysql = require('mysql2/promise');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 15000
};
const RACE_CODE = 'tdf-2026';

async function audit(conn, name) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  if (!race.length) { console.log(`\n[${name}] race ${RACE_CODE} NOT FOUND`); return; }
  const raceId = race[0].id;
  const [stages] = await conn.query(
    'SELECT id, stage_number FROM stages WHERE race_id=? ORDER BY stage_number', [raceId]
  );
  console.log(`\n========== ${name} (${stages.length} stages) ==========`);
  console.log('Stage | StageResults |  GC  | Points | KOM | Youth | Team');
  for (const st of stages) {
    const [sr] = await conn.query('SELECT COUNT(*) c FROM stage_results WHERE stage_id=?', [st.id]);
    const [gc] = await conn.query('SELECT COUNT(*) c FROM general_classification WHERE stage_id=?', [st.id]);
    const [pts] = await conn.query('SELECT COUNT(*) c FROM points_classification WHERE stage_id=?', [st.id]);
    const [kom] = await conn.query('SELECT COUNT(*) c FROM mountains_classification WHERE stage_id=?', [st.id]);
    const [yth] = await conn.query('SELECT COUNT(*) c FROM youth_classification WHERE stage_id=?', [st.id]);
    const [tm] = await conn.query('SELECT COUNT(*) c FROM team_classification WHERE stage_id=?', [st.id]);
    console.log(`S${String(st.stage_number).padStart(2)}   |     ${String(sr[0].c).padStart(3)}     | ${String(gc[0].c).padStart(3)} |  ${String(pts[0].c).padStart(3)}  | ${String(kom[0].c).padStart(3)} | ${String(yth[0].c).padStart(3)}  | ${String(tm[0].c).padStart(3)}`);
  }
}

async function run() {
  for (const [cfg, name] of [[LOCAL, 'LOCAL'], [PROD, 'PROD']]) {
    let conn;
    try {
      conn = await mysql.createConnection(cfg);
      await audit(conn, name);
    } catch (e) {
      console.log(`\n[${name}] CONNECTION ERROR: ${e.message}`);
    } finally {
      if (conn) await conn.end();
    }
  }
}
run().catch(e => { console.error('FATAL', e); process.exit(1); });
