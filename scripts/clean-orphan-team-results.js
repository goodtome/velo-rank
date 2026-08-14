/*
 * Remove local result records whose team_id no longer exists.
 * Default mode is read-only; use --apply to delete inside one transaction.
 */

const mysql = require('mysql2/promise');
const { localDbConfig } = require('./lib/db-config');

const APPLY = process.argv.includes('--apply');
const TABLES = ['stage_results', 'general_classification', 'jerseys', 'team_classification'];

async function getExistingTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  return new Set(rows.map(row => Object.values(row)[0]));
}

async function orphanCount(conn, table) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS count FROM \`${table}\` source
     LEFT JOIN teams target ON target.id = source.team_id
     WHERE target.id IS NULL`
  );
  return Number(row.count || 0);
}

async function main() {
  if (process.argv.includes('--production')) {
    throw new Error('Production execution is intentionally disabled. This tool only cleans the local database.');
  }

  const conn = await mysql.createConnection(localDbConfig());
  try {
    const existingTables = await getExistingTables(conn);
    const tables = TABLES.filter(table => existingTables.has(table));
    const before = Object.fromEntries(await Promise.all(tables.map(async table => [table, await orphanCount(conn, table)])));
    const total = Object.values(before).reduce((sum, count) => sum + count, 0);
    console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', orphanedResults: before, total }, null, 2));

    if (!APPLY || total === 0) return;

    await conn.beginTransaction();
    try {
      const deleted = {};
      for (const table of tables) {
        const [result] = await conn.query(
          `DELETE source FROM \`${table}\` source
           LEFT JOIN teams target ON target.id = source.team_id
           WHERE target.id IS NULL`
        );
        deleted[table] = result.affectedRows;
      }
      await conn.commit();
      console.log(JSON.stringify({ deleted }, null, 2));
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
