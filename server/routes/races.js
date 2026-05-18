const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, CACHE, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// 统计信息缓存（使用配置）
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
  
  // 检查缓存是否有效
  if (statsCache.data && (now - statsCache.timestamp) < statsCache.TTL) {
    console.log('使用缓存的统计信息');
    return statsCache.data;
  }
    
  console.log('重新查询统计信息');
    
  // 优化：使用单条查询代替多个子查询
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
    
  // 更新缓存
  statsCache.data = stats[0];
  statsCache.timestamp = now;
    
  return stats[0];
}

// GET /api/v1/races - 获取赛事列表
router.get('/', asyncHandler(async (req, res) => {
  const { category, gender, season } = req.query;
    
  // 验证参数
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
    
  // 验证并获取分页参数
  const pagination = validatePagination(req.query.page, req.query.limit);
    
  // 优化：添加索引提示（假设在start_date上有索引）
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

// GET /api/v1/races/stats/overview - 获取数据库统计信息（带缓存）
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const stats = await getStatsWithCache();
  res.json({ code: 200, data: stats });
}));

// POST /api/v1/races - 创建赛事
router.post('/', asyncHandler(async (req, res) => {
  const {
    race_name,
    race_name_en,
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
  const sql = `
    INSERT INTO races (
      id, race_name, race_name_en, race_code, category, gender,
      season, country, start_date, end_date, total_stages, total_distance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
    
  await pool.query(sql, [
    id, race_name, race_name_en, race_code, category, gender,
    season, country, start_date, end_date, total_stages, total_distance
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
    
  // 验证ID是否为有效数字
  const raceId = parseInt(id);
  if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }
    
  const [rows] = await pool.query('SELECT * FROM races WHERE id = ?', [raceId]);
  if (rows.length === 0) {
    throw new AppError('赛事不存在', ERROR_CODE.NOT_FOUND);
  }
  res.json({ code: 200, data: rows[0] });
}));

// PUT /api/v1/races/:id - 更新赛事
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const raceId = parseInt(id);
    
  if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  const {
    race_name,
    race_name_en,
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
  const [existing] = await pool.query('SELECT id FROM races WHERE id = ?', [raceId]);
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

  params.push(raceId); // WHERE id = ?

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
  const raceId = parseInt(id);
    
  if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }

  // 检查赛事是否存在
  const [existing] = await pool.query('SELECT id FROM races WHERE id = ?', [raceId]);
  if (existing.length === 0) {
    throw new AppError('赛事不存在', ERROR_CODE.NOT_FOUND);
  }

  // 删除关联的赛段（级联删除）
  await pool.query('DELETE FROM stages WHERE race_id = ?', [raceId]);
    
  // 删除赛事
  await pool.query('DELETE FROM races WHERE id = ?', [raceId]);

  res.json({
    code: 200,
    message: '赛事删除成功'
  });
}));

// GET /api/v1/races/:id/stages - 获取赛事赛段列表
router.get('/:id/stages', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  // 验证ID
  const raceId = parseInt(id);
  if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }
    
  const [rows] = await pool.query(
    'SELECT * FROM stages WHERE race_id = ? ORDER BY stage_number',
    [raceId]
  );
  res.json({ code: 200, data: rows });
}));

// GET /api/v1/races/:id/gc - 赛事总成绩榜
router.get('/:id/gc', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
  // 验证ID
  const raceId = parseInt(id);
  if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛事ID', ERROR_CODE.BAD_REQUEST);
  }
    
  // 使用参数化查询避免语法问题
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
    
  const [rows] = await pool.query(sql, [raceId]);
  res.json({ code: 200, data: rows });
}));

module.exports = router;
