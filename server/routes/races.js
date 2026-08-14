const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, CACHE, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');
const { routeLog } = require('../middleware/requestLogger');
const { getJerseysForStage, getJerseysForStages } = require('../services/jerseyService');
const log = routeLog('races');

function toDateOnly(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return null;

  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isFinishedAfterEndOfDay(endDateValue, now = new Date()) {
  const endDate = parseDateOnly(endDateValue);
  if (!endDate) return false;

  endDate.setHours(23, 59, 59, 999);
  return now.getTime() > endDate.getTime();
}

function buildRaceDays(startDateValue, endDateValue) {
  const start = parseDateOnly(startDateValue);
  const end = parseDateOnly(endDateValue);
  if (!start || !end) return [];

  const raceDays = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (current <= end) {
    raceDays.push(toDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return raceDays;
}

const STAGE_CHILD_TABLES = [
  'stage_results',
  'jerseys',
  'general_classification',
  'points_classification',
  'mountains_classification',
  'youth_classification',
  'team_classification'
];

async function deleteStageData(conn, stageIds) {
  if (!stageIds.length) return;

  for (const table of STAGE_CHILD_TABLES) {
    await conn.query(`DELETE FROM ${table} WHERE stage_id IN (?)`, [stageIds]);
  }
}

async function getLatestClassifiedStageId(raceId, tableName) {
  const [rows] = await pool.query(
    `
      SELECT s.id
      FROM stages s
      JOIN ${tableName} tc ON tc.stage_id = s.id
      WHERE s.race_id = ?
      ORDER BY s.stage_number DESC
      LIMIT 1
    `,
    [raceId]
  );

  return rows.length > 0 ? rows[0].id : null;
}

// 统计信息缓存
let statsCache = {
  data: null,
  timestamp: 0,
  TTL: CACHE.STATS_TTL
};

/**
 * 验证并规范化分页参数
 */
function validatePagination(page, limit) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(PAGINATION.MIN_LIMIT, parseInt(limit) || PAGINATION.DEFAULT_LIMIT));
  
  if (isNaN(pageNum) || pageNum > PAGINATION.MAX_PAGE) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }
    
  return {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum -1) * limitNum
  };
}

/**
 * 获取统计信息（带缓存）
 */
async function getStatsWithCache() {
  const now = Date.now();
    
  if (statsCache.data && (now - statsCache.timestamp) < statsCache.TTL) {
    log.info('使用缓存的统计信息');
    return statsCache.data;
  }
    
  log.info('重新查询统计信息');
    
  const [stats] = await pool.query(`
    SELECT 
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as races,
      (SELECT COUNT(*) FROM stages) as stages,
      (SELECT COUNT(*) FROM riders) as riders,
      (SELECT COUNT(*) FROM teams) as teams,
      (SELECT COUNT(*) FROM stage_results) as stage_results,
      (SELECT COUNT(*) FROM jerseys) as jerseys,
      (SELECT COUNT(*) FROM general_classification) as general_classification
    FROM races
  `);
    
  statsCache.data = stats[0];
  statsCache.timestamp = now;
    
  return stats[0];
}

