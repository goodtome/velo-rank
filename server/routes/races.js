const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, CACHE, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

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
    console.log('使用缓存的统计信息');
    return statsCache.data;
  }
    
  console.log('重新查询统计信息');
    
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
    throw new AppError('无效的赛事类别', ERROR_CODE.BAD_REQUEST);
  }
    
  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('无效的性别分类', ERROR_CODE.BAD_REQUEST);
  }
    
  let seasonNum = null;
  if (season) {
    seasonNum = parseInt(season);
    if (isNaN(seasonNum) || seasonNum < VALIDATION.MIN_SEASON || seasonNum > VALIDATION.MAX_SEASON) {
      throw new AppError('无效的赛季年份', ERROR_CODE.BAD_REQUEST);
    }
  }
    
  const pagination = validatePagination(req.query.page, req.query.limit);
    
  let sql = `
    SELECT /*+ INDEX(races idx_start_date) */
      id, race_name, race_name_en, race_code, category, gender, 
      season, country, start_date, end_date, total_stages, total_distance, logo_url
    FROM races USE INDEX(idx_start_date)
    WHERE is_active = 1
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
    throw new AppError('月份必须在1-12之间', ERROR_CODE.BAD_REQUEST);
  }
  if (yearNum < 2020 || yearNum > 2030) {
    throw new AppError('年份必须在2020-2030之间', ERROR_CODE.BAD_REQUEST);
  }
  
  // 查询该月及可能跨越该月的赛事
  // 赛事可能在月初之前开始但在月内结束，或在月内开始但在月后结束
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
  
  // 计算每个赛事的状态
  const today = new Date().toISOString().split('T')[0];
  const racesWithStatus = races.map(race => {
    // 统一将datetime转为日期字符串（处理UTC时区问题）
    const startDate = race.start_date ? new Date(race.start_date).toISOString().split('T')[0] : '';
    const endDate = race.end_date ? new Date(race.end_date).toISOString().split('T')[0] : '';
    
    let status = 'upcoming';
    if (startDate && endDate) {
      if (startDate <= today && endDate >= today) {
        status = 'ongoing';
      } else if (endDate < today) {
        status = 'finished';
      }
    }
    
    // 计算赛事覆盖的日期列表（用于日历标记）
    const raceDays = [];
    if (startDate && endDate) {
      // 用纯日期字符串操作，避免时区问题
      let current = new Date(startDate + 'T12:00:00Z'); // 用中午UTC避免跨天
      const endDt = new Date(endDate + 'T12:00:00Z');
      while (current <= endDt) {
        raceDays.push(current.toISOString().split('T')[0]);
        current = new Date(current.getTime() + 86400000); // +1天
      }
    }
    
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
  const today = new Date().toISOString().split('T')[0];
  
  // 查询进行中的赛事
  const [activeRaces] = await pool.query(`
    SELECT * FROM races 
    WHERE is_active = 1 
      AND start_date <= ? 
      AND end_date >= ?
    ORDER BY start_date ASC
  `, [today, today]);

  // 为每个赛事附加最新领骑衫信息
  const racesWithJerseys = await Promise.all(activeRaces.map(async (race) => {
    // 找最新有领骑衫数据的赛段
    const [latestWithJerseys] = await pool.query(`
      SELECT s.id FROM stages s
      JOIN jerseys j ON j.stage_id = s.id
      WHERE s.race_id = ?
      ORDER BY s.stage_number DESC
      LIMIT 1
    `, [race.id]);

    let jerseys = [];
    if (latestWithJerseys.length > 0) {
      const [jerseyRows] = await pool.query(`
        SELECT j.jersey_type, j.time_gap, j.points,
               r.rider_name, r.rider_name_zh, r.nationality,
               t.team_name, t.team_name_zh, t.uci_code
        FROM jerseys j
        JOIN riders r ON j.rider_id = r.id
        JOIN teams t ON j.team_id = t.id
        WHERE j.stage_id = ?
      `, [latestWithJerseys[0].id]);
      jerseys = jerseyRows;
    }

    return { ...race, jerseys };
  }));

  res.json({ code: 200, data: racesWithJerseys });
}));

// GET /api/v1/races/recent - 获取近期已结束赛事
router.get('/recent', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
  
  const [rows] = await pool.query(`
    SELECT * FROM races 
    WHERE is_active = 1 
      AND end_date < ?
    ORDER BY end_date DESC
    LIMIT ?
  `, [today, limit]);

  res.json({ code: 200, data: rows });
}));

// GET /api/v1/races/upcoming - 获取即将开始的赛事
router.get('/upcoming', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
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

  // 查找该赛事最新有领骑衫数据的赛段
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

  const [jerseys] = await pool.query(`
    SELECT j.jersey_type, j.time_gap, j.points,
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM jerseys j
    JOIN riders r ON j.rider_id = r.id
    JOIN teams t ON j.team_id = t.id
    WHERE j.stage_id = ?
  `, [latestWithJerseys[0].id]);

  res.json({ code: 200, data: jerseys });
}));

// POST /api/v1/races - 创建赛事
router.post('/', asyncHandler(async (req, res) => {
  const {
    race_name,
    race_name_en,
    race_name_zh,
    race_code,
    category,
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
    throw new AppError('缺少必填字段（race_name, race_code, season）', ERROR_CODE.BAD_REQUEST);
  }

  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的赛事类别', ERROR_CODE.BAD_REQUEST);
  }

  if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
    throw new AppError('无效的性别分类', ERROR_CODE.BAD_REQUEST);
  }

  if (season < VALIDATION.MIN_SEASON || season > VALIDATION.MAX_SEASON) {
    throw new AppError(`赛季年份必须在${VALIDATION.MIN_SEASON}-${VALIDATION.MAX_SEASON}之间`, ERROR_CODE.BAD_REQUEST);
  }

  const id = require('crypto').randomUUID();
  
  const sql = `INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, gender, season, country, start_date, end_date, total_stages, total_distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await pool.query(sql, [
    id, race_name, race_name_en || null, race_name_zh || null, race_code, category || null, gender || null,
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
    throw new AppError('赛事不存在', ERROR_CODE.NOT_FOUND);
  }
  res.json({ code: 200, data: rows[0] });
}));

