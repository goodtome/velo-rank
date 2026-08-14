const path = require('path');
const mysql = require('mysql2/promise');
const { localDbConfig } = require('./lib/db-config');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'config', '.env') });

const DB_CONFIG = localDbConfig();

const DRY_RUN = process.argv.includes('--dry-run');

const MERGES = [
  {
    sourceName: 'EF Education - Easy Post',
    targetName: 'EF EDUCATION - EASYPOST'
  },
  {
    sourceName: 'Pinarello-Q36.5',
    targetName: 'PINARELLO-Q36.5 PRO CYCLING',
    targetPatch: {
      team_name_zh: 'Pinarello-Q36.5职业自行车队',
      team_slug: 'pinarello-q365-pro-cycling',
      category: 'UCI_PRO_TEAM'
    }
  },
  {
    sourceName: 'Pinarello Q36.5 Pro Cycling Team',
    targetName: 'PINARELLO-Q36.5 PRO CYCLING',
    targetPatch: {
      team_name_zh: 'Pinarello-Q36.5职业自行车队',
      team_slug: 'pinarello-q365-pro-cycling',
      category: 'UCI_PRO_TEAM'
    }
  },
  {
    sourceName: 'Polti VisitMalta',
    targetName: 'TEAM POLTI VISITMALTA',
    targetPatch: {
      team_name_zh: '波尔蒂-VisitMalta车队',
      team_slug: 'team-polti-visitmalta',
      category: 'UCI_PRO_TEAM'
    }
  },
  {
    sourceName: 'RedBull - Bora-Hansgrohe',
    targetName: 'RED BULL - BORA - HANSGROHE'
  }
];

const REFERENCE_TABLES = [
  'stage_results',
  'general_classification',
  'jerseys',
  'team_classification'
];

async function getTeamByName(conn, name) {
  const [rows] = await conn.query(
    `SELECT id, uci_code, team_name, team_name_zh, team_name_en, team_slug, category, country, logo_url, bike_brand
     FROM teams
     WHERE team_name = ?`,
    [name]
  );
  return rows;
}

async function countReferences(conn, teamId) {
  const refs = {};
  for (const table of REFERENCE_TABLES) {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS count FROM ${table} WHERE team_id = ?`, [teamId]);
    refs[table] = row.count;
  }
  return refs;
}

function metadataPatch(source, target, override = {}) {
  const patch = { ...override };
  for (const field of ['team_name_zh', 'team_name_en', 'category', 'country', 'logo_url', 'bike_brand']) {
    if (patch[field] === undefined && !target[field] && source[field]) patch[field] = source[field];
  }
  if (patch.uci_code === undefined && !target.uci_code && source.uci_code) patch.uci_code = source.uci_code;
  return patch;
}

async function applyPatch(conn, teamId, patch) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return {};
  const setClause = entries.map(([field]) => `${field} = ?`).join(', ');
  await conn.query(`UPDATE teams SET ${setClause} WHERE id = ?`, [
    ...entries.map(([, value]) => value),
    teamId
  ]);
  return Object.fromEntries(entries);
}

async function buildPlan(conn) {
  const plan = [];
  for (const item of MERGES) {
    const sources = await getTeamByName(conn, item.sourceName);
    const targets = await getTeamByName(conn, item.targetName);
    if (targets.length !== 1) {
      throw new Error(`Expected exactly one target team named "${item.targetName}", found ${targets.length}`);
    }
    if (sources.length === 0) {
      plan.push({ ...item, source: null, target: targets[0], skipped: 'source_not_found' });
      continue;
    }
    if (sources.length !== 1) {
      throw new Error(`Expected at most one source team named "${item.sourceName}", found ${sources.length}`);
    }
    const source = sources[0];
    const target = targets[0];
    plan.push({
      ...item,
      source,
      target,
      sourceRefs: await countReferences(conn, source.id),
      targetRefs: await countReferences(conn, target.id),
      metadataPatch: metadataPatch(source, target, item.targetPatch)
    });
  }
  return plan;
}

async function mergeTeam(conn, item) {
  const metadata = await applyPatch(conn, item.target.id, item.metadataPatch);
  if (!item.source) return { source: item.sourceName, target: item.target.team_name, metadata, skipped: item.skipped };

  const tableUpdates = {};
  for (const table of REFERENCE_TABLES) {
    const [result] = await conn.query(
      `UPDATE ${table} SET team_id = ? WHERE team_id = ?`,
      [item.target.id, item.source.id]
    );
    tableUpdates[table] = result.affectedRows;
  }

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
