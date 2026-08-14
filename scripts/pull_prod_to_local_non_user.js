#!/usr/bin/env node

/*
 * Pull production non-user data into the local database.
 * Default mode is read-only. --apply rebuilds only local non-user tables.
 */

const mysql = require('mysql2/promise');
const { localDbConfig, prodDbConfig } = require('./lib/db-config');

const APPLY = process.argv.includes('--apply');
const USER_TABLE_PATTERNS = [
  /^user/i, /users/i, /favorite/i, /favorites/i, /^push_/i, /push/i,
  /token/i, /auth/i, /openid/i, /admin_logs/i
];

function qid(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function isUserTable(table) {
  return USER_TABLE_PATTERNS.some(pattern => pattern.test(table));
}

function stripForeignKeys(createSql) {
  const lines = createSql.split(/\r?\n/).filter(line => {
    const upper = line.trim().toUpperCase();
    return !upper.startsWith('CONSTRAINT ') && !upper.startsWith('FOREIGN KEY ');
  });
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].trim().startsWith(')')) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (lines[j].trim()) {
        lines[j] = lines[j].replace(/,\s*$/, '');
        break;
      }
    }
    break;
  }
  return lines.join('\n');
}

async function getTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  const key = Object.keys(rows[0] || {})[0];
  return rows.map(row => row[key]).sort();
}

async function getCount(conn, table) {
  const [[row]] = await conn.query(`SELECT COUNT(*) AS count FROM ${qid(table)}`);
  return Number(row.count || 0);
}

async function getColumns(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${qid(table)}`);
  return rows.map(row => row.Field);
}

async function copyTable(source, target, table) {
  const columns = await getColumns(source, table);
  const columnSql = columns.map(qid).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const [rows] = await source.query(`SELECT ${columnSql} FROM ${qid(table)}`);
  let inserted = 0;

  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    const values = chunk.flatMap(row => columns.map(column => row[column]));
    const valueSql = chunk.map(() => `(${placeholders})`).join(', ');
    await target.query(`INSERT INTO ${qid(table)} (${columnSql}) VALUES ${valueSql}`, values);
    inserted += chunk.length;
  }
  return inserted;
}

async function main() {
  const source = await mysql.createConnection(prodDbConfig({ dateStrings: true }));
  const target = await mysql.createConnection(localDbConfig({ dateStrings: true }));
  try {
    const [prodTables, localTables] = await Promise.all([getTables(source), getTables(target)]);
    const dataTables = prodTables.filter(table => !isUserTable(table));
    const localDataTables = localTables.filter(table => !isUserTable(table));
    const counts = {};
    for (const table of dataTables) counts[table] = await getCount(source, table);
    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      source: 'production',
      destination: 'local',
      dataTables,
      excludedUserTables: prodTables.filter(isUserTable),
      sourceCounts: counts,
      localOnlyDataTables: localDataTables.filter(table => !dataTables.includes(table))
    }, null, 2));

    if (!APPLY) return;

    await target.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of localDataTables.slice().reverse()) {
        await target.query(`DROP TABLE IF EXISTS ${qid(table)}`);
      }
      for (const table of dataTables) {
        const [rows] = await source.query(`SHOW CREATE TABLE ${qid(table)}`);
        await target.query(stripForeignKeys(rows[0]['Create Table']));
      }
      const copied = {};
      for (const table of dataTables) copied[table] = await copyTable(source, target, table);
      console.log(JSON.stringify({ copied }, null, 2));
    } finally {
      await target.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch(error => {
  console.error('FAIL:', error.message || error);
  process.exit(1);
});
