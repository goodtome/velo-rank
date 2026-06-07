/**
 * 修正 TdF 2025 GC 排名: 
 * 对于 rank 1 的 time_gap 不为 +0:00 的赛段, 按 time_gap 重新排序
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

function parseTimeToSeconds(timeStr) {
  if (!timeStr || timeStr === '+0:00' || timeStr === '0:00') return 0;
  const cleaned = timeStr.replace('+', '').replace('-', '');
  const parts = cleaned.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 999999;
}

(async () => {
  const conn = await mysql.createConnection(dbConfig.development);
  const raceId = '24a6d4ef-797b-42cb-b23b-ec18732e3d6d';

  const [stages] = await conn.query(
    'SELECT id, stage_number FROM stages WHERE race_id = ? ORDER BY stage_number', [raceId]
  );

  let fixedCount = 0;

  for (const stage of stages) {
    const [gcRows] = await conn.query(
      'SELECT id, `rank`, rider_id, time_gap, total_time FROM general_classification WHERE stage_id = ? ORDER BY `rank`',
      [stage.id]
    );

    if (gcRows.length === 0) continue;

    // 检查 rank 1 是否真的是 GC 领跑者
    const rank1 = gcRows.find(r => r.rank === 1);
    if (rank1 && rank1.time_gap && rank1.time_gap !== '+0:00' && rank1.time_gap !== '0:00') {
      console.log(`Stage ${stage.stage_number}: rank 1 gap=${rank1.time_gap} -> re-ranking ${gcRows.length} riders...`);

      // 按 time_gap 排序
      gcRows.sort((a, b) => parseTimeToSeconds(a.time_gap) - parseTimeToSeconds(b.time_gap));

      // 第一步: 所有 rank 加偏移量避免唯一约束冲突
      await conn.query(
        'UPDATE general_classification SET `rank` = `rank` + 10000 WHERE stage_id = ?',
        [stage.id]
      );

      // 第二步: 按新顺序设置正确的 rank
      const usedRanks = new Set();
      for (let i = 0; i < gcRows.length; i++) {
        let newRank = i + 1;
        while (usedRanks.has(newRank)) newRank++;
        usedRanks.add(newRank);

        let totalTime = null;
        if (newRank === 1) {
          totalTime = gcRows[i].total_time;
        }

        await conn.query(
          'UPDATE general_classification SET `rank` = ?, total_time = ? WHERE id = ?',
          [newRank, totalTime, gcRows[i].id]
        );
      }
      fixedCount++;

      const newLeader = gcRows[0];
      console.log(`  New leader: rider_id=${newLeader.rider_id} gap=${newLeader.time_gap}`);
    } else {
      // 检查 rank 1 的 total_time
      if (rank1 && rank1.total_time) {
        // 确保只有 rank 1 有 total_time
        await conn.query(
          'UPDATE general_classification SET total_time = NULL WHERE stage_id = ? AND `rank` > 1 AND total_time IS NOT NULL',
          [stage.id]
        );
      }
    }
  }

  console.log(`\nFixed ${fixedCount} stages`);

  // 验证
  console.log('\n=== Yellow Jersey Progression (Fixed) ===');
  for (const sn of [1, 3, 7, 10, 14, 17, 21]) {
    const [leader] = await conn.query(
      'SELECT gc.rank, r.rider_name, t.team_name, gc.time_gap FROM general_classification gc JOIN riders r ON gc.rider_id = r.id JOIN teams t ON gc.team_id = t.id JOIN stages s ON gc.stage_id = s.id WHERE s.race_id = ? AND s.stage_number = ? AND gc.rank = 1',
      [raceId, sn]
    );
    if (leader.length) {
      console.log(`After Stage ${sn}: ${leader[0].rider_name} (${leader[0].team_name}) gap=${leader[0].time_gap}`);
    }
  }

  await conn.end();
})();
