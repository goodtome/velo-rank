#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

const LOCAL = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 13306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123456',
  database: process.env.DB_NAME || 'jersey_db',
  dateStrings: true
};

const PROD = {
  host: process.env.DB_HOST_PROD,
  port: Number(process.env.DB_PORT_PROD || 4000),
  user: process.env.DB_USER_PROD,
  password: process.env.DB_PASSWORD_PROD,
  database: process.env.DB_NAME_PROD || process.env.DB_NAME || 'jersey_db',
  ssl: { rejectUnauthorized: true },
  dateStrings: true
};

const USER_TABLE_PATTERNS = [
  /^user/i,
  /users/i,
  /favorite/i,
  /favorites/i,
  /^push_/i,
  /push/i,
  /token/i,
  /auth/i,
  /openid/i,
  /admin_logs/i
];

const ORDER_HINTS = [
  'races',
  'teams',
  'riders',
  'stages',
  'stage_results',
  'general_classification',
  'team_classification',
  'points_classification',
  'mountains_classification',
  'youth_classification',
  'jerseys',
  'sync_logs'
];

function qid(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function isUserTable(table) {
  return USER_TABLE_PATTERNS.some(pattern => pattern.test(table));
}

function normalizeDefault(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/^'(.*)'$/s, '$1').toLowerCase();
}

function sameColumn(a, b) {
  return a.Type.toLowerCase() === b.Type.toLowerCase()
    && a.Null === b.Null
    && normalizeDefault(a.Default) === normalizeDefault(b.Default)
    && String(a.Extra || '').toLowerCase() === String(b.Extra || '').toLowerCase();
}

async function getTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  const key = Object.keys(rows[0] || {})[0];
  return rows.map(row => row[key]).sort();
}

async function getColumns(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${qid(table)}`);
  return rows;
}

async function getCreateTable(conn, table) {
  const [rows] = await conn.query(`SHOW CREATE TABLE ${qid(table)}`);
  return rows[0]['Create Table'];
}

function stripForeignKeys(createSql) {
  const lines = createSql.split(/\r?\n/);
  const filtered = lines.filter(line => {
    const trimmed = line.trim().toUpperCase();
    return !trimmed.startsWith('CONSTRAINT ') && !trimmed.startsWith('FOREIGN KEY ');
  });

  for (let i = filtered.length - 1; i >= 0; i -= 1) {
    if (filtered[i].trim().startsWith(')')) {
      for (let j = i - 1; j >= 0; j -= 1) {
        if (filtered[j].trim()) {
          filtered[j] = filtered[j].replace(/,\s*$/, '');
          break;
        }
      }
      break;
    }
  }

  return filtered.join('\n');
}

async function getCount(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM ${qid(table)}`);
  return Number(rows[0].c);
}

