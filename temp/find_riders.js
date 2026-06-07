const pool = require('../server/config/db-pool');

async function getRiders() {
  const names = [
    'Sepp Kuss',
    'Derek Gee',
    'Giulio Ciccone',
    'Felix Gall',
    'Jonas Vingegaard',
    'Jai Hindley',
    'Thymen Arensman'
  ];
  
  try {
    const riders = [];
    for (const name of names) {
      const [rows] = await pool.query(
        'SELECT id, rider_name, rider_name_zh FROM riders WHERE rider_name LIKE ?',
        [`%${name}%`]
      );
      riders.push({ query: name, results: rows });
    }
    console.log(JSON.stringify(riders, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

getRiders();
