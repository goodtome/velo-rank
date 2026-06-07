console.log('NODE_ENV:', process.env.NODE_ENV);
const pool = require('../server/config/db-pool');

async function test() {
  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('Production connection test successful.');
  } catch (err) {
    console.error('Production connection test failed:', err);
  } finally {
    process.exit();
  }
}

test();
