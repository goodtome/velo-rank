const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'config', '.env') });

const ROOT = path.resolve(__dirname, '..');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 13306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123456',
  database: process.env.DB_NAME || 'jersey_db',
  charset: 'utf8mb4'
};

const IMPORTS = [
  {
    raceCode: 'antwerp-port-epic-2026',
    stage: {
      number: 1,
      name: 'Antwerp Port Epic / Sels Trophy',
      nameZh: '安特卫普港史诗赛',
      date: '2026-05-25',
      type: 'One day race',
      startCity: 'Antwerp',
      finishCity: 'Antwerp',
      distanceKm: 182.0
    },
    sourceType: 'pcs-html',
    source: 'server/scripts/pcs_antwerp_2026.html'
  },
  {
    raceCode: 'tour-japan-2026',
    stage: {
      number: 1,
      name: 'Stage 1',
      nameZh: '第1赛段',
      date: '2026-05-17',
      type: 'Stage'
    },
    sourceType: 'pcs-json',
    source: 'server/scripts/stage-1.json'
  },
  {
    raceCode: 'tour-japan-2026',
    stage: {
      number: 3,
      name: 'Stage 3',
      nameZh: '第3赛段',
      date: '2026-05-19',
      type: 'Stage'
    },
    sourceType: 'pcs-json',
    source: 'server/scripts/stage_data.json'
  }
];

function uuid() {
  return crypto.randomUUID();
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTime(value) {
  const text = cleanText(value)
    .replace(/[▲▼]/g, '')
    .replace(/[\u923b\u9225?]/g, '')
    .trim();

  if (!text || text === '..' || text === '-') return '';
  if (text === 's.t.') return 's.t.';

  const matches = text.match(/\+?\d{1,2}:\d{2}(?::\d{2})?/g);
  if (matches && matches.length > 0) {
    return matches[0];
  }

  const seconds = text.match(/^\+\d+$/);
  return seconds ? text : '';
}

function firstCleanTime(...values) {
  for (const value of values) {
    const time = cleanTime(value);
    if (time) return time;
  }
  return '';
}

function parseIntOrZero(value) {
  const n = parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseHtmlResults(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const $ = cheerio.load(html);
  const rows = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 7) return;

    const rank = parseInt(cleanText($(cells[0]).text()), 10);
    if (!Number.isFinite(rank)) return;

    const riderCell = $(cells[5]);
    const riderLink = riderCell.find('a[href^="rider/"]').first();
    const surname = cleanText(riderLink.find('.uppercase').first().text());
    const fullLinkText = cleanText(riderLink.text());
    const givenNames = surname ? cleanText(fullLinkText.replace(surname, '')) : '';
    const riderName = surname && givenNames ? `${givenNames} ${surname}` : fullLinkText;
    const riderSlug = riderLink.attr('href')?.replace(/^rider\//, '') || slugify(riderName);
    const nationality = (riderCell.find('.flag').first().attr('class') || '').match(/\bflag\s+([a-z]{2})\b/i)?.[1]?.toUpperCase() || 'UNK';

    const teamCell = $(cells[6]);
    const teamName = cleanText(teamCell.find('a').first().text()) || cleanText(teamCell.text());
    const teamSlug = teamCell.find('a').first().attr('href')?.replace(/^team\//, '') || slugify(teamName);
    const time = cleanText($(cells[9]).find('font').first().text()) || cleanText($(cells[9]).text());

    if (!riderName || !teamName) return;
    rows.push({
      rank,
      riderName,
      riderSlug,
      nationality,
      teamName,
      teamSlug,
      timeGap: rank === 1 ? cleanTime(time) : cleanTime(time),
      gcRank: rank,
      gcTimeGap: rank === 1 ? cleanTime(time) : cleanTime(time),
      sprintPoints: parseIntOrZero(cleanText($(cells[8]).text()))
    });
  });

  return rows;
}

function parseJsonResults(file) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  return (data.results || [])
    .map(row => ({
      rank: parseInt(row.rank, 10),
      riderName: cleanText(row.rider),
      riderSlug: row.rider_id || slugify(row.rider),
      nationality: cleanText(row.nationality).toUpperCase() || 'UNK',
      teamName: cleanText(row.team),
      teamSlug: slugify(row.team),
      timeGap: firstCleanTime(row.stage_time, row.timelag),
      gcRank: parseInt(row.gc_rank, 10) || parseInt(row.rank, 10),
      gcTimeGap: firstCleanTime(row.timelag, row.stage_time),
      sprintPoints: parseIntOrZero(row.pnt_points)
    }))
    .filter(row => Number.isFinite(row.rank) && row.riderName && row.teamName);
}

