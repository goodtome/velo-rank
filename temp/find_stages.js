const pool = require('../server/config/db-pool');

async function getStages() {
  const raceId = 'e597183f-8ea4-4fb0-a469-661c57c5a958';
  try {
    const [rows] = await pool.query(
      'SELECT id, stage_number, stage_name FROM stages WHERE race_id = ? AND stage_number IN (19, 20) ORDER BY stage_number',
      [raceId]
    );
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

getStages();
