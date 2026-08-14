/**
 * Audit June 2026 stage races for missing classification data.
 * Corrected logic: for every multi-stage stage race, EACH stage that has
 * stage_results SHOULD have GC + Points + KOM + Youth + Team
 * (individual Points/KOM/Youth skipped only for TTT stages).
 * Flags both:
 *   (A) classification missing while results exist
 *   (B) stage_results missing/empty while classifications exist (orphan)
 */
const mysql = require('mysql2/promise');
const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 15000
};
const TARGET = process.argv.includes('--prod') ? PROD : LOCAL;
const TARGET_NAME = process.argv.includes('--prod') ? 'PROD' : 'LOCAL';

// third element = "individual" (skipped for TTT stages); GC and Team always expected
const ALL = [
  ['gc', 'general_classification', false],
  ['pts', 'points_classification', true],
  ['kom', 'mountains_classification', true],
  ['yth', 'youth_classification', true],
  ['tm', 'team_classification', false],
];

async function auditRace(conn, race) {
  const [stages] = await conn.query(
    'SELECT id, stage_number, stage_type FROM stages WHERE race_id=(SELECT id FROM races WHERE race_code=?) ORDER BY stage_number',
    [race.race_code]
  );
  const rows = [];
  for (const st of stages) {
    const row = { num: st.stage_number, type: (st.stage_type || '').toLowerCase(), sr: 0 };
    const [[sr]] = await conn.query('SELECT COUNT(*) c FROM stage_results WHERE stage_id=?', [st.id]);
    row.sr = sr.c;
    for (const [key, tbl] of ALL) {
      const [[r]] = await conn.query(`SELECT COUNT(*) c FROM ${tbl} WHERE stage_id=?`, [st.id]);
      row[key] = r.c;
    }
    rows.push(row);
  }
  const gaps = [];
  for (const row of rows) {
    const isTTT = row.type.includes('ttt') || row.type.includes('team time');
    const expected = ALL.filter(([key, , individual]) => !(isTTT && individual));
    if (row.sr > 0) {
      for (const [key, , ] of expected) {
        if (row[key] === 0) gaps.push({ stage: row.num, type: row.type, cls: key, kind: 'cls-missing' });
      }
    } else {
      // no results: check if any classification exists (orphan) or fully empty
      const anyCls = expected.some(([key]) => row[key] > 0);
      if (anyCls) gaps.push({ stage: row.num, type: row.type, cls: '*', kind: 'results-missing' });
    }
  }
  return { rows, gaps };
}

const CLS = { gc: 'GC', pts: '冲刺Points', kom: '爬坡KOM', yth: '青年Youth', tm: '车队Team' };

async function run() {
  const conn = await mysql.createConnection(TARGET);
  try {
    const [races] = await conn.query(
      "SELECT race_code, race_name, start_date, total_stages, gender, category FROM races WHERE (start_date BETWEEN '2026-06-01' AND '2026-06-30') OR (end_date BETWEEN '2026-06-01' AND '2026-06-30') ORDER BY start_date"
    );
    const stageRaces = races.filter(r => (r.total_stages || 0) > 1 && !/nationals|championship/i.test(r.race_code));
    console.log(`################ June 2026 多日赛 四榜+GC 对账 (${TARGET_NAME}) ################\n`);
    const raceGaps = [];
    for (const race of stageRaces) {
      const { rows, gaps } = await auditRace(conn, race);
      const clsGapCount = gaps.filter(g => g.kind === 'cls-missing').length;
      const resGapCount = gaps.filter(g => g.kind === 'results-missing').length;
      raceGaps.push({ race, clsGapCount, resGapCount });
      console.log(`### ${race.race_code}  ${race.race_name}  [${race.gender}/${race.category}]  stages=${race.total_stages}`);
      console.log('  St |  SR |  GC | Pts | KOM | Yth | Team');
      for (const row of rows) {
        const flags = [];
        const isTTT = row.type.includes('ttt') || row.type.includes('team time');
        if (row.sr > 0) {
          for (const [key, , individual] of ALL) {
            if (isTTT && individual) continue;
            if (row[key] === 0) flags.push(CLS[key]);
          }
        } else {
          const anyCls = ALL.some(([key]) => row[key] > 0);
          if (anyCls) flags.push('成绩缺失(有分类孤儿)');
          else flags.push('整段无数据');
        }
        const mark = flags.length ? '  <-- ' + flags.join(',') : '';
        console.log(`  S${String(row.num).padStart(2)} | ${String(row.sr).padStart(3)} | ${String(row.gc).padStart(3)} | ${String(row.pts).padStart(3)} | ${String(row.kom).padStart(3)} | ${String(row.yth).padStart(3)} | ${String(row.tm).padStart(3)}${mark}`);
      }
      console.log('');
    }
    console.log('################ 缺口汇总 ################');
    for (const g of raceGaps) {
      if (g.clsGapCount || g.resGapCount)
        console.log(`  ${g.race.race_code}: 分类榜缺失 ${g.clsGapCount} 处, 成绩缺失 ${g.resGapCount} 处`);
    }
    const tot = raceGaps.reduce((a, g) => a + g.clsGapCount + g.resGapCount, 0);
    console.log(`\n==== 总计缺口 ${tot} 处（覆盖 ${stageRaces.length} 场多日赛）====`);
  } finally {
    await conn.end();
  }
}
run().catch(e => { console.error('FATAL', e); process.exit(1); });
