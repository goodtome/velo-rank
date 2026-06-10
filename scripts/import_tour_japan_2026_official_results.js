const crypto = require('crypto');
const path = require('path');
const cheerio = require('cheerio');
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

const RACE_CODE = 'tour-japan-2026';
const BASE_URL = 'https://www.toj.co.jp/2026';

const TEAM_MAP = {
  TUK: { name: 'TEAM UKYO', country: 'Japan', category: 'CT' },
  TFT: { name: 'SOLUTION TECH NIPPO RALI', country: 'Italy', category: 'Pro Team' },
  LNS: { name: 'LI NING STAR', country: 'China', category: 'CT' },
  TSG: { name: 'TERENGGANU CYCLING TEAM', country: 'Malaysia', category: 'CT' },
  KIN: { name: 'KINAN RACING TEAM', country: 'Japan', category: 'CT' },
  CBW: { name: 'CCACHE X BODYWRAP', country: 'Australia', category: 'CT' },
  ABZ: { name: 'ASTEMO UTSUNOMIYA BLITZEN', country: 'Japan', category: 'CT' },
  VCF: { name: 'VC FUKUOKA', country: 'Japan', category: 'CT' },
  VCH: { name: 'VICTOIRE HIROSHIMA', country: 'Japan', category: 'CT' },
  SCT: { name: 'SEOUL CYCLING TEAM', country: 'Korea', category: 'CT' },
  ART: { name: 'AISAN RACING TEAM', country: 'Japan', category: 'CT' },
  SMN: { name: 'SHIMANO RACING TEAM', country: 'Japan', category: 'CT' },
  SWT: { name: 'SWATT CLUB', country: 'Italy', category: 'CT' },
  LVF: { name: 'LEVANTE FUJI SHIZUOKA', country: 'Japan', category: 'CT' },
  JPN: { name: 'JAPAN NATIONAL TEAM', country: 'Japan', category: 'National Team' },
  UZB: { name: 'UZBEKISTAN NATIONAL CYCLING TEAM', country: 'Uzbekistan', category: 'National Team' }
};

const STAGES = [
  { number: 1, slug: 'sakai', name: 'Stage 1 | Sakai', nameZh: '第1赛段 堺', date: '2026-05-24', type: 'Individual Time Trial', distanceKm: 2.6, startCity: 'Sakai', finishCity: 'Sakai', riderResults: true },
  { number: 2, slug: 'kyoto', name: 'Stage 2 | Kyoto', nameZh: '第2赛段 京都', date: '2026-05-25', type: 'Road stage', distanceKm: 103.6, startCity: 'Kyoto', finishCity: 'Kyoto', riderResults: true },
  { number: 3, slug: 'inabe', name: 'Stage 3 | Inabe', nameZh: '第3赛段 いなべ', date: '2026-05-26', type: 'Road stage', distanceKm: null, startCity: 'Inabe', finishCity: 'Inabe', riderResults: true },
  { number: 4, slug: 'ooshika', name: 'Stage 4 | Ooshika', nameZh: '第4赛段 大鹿', date: '2026-05-27', type: 'Team Time Trial', distanceKm: 11.4, startCity: 'Ooshika', finishCity: 'Ooshika', riderResults: false },
  { number: 5, slug: 'shinshu_iida', name: 'Stage 5 | Shinshu Iida', nameZh: '第5赛段 信州饭田', date: '2026-05-28', type: 'Road stage', distanceKm: 120.9, startCity: 'Iida', finishCity: 'Iida', riderResults: true },
  { number: 6, slug: 'fujisan', name: 'Stage 6 | Fujisan', nameZh: '第6赛段 富士山', date: '2026-05-29', type: 'Mountain stage', distanceKm: 62.1, startCity: 'Oyama', finishCity: 'Fujisan', riderResults: true },
  { number: 7, slug: 'sagamihara', name: 'Stage 7 | Sagamihara', nameZh: '第7赛段 相模原', date: '2026-05-30', type: 'Road stage', distanceKm: 107.5, startCity: 'Sagamihara', finishCity: 'Sagamihara', riderResults: true },
  { number: 8, slug: 'tokyo', name: 'Stage 8 | Tokyo', nameZh: '第8赛段 东京', date: '2026-05-31', type: 'Road stage', distanceKm: 104.0, startCity: 'Tokyo', finishCity: 'Tokyo', riderResults: true }
];

