/*
 * Consolidate exact duplicate rider and team records in the local database.
 *
 * Default mode is read-only. Run with --apply only after reviewing the plan.
 * Team candidates are partitioned by men / women / development / unknown so
 * squads with the same sponsor name but different programmes never merge.
 */

const mysql = require('mysql2/promise');
const { localDbConfig } = require('./lib/db-config');

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function teamProgramme(team) {
  const label = [team.team_name, team.team_name_en, team.team_name_zh, team.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/(development|\bdev\b|rookies|u23|发展队)/i.test(label)) return 'development';
  if (/(women|woman|femmes|donne|ladies|女子|\b(?:wtw|prw|ctw)\b)/i.test(label)) return 'women';
  if (/\b(?:wt|prt|ct)\b/i.test(label)) return 'men';

  const genders = String(team.race_genders || '').split(',').filter(Boolean);
  if (genders.length === 1 && genders[0] === 'WOMEN') return 'women';
  if (genders.length === 1 && genders[0] === 'MEN') return 'men';
  return 'unknown';
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

function nonEmpty(value) {
  return value !== null && value !== undefined && value !== '';
}

function teamScore(team) {
  const metadata = ['uci_code', 'team_name_zh', 'team_name_en', 'category', 'country', 'logo_url', 'bike_brand']
    .filter(field => nonEmpty(team[field])).length;
  return Number(team.reference_count || 0) * 100 + metadata * 10 + (team.uci_code ? 1 : 0);
}

function riderScore(rider) {
  const metadata = ['uci_id', 'rider_name_zh', 'birth_date', 'height_cm', 'weight_kg', 'photo_url']
    .filter(field => nonEmpty(rider[field])).length;
  return Number(rider.reference_count || 0) * 100 + metadata * 10 + (rider.uci_id ? 1 : 0);
}

function chooseTarget(group, score) {
  return [...group].sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)))[0];
}

async function existingTables(conn) {
  const [rows] = await conn.query('SHOW TABLES');
  return new Set(rows.map(row => Object.values(row)[0]));
}

async function tableCount(conn, table, column, id) {
  const [[row]] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\` WHERE \`${column}\` = ?`, [id]);
  return Number(row.count || 0);
}

async function referenceCount(conn, tables, column, id) {
  let count = 0;
  for (const table of tables) count += await tableCount(conn, table, column, id);
  return count;
}

async function loadTeams(conn, tables) {
  const [teams] = await conn.query(`
    SELECT id, uci_code, team_name, team_name_zh, team_name_en,
           category, country, logo_url, bike_brand
    FROM teams
  `);
  const [genderRows] = await conn.query(`
    SELECT DISTINCT sr.team_id, r.gender
    FROM stage_results sr
    JOIN stages s ON s.id = sr.stage_id
    JOIN races r ON r.id = s.race_id
    WHERE r.gender IS NOT NULL
  `);
  const gendersByTeam = new Map();
  for (const row of genderRows) {
    if (!gendersByTeam.has(row.team_id)) gendersByTeam.set(row.team_id, []);
    gendersByTeam.get(row.team_id).push(row.gender);
  }
  const refTables = ['stage_results', 'general_classification', 'jerseys', 'team_classification']
    .filter(table => tables.has(table));
  for (const team of teams) {
    team.race_genders = (gendersByTeam.get(team.id) || []).sort().join(',');
    team.reference_count = await referenceCount(conn, refTables, 'team_id', team.id);
  }
  return teams;
}

async function loadRiders(conn, tables) {
  const [riders] = await conn.query(`
    SELECT id, uci_id, rider_name, rider_name_zh, nationality, birth_date,
           height_cm, weight_kg, is_retired, photo_url
    FROM riders
  `);
  const refTables = [
    'stage_results', 'general_classification', 'jerseys', 'points_classification',
    'mountains_classification', 'youth_classification', 'riders_favorites'
  ].filter(table => tables.has(table));
  for (const rider of riders) rider.reference_count = await referenceCount(conn, refTables, 'rider_id', rider.id);
  return riders;
}

