const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
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

const RACES = [
  { raceCode: 'tour-down-under-women-2026', slug: 'tour-down-under-women', type: 'multi', stages: 3 },
  {
    raceCode: 'tour-down-under-2026',
    type: 'custom',
    pages: [
      { slug: 'tour-down-under', kind: 'prologue', stageNumber: 0 },
      { slug: 'tour-down-under', kind: 'stage-1', stageNumber: 1 },
      { slug: 'tour-down-under', kind: 'stage-2', stageNumber: 2 },
      { slug: 'tour-down-under', kind: 'stage-3', stageNumber: 3 },
      { slug: 'tour-down-under', kind: 'stage-4', stageNumber: 4 },
      { slug: 'tour-down-under', kind: 'stage-5', stageNumber: 5 }
    ]
  },
  { raceCode: 'tour-down-under-oneday-women-2026', slug: 'schwalbe-womens-one-day-classic', type: 'single' },
  { raceCode: 'alula-tour-2026', slug: 'alula-tour', type: 'multi', stages: 5 },
  { raceCode: 'cadel-evans-women-2026', slug: 'cadel-evans-road-race-women', type: 'single' }
];

const http = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

function uuid() {
  return crypto.randomUUID();
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractJsValue(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;

  let i = start + marker.length;
  while (html[i] && html[i] !== '[' && html[i] !== '{') i += 1;

  const rootOpen = html[i];
  const rootClose = rootOpen === '[' ? ']' : '}';
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let j = i; j < html.length; j += 1) {
    const ch = html[j];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[' || ch === '{') stack.push(ch === '[' ? ']' : '}');
    else if (ch === ']' || ch === '}') {
      const expected = stack.pop();
      if (expected !== ch) throw new Error(`Malformed JS value near ${marker}`);
      if (stack.length === 0 && ch === rootClose) return html.slice(i, j + 1);
    }
  }

  return null;
}

async function fetchStagePage(page) {
  const url = `https://www.domestiquecycling.com/en/cycling-races/${page.slug}/2026/${page.kind}/`;
  const response = await http.get(url);
  const raw = extractJsValue(response.data, 'var stages = ');
  if (!raw) throw new Error(`No stages variable found: ${url}`);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(`No stage data found: ${url}`);
  const stage = parsed[0];
  if (Number.isInteger(page.stageNumber)) stage.stageNumber = page.stageNumber;
  return stage;
}

async function fetchStages(config) {
  const pages = config.type === 'custom'
    ? config.pages
    : config.type === 'single'
      ? [{ slug: config.slug, kind: 'race' }]
      : Array.from({ length: config.stages }, (_, i) => ({
        slug: config.slug,
        kind: `stage-${i + 1}`
      }));

  const stages = [];
  for (const page of pages) {
    stages.push(await fetchStagePage(page));
  }

  return stages;
}

function normalizeTime(readableTime) {
  const value = cleanText(readableTime);
  if (!value || value === 'DNF' || value === 'DNS' || value === '-') return '';
  return value.replace(/^\+\s*/, '+').replace(/\./g, ':');
}

function riderRow(row) {
  const rank = Number(row.ranking);
  if (!Number.isInteger(rank) || rank <= 0) return null;

  const riderName = cleanText(row.title || `${row.firstName || ''} ${row.lastName || ''}`);
  const teamName = cleanText(row.team?.name || row.team?.title || 'Unknown Team');
  if (!riderName || !teamName) return null;

  return {
    rank,
    riderName,
    riderSlug: slugify(riderName),
    nationality: cleanText(row.country?.short).toUpperCase() || 'UNK',
    teamName,
    teamSlug: slugify(teamName),
    uciCode: cleanText(row.team?.uciCode).slice(0, 10) || null,
    teamCountry: cleanText(row.team?.country?.short).toUpperCase() || null,
    timeGap: normalizeTime(row.readableTime)
  };
}

async function getRace(conn, raceCode) {
  const [rows] = await conn.query('SELECT id, race_code FROM races WHERE race_code = ? LIMIT 1', [raceCode]);
  if (rows.length === 0) throw new Error(`Race not found: ${raceCode}`);
  return rows[0];
}

async function clearRaceClassifications(conn, raceId) {
  for (const table of [
    'jerseys',
    'mountains_classification',
    'points_classification',
    'youth_classification',
    'team_classification',
    'general_classification'
  ]) {
    await conn.query(
      `DELETE c FROM ${table} c JOIN stages st ON st.id = c.stage_id WHERE st.race_id = ?`,
      [raceId]
    );
  }
}

async function upsertStage(conn, race, stage) {
  const stageNumber = Number(stage.stageNumber || 0);
  const date = stage.date?.[0];
  if (!date) throw new Error(`Stage ${stageNumber} has no date`);

  const stageCode = `${race.race_code}-domestique-stage-${stageNumber}`;
  const stageName = cleanText(stage.title || (stage.stageType === 'single-stage' ? 'Race' : `Stage ${stageNumber}`));
  const [startCity, finishCity] = Array.isArray(stage.location) ? stage.location : [];
  const [existing] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ? LIMIT 1',
    [race.id, stageNumber]
  );

  const values = [
    stageName,
    stageName,
    cleanText(stage.type || stage.stageType || 'Stage'),
    date,
    stage.distance || null,
    startCity || null,
    finishCity || null
  ];

  if (existing.length > 0) {
    await conn.query(
      `UPDATE stages
       SET stage_name = ?, stage_name_zh = ?, stage_type = ?, date = ?, distance_km = ?,
           start_city = ?, finish_city = ?, updated_at = NOW()
       WHERE id = ?`,
      [...values, existing[0].id]
    );
    return existing[0].id;
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO stages
     (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date,
      distance_km, start_city, finish_city, stage_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, race.id, stageNumber, ...values, stageCode]
  );
  return id;
}

