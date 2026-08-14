#!/usr/bin/env node
/**
 * 将单个赛事及其关联实体从 LOCAL 定向同步至 PROD，避免全库覆盖。
 * 用法：node scripts/sync_race_to_prod.js sibiu-tour-2026
 */
const mysql = require('mysql2/promise');
const { localDbConfig, prodDbConfig } = require('./lib/db-config');

const raceCode = process.argv[2];
if (!raceCode) throw new Error('Usage: node scripts/sync_race_to_prod.js <race-code>');
const LOCAL = localDbConfig({ dateStrings: true });
const PROD = prodDbConfig({ dateStrings: true, connectTimeout: 15000 });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const TABLES = [
  ['races', 'id'], ['teams', 'id'], ['riders', 'id'], ['stages', 'id'],
  ['stage_results', 'id'], ['general_classification', 'id'], ['points_classification', 'id'],
  ['mountains_classification', 'id'], ['youth_classification', 'id'], ['team_classification', 'id'], ['jerseys', 'id']
];
function quote(name) { return `\`${name.replace(/`/g, '``')}\``; }
async function retry(label, work, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await work(); } catch (error) {
      last = error;
      if (i < tries) { console.log(`  ${label}: retry ${i}/${tries - 1} (${error.code || error.message})`); await sleep(i * 1500); }
    }
  }
  throw last;
}
async function tableColumns(conn, table) {
  const [rows] = await retry(`columns ${table}`, () => conn.query(`SHOW COLUMNS FROM ${quote(table)}`));
  return rows.map(row => row.Field);
}
async function upsertRows(local, prod, table, rows) {
  if (!rows.length) return 0;
  const prodColumns = new Set(await tableColumns(prod, table));
  const columns = Object.keys(rows[0]).filter(col => prodColumns.has(col));
  const colSql = columns.map(quote).join(',');
  const updateSql = columns.filter(col => col !== 'id').map(col => `${quote(col)}=VALUES(${quote(col)})`).join(',');
  const rowSql = `(${columns.map(() => '?').join(',')})`;
  let synced = 0;
  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250);
    const values = chunk.flatMap(row => columns.map(col => row[col]));
    const sql = `INSERT INTO ${quote(table)} (${colSql}) VALUES ${chunk.map(() => rowSql).join(',')} ON DUPLICATE KEY UPDATE ${updateSql || `${quote('id')}=${quote('id')}`}`;
    await retry(`upsert ${table}`, () => prod.query(sql, values));
    synced += chunk.length;
  }
  return synced;
}
async function main() {
  const local = await mysql.createConnection(LOCAL);
  const prod = await mysql.createConnection(PROD);
  try {
    const [[race]] = await local.query('SELECT * FROM races WHERE race_code=?', [raceCode]);
    if (!race) throw new Error(`Local race not found: ${raceCode}`);
    const [stages] = await local.query('SELECT * FROM stages WHERE race_id=? ORDER BY stage_number', [race.id]);
    const stageIds = stages.map(stage => stage.id);
    const byStage = async table => stageIds.length ? (await local.query(`SELECT * FROM ${quote(table)} WHERE stage_id IN (${stageIds.map(() => '?').join(',')})`, stageIds))[0] : [];
    const stageResults = await byStage('stage_results');
    const gc = await byStage('general_classification');
    const points = await byStage('points_classification');
    const mountains = await byStage('mountains_classification');
    const youth = await byStage('youth_classification');
    const teamsClass = await byStage('team_classification');
    const jerseys = await byStage('jerseys');
    const riderIds = [...new Set([...stageResults, ...gc, ...points, ...mountains, ...youth, ...jerseys].map(row => row.rider_id).filter(Boolean))];
    const teamIds = [...new Set([...stageResults, ...gc, ...jerseys].map(row => row.team_id).filter(Boolean))];
    const riders = riderIds.length ? (await local.query(`SELECT * FROM riders WHERE id IN (${riderIds.map(() => '?').join(',')})`, riderIds))[0] : [];
    const teams = teamIds.length ? (await local.query(`SELECT * FROM teams WHERE id IN (${teamIds.map(() => '?').join(',')})`, teamIds))[0] : [];
    const items = [
      ['races', [race]], ['teams', teams], ['riders', riders], ['stages', stages],
      ['stage_results', stageResults], ['general_classification', gc], ['points_classification', points],
      ['mountains_classification', mountains], ['youth_classification', youth], ['team_classification', teamsClass], ['jerseys', jerseys]
    ];
    console.log(`Sync ${raceCode}: ${stages.length} stages`);
    for (const [table, rows] of items) console.log(`  ${table}: ${await upsertRows(local, prod, table, rows)}`);
    console.log('Verification:');
    for (const [table] of TABLES) {
      const localCount = table === 'races' ? 1 : table === 'stages' ? stages.length : (items.find(x => x[0] === table)?.[1].length || 0);
      let prodCount;
      if (table === 'races') [[{ c: prodCount }]] = await prod.query('SELECT COUNT(*) c FROM races WHERE race_code=?', [raceCode]);
      else if (table === 'stages') [[{ c: prodCount }]] = await prod.query('SELECT COUNT(*) c FROM stages WHERE race_id=?', [race.id]);
      else if (stageIds.length && !['teams', 'riders'].includes(table)) [[{ c: prodCount }]] = await prod.query(`SELECT COUNT(*) c FROM ${quote(table)} WHERE stage_id IN (${stageIds.map(() => '?').join(',')})`, stageIds);
      else prodCount = localCount;
      console.log(`  ${table}: local=${localCount} prod=${prodCount}${localCount === Number(prodCount) ? ' OK' : ' MISMATCH'}`);
    }
  } finally { await local.end(); await prod.end(); }
}
main().catch(error => { console.error('FAIL:', error.stack || error.message); process.exit(1); });
