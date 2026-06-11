const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
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

const RACES = [
  { raceCode: 'tour-turkiye-2026', slug: 'tour-de-turquie' },
  { raceCode: 'tour-romandie-2026', slug: 'tour-de-romandie' },
  { raceCode: 'tour-hongrie-2026', slug: 'tour-de-hongrie' },
  { raceCode: 'dunkerque-2026', slug: 'quatre-jours-de-dunkerque' }
];

const http = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
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

function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function parseDuration(text) {
  const value = cleanText(text);
  const hours = value.match(/^(\d+)h(\d{2})'(\d{2})''$/);
  if (hours) return `${hours[1]}:${hours[2]}:${hours[3]}`;

  const gap = value.match(/^à\s+(\d+)"$/);
  if (gap) return `+0:${String(gap[1]).padStart(2, '0')}`;

  const gapMin = value.match(/^à\s+(\d+)'(\d{2})"$/);
  if (gapMin) return `+${gapMin[1]}:${gapMin[2]}`;

  return value === '-' ? '' : value;
}

function parseStageLabel(item, fallbackNumber) {
  const name = cleanText(item.name);
  const distance = name.match(/\(([\d.,]+)\s*km\)/i);
  const withoutDistance = cleanText(name.replace(/\s*\([^)]*km\)\s*/i, ''));
  const route = withoutDistance.replace(/^(?:Prologue|[\de]+e?\s+ét\.)\s*/i, '').trim();
  const [startCity, finishCity] = route.split(' - ').map(cleanText);
  const stageNumber = fallbackNumber;

  return {
    stageNumber,
    stageName: withoutDistance,
    stageNameZh: withoutDistance,
    distanceKm: distance ? Number(distance[1].replace(',', '.')) : null,
    stageType: /^Prologue/i.test(withoutDistance) ? 'Prologue' : 'Stage',
    startCity: startCity || null,
    finishCity: finishCity || null
  };
}

async function getRace(conn, raceCode) {
  const [rows] = await conn.query(
    'SELECT id, race_code, race_name, start_date, end_date FROM races WHERE race_code = ? LIMIT 1',
    [raceCode]
  );
  if (rows.length === 0) throw new Error(`Race not found: ${raceCode}`);
  return rows[0];
}

async function fetchStageList(slug) {
  const url = `https://www.lequipe.fr/Cyclisme-sur-route/${slug}/page-classement-individuel`;
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const scripts = $('script[type="application/ld+json"]').map((_, script) => $(script).html()).get();

  for (const script of scripts) {
    try {
      const data = JSON.parse(script);
      if (Array.isArray(data.itemListElement) && data.itemListElement.some(item => item && item.url)) {
        return {
          generalUrl: data.itemListElement.find(item => /classement général/i.test(item.name || ''))?.url,
          stages: data.itemListElement
            .filter(item => item.url && !/classement général/i.test(item.name || ''))
            .map((item, index) => ({
              ...parseStageLabel(item, index + 1),
              url: item.url
            }))
        };
      }
    } catch {
      // Ignore unrelated JSON-LD blocks.
    }
  }

  throw new Error(`No stage list found for ${slug}`);
}

async function fetchRankingRows(url) {
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const rows = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 4) return;

    const rank = parseInt(cleanText($(cells[0]).text()), 10);
    if (!Number.isFinite(rank)) return;

    const country = cleanText($(cells[1]).find('img').attr('alt')).slice(0, 3).toUpperCase() || 'UNK';
    const nameCell = $(cells[2]);
    const riderName = cleanText(nameCell.find('a').first().text());
    const teamName = cleanText(nameCell.find('.table__teamName').first().text()) || 'Unknown Team';
    const timeText = cleanText($(cells[3]).text());

    if (!riderName) return;
    rows.push({
      rank,
      riderName,
      riderSlug: slugify(riderName),
      teamName,
      teamSlug: slugify(teamName),
      nationality: country,
      timeGap: parseDuration(timeText)
    });
  });

  return rows;
}

