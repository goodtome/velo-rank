const pool = require('./server/config/db-pool');

async function getStages() {
  const raceId = 'e597183f-8ea4-4fb0-a469-661c57c5a958';
  try {
    const [rows] = await pool.query('SELECT id, stage_number FROM stages WHERE race_id = ? ORDER BY stage_number', [raceId]);
    const map = {};
    rows.forEach(r => map[r.stage_number] = r.id);
    console.log(JSON.stringify(map, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

getStages();
