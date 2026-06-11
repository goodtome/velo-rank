const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');
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
const URL = 'https://www.procyclingstats.com/race/tour-of-japan/2026/stage-2/result/result';

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

function parseDate(text) {
  const match = cleanText(text).match(/Date:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) throw new Error('Could not parse stage date');
  const months = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  };
  return `${match[3]}-${months[match[2].toLowerCase()]}-${match[1].padStart(2, '0')}`;
}

function parseDistance(text) {
  const match = cleanText(text).match(/Distance:\s*([\d.]+)\s*km/i);
  return match ? Number(match[1]) : null;
}

function normalizeRiderName(value) {
  const text = cleanText(value);
  const parts = text.split(/\s+/);
  const firstLower = parts.findIndex(part => /[a-zÀ-ÿ]/.test(part));
  if (firstLower > 0) {
    return `${parts.slice(firstLower).join(' ')} ${parts.slice(0, firstLower).map(part => part.charAt(0) + part.slice(1).toLowerCase()).join(' ')}`;
  }
  return text;
}

function parseTime(value) {
  const text = cleanText(value);
  if (!text || text === ',,' || text === '..' || text === '-') return '';
  return text;
}

async function fetchHtml() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const title = await page.title();
  if (/just a moment/i.test(title)) {
    await browser.close();
    throw new Error('PCS security verification page returned');
  }
  const html = await page.content();
  await browser.close();
  return html;
}

function parseResults(html) {
  const $ = cheerio.load(html);
  const bodyText = cleanText($('body').text());
  const date = parseDate(bodyText);
  const distanceKm = parseDistance(bodyText);
  const table = $('table').first();
  const rows = [];

  table.find('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 9) return;
    const rank = parseInt(cleanText($(cells[0]).text()), 10);
    if (!Number.isInteger(rank)) return;

    const riderLink = $(tr).find('td.ridername a').first();
    const riderName = normalizeRiderName(riderLink.text());
    const riderSlug = riderLink.attr('href')?.replace(/^rider\//, '') || slugify(riderName);
    const riderCell = $(tr).find('td.ridername').first();
    const nationality = (riderCell.find('.flag').first().attr('class') || '').match(/\bflag\s+([a-z]{2})\b/i)?.[1]?.toUpperCase() || 'UNK';
    const teamLink = $(tr).find('td.cu600 a[href^="team/"]').first();
    const teamName = cleanText(teamLink.text()) || cleanText($(cells[8]).text()) || 'Unknown Team';
    const teamSlug = teamLink.attr('href')?.replace(/^team\//, '') || slugify(teamName);
    const timeText = parseTime($(cells[12]).find('font').first().text() || $(cells[12]).text());

    if (!riderName || !teamName) return;
    rows.push({
      rank,
      riderName,
      riderSlug,
      nationality,
      teamName,
      teamSlug,
      timeGap: rank === 1 ? timeText : timeText || 's.t.'
    });
  });

  return { date, distanceKm, rows };
}

async function getRace(conn) {
  const [rows] = await conn.query('SELECT id, race_code FROM races WHERE race_code = ? LIMIT 1', [RACE_CODE]);
  if (rows.length === 0) throw new Error(`Race not found: ${RACE_CODE}`);
  return rows[0];
}

async function upsertStage(conn, race, parsed) {
  const [existing] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ? LIMIT 1',
    [race.id, 2]
  );
  const values = ['Stage 2 | Inabe-Inabe', '第2赛段', 'Stage', parsed.date, parsed.distanceKm, 'Inabe', 'Inabe'];
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
    [id, race.id, 2, ...values, `${RACE_CODE}-pcs-stage-2`]
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
    'INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [id, row.riderName, row.riderSlug, row.nationality]
  );
  return id;
}

async function upsertResult(conn, stageId, row) {
  const teamId = await getOrCreateTeam(conn, row);
  const riderId = await getOrCreateRider(conn, row);
  const [existing] = await conn.query(
    'SELECT id FROM stage_results WHERE stage_id = ? AND rank_pos = ? LIMIT 1',
    [stageId, row.rank]
  );
  const values = [riderId, teamId, row.nationality, row.timeGap, row.timeGap === 's.t.' ? 1 : 0];
  if (existing.length > 0) {
    await conn.query(
      'UPDATE stage_results SET rider_id = ?, team_id = ?, nationality = ?, time_gap = ?, is_same_time = ? WHERE id = ?',
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

async function main() {
  const html = await fetchHtml();
  const parsed = parseResults(html);
  if (parsed.rows.length === 0) throw new Error('No stage result rows parsed');

  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    await conn.beginTransaction();
    const race = await getRace(conn);
    const stageId = await upsertStage(conn, race, parsed);
    for (const row of parsed.rows) await upsertResult(conn, stageId, row);
    await conn.commit();
    console.log(JSON.stringify({ raceCode: RACE_CODE, stage: 2, date: parsed.date, results: parsed.rows.length }, null, 2));
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
