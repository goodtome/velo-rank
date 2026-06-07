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

// 缁熻淇℃伅缂撳瓨
let statsCache = {
  data: null,
  timestamp: 0,
  TTL: CACHE.STATS_TTL
};

/**
 * 楠岃瘉骞惰鑼冨寲鍒嗛〉鍙傛暟
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
 * 鑾峰彇缁熻淇℃伅锛堝甫缂撳瓨锛? */
async function getStatsWithCache() {
  const now = Date.now();
    
  if (statsCache.data && (now - statsCache.timestamp) < statsCache.TTL) {
    log.info('使用缓存的统计信息');
    return statsCache.data;
  }
    
  log.info('閲嶆柊鏌ヨ缁熻淇℃伅');
    
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

// GET /api/v1/races - 鑾峰彇璧涗簨鍒楄〃
router.get('/', asyncHandler(async (req, res) => {
  const { category, gender, season } = req.query;
    
  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }
    
  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('鏃犳晥鐨勬€у埆鍒嗙被', ERROR_CODE.BAD_REQUEST);
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

// GET /api/v1/races/stats/overview - 鑾峰彇鏁版嵁搴撶粺璁′俊鎭?
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const stats = await getStatsWithCache();
  res.json({ code: 200, data: stats });
}));

// GET /api/v1/races/calendar - 鑾峰彇璧涗簨鏃ュ巻鏁版嵁锛堟寚瀹氭湀浠斤級
router.get('/calendar', asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  
  const yearNum = parseInt(year) || new Date().getFullYear();
  const monthNum = parseInt(month) || (new Date().getMonth() + 1);
  
  if (monthNum < 1 || monthNum > 12) {
    throw new AppError('鏈堜唤蹇呴』鍦?-12涔嬮棿', ERROR_CODE.BAD_REQUEST);
  }
  if (yearNum < 2020 || yearNum > 2030) {
    throw new AppError('骞翠唤蹇呴』鍦?020-2030涔嬮棿', ERROR_CODE.BAD_REQUEST);
  }
  
  // 鏌ヨ璇ユ湀鍙婂彲鑳借法瓒婅鏈堢殑璧涗簨
  // 璧涗簨鍙兘鍦ㄦ湀鍒濅箣鍓嶅紑濮嬩絾鍦ㄦ湀鍐呯粨鏉燂紝鎴栧湪鏈堝唴寮€濮嬩絾鍦ㄦ湀鍚庣粨鏉?
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
  
  // 璁＄畻姣忎釜璧涗簨鐨勭姸鎬?
const now = new Date();
  const today = toDateOnly(now);
  const racesWithStatus = races.map(race => {
    // 缁熶竴灏哾atetime杞负鏃ユ湡瀛楃涓诧紙澶勭悊UTC鏃跺尯闂锛?
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

// GET /api/v1/races/active - 鑾峰彇褰撳墠杩涜涓禌浜嬶紙鍚渶鏂伴楠戣～锛?
router.get('/active', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = toDateOnly(now);
  
  // 鏌ヨ杩涜涓殑璧涗簨
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

// GET /api/v1/races/recent - 鑾峰彇杩戞湡宸茬粨鏉熻禌浜?
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

// GET /api/v1/races/upcoming - 鑾峰彇鍗冲皢寮€濮嬬殑璧涗簨
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

// GET /api/v1/races/:id/latest-jerseys - 鑾峰彇璧涗簨鏈€鏂伴楠戣～
router.get('/:id/latest-jerseys', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
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

// GET /api/v1/races/:id/jerseys - 鑾峰彇璧涗簨鎵€鏈夎禌娈电殑棰嗛獞琛?
router.get('/:id/jerseys', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }

  // 鏌ヨ璇ヨ禌浜嬫墍鏈夋湁棰嗛獞琛暟鎹殑璧涙
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

// POST /api/v1/races - 鍒涘缓璧涗簨
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

  // 鏁版嵁鏍￠獙
  if (!race_name || !race_code || !season) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('鏃犳晥鐨勬€у埆鍒嗙被', ERROR_CODE.BAD_REQUEST);
  }

  if (season < VALIDATION.MIN_SEASON || season > VALIDATION.MAX_SEASON) {
    throw new AppError(`璧涘骞翠唤蹇呴』鍦?{VALIDATION.MIN_SEASON}-${VALIDATION.MAX_SEASON}涔嬮棿`, ERROR_CODE.BAD_REQUEST);
  }

  const id = require('crypto').randomUUID();
  
  const sql = `INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages, total_distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await pool.query(sql, [
    id, race_name, race_name_en || null, race_name_zh || null, race_code, category || null, category_zh || null, gender || null,
    season, country || null, start_date || null, end_date || null, total_stages || null, total_distance || null
  ]);

  res.status(201).json({
    code: 201,
    message: '璧涗簨鍒涘缓鎴愬姛',
    data: { id }
  });
}));

// GET /api/v1/races/:id - 鑾峰彇璧涗簨璇︽儏
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }
    
  const [rows] = await pool.query('SELECT * FROM races WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }
  res.json({ code: 200, data: rows[0] });
}));

// PUT /api/v1/races/:id - 鏇存柊璧涗簨
router.put('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
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

  // 妫€鏌ヨ禌浜嬫槸鍚﹀瓨鍦?
const [existing] = await pool.query('SELECT id FROM races WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  // 鏁版嵁鏍￠獙
  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('鏃犳晥鐨勬€у埆鍒嗙被', ERROR_CODE.BAD_REQUEST);
  }

  // 鏋勫缓鍔ㄦ€佹洿鏂癝QL
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
    throw new AppError('娌℃湁鎻愪緵瑕佹洿鏂扮殑瀛楁', ERROR_CODE.BAD_REQUEST);
  }

  params.push(id); // WHERE id = ?

  const sql = `UPDATE races SET ${updates.join(', ')} WHERE id = ?`;
    
  try {
    await pool.query(sql, params);
    res.json({
      code: 200,
      message: '璧涗簨鏇存柊鎴愬姛'
    });
  } catch (err) {
    log.error('鏇存柊璧涗簨澶辫触', { error: err.message });
    throw new AppError('鏇存柊璧涗簨澶辫触: ' + err.message, ERROR_CODE.INTERNAL_ERROR);
  }
}));

// DELETE /api/v1/races/:id - 鍒犻櫎璧涗簨
router.delete('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
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
    message: '璧涗簨鍒犻櫎鎴愬姛'
  });
}));

// GET /api/v1/races/:id/stages - 鑾峰彇璧涗簨璧涙鍒楄〃
router.get('/:id/stages', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }
    
  const [rows] = await pool.query(
    'SELECT * FROM stages WHERE race_id = ? ORDER BY stage_number',
    [id]
  );
  res.json({ code: 200, data: rows });
}));

// GET /api/v1/races/:id/gc - 璧涗簨鎬绘垚缁╂锛堟敮鎸佸垎椤碉級
router.get('/:id/gc', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // 鏌ユ€绘暟
  const [countResult] = await pool.query(`
    SELECT COUNT(*) as total FROM general_classification
    WHERE stage_id = (SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1)
  `, [id]);
  const total = countResult[0].total;

  const sql = `
    SELECT gc.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM general_classification gc
    JOIN riders r ON gc.rider_id = r.id
    LEFT JOIN stage_results sr ON gc.stage_id = sr.stage_id AND gc.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE gc.stage_id = (
      SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1
    )
    ORDER BY gc.\`rank\`
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [id, limitNum, offset]);
  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/races/:id/points - 璧涗簨鍐插埡绉垎姒滐紙鏀寔鍒嗛〉锛?
router.get('/:id/points', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // 鏌ユ€绘暟锛堝熀浜庢渶鏂拌禌娈碉級
  const [countResult] = await pool.query(`
    SELECT COUNT(*) as total FROM points_classification
    WHERE stage_id = (SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1)
  `, [id]);
  const total = countResult[0].total;

  const sql = `
    SELECT sub.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM (
      SELECT id, stage_id, rider_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS \`rank\`
      FROM points_classification
      WHERE stage_id = (
        SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1
      )
    ) sub
    JOIN riders r ON sub.rider_id = r.id
    LEFT JOIN stage_results sr ON sub.stage_id = sr.stage_id AND sub.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    ORDER BY sub.\`rank\`, sub.points DESC, sub.rider_id
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [id, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/races/:id/kom - 璧涗簨鐖潯绉垎姒滐紙鏀寔鍒嗛〉锛?
router.get('/:id/kom', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const [countResult] = await pool.query(`
    SELECT COUNT(*) as total FROM mountains_classification
    WHERE stage_id = (SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1)
  `, [id]);
  const total = countResult[0].total;

  const sql = `
    SELECT sub.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM (
      SELECT id, stage_id, rider_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS \`rank\`
      FROM mountains_classification
      WHERE stage_id = (
        SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1
      )
    ) sub
    JOIN riders r ON sub.rider_id = r.id
    LEFT JOIN stage_results sr ON sub.stage_id = sr.stage_id AND sub.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    ORDER BY sub.\`rank\`, sub.points DESC, sub.rider_id
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [id, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/races/:id/youth - 璧涗簨闈掑勾杞︽墜姒滐紙鏀寔鍒嗛〉锛?
router.get('/:id/youth', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('鏃犳晥鐨勮禌浜婭D', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const [countResult] = await pool.query(`
    SELECT COUNT(*) as total FROM youth_classification
    WHERE stage_id = (SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1)
  `, [id]);
  const total = countResult[0].total;

  const sql = `
    SELECT yc.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM youth_classification yc
    JOIN riders r ON yc.rider_id = r.id
    LEFT JOIN stage_results sr ON yc.stage_id = sr.stage_id AND yc.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE yc.stage_id = (
      SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1
    )
    ORDER BY yc.\`rank\`
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [id, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

module.exports = router;




