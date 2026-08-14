const mysql = require('mysql2/promise');
const { localDbConfig } = require('../../scripts/lib/db-config');

(async () => {
  const c = await mysql.createConnection(localDbConfig());
  const [cols] = await c.query('SHOW COLUMNS FROM points_classification');
  console.log('points_classification columns:');
  cols.forEach(c => console.log(`  ${c.Field} (${c.Type}) ${c.Key} ${c.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${c.Default || ''}`));

  // Check unique keys
  const [keys] = await c.query("SHOW INDEX FROM points_classification");
  console.log('\nIndexes:');
  keys.forEach(k => console.log(`  ${k.Key_name}: ${k.Column_name} (${k.Non_unique ? 'non-unique' : 'unique'})`));
  await c.end();
})();