// GET /api/v1/races - 获取赛事列表
router.get('/', asyncHandler(async (req, res) => {
  const { category, gender, season } = req.query;
    
  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }
    
  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('无效的性别分类', ERROR_CODE.BAD_REQUEST);
  }
    
  let seasonNum = null;
  if (season) {
    seasonNum = parseInt(season);
    if (isNaN(seasonNum) || seasonNum < VALIDATION.MIN_SEASON || seasonNum > VALIDATION.MAX_SEASON) {
      throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
    }
  }
    
  const pagination = validatePagination(req.query.page, req.query.limit);
    
  let sql = `
    SELECT /*+ INDEX(races idx_start_date) */
      r.id, r.race_name, r.race_name_en, r.race_code, r.category, r.gender, 
      r.season, r.country, r.start_date, r.end_date, 
      GREATEST(COALESCE(r.total_stages, (SELECT COUNT(*) FROM stages s WHERE s.race_id = r.id)), 1) AS total_stages,
      r.total_distance, r.logo_url
    FROM races r USE INDEX(idx_start_date)
    WHERE r.is_active = 1
  `;
  const params = [];
    
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (gender) {
    sql += ' AND gender = ?';
    params.push(gender);
  }
  if (seasonNum) {
    sql += ' AND season = ?';
    params.push(seasonNum);
  }
    
  sql += ' ORDER BY start_date DESC LIMIT ? OFFSET ?';
  params.push(pagination.limit, pagination.offset);
    
  const [rows] = await pool.query(sql, params);
  res.json({
    code: 200,
    data: rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit
    }
  });
}));

// GET /api/v1/races/stats/overview - 获取数据库统计信息
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const stats = await getStatsWithCache();
  res.json({ code: 200, data: stats });
}));

// GET /api/v1/races/calendar - 获取赛事日历数据（指定月份）
router.get('/calendar', asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  
  const yearNum = parseInt(year) || new Date().getFullYear();
  const monthNum = parseInt(month) || (new Date().getMonth() + 1);
  
  if (monthNum < 1 || monthNum > 12) {
    throw new AppError('月份必须在 1-12 之间', ERROR_CODE.BAD_REQUEST);
  }
  if (yearNum < 2020 || yearNum > 2030) {
    throw new AppError('年份必须在 2020-2030 之间', ERROR_CODE.BAD_REQUEST);
  }
  
  // 查询该月及可能跨越该月的赛事。
  // 赛事可能在月初之前开始但在月内结束，或在月内开始但在月后结束。
const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  const [races] = await pool.query(`
    SELECT id, race_name, race_name_zh, race_name_en, race_code, category, gender,
           season, country, start_date, end_date, total_stages, logo_url
    FROM races 
    WHERE is_active = 1
      AND start_date <= ? 
      AND end_date >= ?
    ORDER BY start_date ASC
  `, [monthEnd, monthStart]);
  
  // 计算每个赛事的状态。
const now = new Date();
  const today = toDateOnly(now);
  const racesWithStatus = races.map(race => {
    // 统一将 datetime 转为日期字符串（处理 UTC 时区问题）
const startDate = toDateOnly(race.start_date);
    const endDate = toDateOnly(race.end_date);
    
    let status = 'upcoming';
    if (startDate && endDate) {
      if (startDate <= today && !isFinishedAfterEndOfDay(endDate, now)) {
        status = 'ongoing';
      } else if (isFinishedAfterEndOfDay(endDate, now)) {
        status = 'finished';
      }
    }
    
    const raceDays = buildRaceDays(startDate, endDate);
    
    return {
      ...race,
      start_date: startDate,
      end_date: endDate,
      status,
      raceDays
    };
  });
  
  res.json({ 
    code: 200, 
    data: {
      year: yearNum,
      month: monthNum,
      races: racesWithStatus
    }
  });
}));

// GET /api/v1/races/active - 获取当前进行中赛事（含最新领骑衫）
router.get('/active', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = toDateOnly(now);
  
  // 查询进行中的赛事。
  const [activeRaces] = await pool.query(`
    SELECT r.*, 
      GREATEST(COALESCE(r.total_stages, (
        SELECT COUNT(*) FROM stages s WHERE s.race_id = r.id
      )), 1) AS total_stages
    FROM races r
    WHERE r.is_active = 1 
      AND r.start_date <= ? 
      AND r.end_date >= ?
    ORDER BY r.start_date ASC
  `, [today, today]);

  const raceIds = activeRaces.map(race => race.id);
  const [latestStages] = raceIds.length
    ? await pool.query(`
        SELECT ranked.race_id, ranked.id AS stage_id
        FROM (
          SELECT s.race_id, s.id, s.stage_number,
                 ROW_NUMBER() OVER (PARTITION BY s.race_id ORDER BY s.stage_number DESC) AS rn
          FROM stages s
          JOIN jerseys j ON j.stage_id = s.id
          WHERE s.race_id IN (?)
        ) ranked
        WHERE ranked.rn = 1
      `, [raceIds])
    : [[]];

  const latestStageByRace = new Map(latestStages.map(row => [row.race_id, row.stage_id]));
  const jerseysByStage = await getJerseysForStages(pool, latestStages.map(row => row.stage_id));
  const racesWithJerseys = activeRaces.map(race => ({
    ...race,
    jerseys: jerseysByStage.get(latestStageByRace.get(race.id)) || []
  }));

  res.json({ code: 200, data: racesWithJerseys });
}));