async function riderHasConflictingClassification(conn, sourceId, targetId, tables) {
  const classificationTables = [
    'points_classification', 'mountains_classification', 'youth_classification'
  ].filter(table => tables.has(table));
  for (const table of classificationTables) {
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS count
       FROM \`${table}\` source
       JOIN \`${table}\` target ON target.stage_id = source.stage_id
         AND target.rider_id = ?
         AND target.jersey_type = source.jersey_type
       WHERE source.rider_id = ?`,
      [targetId, sourceId]
    );
    if (Number(row.count) > 0) return table;
  }
  return '';
}

function buildTeamPlans(teams) {
  return groupBy(teams, team => {
    const name = normalizeName(team.team_name);
    const programme = teamProgramme(team);
    // 没有可验证组别的队伍不自动合并，避免把同名的男、女项目混在一起。
    return name && programme !== 'unknown' ? `${programme}:${name}` : '';
  }).map(group => {
    const target = chooseTarget(group, teamScore);
    return {
      programme: teamProgramme(target),
      canonical_name: target.team_name,
      target,
      sources: group.filter(team => team.id !== target.id)
    };
  });
}

function buildRiderPlans(riders) {
  return groupBy(riders, rider => {
    const name = normalizeName(rider.rider_name);
    const nationality = String(rider.nationality || '').trim().toUpperCase();
    return name && nationality ? `${nationality}:${name}` : '';
  }).map(group => {
    const target = chooseTarget(group, riderScore);
    return {
      canonical_name: target.rider_name,
      nationality: target.nationality,
      target,
      sources: group.filter(rider => rider.id !== target.id)
    };
  });
}

function fillEmptyPatch(source, target, fields) {
  const patch = {};
  for (const field of fields) {
    if (!nonEmpty(target[field]) && nonEmpty(source[field])) patch[field] = source[field];
  }
  return patch;
}

function printableMetadata(patch) {
  return Object.fromEntries(Object.entries(patch).map(([field, value]) => [
    field,
    field === 'logo_url' ? '[copied]' : value
  ]));
}

async function updateRow(conn, table, id, patch) {
  const entries = Object.entries(patch);
  if (!entries.length) return;
  await conn.query(
    `UPDATE \`${table}\` SET ${entries.map(([field]) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
    [...entries.map(([, value]) => value), id]
  );
}

async function removeConflictingUniqueFields(conn, table, sourceId, targetId, patch, fields) {
  const safePatch = { ...patch };
  for (const field of fields) {
    if (!nonEmpty(safePatch[field])) continue;
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS count FROM \`${table}\`
       WHERE \`${field}\` = ? AND id <> ? AND id <> ?`,
      [safePatch[field], sourceId, targetId]
    );
    if (Number(row.count) > 0) delete safePatch[field];
  }
  return safePatch;
}

async function mergeTeam(conn, plan, source, tables) {
  const initialPatch = fillEmptyPatch(source, plan.target, [
    'uci_code', 'team_name_zh', 'team_name_en', 'category', 'country', 'logo_url', 'bike_brand'
  ]);
  const patch = await removeConflictingUniqueFields(conn, 'teams', source.id, plan.target.id, initialPatch, ['uci_code']);
  const uniquePatch = patch.uci_code ? { uci_code: patch.uci_code } : {};
  delete patch.uci_code;
  await updateRow(conn, 'teams', plan.target.id, patch);
  for (const table of ['stage_results', 'general_classification', 'jerseys', 'team_classification']) {
    if (tables.has(table)) await conn.query(`UPDATE \`${table}\` SET team_id = ? WHERE team_id = ?`, [plan.target.id, source.id]);
  }
  await conn.query('DELETE FROM teams WHERE id = ?', [source.id]);
  await updateRow(conn, 'teams', plan.target.id, uniquePatch);
  Object.assign(plan.target, patch, uniquePatch);
  return {
    source: source.team_name,
    target: plan.target.team_name,
    metadata: printableMetadata({ ...patch, ...uniquePatch })
  };
}

