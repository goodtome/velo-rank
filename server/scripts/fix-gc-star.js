const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  const [rows] = await c.query("SELECT id, total_time FROM general_classification WHERE total_time LIKE '*%'");
  console.log(`修复 general_classification.total_time * 前缀 (${rows.length} 条):`);

  for (const row of rows) {
    const val = row.total_time.replace(/^\*/, '');
    await c.query('UPDATE general_classification SET total_time = ? WHERE id = ?', [val, row.id]);
  }
  console.log(`✅ 已清理`);

  const [check] = await c.query("SELECT COUNT(*) as cnt FROM general_classification WHERE total_time LIKE '*%'");
  console.log(`残留: ${check[0].cnt}`);

  await c.end();
})();
