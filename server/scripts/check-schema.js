const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  for (const t of ['stage_results','general_classification','youth_classification','team_classification','points_classification','mountains_classification']) {
    const [cols] = await c.query(`SHOW COLUMNS FROM ${t}`);
    console.log(`${t}: ${cols.map(c => c.Field + (c.Key === 'PRI' ? '*' : '')).join(', ')}`);
  }
  await c.end();
})();