// GET /api/v1/races/recent - 获取近期已结束赛事
router.get('/recent', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = toDateOnly(now);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  
  const [rows] = await pool.query(`
    SELECT r.*, 
      GREATEST(COALESCE(r.total_stages, (
        SELECT COUNT(*) FROM stages s WHERE s.race_id = r.id
      )), 1) AS total_stages
    FROM races r
    WHERE r.is_active = 1 
      AND r.end_date < ?
    ORDER BY r.end_date DESC
    LIMIT ?
  `, [today, limit]);

  res.json({ code: 200, data: rows });
}));

// GET /api/v1/races/upcoming - 获取即将开始的赛事
router.get('/upcoming', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = toDateOnly(now);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  
  const [rows] = await pool.query(`
    SELECT * FROM races 
    WHERE is_active = 1 
      AND start_date > ?
    ORDER BY start_date ASC
    LIMIT ?
  `, [today, limit]);

  res.json({ code: 200, data: rows });
}));

// GET /api/v1/races/:id/latest-jerseys - 获取赛事最新领骑衫
router.get('/:id/latest-jerseys', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const [latestWithJerseys] = await pool.query(`
    SELECT s.id FROM stages s
    JOIN jerseys j ON j.stage_id = s.id
    WHERE s.race_id = ?
    ORDER BY s.stage_number DESC
    LIMIT 1
  `, [id]);

  if (latestWithJerseys.length === 0) {
    return res.json({ code: 200, data: [] });
  }

  const jerseys = await getJerseysForStage(pool, latestWithJerseys[0].id);

  res.json({ code: 200, data: jerseys });
}));

// GET /api/v1/races/:id/team-classification - 获取赛事车队成绩榜
router.get('/:id/team-classification', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const stageId = await getLatestClassifiedStageId(id, 'team_classification');
  if (!stageId) {
    return res.json({
      code: 200,
      data: [],
      pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
    });
  }

  const [countResult] = await pool.query(
    'SELECT COUNT(*) AS total FROM team_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const [rows] = await pool.query(
    `
      SELECT tc.*, t.team_name, t.team_name_zh, t.uci_code, t.logo_url
      FROM team_classification tc
      JOIN teams t ON tc.team_id = t.id
      WHERE tc.stage_id = ?
      ORDER BY tc.\`rank\`
      LIMIT ? OFFSET ?
    `,
    [stageId, limitNum, offset]
  );

  res.json({
    code: 200,
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
}));

// GET /api/v1/races/:id/jerseys - 获取赛事所有赛段的领骑衫
router.get('/:id/jerseys', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  // 查询该赛事所有有领骑衫数据的赛段。
  const [stagesWithJerseys] = await pool.query(`
    SELECT DISTINCT s.id, s.stage_number, s.stage_name
    FROM stages s
    JOIN jerseys j ON j.stage_id = s.id
    WHERE s.race_id = ?
    ORDER BY s.stage_number
  `, [id]);

  if (stagesWithJerseys.length === 0) {
    return res.json({ code: 200, data: [] });
  }

  const jerseysByStageId = await getJerseysForStages(pool, stagesWithJerseys.map(stage => stage.id));
  const jerseysByStage = stagesWithJerseys.map(stage => ({
    stage_id: stage.id,
    stage_number: stage.stage_number,
    stage_name: stage.stage_name,
    jerseys: jerseysByStageId.get(stage.id) || []
  }));

  res.json({ code: 200, data: jerseysByStage });
}));

