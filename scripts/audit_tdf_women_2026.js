const mysql = require('mysql2/promise');

const CFGS = [
  ['LOCAL', { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' }],
  ['PROD', {
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
    user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc', database: 'jersey_db',
    ssl: { rejectUnauthorized: true }, connectTimeout: 30000,
  }],
];

const TABLES = ['stage_results', 'general_classification', 'points_classification', 'mountains_classification', 'youth_classification', 'team_classification'];

async function q(conn, sql, params, ms = 25000) {
  return Promise.race([
    conn.query(sql, params),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

(async () => {
  for (const [name, cfg] of CFGS) {
    const c = await mysql.createConnection(cfg);
    c.on('error', () => {});
    const [race] = await q(c, "SELECT id FROM races WHERE race_code='tdf-women-2026'");
    const [stages] = await q(c, 'SELECT id, stage_number FROM stages WHERE race_id=? ORDER BY stage_number', [race[0].id]);
    console.log('====', name);
    for (const s of stages.filter(x => x.stage_number <= 9)) {
      const counts = { stage: s.stage_number };
      for (const t of TABLES) {
        const [r] = await q(c, `SELECT COUNT(*) c FROM ${t} WHERE stage_id=?`, [s.id]);
        counts[t] = r[0].c;
      }
      console.log(JSON.stringify(counts));
    }
    const [leaders] = await q(c, `
      SELECT s.stage_number,
        (SELECT r.rider_name FROM general_classification g JOIN riders r ON r.id=g.rider_id WHERE g.stage_id=s.id AND g.\`rank\`=1) gc_leader,
        (SELECT r.rider_name FROM points_classification p JOIN riders r ON r.id=p.rider_id WHERE p.stage_id=s.id AND p.\`rank\`=1) points_leader,
        (SELECT r.rider_name FROM mountains_classification m JOIN riders r ON r.id=m.rider_id WHERE m.stage_id=s.id AND m.\`rank\`=1) kom_leader,
        (SELECT r.rider_name FROM youth_classification y JOIN riders r ON r.id=y.rider_id WHERE y.stage_id=s.id AND y.\`rank\`=1) youth_leader,
        (SELECT t.team_name FROM team_classification tc JOIN teams t ON t.id=tc.team_id WHERE tc.stage_id=s.id AND tc.\`rank\`=1) team_leader
      FROM stages s WHERE s.race_id=? AND s.stage_number<=9 ORDER BY s.stage_number`, [race[0].id]);
    console.log('LEADERS', JSON.stringify(leaders));
    await c.end();
  }
  console.log('DONE');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
