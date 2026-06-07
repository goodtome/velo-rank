const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  console.log('🔧 清理残留 * 前缀...');

  // Find all * prefix that don't already have + after *
  const [rows] = await c.query(
    "SELECT id, time_gap FROM stage_results WHERE time_gap LIKE '*%' AND time_gap NOT LIKE '*+%'"
  );
  console.log(`  发现 ${rows.length} 条`);

  let fixed = 0;
  for (const row of rows) {
    const val = row.time_gap;
    // Strip * prefix, then add +
    const stripped = val.replace(/^\*/, '');
    // If it already looks like a time (starts with digit), add +
    let newVal;
    if (/^\d/.test(stripped)) {
      newVal = '+' + stripped;
    } else {
      newVal = stripped || '+0:00';
    }
    await c.query('UPDATE stage_results SET time_gap = ? WHERE id = ?', [newVal, row.id]);
    console.log(`    "${val}" → "${newVal}"`);
    fixed++;
  }
  console.log(`  ✅ 已修复 ${fixed} 条`);

  // Final verification
  console.log('\n🔍 最终验证...');
  const checks = [
    ['stage_results.time_gap 含",,"', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE ',,%'"],
    ['stage_results.time_gap 含"*"', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '*%'"],
    ['general_classification.total_time 含",,"', "SELECT COUNT(*) as cnt FROM general_classification WHERE total_time LIKE ',,%'"],
    ['youth_classification.time 含",,"', "SELECT COUNT(*) as cnt FROM youth_classification WHERE time LIKE ',,%'"],
    ['team_classification.total_time 含",,"', "SELECT COUNT(*) as cnt FROM team_classification WHERE total_time LIKE ',,%'"],
  ];
  for (const [label, sql] of checks) {
    const [r] = await c.query(sql);
    console.log(`  ${r[0].cnt === 0 ? '✅' : '⚠️'} ${label}: ${r[0].cnt}`);
  }

  await c.end();
})();