// POST /api/v1/races - 创建赛事
router.post('/', adminMiddleware, asyncHandler(async (req, res) => {
  const {
    race_name,
    race_name_en,
    race_name_zh,
    race_code,
    category,
    category_zh,
    gender,
    season,
    country,
    start_date,
    end_date,
    total_stages,
    total_distance
  } = req.body;

  // 数据校验
  if (!race_name || !race_code || !season) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('无效的性别分类', ERROR_CODE.BAD_REQUEST);
  }

  if (season < VALIDATION.MIN_SEASON || season > VALIDATION.MAX_SEASON) {
    throw new AppError(`赛季年份必须在 ${VALIDATION.MIN_SEASON}-${VALIDATION.MAX_SEASON} 之间`, ERROR_CODE.BAD_REQUEST);
  }

  const id = require('crypto').randomUUID();
  
  const sql = `INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages, total_distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await pool.query(sql, [
    id, race_name, race_name_en || null, race_name_zh || null, race_code, category || null, category_zh || null, gender || null,
    season, country || null, start_date || null, end_date || null, total_stages || null, total_distance || null
  ]);

  res.status(201).json({
    code: 201,
    message: '赛事创建成功',
    data: { id }
  });
}));

// GET /api/v1/races/:id - 获取赛事详情
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }
    
  const [rows] = await pool.query('SELECT * FROM races WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }
  res.json({ code: 200, data: rows[0] });
}));

// PUT /api/v1/races/:id - 更新赛事
router.put('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const {
    race_name,
    race_name_en,
    race_name_zh,
    race_code,
    category,
    category_zh,
    gender,
    season,
    country,
    start_date,
    end_date,
    total_stages,
    total_distance
  } = req.body;

  // 检查赛事是否存在
  const [existing] = await pool.query('SELECT id FROM races WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  // 数据校验
  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('无效的性别分类', ERROR_CODE.BAD_REQUEST);
  }

  // 构建动态更新SQL
  const updates = [];
  const params = [];

  if (race_name !== undefined) {
    updates.push('race_name = ?');
    params.push(race_name);
  }
  if (race_name_en !== undefined) {
    updates.push('race_name_en = ?');
    params.push(race_name_en);
  }
  if (race_name_zh !== undefined) {
    updates.push('race_name_zh = ?');
    params.push(race_name_zh || null);
  }
  if (race_code !== undefined) {
    updates.push('race_code = ?');
    params.push(race_code);
  }
  if (category !== undefined) {
    updates.push('category = ?');
    params.push(category);
  }
  if (category_zh !== undefined) {
    updates.push('category_zh = ?');
    params.push(category_zh || null);
  }
  if (gender !== undefined) {
    updates.push('gender = ?');
    params.push(gender);
  }
  if (season !== undefined) {
    updates.push('season = ?');
    params.push(season);
  }
  if (country !== undefined) {
    updates.push('country = ?');
    params.push(country || null);
  }
  if (start_date !== undefined) {
    updates.push('start_date = ?');
    params.push(start_date || null);
  }
  if (end_date !== undefined) {
    updates.push('end_date = ?');
    params.push(end_date || null);
  }
  if (total_stages !== undefined) {
    updates.push('total_stages = ?');
    params.push(total_stages || null);
  }
  if (total_distance !== undefined) {
    updates.push('total_distance = ?');
    params.push(total_distance || null);
  }

  if (updates.length === 0) {
    throw new AppError('没有提供要更新的字段', ERROR_CODE.BAD_REQUEST);
  }

  params.push(id); // WHERE id = ?

  const sql = `UPDATE races SET ${updates.join(', ')} WHERE id = ?`;
    
  try {
    await pool.query(sql, params);
    res.json({
      code: 200,
      message: '赛事更新成功'
    });
  } catch (err) {
    log.error('更新赛事失败', { error: err.message });
    throw new AppError('更新赛事失败: ' + err.message, ERROR_CODE.INTERNAL_ERROR);
  }
}));

// DELETE /api/v1/races/:id - 删除赛事
router.delete('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM races WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
    }

    const [stages] = await conn.query('SELECT id FROM stages WHERE race_id = ?', [id]);
    const stageIds = stages.map(stage => stage.id);

    await deleteStageData(conn, stageIds);
    await conn.query('DELETE FROM sync_logs WHERE race_id = ?', [id]);
    await conn.query('DELETE FROM stages WHERE race_id = ?', [id]);
    await conn.query('DELETE FROM races WHERE id = ?', [id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({
    code: 200,
    message: '赛事删除成功'
  });
}));

// GET /api/v1/races/:id/stages - 获取赛事赛段列表
router.get('/:id/stages', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }
    
  const [rows] = await pool.query(
    'SELECT * FROM stages WHERE race_id = ? ORDER BY stage_number',
    [id]
  );
  res.json({ code: 200, data: rows });
}));

// GET /api/v1/races/:id/gc - 赛事总成绩榜（支持分页）
router.get('/:id/gc', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;
  const stageId = await getLatestClassifiedStageId(id, 'general_classification');

  if (!stageId) {
    return res.json({
      code: 200,
      data: [],
      pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
    });
  }

  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM general_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT gc.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM general_classification gc
    JOIN riders r ON gc.rider_id = r.id
    LEFT JOIN teams t ON gc.team_id = t.id
    WHERE gc.stage_id = ?
    ORDER BY gc.\`rank\`
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);
  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/races/:id/visualization/gc-trend - GC time-gap timeline for the latest contenders
router.get('/:id/visualization/gc-trend', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requestedLimit = parseInt(req.query.limit, 10);
  const riderLimit = Math.min(10, Math.max(5, Number.isFinite(requestedLimit) ? requestedLimit : 5));

  if (!id || id.trim() === '') {
    throw new AppError('Invalid race ID', ERROR_CODE.BAD_REQUEST);
  }

  // The latest stage that has GC rows anchors both the selected riders and the
  // time window. Stages without a GC row are deliberately kept in the response
  // so clients can render an honest partial-data state instead of connecting
  // points across missing stages.
  const [latestRows] = await pool.query(`
    SELECT s.id, s.stage_number
    FROM stages s
    JOIN general_classification gc ON gc.stage_id = s.id
    WHERE s.race_id = ?
    ORDER BY s.stage_number DESC
    LIMIT 1
  `, [id]);

  if (latestRows.length === 0) {
    return res.json({
      code: 200,
      data: { status: 'empty', stages: [], riders: [] }
    });
  }

  const latestStage = latestRows[0];
  const [stages] = await pool.query(`
    SELECT id, stage_number, stage_name, stage_name_zh
    FROM stages
    WHERE race_id = ? AND stage_number <= ?
    ORDER BY stage_number ASC
  `, [id, latestStage.stage_number]);

  const [latestRiders] = await pool.query(`
    SELECT gc.rider_id, gc.\`rank\`, r.rider_name, r.rider_name_zh
    FROM general_classification gc
    JOIN riders r ON r.id = gc.rider_id
    WHERE gc.stage_id = ?
    ORDER BY gc.\`rank\` ASC, gc.rider_id ASC
    LIMIT ?
  `, [latestStage.id, riderLimit]);

  if (latestRiders.length === 0) {
    return res.json({
      code: 200,
      data: { status: 'empty', stages: [], riders: [] }
    });
  }

  const riderIds = latestRiders.map(row => row.rider_id);
  const [timelineRows] = await pool.query(`
    SELECT gc.stage_id, gc.rider_id, gc.\`rank\`, gc.time_gap, s.stage_number
    FROM general_classification gc
    JOIN stages s ON s.id = gc.stage_id
    WHERE s.race_id = ?
      AND s.stage_number <= ?
      AND gc.rider_id IN (?)
    ORDER BY s.stage_number ASC, gc.\`rank\` ASC
  `, [id, latestStage.stage_number, riderIds]);

  const rowsByRider = new Map();
  timelineRows.forEach(row => {
    if (!rowsByRider.has(row.rider_id)) rowsByRider.set(row.rider_id, []);
    rowsByRider.get(row.rider_id).push({
      stageId: row.stage_id,
      stageNumber: row.stage_number,
      rank: row.rank,
      timeGap: row.time_gap
    });
  });

  const riders = latestRiders.map(row => ({
    id: row.rider_id,
    rank: row.rank,
    name: row.rider_name_zh || row.rider_name || '',
    points: rowsByRider.get(row.rider_id) || []
  }));
  const expectedPoints = stages.length * riders.length;
  const status = timelineRows.length < expectedPoints ? 'partial' : 'ready';

  res.json({
    code: 200,
    data: {
      status,
      latestStageId: latestStage.id,
      stages: stages.map(stage => ({
        id: stage.id,
        number: stage.stage_number,
        name: stage.stage_name_zh || stage.stage_name || `Stage ${stage.stage_number}`
      })),
      riders
    }
  });
}));