async function mergeRider(conn, plan, source, tables) {
  const conflictTable = await riderHasConflictingClassification(conn, source.id, plan.target.id, tables);
  if (conflictTable) return { source: source.rider_name, target: plan.target.rider_name, skipped: `classification_conflict:${conflictTable}` };

  const initialPatch = fillEmptyPatch(source, plan.target, [
    'uci_id', 'rider_name_zh', 'birth_date', 'height_cm', 'weight_kg', 'photo_url'
  ]);
  const patch = await removeConflictingUniqueFields(conn, 'riders', source.id, plan.target.id, initialPatch, ['uci_id']);
  const uniquePatch = patch.uci_id ? { uci_id: patch.uci_id } : {};
  delete patch.uci_id;
  await updateRow(conn, 'riders', plan.target.id, patch);
  for (const table of ['stage_results', 'general_classification', 'jerseys', 'points_classification', 'mountains_classification', 'youth_classification']) {
    if (tables.has(table)) await conn.query(`UPDATE \`${table}\` SET rider_id = ? WHERE rider_id = ?`, [plan.target.id, source.id]);
  }
  if (tables.has('riders_favorites')) {
    await conn.query(
      `DELETE source FROM riders_favorites source
       JOIN riders_favorites target ON target.user_id = source.user_id AND target.rider_id = ?
       WHERE source.rider_id = ?`,
      [plan.target.id, source.id]
    );
    await conn.query('UPDATE riders_favorites SET rider_id = ? WHERE rider_id = ?', [plan.target.id, source.id]);
  }
  await conn.query('DELETE FROM riders WHERE id = ?', [source.id]);
  await updateRow(conn, 'riders', plan.target.id, uniquePatch);
  Object.assign(plan.target, patch, uniquePatch);
  return {
    source: source.rider_name,
    target: plan.target.rider_name,
    metadata: printableMetadata({ ...patch, ...uniquePatch })
  };
}

function printablePlan(plan) {
  return plan.map(item => ({
    canonical_name: item.canonical_name,
    programme: item.programme,
    nationality: item.nationality,
    target: { id: item.target.id, name: item.target.team_name || item.target.rider_name, references: item.target.reference_count },
    sources: item.sources.map(source => ({ id: source.id, name: source.team_name || source.rider_name, references: source.reference_count }))
  }));
}

async function main() {
  if (process.argv.includes('--production')) {
    throw new Error('Production execution is intentionally disabled. This tool only consolidates the local database.');
  }

  const conn = await mysql.createConnection(localDbConfig());
  try {
    const tables = await existingTables(conn);
    const [teams, riders] = await Promise.all([loadTeams(conn, tables), loadRiders(conn, tables)]);
    const teamPlans = buildTeamPlans(teams);
    const riderPlans = buildRiderPlans(riders);
    const plan = {
      mode: DRY_RUN ? 'dry-run' : 'apply',
      safeguards: 'Teams are partitioned by programme; rider matches require normalized Latin name plus nationality.',
      teams: printablePlan(teamPlans),
      riders: printablePlan(riderPlans)
    };

    console.log(JSON.stringify(plan, null, 2));
    if (DRY_RUN) return;

    await conn.beginTransaction();
    try {
      const merged = { teams: [], riders: [] };
      for (const planItem of teamPlans) {
        for (const source of planItem.sources) {
          try {
            merged.teams.push(await mergeTeam(conn, planItem, source, tables));
          } catch (err) {
            throw new Error(`Team merge failed: ${source.team_name} -> ${planItem.target.team_name}: ${err.message}`);
          }
        }
      }
      for (const planItem of riderPlans) {
        for (const source of planItem.sources) {
          try {
            merged.riders.push(await mergeRider(conn, planItem, source, tables));
          } catch (err) {
            throw new Error(`Rider merge failed: ${source.rider_name} -> ${planItem.target.rider_name}: ${err.message}`);
          }
        }
      }
      await conn.commit();
      console.log(JSON.stringify({ merged }, null, 2));
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
