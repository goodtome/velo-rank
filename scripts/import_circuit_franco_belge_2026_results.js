#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 13306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123456',
  database: process.env.DB_NAME || 'jersey_db',
  charset: 'utf8mb4',
  dateStrings: true
};

const RACE_CODE = 'circuit-franco-belge-2026';
const SOURCE_FILE = path.resolve(__dirname, '..', 'temp', 'dom_circuit_franco_belge_2026.html');
const EXPECTED = {
  date: '2026-06-10',
  distanceKm: 195.6,
  location: ['Tournai', "Mont-de-l'Enclus"],
  resultRows: 117,
  podium: ['Corbin Strong', 'Anders Foldager', 'Paul Magnier']
};

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

function normalizeTime(readableTime, rank) {
  const value = cleanText(readableTime);
  if (!value || value === '-' || value === 'DNF' || value === 'DNS') return value;
  if (rank === 1 && !value.startsWith('+')) return value;
  return value.replace(/^\+\s*/, '+').replace(/\./g, ':');
}

function parseSource() {
  if (!fs.existsSync(SOURCE_FILE)) throw new Error(`Missing source file: ${SOURCE_FILE}`);
  const html = fs.readFileSync(SOURCE_FILE, 'utf8');
  const raw = extractJsValue(html, 'var stages = ');
  if (!raw) throw new Error('No Domestique stages payload found');

  const stages = JSON.parse(raw);
  if (!Array.isArray(stages) || stages.length === 0) throw new Error('Domestique stages payload is empty');

  const stage = stages[0];
  const rows = (stage.riderRanking || [])
    .map(row => {
      const rank = Number(row.ranking);
      const riderName = cleanText(row.title || `${row.firstName || ''} ${row.lastName || ''}`);
      const teamName = cleanText(row.team?.name || row.team?.title || 'Unknown Team');
      if (!Number.isInteger(rank) || rank <= 0 || !riderName || !teamName) return null;

      return {
        rank,
        riderName,
        riderSlug: slugify(riderName),
        nationality: cleanText(row.country?.short).toUpperCase() || 'UNK',
        teamName,
        teamSlug: slugify(teamName),
        uciCode: cleanText(row.team?.uciCode).slice(0, 10) || null,
        teamCountry: cleanText(row.team?.country?.short).toUpperCase() || null,
        timeGap: normalizeTime(row.readableTime, rank)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  return {
    title: cleanText(stage.title || 'Race'),
    date: stage.date?.[0],
    distanceKm: Number(stage.distance),
    location: Array.isArray(stage.location) ? stage.location : [],
    type: cleanText(stage.type || 'race'),
    rows
  };
}

function validateSource(parsed) {
  const errors = [];
  if (parsed.date !== EXPECTED.date) errors.push(`date ${parsed.date} != ${EXPECTED.date}`);
  if (Math.abs(parsed.distanceKm - EXPECTED.distanceKm) > 0.01) {
    errors.push(`distance ${parsed.distanceKm} != ${EXPECTED.distanceKm}`);
  }
  if (parsed.location[0] !== EXPECTED.location[0] || parsed.location[1] !== EXPECTED.location[1]) {
    errors.push(`location ${parsed.location.join(' - ')} != ${EXPECTED.location.join(' - ')}`);
  }
  if (parsed.rows.length !== EXPECTED.resultRows) {
    errors.push(`rows ${parsed.rows.length} != ${EXPECTED.resultRows}`);
  }
  const podium = parsed.rows.slice(0, 3).map(row => row.riderName);
  if (podium.join('|') !== EXPECTED.podium.join('|')) {
    errors.push(`podium ${podium.join(', ')} != ${EXPECTED.podium.join(', ')}`);
  }
  for (let i = 0; i < parsed.rows.length; i += 1) {
    if (parsed.rows[i].rank !== i + 1) {
      errors.push(`rank sequence breaks at row ${i + 1}: ${parsed.rows[i].rank}`);
      break;
    }
  }
  if (errors.length) throw new Error(`Source validation failed: ${errors.join('; ')}`);
}

async function getRaceAndStage(conn, parsed) {
  const [rows] = await conn.query(
    `SELECT r.id AS race_id, s.id AS stage_id, s.stage_number, s.stage_name, s.date, s.distance_km
     FROM races r
     JOIN stages s ON s.race_id = r.id
     WHERE r.race_code = ? AND s.stage_number = 1
     LIMIT 1`,
    [RACE_CODE]
  );
  if (!rows.length) throw new Error(`${RACE_CODE} stage 1 not found`);

  const stage = rows[0];
  const dbDate = String(stage.date).slice(0, 10);
  const dbDistance = Number(stage.distance_km);
  if (dbDate !== parsed.date) throw new Error(`DB stage date ${dbDate} != source ${parsed.date}`);
  if (Math.abs(dbDistance - parsed.distanceKm) > 0.01) {
    throw new Error(`DB stage distance ${dbDistance} != source ${parsed.distanceKm}`);
  }
  return stage;
}

async function getOrCreateTeam(conn, row) {
  const [existing] = row.uciCode
    ? await conn.query(
        'SELECT id FROM teams WHERE uci_code = ? OR team_slug = ? OR team_name = ? LIMIT 1',
        [row.uciCode, row.teamSlug, row.teamName]
      )
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

async function importRows(conn, stageId, rows) {
  await conn.query('DELETE FROM jerseys WHERE stage_id = ?', [stageId]);
  await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);
  await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);

  for (const row of rows) {
    const teamId = await getOrCreateTeam(conn, row);
    const riderId = await getOrCreateRider(conn, row);
    await conn.query(
      `INSERT INTO stage_results
       (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuid(), stageId, row.rank, riderId, teamId, row.nationality, row.timeGap, row.timeGap === '+00:00' ? 1 : 0]
    );
  }
}

async function main() {
  const parsed = parseSource();
  validateSource(parsed);

  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    await conn.beginTransaction();
    const stage = await getRaceAndStage(conn, parsed);
    await importRows(conn, stage.stage_id, parsed.rows);
    await conn.commit();

    console.log(JSON.stringify({
      raceCode: RACE_CODE,
      stageId: stage.stage_id,
      date: parsed.date,
      distanceKm: parsed.distanceKm,
      location: parsed.location,
      rows: parsed.rows.length,
      podium: parsed.rows.slice(0, 3).map(row => ({
        rank: row.rank,
        rider: row.riderName,
        team: row.teamName,
        timeGap: row.timeGap
      }))
    }, null, 2));
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