// GET /api/v1/races/:id/points - 赛事冲刺积分榜（支持分页）
router.get('/:id/points', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;
  const stageId = await getLatestClassifiedStageId(id, 'points_classification');

  if (!stageId) {
    return res.json({
      code: 200,
      data: [],
      pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
    });
  }

  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM points_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT sub.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM (
      SELECT id, stage_id, rider_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS \`rank\`
      FROM points_classification
      WHERE stage_id = ?
    ) sub
    JOIN riders r ON sub.rider_id = r.id
    LEFT JOIN general_classification gc ON sub.stage_id = gc.stage_id AND sub.rider_id = gc.rider_id
    LEFT JOIN teams t ON gc.team_id = t.id
    ORDER BY sub.\`rank\`, sub.points DESC, sub.rider_id
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/races/:id/kom - 赛事爬坡积分榜（支持分页）
router.get('/:id/kom', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;
  const stageId = await getLatestClassifiedStageId(id, 'mountains_classification');

  if (!stageId) {
    return res.json({
      code: 200,
      data: [],
      pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
    });
  }

  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM mountains_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT sub.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM (
      SELECT id, stage_id, rider_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS \`rank\`
      FROM mountains_classification
      WHERE stage_id = ?
    ) sub
    JOIN riders r ON sub.rider_id = r.id
    LEFT JOIN general_classification gc ON sub.stage_id = gc.stage_id AND sub.rider_id = gc.rider_id
    LEFT JOIN teams t ON gc.team_id = t.id
    ORDER BY sub.\`rank\`, sub.points DESC, sub.rider_id
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/races/:id/youth - 赛事青年车手榜（支持分页）
router.get('/:id/youth', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;
  const stageId = await getLatestClassifiedStageId(id, 'youth_classification');

  if (!stageId) {
    return res.json({
      code: 200,
      data: [],
      pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
    });
  }

  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM youth_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT yc.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM youth_classification yc
    JOIN riders r ON yc.rider_id = r.id
    LEFT JOIN general_classification gc ON yc.stage_id = gc.stage_id AND yc.rider_id = gc.rider_id
    LEFT JOIN teams t ON gc.team_id = t.id
    WHERE yc.stage_id = ?
    ORDER BY yc.\`rank\`
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

module.exports = router;




