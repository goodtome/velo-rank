const pool = require('../server/config/db-pool');

async function checkStructure() {
  try {
    const [rows] = await pool.query('DESCRIBE riders');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkStructure();