// PUT /api/v1/races/:id - 更新赛事
router.put('/:id', asyncHandler(async (req, res) => {
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
    throw new AppError('赛事不存在', ERROR_CODE.NOT_FOUND);
  }

  // 数据校验
  if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
    throw new AppError('无效的赛事类别', ERROR_CODE.BAD_REQUEST);
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
    console.error('更新赛事失败:', err);
    throw new AppError('更新赛事失败: ' + err.message, ERROR_CODE.INTERNAL_ERROR);
  }
}));

// DELETE /api/v1/races/:id - 删除赛事
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  // 检查赛事是否存在
  const [existing] = await pool.query('SELECT id FROM races WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new AppError('赛事不存在', ERROR_CODE.NOT_FOUND);
  }

  // 删除关联的赛段（级联删除）
  await pool.query('DELETE FROM stages WHERE race_id = ?', [id]);
    
  // 删除赛事
  await pool.query('DELETE FROM races WHERE id = ?', [id]);

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

// GET /api/v1/races/:id/gc - 赛事总成绩榜
router.get('/:id/gc', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }
    
  const sql = `
    SELECT gc.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM general_classification gc
    JOIN riders r ON gc.rider_id = r.id
    JOIN teams t ON gc.team_id = t.id
    WHERE gc.stage_id = (
      SELECT id FROM stages WHERE race_id = ? ORDER BY stage_number DESC LIMIT 1
    )
    ORDER BY gc.\`rank\`
  `;
    
  const [rows] = await pool.query(sql, [id]);
  res.json({ code: 200, data: rows });
}));

module.exports = router;
