const pool = require('../server/config/db-pool');

async function checkRaceData() {
  const raceId = 'e597183f-8ea4-4fb0-a469-661c57c5a958'; // Giro 2026
  try {
    console.log('--- Checking Stages ---');
    const [stages] = await pool.query(
      `SELECT s.id, s.stage_number, s.stage_name, COUNT(r.id) as result_count 
       FROM stages s
       LEFT JOIN stage_results r ON s.id = r.stage_id
       WHERE s.race_id = ?
       GROUP BY s.id
       ORDER BY s.stage_number`,
      [raceId]
    );
    
    console.log(JSON.stringify(stages, null, 2));
    
    const missingResults = stages.filter(s => s.result_count === 0);
    console.log('\n--- Stages missing results ---');
    console.log(missingResults.map(s => `Stage ${s.stage_number}: ${s.stage_name}`).join('\n'));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkRaceData();
