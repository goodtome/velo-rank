const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  const tables = [
    ['stage_results', 'time_gap'],
    ['general_classification', 'time_gap'],
    ['general_classification', 'total_time'],
    ['youth_classification', 'time_gap'],
    ['youth_classification', 'time'],
    ['team_classification', 'time_gap'],
    ['team_classification', 'total_time'],
  ];

  for (const [table, col] of tables) {
    console.log(`\n=== ${table}.${col} 异常值 (以",,"开头) ===`);
    const [rows] = await c.query(
      `SELECT ${col} as val, COUNT(*) as cnt FROM ${table} WHERE ${col} LIKE ',,%' GROUP BY ${col} ORDER BY cnt DESC LIMIT 15`
    );
    if (rows.length === 0) console.log('  (无)');
    else rows.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

    // Also count total affected
    const [total] = await c.query(`SELECT COUNT(*) as cnt FROM ${table} WHERE ${col} LIKE ',,%'`);
    if (total[0].cnt > 0) console.log(`  总计: ${total[0].cnt} 条`);
  }

  // Check for other weird patterns in stage_results.time_gap
  console.log('\n=== stage_results.time_gap 其他可疑模式 ===');
  const [other] = await c.query(
    `SELECT time_gap as val, COUNT(*) as cnt FROM stage_results 
     WHERE time_gap IS NOT NULL AND time_gap != '' 
       AND time_gap NOT LIKE '+%' 
       AND time_gap NOT LIKE ',,%'
       AND time_gap NOT REGEXP '^[0-9]'
       AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')
     GROUP BY time_gap ORDER BY cnt DESC LIMIT 20`
  );
  if (other.length === 0) console.log('  (无)');
  else other.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

  await c.end();
})();
