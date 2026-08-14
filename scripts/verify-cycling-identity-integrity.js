/* Verify that identity consolidation did not leave dangling local references. */

const mysql = require('mysql2/promise');
const { localDbConfig, prodDbConfig } = require('./lib/db-config');

const CHECKS = [
  ['stage_results.team_id', 'stage_results', 'team_id', 'teams'],
  ['general_classification.team_id', 'general_classification', 'team_id', 'teams'],
  ['jerseys.team_id', 'jerseys', 'team_id', 'teams'],
  ['team_classification.team_id', 'team_classification', 'team_id', 'teams'],
  ['stage_results.rider_id', 'stage_results', 'rider_id', 'riders'],
  ['general_classification.rider_id', 'general_classification', 'rider_id', 'riders'],
  ['jerseys.rider_id', 'jerseys', 'rider_id', 'riders'],
  ['points_classification.rider_id', 'points_classification', 'rider_id', 'riders'],
  ['mountains_classification.rider_id', 'mountains_classification', 'rider_id', 'riders'],
  ['youth_classification.rider_id', 'youth_classification', 'rider_id', 'riders'],
  ['riders_favorites.rider_id', 'riders_favorites', 'rider_id', 'riders']
];

async function main() {
  const production = process.argv.includes('--production');
  const conn = await mysql.createConnection(production ? prodDbConfig() : localDbConfig());
  try {
    const [tableRows] = await conn.query('SHOW TABLES');
    const tables = new Set(tableRows.map(row => Object.values(row)[0]));
    const results = [];

    for (const [name, sourceTable, sourceColumn, targetTable] of CHECKS) {
      if (!tables.has(sourceTable) || !tables.has(targetTable)) continue;
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS count FROM \`${sourceTable}\` source
         LEFT JOIN \`${targetTable}\` target ON target.id = source.\`${sourceColumn}\`
         WHERE target.id IS NULL`
      );
      results.push({ relation: name, orphans: Number(row.count || 0) });
    }

    const totalOrphans = results.reduce((sum, result) => sum + result.orphans, 0);
    console.log(JSON.stringify({ environment: production ? 'production' : 'local', totalOrphans, checks: results }, null, 2));
    if (totalOrphans > 0) process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
