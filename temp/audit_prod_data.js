const mysql = require('mysql2/promise');
require('dotenv').config();

const prodConfig = {
  host: process.env.DB_HOST_PROD,
  port: parseInt(process.env.DB_PORT_PROD) || 4000,
  user: process.env.DB_USER_PROD,
  password: process.env.DB_PASSWORD_PROD,
  database: process.env.DB_NAME_PROD,
  ssl: { rejectUnauthorized: true }
};

async function checkProdData() {
  const raceId = 'e597183f-8ea4-4fb0-a469-661c57c5a958';
  try {
    const prodConn = await mysql.createConnection(prodConfig);
    console.log('--- Checking Prod Stages ---');
    const [stages] = await prodConn.query(
      `SELECT s.stage_number, COUNT(r.id) as result_count 
       FROM stages s
       LEFT JOIN stage_results r ON s.id = r.stage_id
       WHERE s.race_id = ?
       GROUP BY s.id
       ORDER BY s.stage_number`,
      [raceId]
    );
    console.log(JSON.stringify(stages, null, 2));

    console.log('\n--- Checking GC Data ---');
    const [gcCounts] = await prodConn.query(
      `SELECT stage_id, COUNT(*) as count 
       FROM general_classification 
       WHERE stage_id IN (SELECT id FROM stages WHERE race_id = ?)
       GROUP BY stage_id`,
      [raceId]
    );
    console.log('GC counts by stage:', JSON.stringify(gcCounts, null, 2));

    await prodConn.end();
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkProdData();
