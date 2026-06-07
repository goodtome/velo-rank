const pool = require('../server/config/db-pool');

async function verify() {
  const stage19Id = 'c7783c90-c346-41c8-8799-9080da8b11ee';
  const stage20Id = 'f4ab60ad-2def-44ea-92de-48f1f85f409b';

  try {
    const [rows19] = await pool.query(
      `SELECT r.rank_pos, rd.rider_name, t.team_name, r.time_gap 
       FROM stage_results r
       JOIN riders rd ON r.rider_id = rd.id
       JOIN teams t ON r.team_id = t.id
       WHERE r.stage_id = ?
       ORDER BY r.rank_pos`,
      [stage19Id]
    );
    console.log('Stage 19 Results:', JSON.stringify(rows19, null, 2));

    const [rows20] = await pool.query(
      `SELECT r.rank_pos, rd.rider_name, t.team_name, r.time_gap 
       FROM stage_results r
       JOIN riders rd ON r.rider_id = rd.id
       JOIN teams t ON r.team_id = t.id
       WHERE r.stage_id = ?
       ORDER BY r.rank_pos`,
      [stage20Id]
    );
    console.log('Stage 20 Results:', JSON.stringify(rows20, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

verify();
