#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 13306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123456',
  database: process.env.DB_NAME || 'jersey_db',
  dateStrings: true
};

const ROOT = path.resolve(__dirname, '..');
const STAGES = [1, 2, 3, 4];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractTeamCode(href) {
  const match = String(href || '').match(/\/team\/([^/]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractSlug(href) {
  const parts = String(href || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function titleCaseName(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/(\s+|-)/)
    .map(part => (/^\s+$|^-$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function formatTime(value) {
  const text = cleanText(value);
  if (!text || text === '-') return null;
  const hours = (text.match(/(\d+)\s*h/i) || [])[1];
  const minutes = (text.match(/(\d+)\s*'/) || [])[1];
  const seconds = (text.match(/(\d+)\s*''/) || [])[1];
  if (hours !== undefined && minutes !== undefined && seconds !== undefined) {
    const h = Number(hours);
    const m = String(Number(minutes)).padStart(2, '0');
    const s = String(Number(seconds)).padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${Number(minutes)}:${s}`;
  }
  return text;
}

function formatGap(value) {
  const text = cleanText(value);
  if (!text || text === '-') return null;
  const formatted = formatTime(text.replace(/^\+\s*/, ''));
  return formatted ? `+${formatted}` : text;
}

function parsePoints(value) {
  const match = cleanText(value).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function sourceFile(stageNumber, type) {
  return path.join(ROOT, 'temp', `dauphine_stage${stageNumber}_${type}.html`);
}

function loadHtmlIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function parseTeamRows(file) {
  const html = loadHtmlIfExists(file);
  if (!html) return [];
  const $ = cheerio.load(html);
  const rows = [];

  $('tbody tr').each((_, tr) => {
    const tds = $(tr).children('td');
    const teamLink = $(tds[1]).find('a').first();
    const rank = Number(cleanText($(tds[0]).text()));
    const teamName = cleanText(teamLink.text());
    if (!rank || !teamName) return;
    rows.push({
      rank,
      teamName,
      teamCode: extractTeamCode(teamLink.attr('href')),
      teamSlug: extractSlug(teamLink.attr('href')),
      totalTime: formatTime($(tds[2]).text()),
      timeGap: formatGap($(tds[3]).text())
    });
  });
  return rows;
}

function parseRiderRows(file, type) {
  const html = loadHtmlIfExists(file);
  if (!html) return [];
  const $ = cheerio.load(html);
  const rows = [];

  $('tbody tr').each((_, tr) => {
    const tds = $(tr).children('td');
    const riderCell = $(tds[1]);
    const riderLink = riderCell.find('a').first();
    const teamLink = $(tds[3]).find('a').first();
    const rank = Number(cleanText($(tds[0]).text()));
    const riderName = cleanText(riderLink.text());
    const teamName = cleanText(teamLink.text());
    if (!rank || !riderName || !teamName) return;

    const row = {
      rank,
      riderName,
      riderSlug: extractSlug(riderLink.attr('href')),
      nationality: cleanText(riderCell.find('.flag').attr('data-class')).replace(/^flag--/i, '').toUpperCase() || 'UNK',
      teamName,
      teamCode: extractTeamCode(teamLink.attr('href')),
      teamSlug: extractSlug(teamLink.attr('href'))
    };

    if (type === 'stage') {
      row.stageTime = formatTime($(tds[4]).text());
      row.timeGap = formatGap($(tds[5]).text());
    } else if (type === 'gc' || type === 'youth') {
      row.totalTime = formatTime($(tds[4]).text());
      row.timeGap = formatGap($(tds[5]).text());
    } else {
      row.points = parsePoints($(tds[4]).text());
    }
    rows.push(row);
  });
  return rows;
}

async function ensureTeam(conn, row) {
  if (row.teamCode) {
    const [existing] = await conn.query('SELECT id FROM teams WHERE uci_code = ? LIMIT 1', [row.teamCode]);
    if (existing.length) return existing[0].id;
  }
  if (row.teamSlug) {
    const [existing] = await conn.query('SELECT id FROM teams WHERE team_slug = ? LIMIT 1', [row.teamSlug]);
    if (existing.length) return existing[0].id;
  }
  const [byName] = await conn.query('SELECT id FROM teams WHERE team_name = ? LIMIT 1', [row.teamName]);
  if (byName.length) return byName[0].id;

  const id = crypto.randomUUID();
  await conn.query(
    `INSERT INTO teams (id, uci_code, team_name, team_name_en, team_slug, category, country)
     VALUES (?, ?, ?, ?, ?, 'WorldTeam', null)`,
    [id, row.teamCode || null, row.teamName, row.teamName, row.teamSlug || null]
  );
  return id;
}

async function ensureRider(conn, row) {
  if (row.riderSlug) {
    const [existing] = await conn.query('SELECT id FROM riders WHERE rider_slug = ? LIMIT 1', [row.riderSlug]);
    if (existing.length) return existing[0].id;
  }
  const [byName] = await conn.query(
    'SELECT id FROM riders WHERE rider_name = ? AND nationality = ? LIMIT 1',
    [row.riderName, row.nationality]
  );
  if (byName.length) return byName[0].id;

  const id = crypto.randomUUID();
  await conn.query(
    'INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (?, ?, ?, ?)',
    [id, titleCaseName(row.riderName), row.riderSlug || null, row.nationality || 'UNK']
  );
  return id;
}

async function importStage(conn, stageNumber) {
  const [stages] = await conn.query(
    `SELECT s.id
     FROM stages s
     JOIN races r ON r.id = s.race_id
     WHERE r.race_code = 'dauphine-2026' AND s.stage_number = ?
     LIMIT 1`,
    [stageNumber]
  );
  if (!stages.length) throw new Error(`dauphine-2026 stage ${stageNumber} not found`);
  const stageId = stages[0].id;

  const stageRows = parseRiderRows(sourceFile(stageNumber, 'ite'), 'stage');
  const gcRows = parseRiderRows(sourceFile(stageNumber, 'itg'), 'gc');
  const pointsRows = parseRiderRows(sourceFile(stageNumber, 'ipg'), 'points');
  const mountainsRows = parseRiderRows(sourceFile(stageNumber, 'img'), 'mountains');
  const youthRows = parseRiderRows(sourceFile(stageNumber, 'ijg'), 'youth');
  const teamRows = parseTeamRows(sourceFile(stageNumber, 'etg'));

  if (!gcRows.length || !pointsRows.length || !mountainsRows.length || !youthRows.length || !teamRows.length) {
    throw new Error(`Stage ${stageNumber} has missing official classification rows`);
  }
  if (stageNumber !== 3 && !stageRows.length) {
    throw new Error(`Stage ${stageNumber} has no official stage result rows`);
  }

  for (const table of ['jerseys', 'mountains_classification', 'points_classification', 'youth_classification', 'team_classification', 'general_classification']) {
    await conn.query(`DELETE FROM ${table} WHERE stage_id = ?`, [stageId]);
  }
  if (stageRows.length) {
    await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
  }

  const teamCache = new Map();
  const riderCache = new Map();
  const cachedTeam = async row => {
    const key = row.teamCode || row.teamSlug || row.teamName;
    if (!teamCache.has(key)) teamCache.set(key, await ensureTeam(conn, row));
    return teamCache.get(key);
  };
  const cachedRider = async row => {
    const key = row.riderSlug || `${row.riderName}:${row.nationality}`;
    if (!riderCache.has(key)) riderCache.set(key, await ensureRider(conn, row));
    return riderCache.get(key);
  };

  for (const row of stageRows) {
    const teamId = await cachedTeam(row);
    const riderId = await cachedRider(row);
    await conn.query(
      `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), stageId, row.rank, riderId, teamId, row.nationality, row.timeGap]
    );
  }

  for (const row of gcRows) {
    const teamId = await cachedTeam(row);
    const riderId = await cachedRider(row);
    await conn.query(
      `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), stageId, row.rank, riderId, teamId, row.nationality, row.totalTime, row.timeGap]
    );
  }

  for (const row of pointsRows) {
    const riderId = await cachedRider(row);
    await conn.query(
      `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
       VALUES (?, ?, ?, ?, 'green')`,
      [stageId, riderId, row.rank, row.points]
    );
  }

  for (const row of mountainsRows) {
    const riderId = await cachedRider(row);
    await conn.query(
      `INSERT INTO mountains_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
       VALUES (?, ?, ?, ?, 'blue')`,
      [stageId, riderId, row.rank, row.points]
    );
  }

  for (const row of youthRows) {
    const riderId = await cachedRider(row);
    await conn.query(
      `INSERT INTO youth_classification (stage_id, rider_id, \`rank\`, time, time_gap, jersey_type)
       VALUES (?, ?, ?, ?, ?, 'white')`,
      [stageId, riderId, row.rank, row.totalTime, row.timeGap]
    );
  }

  for (const row of teamRows) {
    const teamId = await cachedTeam(row);
    await conn.query(
      `INSERT INTO team_classification (id, stage_id, \`rank\`, team_id, total_time, time_gap)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), stageId, row.rank, teamId, row.totalTime, row.timeGap]
    );
  }

  for (const jersey of [
    { type: 'yellow', row: gcRows[0] },
    { type: 'green', row: pointsRows[0] },
    { type: 'blue', row: mountainsRows[0] },
    { type: 'white', row: youthRows[0] }
  ]) {
    const teamId = await cachedTeam(jersey.row);
    const riderId = await cachedRider(jersey.row);
    await conn.query(
      'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), stageId, jersey.type, riderId, teamId]
    );
  }

  return {
    stageNumber,
    stageRows: stageRows.length,
    gcRows: gcRows.length,
    pointsRows: pointsRows.length,
    mountainsRows: mountainsRows.length,
    youthRows: youthRows.length,
    teamRows: teamRows.length,
    stageWinner: stageRows[0]?.riderName || null,
    gcLeader: gcRows[0].riderName
  };
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const summary = [];
  try {
    await conn.beginTransaction();
    for (const stageNumber of STAGES) {
      summary.push(await importStage(conn, stageNumber));
    }
    await conn.commit();
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
