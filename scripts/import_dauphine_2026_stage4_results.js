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
const SOURCE_FILES = {
  stage: path.join(ROOT, 'temp', 'dauphine_stage4_ite.html'),
  teamStage: path.join(ROOT, 'temp', 'dauphine_stage4_ete.html'),
  gc: path.join(ROOT, 'temp', 'dauphine_stage4_itg.html'),
  points: path.join(ROOT, 'temp', 'dauphine_stage4_ipg.html'),
  mountains: path.join(ROOT, 'temp', 'dauphine_stage4_img.html'),
  youth: path.join(ROOT, 'temp', 'dauphine_stage4_ijg.html')
};

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

  return text.replace(/\s+/g, ' ');
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

function loadHtml(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing source file: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function parseTeamRows(file) {
  const $ = cheerio.load(loadHtml(file));
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
  const $ = cheerio.load(loadHtml(file));
  const rows = [];

  $('tbody tr').each((_, tr) => {
    const tds = $(tr).children('td');
    const riderCell = $(tds[1]);
    const riderLink = riderCell.find('a').first();
    const teamLink = $(tds[3]).find('a').first();
    const rank = Number(cleanText($(tds[0]).text()));
    const riderName = cleanText(riderLink.text());
    const teamName = cleanText(teamLink.text());
    if (!rank || !riderName) return;

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
  const teamCode = row.teamCode || null;
  if (teamCode) {
    const [existing] = await conn.query('SELECT id FROM teams WHERE uci_code = ?', [teamCode]);
    if (existing.length) {
      await conn.query(
        'UPDATE teams SET team_name = COALESCE(team_name, ?), team_slug = COALESCE(team_slug, ?) WHERE id = ?',
        [row.teamName, row.teamSlug || null, existing[0].id]
      );
      return existing[0].id;
    }
  }

  const [bySlug] = row.teamSlug
    ? await conn.query('SELECT id FROM teams WHERE team_slug = ?', [row.teamSlug])
    : [[]];
  if (bySlug.length) return bySlug[0].id;

  const id = crypto.randomUUID();
  await conn.query(
    `INSERT INTO teams (id, uci_code, team_name, team_name_en, team_slug, category, country)
     VALUES (?, ?, ?, ?, ?, 'WorldTeam', null)`,
    [id, teamCode, row.teamName, row.teamName, row.teamSlug || null]
  );
  return id;
}

async function ensureRider(conn, row) {
  if (row.riderSlug) {
    const [existing] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [row.riderSlug]);
    if (existing.length) return existing[0].id;
  }

  const [byName] = await conn.query(
    'SELECT id FROM riders WHERE rider_name = ? AND nationality = ?',
    [row.riderName, row.nationality]
  );
  if (byName.length) return byName[0].id;

  const id = crypto.randomUUID();
  await conn.query(
    `INSERT INTO riders (id, rider_name, rider_slug, nationality)
     VALUES (?, ?, ?, ?)`,
    [id, titleCaseName(row.riderName), row.riderSlug || null, row.nationality || 'UNK']
  );
  return id;
}

async function main() {
  const stageRows = parseRiderRows(SOURCE_FILES.stage, 'stage');
  const teamStageRows = parseTeamRows(SOURCE_FILES.teamStage);
  const gcRows = parseRiderRows(SOURCE_FILES.gc, 'gc');
  const pointsRows = parseRiderRows(SOURCE_FILES.points, 'points');
  const mountainRows = parseRiderRows(SOURCE_FILES.mountains, 'mountains');
  const youthRows = parseRiderRows(SOURCE_FILES.youth, 'youth');

  if (stageRows.length < 100) {
    throw new Error(`Expected at least 100 stage result rows, found ${stageRows.length}`);
  }
  if (teamStageRows.length !== 22) {
    throw new Error(`Expected 22 team stage rows, found ${teamStageRows.length}`);
  }
  if (!gcRows.length || !pointsRows.length || !mountainRows.length || !youthRows.length) {
    throw new Error('One or more official classification files parsed no rows');
  }

  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    await conn.beginTransaction();

    const [stages] = await conn.query(
      `SELECT s.id, s.race_id
       FROM stages s
       JOIN races r ON r.id = s.race_id
       WHERE r.race_code = 'dauphine-2026' AND s.stage_number = 4`
    );
    if (!stages.length) throw new Error('dauphine-2026 stage 4 not found');
    const stageId = stages[0].id;

    for (const table of [
      'jerseys',
      'mountains_classification',
      'points_classification',
      'youth_classification',
      'team_classification',
      'general_classification',
      'stage_results'
    ]) {
      await conn.query(`DELETE FROM ${table} WHERE stage_id = ?`, [stageId]);
    }

    const teamIdByKey = new Map();
    const ensureTeamCached = async row => {
      const key = row.teamCode || row.teamSlug || row.teamName;
      if (!teamIdByKey.has(key)) {
        teamIdByKey.set(key, await ensureTeam(conn, row));
      }
      return teamIdByKey.get(key);
    };

    const riderIdByKey = new Map();
    const ensureRiderCached = async row => {
      const key = row.riderSlug || `${row.riderName}:${row.nationality}`;
      if (!riderIdByKey.has(key)) {
        riderIdByKey.set(key, await ensureRider(conn, row));
      }
      return riderIdByKey.get(key);
    };

    for (const row of stageRows) {
      const teamId = await ensureTeamCached(row);
      const riderId = await ensureRiderCached(row);
      await conn.query(
        `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), stageId, row.rank, riderId, teamId, row.nationality, row.timeGap]
      );
    }

    for (const row of teamStageRows) {
      const teamId = await ensureTeamCached(row);
      await conn.query(
        `INSERT INTO team_classification (id, stage_id, \`rank\`, team_id, total_time, time_gap)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), stageId, row.rank, teamId, row.totalTime, row.timeGap]
      );
    }

    async function importRiderClassification(rows, insertValues) {
      for (const row of rows) {
        const teamId = await ensureTeamCached(row);
        const riderId = await ensureRiderCached(row);
        await insertValues(row, riderId, teamId);
      }
    }

    await importRiderClassification(gcRows, async (row, riderId, teamId) => {
      await conn.query(
        `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), stageId, row.rank, riderId, teamId, row.nationality, row.totalTime, row.timeGap]
      );
    });

    await importRiderClassification(pointsRows, async (row, riderId) => {
      await conn.query(
        `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
         VALUES (?, ?, ?, ?, 'green')`,
        [stageId, riderId, row.rank, row.points]
      );
    });

    await importRiderClassification(mountainRows, async (row, riderId) => {
      await conn.query(
        `INSERT INTO mountains_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
         VALUES (?, ?, ?, ?, 'blue')`,
        [stageId, riderId, row.rank, row.points]
      );
    });

    await importRiderClassification(youthRows, async (row, riderId) => {
      await conn.query(
        `INSERT INTO youth_classification (stage_id, rider_id, \`rank\`, time, time_gap, jersey_type)
         VALUES (?, ?, ?, ?, ?, 'white')`,
        [stageId, riderId, row.rank, row.totalTime, row.timeGap]
      );
    });

    const jerseyDefinitions = [
      { type: 'yellow', row: gcRows[0] },
      { type: 'green', row: pointsRows[0] },
      { type: 'blue', row: mountainRows[0] },
      { type: 'white', row: youthRows[0] }
    ];

    for (const jersey of jerseyDefinitions) {
      const teamId = await ensureTeamCached(jersey.row);
      const riderId = await ensureRiderCached(jersey.row);
      await conn.query(
        `INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), stageId, jersey.type, riderId, teamId]
      );
    }

    await conn.commit();

    console.log(`Imported Dauphine 2026 stage 4 official results for stage_id=${stageId}`);
    console.log(`Stage rows: ${stageRows.length}`);
    console.log(`Team stage rows: ${teamStageRows.length}`);
    console.log(`GC rows: ${gcRows.length}`);
    console.log(`Points rows: ${pointsRows.length}`);
    console.log(`Mountains rows: ${mountainRows.length}`);
    console.log(`Youth rows: ${youthRows.length}`);
    console.log(`Stage winner: ${stageRows[0].riderName} ${stageRows[0].stageTime}`);
    console.log(`GC leader: ${gcRows[0].riderName} ${gcRows[0].totalTime}`);
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
