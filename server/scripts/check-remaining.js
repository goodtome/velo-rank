const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  
  console.log('=== 残留 * 前缀值 ===');
  const [rows] = await c.query(
    "SELECT time_gap as val, COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '*%' AND time_gap NOT LIKE '*+%' GROUP BY time_gap ORDER BY cnt DESC"
  );
  rows.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

  // Also sample some records
  console.log('\n=== 残留记录样例 ===');
  const [samples] = await c.query(
    `SELECT sr.rank_pos, r.rider_name, sr.time_gap 
     FROM stage_results sr JOIN riders r ON sr.rider_id = r.id 
     WHERE sr.time_gap LIKE '*%' AND sr.time_gap NOT LIKE '*+%' 
     LIMIT 15`
  );
  samples.forEach(r => console.log(`  #${r.rank_pos} ${r.rider_name}: "${r.time_gap}"`));

  await c.end();
})();
