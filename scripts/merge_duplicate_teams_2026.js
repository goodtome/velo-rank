const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'config', '.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 13306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123456',
  database: process.env.DB_NAME || 'jersey_db',
  charset: 'utf8mb4'
};

const DRY_RUN = process.argv.includes('--dry-run');

const MERGES = [
  ['Alpecin - Premier Tech', 'ALPECIN-PREMIER TECH'],
  ['BARDIANI CSF 7 SABER', 'Bardiani-CSF 7 Saber'],
  ['Caja Rural - Seguros RGA (PRT)', 'Caja Rural-Seguros RGA'],
  ['CIC Pro Cycling Academy (CT)', 'CIC Pro Cycling Academy'],
  ['Cofidis (PRT)', 'COFIDIS'],
  ['Color Code - Alu Center', 'Color Code-Alu Center'],
  ['Flanders - Baloise', 'TEAM FLANDERS - BALOISE'],
  ['Jayco AlUla', 'TEAM JAYCO ALULA'],
  ['Modern Adventure', 'Modern Adventure Pro Cycling'],
  ['Netcompany INEOS', 'Netcompany INEOS Cycling Team'],
  ['Netcompany INEOS (WT)', 'Netcompany INEOS Cycling Team'],
  ["Nice Métropole Côte d'Azur (CT)", "Nice Métropole Côte d'Azur"],
  ['Novo Nordisk', 'TEAM NOVO NORDISK'],
  ['NSN', 'NSN CYCLING TEAM'],
  ['Tarteletto - Isorex', 'Tarteletto-Isorex'],
  ['TotalEnergies (PRT)', 'TOTALENERGIES'],
  ['Tudor', 'Tudor Pro Cycling Team'],
  ['Unibet Rose Rockets (PRT)', 'UNIBET ROSE ROCKETS'],
  ['Van Rysel Roubaix', 'Van Rysel - Roubaix'],
  ['Van Rysel Roubaix (CT)', 'Van Rysel - Roubaix'],
  ['XDS Astana', 'XDS ASTANA TEAM']
];

const REFERENCE_TABLES = [
  'stage_results',
  'general_classification',
  'jerseys',
  'team_classification'
];

async function getTeamByName(conn, name) {
  const [rows] = await conn.query(
    `SELECT id, uci_code, team_name, team_name_zh, team_name_en, team_slug, category, country
     FROM teams
     WHERE team_name = ?`,
    [name]
  );
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one team named "${name}", found ${rows.length}`);
  }
  return rows[0];
}

async function countReferences(conn, teamId) {
  const refs = {};
  for (const table of REFERENCE_TABLES) {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS count FROM ${table} WHERE team_id = ?`, [teamId]);
    refs[table] = row.count;
  }
  return refs;
}

function metadataPatch(source, target) {
  const patch = {};
  for (const field of ['team_name_zh', 'team_name_en', 'category', 'country', 'logo_url', 'bike_brand']) {
    if (!target[field] && source[field]) patch[field] = source[field];
  }
  if (!target.uci_code && source.uci_code) patch.uci_code = source.uci_code;
  return patch;
}

async function updateMetadata(conn, source, target) {
  const patch = metadataPatch(source, target);
  const entries = Object.entries(patch);
  if (entries.length === 0) return {};

  const setClause = entries.map(([field]) => `${field} = ?`).join(', ');
  await conn.query(
    `UPDATE teams SET ${setClause} WHERE id = ?`,
    [...entries.map(([, value]) => value), target.id]
  );
  return patch;
}

async function buildPlan(conn) {
  const plan = [];
  for (const [sourceName, targetName] of MERGES) {
    const source = await getTeamByName(conn, sourceName);
    const target = await getTeamByName(conn, targetName);
    if (source.id === target.id) {
      throw new Error(`Source and target are the same team: ${sourceName}`);
    }

    plan.push({
      source,
      target,
      sourceRefs: await countReferences(conn, source.id),
      targetRefs: await countReferences(conn, target.id),
      metadataPatch: metadataPatch(source, target)
    });
  }
  return plan;
}

async function mergeTeam(conn, item) {
  const tableUpdates = {};
  for (const table of REFERENCE_TABLES) {
    const [result] = await conn.query(
      `UPDATE ${table} SET team_id = ? WHERE team_id = ?`,
      [item.target.id, item.source.id]
    );
    tableUpdates[table] = result.affectedRows;
  }

  const metadata = await updateMetadata(conn, item.source, item.target);
  const [deleteResult] = await conn.query('DELETE FROM teams WHERE id = ?', [item.source.id]);

  return {
    source: item.source.team_name,
    target: item.target.team_name,
    tableUpdates,
    metadata,
    deleted: deleteResult.affectedRows
  };
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    const plan = await buildPlan(conn);
    console.log(JSON.stringify({ dryRun: DRY_RUN, plan }, null, 2));

    if (DRY_RUN) return;

    await conn.beginTransaction();
    try {
      const summary = [];
      for (const item of plan) {
        summary.push(await mergeTeam(conn, item));
      }
      await conn.commit();
      console.log(JSON.stringify({ merged: summary }, null, 2));
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
