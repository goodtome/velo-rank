const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  
  // Check all remaining * values
  const [rows] = await c.query(
    "SELECT id, time_gap, rank_pos FROM stage_results WHERE time_gap LIKE '*%' ORDER BY rank_pos"
  );
  console.log(`残留 * 值 (${rows.length} 条):`);
  rows.forEach(r => console.log(`  #${r.rank_pos}: "${r.time_gap}"`));

  await c.end();
})();
