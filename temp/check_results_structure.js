const pool = require('../server/config/db-pool');

async function checkResultsStructure() {
  try {
    const [rows] = await pool.query('DESCRIBE stage_results');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkResultsStructure();
