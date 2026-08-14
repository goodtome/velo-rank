#!/usr/bin/env node
// Clean up duplicate races and fix known race data errors.
const mysql = require('mysql2/promise');
const { localDbConfig } = require('./lib/db-config');

const APPLY = process.argv.includes('--apply');

const DB = localDbConfig({ dateStrings: true });

const STAGE_DATA_TABLES = [
  'stage_results',
  'general_classification',
  'points_classification',
  'mountains_classification',
  'youth_classification',
  'team_classification',
  'jerseys'
];

const OPTIONAL_RACE_TABLES = ['sync_logs'];
const OPTIONAL_STAGE_OR_RACE_TABLES = ['push_history'];

const FIXES = {
  // Duplicate races: keep the canonical race_code, delete the duplicate race_code.
  dupRaces: [
    { keep: 'tour-of-slovenia-2026', del: 'tour-slovenia-2026' },
    { keep: 'baloise-belgium-tour-2026', del: 'belgium-tour-2026' },
    { keep: 'tour-de-suisse-2026', del: 'tour-suisse-2026' },
    { keep: 'clasica-almeria-2026', del: 'clasica-almeria-men-2026' }
  ],
  // If duplicate rows with this same race_code exist, keep the one with results.
  womenSpecial: {
    raceCode: 'tour-de-suisse-women-2026'
  },
  stageTypeFixes: [
    { race_code: 'tour-de-suisse-women-2026', stage: 4, from: 'ttt', to: 'itt' }
  ]
};

function qid(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0].c) > 0;
}

async function countStageData(conn, table, raceId) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM ${qid(table)} target
     JOIN stages s ON s.id = target.stage_id
     WHERE s.race_id = ?`,
    [raceId]
  );
  return Number(rows[0].c);
}

async function countByColumn(conn, table, column, value) {
  if (!await tableExists(conn, table)) return null;
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM ${qid(table)} WHERE ${qid(column)} = ?`,
    [value]
  );
  return Number(rows[0].c);
}

