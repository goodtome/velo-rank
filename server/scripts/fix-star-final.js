const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  
  const [rows] = await c.query("SELECT id, time_gap FROM stage_results WHERE time_gap LIKE '*%'");
  console.log(`清理 ${rows.length} 条 * 前缀...`);
  
  for (const row of rows) {
    const newVal = row.time_gap.replace(/^\*/, '');
    await c.query('UPDATE stage_results SET time_gap = ? WHERE id = ?', [newVal, row.id]);
  }
  console.log(`✅ 已清理`);

  // Final check
  const [check] = await c.query("SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '*%' OR time_gap LIKE ',,%'");
  console.log(`残留 * 或 ,,: ${check[0].cnt}`);

  // Show time_gap distribution after fix
  console.log('\n=== stage_results.time_gap 分布 (修复后) ===');
  const [dist] = await c.query(
    `SELECT 
       CASE 
         WHEN time_gap IS NULL THEN 'NULL'
         WHEN time_gap = '' THEN 'empty'
         WHEN time_gap LIKE '+0:00' THEN '+0:00 (same time)'
         WHEN time_gap LIKE '+%' THEN '+X:XX (time gap)'
         WHEN time_gap IN ('DNF','DNS','OTL','DSQ') THEN time_gap
         ELSE CONCAT('OTHER: ', time_gap)
       END as category,
       COUNT(*) as cnt
     FROM stage_results GROUP BY category ORDER BY cnt DESC`
  );
  dist.forEach(r => console.log(`  ${r.category}: ${r.cnt}`));

  await c.end();
})();