async function getRace(conn, raceCode) {
  const [rows] = await conn.query('SELECT id, race_name FROM races WHERE race_code = ? LIMIT 1', [raceCode]);
  if (rows.length === 0) {
    throw new Error(`Race not found: ${raceCode}`);
  }
  return rows[0];
}

async function upsertStage(conn, raceId, raceCode, stage) {
  const stageCode = `${raceCode}-stage-${stage.number}`;
  const [existing] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ? LIMIT 1',
    [raceId, stage.number]
  );

  if (existing.length > 0) {
    await conn.query(
      `UPDATE stages
       SET stage_name = ?, stage_name_zh = ?, stage_type = ?, date = ?, distance_km = ?,
           start_city = ?, finish_city = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        stage.name,
        stage.nameZh,
        stage.type,
        stage.date,
        stage.distanceKm || null,
        stage.startCity || null,
        stage.finishCity || null,
        existing[0].id
      ]
    );
    return existing[0].id;
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO stages
     (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date,
      distance_km, start_city, finish_city, stage_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      raceId,
      stage.number,
      stage.name,
      stage.nameZh,
      stage.type,
      stage.date,
      stage.distanceKm || null,
      stage.startCity || null,
      stage.finishCity || null,
      stageCode
    ]
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
      [row.riderName, row.riderSlug, row.nationality || 'UNK', existing[0].id]
    );
    return existing[0].id;
  }

  const id = uuid();
  await conn.query(
    `INSERT INTO riders
     (id, rider_name, rider_slug, nationality, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [id, row.riderName, row.riderSlug, row.nationality || 'UNK']
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

  const values = [
    riderId,
    teamId,
    row.nationality || 'UNK',
    row.timeGap || '',
    row.timeGap === 's.t.' ? 1 : 0,
    row.sprintPoints || 0
  ];

  if (existing.length > 0) {
    await conn.query(
      `UPDATE stage_results
       SET rider_id = ?, team_id = ?, nationality = ?, time_gap = ?, is_same_time = ?, sprint_points = ?
       WHERE id = ?`,
      [...values, existing[0].id]
    );
    return;
  }

  await conn.query(
    `INSERT INTO stage_results
     (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, sprint_points, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), stageId, row.rank, ...values]
  );
}

async function upsertGeneralClassification(conn, stageId, row) {
  if (!Number.isFinite(row.gcRank)) return;

  const teamId = await getOrCreateTeam(conn, row);
  const riderId = await getOrCreateRider(conn, row);
  const [existing] = await conn.query(
    'SELECT id FROM general_classification WHERE stage_id = ? AND `rank` = ? LIMIT 1',
    [stageId, row.gcRank]
  );

  const values = [
    riderId,
    teamId,
    row.nationality || 'UNK',
    row.gcRank === 1 ? row.gcTimeGap || row.timeGap || null : null,
    row.gcTimeGap || ''
  ];

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
    [uuid(), stageId, row.gcRank, ...values]
  );
}

async function importOne(conn, config) {
  const race = await getRace(conn, config.raceCode);
  const stageId = await upsertStage(conn, race.id, config.raceCode, config.stage);
  const rows = config.sourceType === 'pcs-html'
    ? parseHtmlResults(config.source)
    : parseJsonResults(config.source);

  for (const row of rows) {
    await upsertStageResult(conn, stageId, row);
    await upsertGeneralClassification(conn, stageId, row);
  }

  return {
    raceCode: config.raceCode,
    stage: config.stage.number,
    stageId,
    results: rows.length,
    gcRows: rows.filter(row => Number.isFinite(row.gcRank)).length
  };
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const summary = [];
  try {
    await conn.beginTransaction();
    for (const config of IMPORTS) {
      summary.push(await importOne(conn, config));
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
