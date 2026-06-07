const pool = require('../server/config/db-pool');

async function search() {
  try {
    const [riders] = await pool.query(
      "SELECT id, rider_name FROM riders WHERE rider_name LIKE '%Gee%'"
    );
    console.log('Riders:', JSON.stringify(riders, null, 2));

    const teamNames = [
      'Visma',
      'Lidl',
      'Decathlon',
      'Bora',
      'Ineos'
    ];
    const teams = [];
    for (const name of teamNames) {
      const [rows] = await pool.query(
        'SELECT id, team_name, uci_code FROM teams WHERE team_name LIKE ? OR uci_code LIKE ?',
        [`%${name}%`, `%${name}%`]
      );
      teams.push({ query: name, results: rows });
    }
    console.log('Teams:', JSON.stringify(teams, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

search();