async function countPushHistory(conn, raceId) {
  if (!await tableExists(conn, 'push_history')) return null;
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM push_history ph
     LEFT JOIN stages s ON s.id = ph.stage_id
     WHERE ph.race_id = ? OR s.race_id = ?`,
    [raceId, raceId]
  );
  return Number(rows[0].c);
}

async function getRaceByCode(conn, raceCode) {
  const [rows] = await conn.query(
    'SELECT id, race_code, race_name_zh FROM races WHERE race_code = ? ORDER BY created_at, id',
    [raceCode]
  );
  return rows;
}

async function getRaceSummary(conn, raceId) {
  const summary = {};
  summary.stages = await countByColumn(conn, 'stages', 'race_id', raceId);

  for (const table of STAGE_DATA_TABLES) {
    summary[table] = await countStageData(conn, table, raceId);
  }

  for (const table of OPTIONAL_RACE_TABLES) {
    summary[table] = await countByColumn(conn, table, 'race_id', raceId);
  }

  for (const table of OPTIONAL_STAGE_OR_RACE_TABLES) {
    summary[table] = await countPushHistory(conn, raceId);
  }

  return summary;
}

function totalResults(summary) {
  return Number(summary.stage_results || 0);
}

function printSummary(label, race, summary) {
  const counts = Object.entries(summary)
    .filter(([, value]) => value !== null)
    .map(([table, value]) => `${table}=${value}`)
    .join(', ');
  console.log(`  ${label}: ${race.race_code} (${race.id.substring(0, 8)}) ${counts}`);
}

async function deleteRaceById(conn, raceId) {
  if (await tableExists(conn, 'push_history')) {
    await conn.query(
      `DELETE ph
       FROM push_history ph
       LEFT JOIN stages s ON s.id = ph.stage_id
       WHERE ph.race_id = ? OR s.race_id = ?`,
      [raceId, raceId]
    );
  }

  if (await tableExists(conn, 'sync_logs')) {
    await conn.query('DELETE FROM sync_logs WHERE race_id = ?', [raceId]);
  }

  for (const table of STAGE_DATA_TABLES) {
    await conn.query(
      `DELETE target
       FROM ${qid(table)} target
       JOIN stages s ON s.id = target.stage_id
       WHERE s.race_id = ?`,
      [raceId]
    );
  }

  await conn.query('DELETE FROM stages WHERE race_id = ?', [raceId]);
  await conn.query('DELETE FROM races WHERE id = ?', [raceId]);
}

async function cleanDuplicateRaceCodes(conn) {
  for (const { keep, del } of FIXES.dupRaces) {
    const keepRace = await getRaceByCode(conn, keep);
    const delRace = await getRaceByCode(conn, del);

    if (delRace.length === 0) {
      console.log(`  ${del}: not found, skip`);
      continue;
    }

    if (keepRace.length !== 1) {
      throw new Error(`Expected exactly one keep race "${keep}", found ${keepRace.length}`);
    }

    if (delRace.length !== 1) {
      throw new Error(`Expected exactly one duplicate race "${del}", found ${delRace.length}`);
    }

    const keepSummary = await getRaceSummary(conn, keepRace[0].id);
    const delSummary = await getRaceSummary(conn, delRace[0].id);
    printSummary('keep', keepRace[0], keepSummary);
    printSummary('delete', delRace[0], delSummary);

    if (!APPLY) continue;

    await deleteRaceById(conn, delRace[0].id);
    console.log(`  Deleted: ${del} (duplicate of ${keep})`);
  }
}

async function cleanDuplicateWomenRace(conn) {
  const races = await getRaceByCode(conn, FIXES.womenSpecial.raceCode);
  console.log(`  TdS Women races found: ${races.length}`);

  if (races.length <= 1) return;

  const withSummaries = [];
  for (const race of races) {
    const summary = await getRaceSummary(conn, race.id);
    printSummary('candidate', race, summary);
    withSummaries.push({ race, summary });
  }

  withSummaries.sort((a, b) => totalResults(b.summary) - totalResults(a.summary));
  const [keeper, ...duplicates] = withSummaries;

  for (const item of duplicates) {
    if (totalResults(item.summary) > 0) {
      throw new Error(
        `Refusing to delete TdS Women duplicate ${item.race.id}; it has ${totalResults(item.summary)} stage results`
      );
    }
  }

  console.log(`  TdS Women keep: ${keeper.race.id.substring(0, 8)} with ${totalResults(keeper.summary)} results`);
  if (!APPLY) return;

  for (const item of duplicates) {
    await deleteRaceById(conn, item.race.id);
    console.log(`  Deleted TdS Women duplicate: ${item.race.id.substring(0, 8)}`);
  }
}

async function fixStageTypes(conn) {
  for (const fix of FIXES.stageTypeFixes) {
    const [result] = await conn.query(
      `UPDATE stages s
       JOIN races r ON r.id = s.race_id
       SET s.stage_type = ?
       WHERE r.race_code = ? AND s.stage_number = ? AND s.stage_type = ?`,
      [fix.to, fix.race_code, fix.stage, fix.from]
    );

    const affected = Number(result.affectedRows || 0);
    console.log(`  Stage type: ${fix.race_code} Stage ${fix.stage}: ${fix.from} -> ${fix.to}, affected=${affected}`);

    if (affected > 1) {
      throw new Error(`Stage type fix matched ${affected} rows for ${fix.race_code} stage ${fix.stage}`);
    }
  }
}

async function previewStageTypeFixes(conn) {
  for (const fix of FIXES.stageTypeFixes) {
    const [rows] = await conn.query(
      `SELECT s.id, s.stage_type
       FROM stages s
       JOIN races r ON r.id = s.race_id
       WHERE r.race_code = ? AND s.stage_number = ?`,
      [fix.race_code, fix.stage]
    );

    const matching = rows.filter(row => row.stage_type === fix.from);
    console.log(
      `  Stage type: ${fix.race_code} Stage ${fix.stage}: ${fix.from} -> ${fix.to}, would_affect=${matching.length}`
    );

    if (matching.length > 1) {
      throw new Error(`Stage type fix would match ${matching.length} rows for ${fix.race_code} stage ${fix.stage}`);
    }
  }
}

async function verify(conn) {
  console.log('\n=== VERIFICATION ===');
  const [races] = await conn.query(
    `SELECT race_code, race_name_zh
     FROM races
     WHERE race_code IN (
       'tour-of-slovenia-2026',
       'baloise-belgium-tour-2026',
       'tour-de-suisse-2026',
       'tour-de-suisse-women-2026'
     )
     ORDER BY race_code`
  );
  for (const race of races) console.log(`  ${race.race_code} -> ${race.race_name_zh}`);

  const [tdsStage4] = await conn.query(
    `SELECT s.stage_type
     FROM stages s
     JOIN races r ON r.id = s.race_id
     WHERE r.race_code = ? AND s.stage_number = 4`,
    ['tour-de-suisse-2026']
  );
  if (tdsStage4.length && tdsStage4[0].stage_type !== 'itt') {
    console.log(`  Note: tour-de-suisse-2026 Stage 4 is ${tdsStage4[0].stage_type}, not itt`);
  }
}

async function main() {
  const conn = await mysql.createConnection(DB);
  try {
    console.log(APPLY ? '=== APPLY CLEANUP ===' : '=== DRY RUN: re-run with --apply to change data ===');

    await conn.beginTransaction();
    await cleanDuplicateRaceCodes(conn);
    await cleanDuplicateWomenRace(conn);

    if (APPLY) {
      await fixStageTypes(conn);
      await conn.commit();
      console.log('\n=== CLEANUP COMPLETE ===');
    } else {
      await previewStageTypeFixes(conn);
      await conn.rollback();
      console.log('\n=== DRY RUN COMPLETE: no data changed ===');
    }

    await verify(conn);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
