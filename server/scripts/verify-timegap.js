const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  console.log('🔍 最终数据验证');
  console.log('='.repeat(60));

  // 1. Check for any remaining bad patterns in stage_results
  const checks = [
    ['stage_results.time_gap 含",,"', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE ',,%'"],
    ['stage_results.time_gap 含"*"', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '*%'"],
    ['stage_results.time_gap 裸时间', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap IS NOT NULL AND time_gap != '' AND time_gap NOT LIKE '+%' AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')"],
    ['general_classification.total_time 含",,"', "SELECT COUNT(*) as cnt FROM general_classification WHERE total_time LIKE ',,%'"],
    ['general_classification.total_time 含"*"', "SELECT COUNT(*) as cnt FROM general_classification WHERE total_time LIKE '*%'"],
    ['youth_classification.time 含",,"', "SELECT COUNT(*) as cnt FROM youth_classification WHERE time LIKE ',,%'"],
    ['team_classification.total_time 含",,"', "SELECT COUNT(*) as cnt FROM team_classification WHERE total_time LIKE ',,%'"],
  ];

  let allClean = true;
  for (const [label, sql] of checks) {
    const [r] = await c.query(sql);
    const ok = r[0].cnt === 0;
    if (!ok) allClean = false;
    console.log(`  ${ok ? '✅' : '⚠️'} ${label}: ${r[0].cnt}`);
  }

  // 2. Show stage_results.time_gap distribution
  console.log('\n📊 stage_results.time_gap 分布:');
  const [dist] = await c.query(
    `SELECT 
       CASE 
         WHEN time_gap IS NULL THEN 'NULL'
         WHEN time_gap = '' THEN '空'
         WHEN time_gap LIKE '+0:00' OR time_gap LIKE '+0.000' THEN '+0:00(同时间)'
         WHEN time_gap LIKE '+%' THEN '+X:XX(时间差)'
         WHEN time_gap IN ('DNF','DNS','OTL','DSQ') THEN time_gap
         ELSE '异常'
       END as cat,
       COUNT(*) as cnt
     FROM stage_results GROUP BY cat ORDER BY cnt DESC`
  );
  dist.forEach(r => console.log(`  ${r.cat}: ${r.cnt}`));

  // 3. Sample top 3 from a few stages to verify format
  console.log('\n🔍 抽样验证 (S07, S10, S21):');
  for (const sn of [7, 10, 21]) {
    const [rows] = await c.query(
      `SELECT sr.rank_pos, r.rider_name, sr.time_gap 
       FROM stage_results sr JOIN riders r ON sr.rider_id = r.id 
       JOIN stages s ON sr.stage_id = s.id JOIN races rc ON s.race_id = rc.id
       WHERE rc.race_code = 'giro-ditalia-2026' AND s.stage_number = ?
       ORDER BY sr.rank_pos LIMIT 3`, [sn]
    );
    console.log(`  S${String(sn).padStart(2,'0')}:`);
    rows.forEach(r => console.log(`    #${r.rank_pos} ${r.rider_name}: ${r.time_gap}`));
  }

  if (allClean) console.log('\n🎉 所有 time_gap 格式已修复！');
  await c.end();
})();