async function getOrCreateTeam(conn, row) {
  const [existing] = row.uciCode
    ? await conn.query('SELECT id FROM teams WHERE uci_code = ? OR team_slug = ? OR team_name = ? LIMIT 1', [row.uciCode, row.teamSlug, row.teamName])
    : await conn.query('SELECT id FROM teams WHERE team_slug = ? OR team_name = ? LIMIT 1', [row.teamSlug, row.teamName]);

  if (existing.length > 0) return existing[0].id;

  const id = uuid();
  await conn.query(
    `INSERT INTO teams
     (id, uci_code, team_name, team_name_en, team_slug, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [id, row.uciCode, row.teamName, row.teamName, row.teamSlug, row.teamCountry]
  );
  return id;
}

async function getOrCreateRider(conn, row) {
  const [existing] = await conn.query(
    'SELECT id FROM riders WHERE rider_slug = ? OR rider_name = ? LIMIT 1',
    [row.riderSlug, row.riderName]
  );
  if (existing.length > 0) {
    await conn.query(
      'UPDATE riders SET rider_name = ?, rider_slug = COALESCE(rider_slug, ?), nationality = ? WHERE id = ?',
      [row.riderName, row.riderSlug, row.nationality, existing[0].id]
    );
    return existing[0].id;
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO riders
     (id, rider_name, rider_slug, nationality, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [id, row.riderName, row.riderSlug, row.nationality]
  );
  return id;
}

async function upsertStageResult(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row);
  const riderId = await getOrCreateRider(conn, row);
  const [existing] = await conn.query(
    'SELECT id FROM stage_results WHERE stage_id = ? AND rank_pos = ? LIMIT 1',
    [stageId, row.rank]
  );
  const values = [riderId, teamId, row.nationality, row.timeGap, row.timeGap === '+00:00' ? 1 : 0];

  if (existing.length > 0) {
    await conn.query(
      `UPDATE stage_results
       SET rider_id = ?, team_id = ?, nationality = ?, time_gap = ?, is_same_time = ?
       WHERE id = ?`,
      [...values, existing[0].id]
    );
    return;
  }

  await conn.query(
    `INSERT INTO stage_results
     (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, ...values]
  );
}

async function upsertGc(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row);
  const riderId = await getOrCreateRider(conn, row);
  const [existing] = await conn.query(
    'SELECT id FROM general_classification WHERE stage_id = ? AND `rank` = ? LIMIT 1',
    [stageId, row.rank]
  );
  const values = [riderId, teamId, row.nationality, row.rank === 1 ? row.timeGap : null, row.rank === 1 ? '' : row.timeGap];

  if (existing.length > 0) {
    await conn.query(
      `UPDATE general_classification
       SET rider_id = ?, team_id = ?, nationality = ?, total_time = ?, time_gap = ?
       WHERE id = ?`,
      [...values, existing[0].id]
    );
    return;
  }

  await conn.query(
    `INSERT INTO general_classification
     (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, ...values]
  );
}

async function importRace(conn, config) {
  const race = await getRace(conn, config.raceCode);
  const stages = await fetchStages(config);
  const dates = stages.map(stage => stage.date?.[0]).filter(Boolean).sort();
  const stageIds = [];

  await clearRaceClassifications(conn, race.id);
  await conn.query(
    'UPDATE races SET total_stages = ?, start_date = ?, end_date = ?, updated_at = NOW() WHERE id = ?',
    [stages.length, dates[0], dates[dates.length - 1], race.id]
  );
  await conn.query(
    `DELETE st FROM stages st
     LEFT JOIN stage_results sr ON sr.stage_id = st.id
     WHERE st.race_id = ? AND st.stage_number > ? AND sr.id IS NULL`,
    [race.id, stages.length]
  );

  const summary = [];
  for (const stage of stages) {
    const stageId = await upsertStage(conn, race, stage);
    stageIds.push(stageId);
    const rows = (stage.riderRanking || []).map(riderRow).filter(Boolean);
    for (const row of rows) await upsertStageResult(conn, stageId, row);
    summary.push({ stage: stage.stageNumber, results: rows.length });
  }

  const finalStage = stages[stages.length - 1];
  const finalStageId = stageIds[stageIds.length - 1];
  const gcSource = finalStage.gcRanking && finalStage.gcRanking.length > 0
    ? finalStage.gcRanking
    : finalStage.riderRanking || [];
  const gcRows = gcSource.map(riderRow).filter(Boolean);
  for (const row of gcRows) await upsertGc(conn, finalStageId, row);

  return {
    raceCode: config.raceCode,
    stages: summary,
    finalGcRows: gcRows.length,
    dates: [dates[0], dates[dates.length - 1]]
  };
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const summary = [];
  try {
    await conn.beginTransaction();
    for (const config of RACES) {
      summary.push(await importRace(conn, config));
    }
    await conn.commit();
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
