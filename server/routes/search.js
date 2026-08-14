const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const MAX_LIMIT = PAGINATION.MAX_LIMIT;

function normalizeKeyword(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePaging(query, defaultLimit = 20) {
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || defaultLimit));
  const pageNum = Math.max(1, parseInt(query.page) || 1);
  const rawOffset = query.offset !== undefined ? parseInt(query.offset) : NaN;
  const offset = Number.isNaN(rawOffset)
    ? (pageNum - 1) * limitNum
    : Math.max(0, rawOffset);

  return { pageNum, limitNum, offset };
}

function buildRaceSearchLabel(race) {
  const zh = race.race_name_zh || '';
  const en = race.race_name_en || race.race_name || '';
  return { zh, en };
}

function normalizeFilter(value) {
  const normalized = normalizeKeyword(value);
  return normalized && normalized.toUpperCase() !== 'ALL' ? normalized : '';
}

// GET /api/v1/search/riders
router.get('/riders', asyncHandler(async (req, res) => {
  const q = normalizeKeyword(req.query.q);
  const { pageNum, limitNum, offset } = parsePaging(req.query);

  if (q.length > 50) {
    throw new AppError('Search keyword is too long', ERROR_CODE.BAD_REQUEST);
  }

  const whereSql = q ? 'WHERE rider_name LIKE ? OR rider_name_zh LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`] : [];

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM riders ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT id, rider_name, rider_name_zh, nationality, photo_url
     FROM riders
     ${whereSql}
     ORDER BY rider_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  res.json({ code: 200, data: { riders: rows, total, page: pageNum, limit: limitNum, offset } });
}));

// GET /api/v1/search/teams
router.get('/teams', asyncHandler(async (req, res) => {
  const q = normalizeKeyword(req.query.q);
  const { pageNum, limitNum, offset } = parsePaging(req.query);

  if (q.length > 50) {
    throw new AppError('Search keyword is too long', ERROR_CODE.BAD_REQUEST);
  }

  const whereSql = q ? 'WHERE team_name LIKE ? OR team_name_zh LIKE ? OR uci_code LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM teams ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT id, uci_code, team_name, team_name_zh, logo_url
     FROM teams
     ${whereSql}
     ORDER BY team_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  res.json({ code: 200, data: { teams: rows, total, page: pageNum, limit: limitNum, offset } });
}));

// GET /api/v1/search/races
router.get('/races', asyncHandler(async (req, res) => {
  const q = normalizeKeyword(req.query.q);
  const season = req.query.season ?? req.query.year;
  const status = normalizeFilter(req.query.status).toLowerCase();
  const category = normalizeFilter(req.query.category);
  const gender = normalizeFilter(req.query.gender).toUpperCase();
  const { pageNum, limitNum, offset } = parsePaging(req.query);

  if (q.length > 50) {
    throw new AppError('Search keyword is too long', ERROR_CODE.BAD_REQUEST);
  }

  const where = ['1=1'];
  const params = [];

  if (q) {
    where.push(`(
      race_name LIKE ?
      OR race_name_zh LIKE ?
      OR race_name_en LIKE ?
      OR race_code LIKE ?
      OR country LIKE ?
      OR CAST(season AS CHAR) LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  if (season !== undefined && season !== null && String(season).trim() !== '') {
    const seasonNum = parseInt(season);
    if (Number.isNaN(seasonNum)) {
      throw new AppError('Invalid season parameter', ERROR_CODE.BAD_REQUEST);
    }
    where.push('season = ?');
    params.push(seasonNum);
  }

  if (status) {
    if (!['upcoming', 'ongoing', 'active', 'finished'].includes(status)) {
      throw new AppError('Invalid status parameter', ERROR_CODE.BAD_REQUEST);
    }
    if (status === 'upcoming') {
      where.push('start_date > CURDATE()');
    } else if (status === 'ongoing' || status === 'active') {
      where.push('start_date <= CURDATE() AND COALESCE(end_date, start_date) >= CURDATE()');
    } else if (status === 'finished') {
      where.push('COALESCE(end_date, start_date) < CURDATE()');
    }
  }

  if (category) {
    where.push('category = ?');
    params.push(category);
  }

  if (gender) {
    if (!['MEN', 'WOMEN'].includes(gender)) {
      throw new AppError('Invalid gender parameter', ERROR_CODE.BAD_REQUEST);
    }
    where.push('gender = ?');
    params.push(gender);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM races ${whereSql}`,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        id,
        race_name,
        race_name_zh,
        race_name_en,
        race_code,
        category,
        gender,
        season,
        country,
        start_date,
        end_date,
        total_stages,
        total_distance,
        logo_url,
        CASE
          WHEN start_date > CURDATE() THEN 'upcoming'
          WHEN start_date <= CURDATE() AND COALESCE(end_date, start_date) >= CURDATE() THEN 'ongoing'
          ELSE 'finished'
        END AS status
      FROM races
      ${whereSql}
      ORDER BY season DESC, start_date DESC, race_name ASC
      LIMIT ? OFFSET ?
    `,
    [...params, limitNum, offset]
  );

  const races = rows.map(race => {
    const label = buildRaceSearchLabel(race);
    return {
      ...race,
      displayName: label.zh || label.en,
      displaySub: label.zh && label.en ? label.en : '',
      searchSeason: race.season,
      searchCountry: race.country
    };
  });

  res.json({
    code: 200,
    data: { races, total, page: pageNum, limit: limitNum, offset }
  });
}));

module.exports = router;
