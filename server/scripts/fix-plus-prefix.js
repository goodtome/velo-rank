const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  // Get stage IDs for 19 and 20
  const [stageIds] = await c.query(
    "SELECT s.id, s.stage_number FROM stages s JOIN races r ON s.race_id = r.id WHERE r.race_code = 'giro-ditalia-2026' AND s.stage_number IN (19, 20)"
  );

  console.log('修复 Stage 19-20 缺失 + 前缀（补充轮）...');
  let total = 0;

  for (const stage of stageIds) {
    // Get ALL time_gap values that don't start with + and aren't special
    const [rows] = await c.query(
      `SELECT id, time_gap FROM stage_results 
       WHERE stage_id = ? 
         AND time_gap IS NOT NULL AND time_gap != ''
         AND time_gap NOT LIKE '+%'
         AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')`,
      [stage.id]
    );

    console.log(`  Stage ${stage.stage_number}: ${rows.length} 条缺 + 前缀`);
    let fixed = 0;
    for (const row of rows) {
      const newVal = '+' + row.time_gap;
      await c.query('UPDATE stage_results SET time_gap = ? WHERE id = ?', [newVal, row.id]);
      fixed++;
    }
    console.log(`    已修复 ${fixed} 条`);
    total += fixed;
  }

  // Final verification: count remaining non-+ non-special values
  console.log(`\n总计修复: ${total}`);
  const [remaining] = await c.query(
    `SELECT time_gap, COUNT(*) as cnt FROM stage_results 
     WHERE time_gap IS NOT NULL AND time_gap != ''
       AND time_gap NOT LIKE '+%'
       AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')
     GROUP BY time_gap LIMIT 5`
  );
  if (remaining.length === 0) {
    console.log('✅ 所有 time_gap 格式已修正！');
  } else {
    console.log('⚠️ 仍有残留:');
    remaining.forEach(r => console.log(`  "${r.time_gap}" x${r.cnt}`));
  }

  await c.end();
})();
