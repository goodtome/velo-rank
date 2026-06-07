const pool = require('../server/config/db-pool');

async function auditClassifications() {
  const raceId = 'e597183f-8ea4-4fb0-a469-661c57c5a958';
  try {
    const [stages] = await pool.query('SELECT id, stage_number FROM stages WHERE race_id = ? ORDER BY stage_number', [raceId]);
    
    for (const stage of stages) {
      const [pts] = await pool.query('SELECT COUNT(*) as count FROM points_classification WHERE stage_id = ?', [stage.id]);
      const [mtn] = await pool.query('SELECT COUNT(*) as count FROM mountains_classification WHERE stage_id = ?', [stage.id]);
      const [yth] = await pool.query('SELECT COUNT(*) as count FROM youth_classification WHERE stage_id = ?', [stage.id]);
      const [tm] = await pool.query('SELECT COUNT(*) as count FROM team_classification WHERE stage_id = ?', [stage.id]);
      
      console.log(`Stage ${stage.stage_number}: Pts=${pts[0].count}, Mtn=${mtn[0].count}, Yth=${yth[0].count}, Team=${tm[0].count}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

auditClassifications();
