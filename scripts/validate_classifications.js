/**
 * Validation round: for TDF 2026 stages S1-S4, check the four classification
 * tables for (a) presence, (b) leader correctness, (c) rank integrity
 * (1..N contiguous, no dupes), (d) FK validity (rider/team id exists).
 */
const mysql = require('mysql2/promise');
const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 15000
};
const RACE_CODE = 'tdf-2026';

async function getStageId(conn, num) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, num]);
  return s[0].id;
}

function integrity(ranks) {
  // ranks: array of ints
  const set = new Set(ranks);
  const sorted = [...ranks].sort((a, b) => a - b);
  let contiguous = true;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) { contiguous = false; break; }
  }
  return { count: ranks.length, dupes: ranks.length - set.size, contiguous };
}

async function validateStage(conn, stageNum, stageId) {
  const report = { stage: stageNum, issues: [] };
  // POINTS
  {
    const [rows] = await conn.query(
      `SELECT pc.\`rank\`, pc.points, r.rider_name
       FROM points_classification pc LEFT JOIN riders r ON pc.rider_id=r.id
       WHERE pc.stage_id=? ORDER BY pc.\`rank\``, [stageId]);
    if (rows.length === 0) {
      report.points = 'N/A (TTT or missing)';
    } else {
      const ig = integrity(rows.map(x => x.rank));
      const leader = rows[0];
      const nullRider = rows.filter(x => !x.rider_name).length;
      report.points = { count: ig.count, leader: `${leader.rider_name} (${leader.points}pts)`, dupes: ig.dupes, contiguous: ig.contiguous, nullRider };
      if (ig.dupes) report.issues.push('points: duplicate ranks');
      if (!ig.contiguous) report.issues.push('points: non-contiguous ranks');
      if (nullRider) report.issues.push(`points: ${nullRider} rows with missing rider`);
    }
  }
  // KOM
  {
    const [rows] = await conn.query(
      `SELECT pc.\`rank\`, pc.points, r.rider_name
       FROM mountains_classification pc LEFT JOIN riders r ON pc.rider_id=r.id
       WHERE pc.stage_id=? ORDER BY pc.\`rank\``, [stageId]);
    if (rows.length === 0) {
      report.kom = 'N/A (TTT or missing)';
    } else {
      const ig = integrity(rows.map(x => x.rank));
      const leader = rows[0];
      const nullRider = rows.filter(x => !x.rider_name).length;
      report.kom = { count: ig.count, leader: `${leader.rider_name} (${leader.points}pts)`, dupes: ig.dupes, contiguous: ig.contiguous, nullRider };
      if (ig.dupes) report.issues.push('kom: duplicate ranks');
      if (!ig.contiguous) report.issues.push('kom: non-contiguous ranks');
      if (nullRider) report.issues.push(`kom: ${nullRider} rows with missing rider`);
    }
  }
  // YOUTH
  {
    const [rows] = await conn.query(
      `SELECT yc.\`rank\`, yc.\`time\`, yc.time_gap, r.rider_name
       FROM youth_classification yc LEFT JOIN riders r ON yc.rider_id=r.id
       WHERE yc.stage_id=? ORDER BY yc.\`rank\``, [stageId]);
    if (rows.length === 0) {
      report.youth = 'N/A (TTT or missing)';
    } else {
      const ig = integrity(rows.map(x => x.rank));
      const leader = rows[0];
      const nullRider = rows.filter(x => !x.rider_name).length;
      const badGap = rows.filter(x => x.rank !== 1 && !(String(x.time_gap).startsWith('+')) && x.time_gap !== '0:00').length;
      const badLeaderTime = rows.filter(x => x.rank === 1 && !x.time).length;
      report.youth = { count: ig.count, leader: `${leader.rider_name} (${leader.time_gap})`, dupes: ig.dupes, contiguous: ig.contiguous, nullRider, badGap, badLeaderTime };
      if (ig.dupes) report.issues.push('youth: duplicate ranks');
      if (!ig.contiguous) report.issues.push('youth: non-contiguous ranks');
      if (nullRider) report.issues.push(`youth: ${nullRider} rows with missing rider`);
      if (badGap) report.issues.push(`youth: ${badGap} rows with invalid time_gap`);
      if (badLeaderTime) report.issues.push('youth: leader missing total_time');
    }
  }
  // TEAM
  {
    const [rows] = await conn.query(
      `SELECT tc.\`rank\`, tc.total_time, t.team_name
       FROM team_classification tc LEFT JOIN teams t ON tc.team_id=t.id
       WHERE tc.stage_id=? ORDER BY tc.\`rank\``, [stageId]);
    const ig = integrity(rows.map(x => x.rank));
    const leader = rows[0];
    const nullTeam = rows.filter(x => !x.team_name).length;
    report.team = { count: ig.count, leader: `${leader ? leader.team_name : '?'} (${leader ? leader.total_time : '?'})`, dupes: ig.dupes, contiguous: ig.contiguous, nullTeam };
    if (ig.dupes) report.issues.push('team: duplicate ranks');
    if (!ig.contiguous) report.issues.push('team: non-contiguous ranks');
    if (nullTeam) report.issues.push(`team: ${nullTeam} rows with missing team`);
  }
  return report;
}

async function run() {
  for (const [cfg, name] of [[LOCAL, 'LOCAL'], [PROD, 'PROD']]) {
    let conn;
    try {
      conn = await mysql.createConnection(cfg);
      console.log(`\n########## ${name} ##########`);
      for (const s of [1, 2, 3, 4]) {
        const sid = await getStageId(conn, s);
        const rep = await validateStage(conn, s, sid);
        console.log(`\n--- S${s} ---`);
        console.log('  points:', JSON.stringify(rep.points));
        console.log('  kom   :', JSON.stringify(rep.kom));
        console.log('  youth :', JSON.stringify(rep.youth));
        console.log('  team  :', JSON.stringify(rep.team));
        if (rep.issues.length) console.log('  ⚠️ ISSUES:', rep.issues.join('; '));
        else console.log('  ✅ no integrity issues');
      }
    } catch (e) {
      console.log(`\n[${name}] ERROR: ${e.message}`);
    } finally {
      if (conn) await conn.end();
    }
  }
}
run().catch(e => { console.error('FATAL', e); process.exit(1); });
