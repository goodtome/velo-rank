const mysql = require('mysql2/promise');
const { localDbConfig } = require('../../scripts/lib/db-config');

(async () => {
  const c = await mysql.createConnection(localDbConfig());
  for (const t of ['stage_results','general_classification','youth_classification','team_classification','points_classification','mountains_classification']) {
    const [cols] = await c.query(`SHOW COLUMNS FROM ${t}`);
    console.log(`${t}: ${cols.map(c => c.Field + (c.Key === 'PRI' ? '*' : '')).join(', ')}`);
  }
  await c.end();
})();
