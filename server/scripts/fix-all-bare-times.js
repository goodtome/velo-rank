const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  console.log('🔧 全量修复 stage_results.time_gap 缺失 + 前缀');
  console.log('='.repeat(60));

  // 查找所有缺少 + 前缀且非特殊状态的 time_gap
  const [rows] = await c.query(
    `SELECT id, time_gap, rank_pos FROM stage_results 
     WHERE time_gap IS NOT NULL AND time_gap != ''
       AND time_gap NOT LIKE '+%'
       AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')`
  );

  console.log(`发现 ${rows.length} 条裸时间值需添加 + 前缀`);

  let fixed = 0;
  for (const row of rows) {
    await c.query('UPDATE stage_results SET time_gap = ? WHERE id = ?', ['+' + row.time_gap, row.id]);
    fixed++;
  }
  console.log(`✅ 已修复 ${fixed} 条`);

  // 验证
  console.log('\n🔍 最终验证...');
  const [remaining] = await c.query(
    `SELECT time_gap, COUNT(*) as cnt FROM stage_results 
     WHERE time_gap IS NOT NULL AND time_gap != ''
       AND time_gap NOT LIKE '+%'
       AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')
     GROUP BY time_gap LIMIT 5`
  );
  if (remaining.length === 0) {
    console.log('✅ stage_results.time_gap 全部格式正确！');
  } else {
    console.log('⚠️ 仍有残留:');
    remaining.forEach(r => console.log(`  "${r.time_gap}" x${r.cnt}`));
  }

  // 显示最终分布
  const [dist] = await c.query(
    `SELECT 
       CASE 
         WHEN time_gap IS NULL THEN 'NULL'
         WHEN time_gap = '' THEN '空'
         WHEN time_gap LIKE '+0:00' OR time_gap LIKE '+0.000' THEN '同时间(+0:00)'
         WHEN time_gap LIKE '+%' THEN '有时间差(+X:XX)'
         WHEN time_gap IN ('DNF','DNS','OTL','DSQ') THEN time_gap
         ELSE '其他: ' + time_gap
       END as cat,
       COUNT(*) as cnt
     FROM stage_results GROUP BY cat ORDER BY cnt DESC`
  );
  console.log('\n📊 最终分布:');
  dist.forEach(r => console.log(`  ${r.cat}: ${r.cnt}`));

  await c.end();
})();