function uuid() {
  return crypto.randomUUID();
}

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleWord(word) {
  if (/^[A-Z]+$/.test(word) || /^[A-Z]+(?:-[A-Z]+)+$/.test(word)) {
    return word
      .split('-')
      .map(part => part.charAt(0) + part.slice(1).toLowerCase())
      .join('-');
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizeRiderName(value) {
  return cleanText(value)
    .split(/\s+/)
    .map(titleWord)
    .join(' ');
}

function parseRank(value) {
  const rank = parseInt(cleanText(value), 10);
  return Number.isInteger(rank) ? rank : null;
}

function parsePoints(value) {
  const points = parseInt(cleanText(value), 10);
  return Number.isInteger(points) ? points : 0;
}

function normalizeTime(value) {
  const text = cleanText(value);
  if (!text || text === '-' || text === '..') return '';
  return text;
}

async function fetchPage(slug) {
  const response = await fetch(`${BASE_URL}/${slug}`);
  if (!response.ok) throw new Error(`Failed to fetch ${slug}: HTTP ${response.status}`);
  return response.text();
}

function parseStagePage(stage, html) {
  const $ = cheerio.load(html);
  const rows = [];
  const teamRows = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('th,td').map((__, cell) => cleanText($(cell).text())).get();
    const rank = parseRank(cells[0]);
    if (!rank) return;

    if (stage.riderResults) {
      const riderName = normalizeRiderName(cells[2]);
      const teamCode = cleanText(cells[4]).toUpperCase();
      if (!riderName || !TEAM_MAP[teamCode]) return;
      rows.push({
        rank,
        riderName,
        riderSlug: slugify(riderName),
        teamCode,
        sprintPoints: parsePoints(cells[5]),
        time: normalizeTime(cells[6]),
        gap: normalizeTime(cells[7])
      });
    } else {
      const teamName = cleanText(cells[2]).toUpperCase();
      const teamCode = Object.keys(TEAM_MAP).find(code => TEAM_MAP[code].name.toUpperCase() === teamName);
      if (!teamCode) return;
      teamRows.push({
        rank,
        teamCode,
        totalTime: normalizeTime(cells[3]),
        gap: normalizeTime(cells[4])
      });
    }
  });

  return { rows, teamRows };
}

async function parseFinalGeneralClassification() {
  const response = await fetch(`${BASE_URL}/result-time`);
  if (!response.ok) throw new Error(`Failed to fetch result-time: HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const rows = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('th,td').map((__, cell) => cleanText($(cell).text())).get();
    const rank = parseRank(cells[0]);
    if (!rank) return;

    const riderName = normalizeRiderName(cells[2]);
    const teamCode = cleanText(cells[4]).toUpperCase();
    if (!riderName || !TEAM_MAP[teamCode]) return;

    rows.push({
      rank,
      riderName,
      riderSlug: slugify(riderName),
      teamCode,
      totalTime: normalizeTime(cells[5]),
      gap: normalizeTime(cells[6])
    });
  });

  return rows;
}

async function getRace(conn) {
  const [rows] = await conn.query('SELECT id FROM races WHERE race_code = ? LIMIT 1', [RACE_CODE]);
  if (rows.length === 0) throw new Error(`Race not found: ${RACE_CODE}`);
  return rows[0];
}

async function clearRaceStages(conn, raceId) {
  const [stageRows] = await conn.query('SELECT id FROM stages WHERE race_id = ?', [raceId]);
  const stageIds = stageRows.map(row => row.id);
  if (stageIds.length === 0) return;

  for (const table of [
    'jerseys',
    'mountains_classification',
    'points_classification',
    'youth_classification',
    'team_classification',
    'general_classification',
    'stage_results'
  ]) {
    await conn.query(`DELETE FROM ${table} WHERE stage_id IN (?)`, [stageIds]);
  }
  await conn.query('DELETE FROM stages WHERE id IN (?)', [stageIds]);
}

async function getOrCreateTeam(conn, teamCode) {
  const team = TEAM_MAP[teamCode];
  const slug = slugify(team.name);
  const [existing] = await conn.query(
    'SELECT id FROM teams WHERE uci_code = ? OR team_slug = ? OR team_name = ? LIMIT 1',
    [teamCode, slug, team.name]
  );

  if (existing.length > 0) {
    await conn.query(
      `UPDATE teams
       SET uci_code = COALESCE(uci_code, ?),
           team_name = ?,
           team_name_en = COALESCE(team_name_en, ?),
           team_slug = COALESCE(team_slug, ?),
           category = COALESCE(category, ?),
           country = COALESCE(country, ?)
       WHERE id = ?`,
      [teamCode, team.name, team.name, slug, team.category, team.country, existing[0].id]
    );
    return existing[0].id;
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO teams
     (id, uci_code, team_name, team_name_en, team_slug, category, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, teamCode, team.name, team.name, slug, team.category, team.country]
  );
  return id;
}

async function getOrCreateRider(conn, row) {
  const [existing] = await conn.query(
    'SELECT id, nationality FROM riders WHERE rider_slug = ? OR rider_name = ? LIMIT 1',
    [row.riderSlug, row.riderName]
  );

  if (existing.length > 0) {
    await conn.query(
      'UPDATE riders SET rider_name = ?, rider_slug = COALESCE(rider_slug, ?), updated_at = NOW() WHERE id = ?',
      [row.riderName, row.riderSlug, existing[0].id]
    );
    return { id: existing[0].id, nationality: existing[0].nationality || 'UNK' };
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO riders
     (id, rider_name, rider_slug, nationality, created_at, updated_at)
     VALUES (?, ?, ?, 'UNK', NOW(), NOW())`,
    [id, row.riderName, row.riderSlug]
  );
  return { id, nationality: 'UNK' };
}