async function upsertStage(conn, race, stage, date) {
  const stageCode = `${race.race_code}-lequipe-stage-${stage.stageNumber}`;
  const [existing] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ? LIMIT 1',
    [race.id, stage.stageNumber]
  );

  const values = [
    stage.stageName,
    stage.stageNameZh,
    stage.stageType,
    date,
    stage.distanceKm,
    stage.startCity,
    stage.finishCity
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
    [id, race.id, stage.stageNumber, ...values, stageCode]
  );
  return id;
}

async function getOrCreateTeam(conn, row) {
  const [existing] = await conn.query(
    'SELECT id FROM teams WHERE team_slug = ? OR team_name = ? LIMIT 1',
    [row.teamSlug, row.teamName]
  );
  if (existing.length > 0) return existing[0].id;

  const id = uuid();
  await conn.query(
    'INSERT INTO teams (id, team_name, team_name_en, team_slug, created_at) VALUES (?, ?, ?, ?, NOW())',
    [id, row.teamName, row.teamName, row.teamSlug]
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

  const values = [riderId, teamId, row.nationality, row.timeGap, row.timeGap === '+0:00' ? 1 : 0];
  if (existing.length > 0) {
    await conn.query(
      `UPDATE stage_results
       SET rider_id = ?, team_id = ?, nationality = ?, time_gap = ?, is_same_time = ?
       WHERE id = ?`,
      [...values, existing[0].id]
    );
  } else {
    await conn.query(
      `INSERT INTO stage_results
       (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuid(), stageId, row.rank, ...values]
    );
  }

}

async function upsertGeneralClassification(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row);
  const riderId = await getOrCreateRider(conn, row);

  const [gcExisting] = await conn.query(
    'SELECT id FROM general_classification WHERE stage_id = ? AND `rank` = ? LIMIT 1',
    [stageId, row.rank]
  );
  const gcValues = [riderId, teamId, row.nationality, row.rank === 1 ? row.timeGap : null, row.rank === 1 ? '' : row.timeGap];
  if (gcExisting.length > 0) {
    await conn.query(
      `UPDATE general_classification
       SET rider_id = ?, team_id = ?, nationality = ?, total_time = ?, time_gap = ?
       WHERE id = ?`,
      [...gcValues, gcExisting[0].id]
    );
  } else {
    await conn.query(
      `INSERT INTO general_classification
       (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuid(), stageId, row.rank, ...gcValues]
    );
  }
}

async function importRace(conn, config) {
  const race = await getRace(conn, config.raceCode);
  const { generalUrl, stages } = await fetchStageList(config.slug);
  const imported = [];
  const stageIds = [];

  await conn.query('UPDATE races SET total_stages = ?, updated_at = NOW() WHERE id = ?', [stages.length, race.id]);

  await conn.query(
    `DELETE gc FROM general_classification gc
     JOIN stages st ON st.id = gc.stage_id
     WHERE st.race_id = ?`,
    [race.id]
  );

  for (const [index, stage] of stages.entries()) {
    const date = addDays(race.start_date.toISOString().slice(0, 10), index);
    const stageId = await upsertStage(conn, race, stage, date);
    stageIds.push(stageId);
    const rows = await fetchRankingRows(stage.url);
    for (const row of rows) {
      await upsertStageResult(conn, stageId, row);
    }
    imported.push({ stage: stage.stageNumber, results: rows.length, name: stage.stageName });
  }

  let finalGcRows = 0;
  if (generalUrl && stageIds.length > 0) {
    const rows = await fetchRankingRows(generalUrl);
    const finalStageId = stageIds[stageIds.length - 1];
    for (const row of rows) {
      await upsertGeneralClassification(conn, finalStageId, row);
    }
    finalGcRows = rows.length;
  }

  return { raceCode: config.raceCode, stages: imported, finalGcRows };
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const summary = [];
  try {
    await conn.beginTransaction();
    for (const race of RACES) {
      summary.push(await importRace(conn, race));
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
