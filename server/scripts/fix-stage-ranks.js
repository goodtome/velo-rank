/**
 * 修正 TdF 2025 stage_results 排名:
 * 某些赛段的 rank 可能与 GC rank 混淆 (stage winner 的 time_gap 不是 +0:00)
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

(async () => {
  const conn = await mysql.createConnection(dbConfig.development);
  const raceId = '24a6d4ef-797b-42cb-b23b-ec18732e3d6d';

  const [stages] = await conn.query(
    'SELECT id, stage_number FROM stages WHERE race_id = ? ORDER BY stage_number', [raceId]
  );

  let fixedCount = 0;

  for (const stage of stages) {
    const [srRows] = await conn.query(
      'SELECT id, rank_pos, rider_id, time_gap, is_same_time FROM stage_results WHERE stage_id = ? ORDER BY rank_pos',
      [stage.id]
    );

    if (srRows.length === 0) continue;

    // 检查: 赛段冠军的 time_gap 应该是 +0:00
    const rank1 = srRows.find(r => r.rank_pos === 1);
    if (rank1 && rank1.time_gap && rank1.time_gap !== '+0:00' && rank1.time_gap !== '0:00' && rank1.time_gap !== '') {
      // 可能混入了 GC 数据 - rank 1 的 gap 不是 +0:00
      console.log(`Stage ${stage.stage_number}: rank_pos 1 gap=${rank1.time_gap} -> looks like GC data mixed in, skipping stage_results fix`);
      // 对于赛段成绩, 我们不能简单按 time_gap 排序, 因为赛段成绩的排名是按完赛时间排的
      // 这种情况下, 数据可能本身就是 GC 排名而非赛段排名
      // 暂时跳过, 保留原始数据
      continue;
    }

    // 正常情况: rank 1 gap 为 +0:00, 检查是否有并列问题
    // (目前不需要处理)
  }

  console.log(`\nChecked ${stages.length} stages, fixed ${fixedCount}`);

  // 显示每个赛段冠军
  console.log('\n=== Stage Winners ===');
  for (const stage of stages) {
    const [winner] = await conn.query(
      'SELECT sr.rank_pos, r.rider_name, t.team_name, sr.time_gap FROM stage_results sr JOIN riders r ON sr.rider_id = r.id JOIN teams t ON sr.team_id = t.id WHERE sr.stage_id = ? AND sr.rank_pos = 1',
      [stage.id]
    );
    if (winner.length) {
      console.log(`Stage ${String(stage.stage_number).padStart(2)}: ${winner[0].rider_name.padEnd(25)} (${winner[0].team_name.padEnd(30)}) gap=${winner[0].time_gap}`);
    }
  }

  await conn.end();
})();