function sortTables(tables) {
  const hintIndex = new Map(ORDER_HINTS.map((table, index) => [table, index]));
  return tables.slice().sort((a, b) => {
    const ai = hintIndex.has(a) ? hintIndex.get(a) : 1000;
    const bi = hintIndex.has(b) ? hintIndex.get(b) : 1000;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

function splitInsertColumns(localCols, prodCols) {
  const prodByName = new Map(prodCols.map(col => [col.Field, col]));
  const columns = [];
  const incompatible = [];

  for (const localCol of localCols) {
    const prodCol = prodByName.get(localCol.Field);
    if (!prodCol) continue;
    if (!sameColumn(localCol, prodCol)) {
      incompatible.push({
        column: localCol.Field,
        local: localCol.Type,
        prod: prodCol.Type,
        localNull: localCol.Null,
        prodNull: prodCol.Null,
        localExtra: localCol.Extra,
        prodExtra: prodCol.Extra
      });
    }
    columns.push(localCol.Field);
  }

  return { columns, incompatible };
}

async function audit(local, prod) {
  const [localTables, prodTables] = await Promise.all([getTables(local), getTables(prod)]);
  const commonTables = localTables.filter(table => prodTables.includes(table));
  const missingInProd = localTables.filter(table => !prodTables.includes(table));
  const extraInProd = prodTables.filter(table => !localTables.includes(table));
  const dataTables = sortTables(localTables.filter(table => !isUserTable(table)));
  const excludedTables = sortTables(commonTables.filter(isUserTable));
  const reports = [];

  for (const table of dataTables) {
    const [localCols, localCount] = await Promise.all([
      getColumns(local, table),
      getCount(local, table)
    ]);
    const existsInProd = prodTables.includes(table);
    const [prodCols, prodCount] = existsInProd
      ? await Promise.all([getColumns(prod, table), getCount(prod, table)])
      : [[], null];
    const { columns, incompatible } = existsInProd
      ? splitInsertColumns(localCols, prodCols)
      : { columns: localCols.map(col => col.Field), incompatible: [{ column: '*table*', local: 'exists', prod: 'missing' }] };
    const localPrimary = localCols.filter(col => col.Key === 'PRI').map(col => `${col.Field} ${col.Type}`).join(', ');
    const prodPrimary = prodCols.filter(col => col.Key === 'PRI').map(col => `${col.Field} ${col.Type}`).join(', ');
    reports.push({
      table,
      localCount,
      prodCount,
      diff: localCount - prodCount,
      columns,
      incompatible,
      localPrimary,
      prodPrimary
    });
  }

  return {
    localTables,
    prodTables,
    commonTables,
    dataTables,
    excludedTables,
    missingInProd,
    extraInProd,
    reports
  };
}

async function recreateTableFromLocal(local, prod, table) {
  const createSql = stripForeignKeys(await getCreateTable(local, table));
  await prod.query(`DROP TABLE IF EXISTS ${qid(table)}`);
  await prod.query(createSql);
}

async function copyTable(local, prod, table, columns) {
  await prod.query(`DELETE FROM ${qid(table)}`);

  const colSql = columns.map(qid).join(', ');
  const [rows] = await local.query(`SELECT ${colSql} FROM ${qid(table)}`);
  if (rows.length === 0) return { inserted: 0 };

  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${qid(table)} (${colSql}) VALUES (${placeholders})`;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map(row => columns.map(col => row[col]));
    await prod.query(insertSql.replace(`VALUES (${placeholders})`, `VALUES ${values.map(() => `(${placeholders})`).join(', ')}`), values.flat());
    inserted += chunk.length;
  }

  return { inserted };
}

async function applySync(local, prod, auditResult) {
  const results = [];
  await prod.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    const tables = auditResult.dataTables;
    console.log('Dropping prod non-user tables in dependency order');
    for (const table of tables.slice().reverse()) {
      console.log(`Dropping ${table}`);
      await prod.query(`DROP TABLE IF EXISTS ${qid(table)}`);
    }

    console.log('Recreating prod non-user tables from local schema');
    for (const table of tables) {
      console.log(`Creating ${table}`);
      const createSql = stripForeignKeys(await getCreateTable(local, table));
      await prod.query(createSql);
    }

    for (const table of tables) {
      const localCols = await getColumns(local, table);
      const columns = localCols.map(col => col.Field);
      console.log(`Syncing ${table}`);
      const result = await copyTable(local, prod, table, columns);
      results.push({ table, ...result, recreated: true });
    }
  } finally {
    await prod.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  return results;
}

function printAudit(auditResult) {
  console.log('=== Sync audit: local -> prod, non-user tables ===');
  console.log(`Data tables: ${auditResult.dataTables.join(', ') || '(none)'}`);
  console.log(`Excluded user-related tables: ${auditResult.excludedTables.join(', ') || '(none)'}`);
  if (auditResult.missingInProd.length) console.log(`Missing in prod: ${auditResult.missingInProd.join(', ')}`);
  if (auditResult.extraInProd.length) console.log(`Extra in prod: ${auditResult.extraInProd.join(', ')}`);
  console.log('');

  for (const r of auditResult.reports) {
    const schemaNote = r.incompatible.length || r.localPrimary !== r.prodPrimary
      ? ` schema-diff primary local=[${r.localPrimary}] prod=[${r.prodPrimary}] incompatible=${r.incompatible.length}`
      : '';
    console.log(`${r.table}: local=${r.localCount} prod=${r.prodCount} diff=${r.diff}${schemaNote}`);
    for (const issue of r.incompatible.slice(0, 8)) {
      console.log(`  - ${issue.column}: local ${issue.local} / prod ${issue.prod}`);
    }
    if (r.incompatible.length > 8) {
      console.log(`  - ... ${r.incompatible.length - 8} more incompatible columns`);
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const local = await mysql.createConnection(LOCAL);
  const prod = await mysql.createConnection(PROD);

  try {
    const auditResult = await audit(local, prod);
    printAudit(auditResult);

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to overwrite prod non-user tables from local.');
      return;
    }

    console.log('\nApplying sync. Prod non-user tables will be overwritten from local.');
    const results = await applySync(local, prod, auditResult);
    console.log('\n=== Apply results ===');
    for (const result of results) {
      console.log(`${result.table}: inserted=${result.inserted}${result.recreated ? ' recreated-schema' : ''}`);
    }

    const after = await audit(local, prod);
    console.log('\n=== Post-sync counts ===');
    for (const r of after.reports) {
      console.log(`${r.table}: local=${r.localCount} prod=${r.prodCount} diff=${r.diff}`);
    }
  } finally {
    await local.end();
    await prod.end();
  }
}

main().catch(error => {
  console.error('FAIL:', error);
  process.exit(1);
});
