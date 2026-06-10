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
  {
    raceCode: 'giro-women-2026',
    pages: Array.from({ length: 9 }, (_, i) => ({ slug: 'giro-ditalia-women', kind: `stage-${i + 1}` }))
  },
  {
    raceCode: 'tour-wallonie-2026',
    pages: [
      { slug: 'tour-de-wallonie', kind: 'stage-1' },
      { slug: 'tour-de-wallonie', kind: 'stage-2' },
      { slug: 'tour-de-wallonie', kind: 'stage-3' },
      { slug: 'tour-de-wallonie', kind: 'stage-1-2' },
      { slug: 'tour-de-wallonie', kind: 'stage-2-2' }
    ]
  },
  { raceCode: 'brussels-classic-2026', pages: [{ slug: 'brussels-classic', kind: 'race' }] },
  {
    raceCode: 'dauphine-2026',
    pages: Array.from({ length: 8 }, (_, i) => ({
      slug: 'criterium-du-dauphine',
      kind: `stage-${i + 1}`
    }))
  },
  { raceCode: 'circuit-franco-belge-2026', pages: [{ slug: 'circuit-franco-belge', kind: 'race' }] },
  { raceCode: 'copenhagen-sprint-women-2026', pages: [{ slug: 'copenhagen-sprint-women', kind: 'race' }] },
  { raceCode: 'copenhagen-sprint-2026', pages: [{ slug: 'copenhagen-sprint', kind: 'race' }] },
  { raceCode: 'elfstedenronde-2026', pages: [{ slug: 'elfstedenronde', kind: 'race' }] },
  {
    raceCode: 'belgium-tour-2026',
    pages: Array.from({ length: 5 }, (_, i) => ({ slug: 'belgium-tour', kind: `stage-${i + 1}` }))
  },
  {
    raceCode: 'tour-suisse-2026',
    pages: Array.from({ length: 5 }, (_, i) => ({ slug: 'tour-de-suisse', kind: `stage-${i + 1}` }))
  },
  {
    raceCode: 'tour-suisse-women-2026',
    pages: Array.from({ length: 5 }, (_, i) => ({ slug: 'tour-de-suisse-women', kind: `stage-${i + 1}` }))
  },
  {
    raceCode: 'tour-slovenia-2026',
    pages: Array.from({ length: 5 }, (_, i) => ({ slug: 'tour-of-slovenia', kind: `stage-${i + 1}` }))
  },
  { raceCode: 'dwars-hageland-2026', pages: [{ slug: 'dwars-door-het-hageland', kind: 'race' }] },
  { raceCode: 'women-cycling-day-2026', pages: [{ slug: 'women-cycling-day', kind: 'race' }] },
  { raceCode: 'heistse-pijl-2026', pages: [{ slug: 'heistse-pijl', kind: 'race' }] }
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
      if (stack.length === 0) return html.slice(i, j + 1);
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
  return parsed[0];
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

async function clearStageResults(conn, raceId) {
  await conn.query(
    `DELETE sr FROM stage_results sr
     JOIN stages st ON st.id = sr.stage_id
     WHERE st.race_id = ?`,
    [raceId]
  );
}

async function upsertStage(conn, race, stage) {
  const stageNumber = Number(stage.stageNumber || 1);
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
  await conn.query(
    `INSERT INTO stage_results
     (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, riderId, teamId, row.nationality, row.timeGap, row.timeGap === '+00:00' ? 1 : 0]
  );
}

async function upsertGc(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row);
  const riderId = await getOrCreateRider(conn, row);
  await conn.query(
    `INSERT INTO general_classification
     (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, riderId, teamId, row.nationality, row.rank === 1 ? row.timeGap : null, row.rank === 1 ? '' : row.timeGap]
  );
}

async function importRace(conn, config) {
  const race = await getRace(conn, config.raceCode);
  const stages = [];
  for (const page of config.pages) stages.push(await fetchStagePage(page));

  const dates = stages.map(stage => stage.date?.[0]).filter(Boolean).sort();
  await clearRaceClassifications(conn, race.id);
  await clearStageResults(conn, race.id);
  await conn.query(
    'UPDATE races SET total_stages = ?, start_date = ?, end_date = ?, updated_at = NOW() WHERE id = ?',
    [stages.length, dates[0], dates[dates.length - 1], race.id]
  );

  const summary = [];
  let latestStageWithGc = null;
  for (const stage of stages) {
    const stageId = await upsertStage(conn, race, stage);
    const rows = (stage.riderRanking || []).map(riderRow).filter(Boolean);
    for (const row of rows) await upsertStageResult(conn, stageId, row);
    const gcRows = (stage.gcRanking || []).map(riderRow).filter(Boolean);
    if (gcRows.length > 0) latestStageWithGc = { stageId, gcRows };
    summary.push({ stage: stage.stageNumber, date: stage.date?.[0], results: rows.length, gcRows: gcRows.length });
  }

  if (!latestStageWithGc) {
    const lastWithResults = summary.map((item, index) => ({ ...item, index })).reverse().find(item => item.results > 0);
    if (lastWithResults) {
      const stage = stages[lastWithResults.index];
      latestStageWithGc = {
        stageId: (await conn.query('SELECT id FROM stages WHERE race_id = ? AND stage_number = ?', [race.id, stage.stageNumber]))[0][0].id,
        gcRows: (stage.riderRanking || []).map(riderRow).filter(Boolean)
      };
    }
  }

  if (latestStageWithGc) {
    for (const row of latestStageWithGc.gcRows) await upsertGc(conn, latestStageWithGc.stageId, row);
  }

  return {
    raceCode: config.raceCode,
    stages: summary,
    finalGcRows: latestStageWithGc ? latestStageWithGc.gcRows.length : 0,
    dates: [dates[0], dates[dates.length - 1]]
  };
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const summary = [];
  try {
    await conn.beginTransaction();
    for (const config of RACES) summary.push(await importRace(conn, config));
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