async function insertStage(conn, raceId, stage) {
  const id = uuid();
  await conn.query(
    `INSERT INTO stages
     (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date, distance_km,
      start_city, finish_city, stage_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      raceId,
      stage.number,
      stage.name,
      stage.nameZh,
      stage.type,
      stage.date,
      stage.distanceKm,
      stage.startCity,
      stage.finishCity,
      `${RACE_CODE}-official-stage-${stage.number}`
    ]
  );
  return id;
}

async function insertStageResult(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row.teamCode);
  const rider = await getOrCreateRider(conn, row);
  await conn.query(
    `INSERT INTO stage_results
     (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, sprint_points, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuid(),
      stageId,
      row.rank,
      rider.id,
      teamId,
      rider.nationality,
      row.rank === 1 ? row.time : row.gap || row.time,
      row.rank > 1 && (row.gap === '0:00:00' || row.gap === '0:00:00.00') ? 1 : 0,
      row.sprintPoints
    ]
  );
}

async function insertTeamClassification(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row.teamCode);
  await conn.query(
    `INSERT INTO team_classification
     (id, stage_id, \`rank\`, team_id, total_time, time_gap, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, teamId, row.totalTime, row.gap]
  );
}

async function insertGeneralClassification(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row.teamCode);
  const rider = await getOrCreateRider(conn, row);
  await conn.query(
    `INSERT INTO general_classification
     (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, rider.id, teamId, rider.nationality, row.totalTime, row.gap]
  );
}

async function main() {
  const parsedStages = [];
  for (const stage of STAGES) {
    const parsed = parseStagePage(stage, await fetchPage(stage.slug));
    if (stage.riderResults && parsed.rows.length === 0) {
      throw new Error(`No rider rows parsed for stage ${stage.number}`);
    }
    if (!stage.riderResults && parsed.teamRows.length === 0) {
      throw new Error(`No team rows parsed for stage ${stage.number}`);
    }
    parsedStages.push({ stage, ...parsed });
  }

  const finalGcRows = await parseFinalGeneralClassification();
  if (finalGcRows.length === 0) throw new Error('No final GC rows parsed');

  const conn = await mysql.createConnection(DB_CONFIG);
  const summary = [];
  try {
    await conn.beginTransaction();
    const race = await getRace(conn);
    await clearRaceStages(conn, race.id);
    await conn.query(
      `UPDATE races
       SET start_date = '2026-05-24', end_date = '2026-05-31', total_stages = 8, is_active = 1, updated_at = NOW()
       WHERE id = ?`,
      [race.id]
    );

    const stageIds = new Map();
    for (const parsed of parsedStages) {
      const stageId = await insertStage(conn, race.id, parsed.stage);
      stageIds.set(parsed.stage.number, stageId);
      for (const row of parsed.rows) await insertStageResult(conn, stageId, row);
      for (const row of parsed.teamRows) await insertTeamClassification(conn, stageId, row);
      summary.push({
        stage: parsed.stage.number,
        stageResults: parsed.rows.length,
        teamClassification: parsed.teamRows.length
      });
    }

    for (const row of finalGcRows) {
      await insertGeneralClassification(conn, stageIds.get(8), row);
    }
    await conn.commit();
    console.log(JSON.stringify({ raceCode: RACE_CODE, stages: summary, finalGcRows: finalGcRows.length }, null, 2));
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
