const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, CACHE, VALIDATION, ERROR_CODE } = require('../constants');

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
    throw new Error('无效的分页参数');
  }
  
  return {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum
  };
}

/**
 * 统一错误响应
 */
function sendError(res, statusCode, message, details = null) {
  const response = { code: statusCode, message };
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  res.status(statusCode).json(response);
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
router.get('/', async (req, res) => {
  try {
    const { category, gender, season } = req.query;
    
    // 验证参数
    if (category && !VALIDATION.ALLOWED_CATEGORIES.includes(category)) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛事类别');
    }
    
    if (gender && !VALIDATION.ALLOWED_GENDERS.includes(gender)) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的性别分类');
    }
    
    let seasonNum = null;
    if (season) {
      seasonNum = parseInt(season);
      if (isNaN(seasonNum) || seasonNum < VALIDATION.MIN_SEASON || seasonNum > VALIDATION.MAX_SEASON) {
        return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛季年份');
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
  } catch (err) {
    console.error('获取赛事列表失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取赛事列表失败', err.message);
  }
});

// GET /api/v1/races/stats/overview - 获取数据库统计信息（带缓存）
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getStatsWithCache();
    res.json({ code: 200, data: stats });
  } catch (err) {
    console.error('获取统计信息失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取统计信息失败', err.message);
  }
});

// GET /api/v1/races/:id - 获取赛事详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID是否为有效数字
    const raceId = parseInt(id);
    if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛事ID');
    }
    
    const [rows] = await pool.query('SELECT * FROM races WHERE id = ?', [raceId]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '赛事不存在' });
    }
    res.json({ code: 200, data: rows[0] });
  } catch (err) {
    console.error('获取赛事详情失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取赛事详情失败', err.message);
  }
});

// GET /api/v1/races/:id/stages - 获取赛事赛段列表
router.get('/:id/stages', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const raceId = parseInt(id);
    if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛事ID');
    }
    
    const [rows] = await pool.query(
      'SELECT * FROM stages WHERE race_id = ? ORDER BY stage_number',
      [raceId]
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    console.error('获取赛段列表失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取赛段列表失败', err.message);
  }
});

// GET /api/v1/races/:id/gc - 赛事总成绩榜
router.get('/:id/gc', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const raceId = parseInt(id);
    if (isNaN(raceId) || raceId < VALIDATION.MIN_ID) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛事ID');
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
  } catch (err) {
    console.error('获取总成绩榜失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取总成绩榜失败', err.message);
  }
});

module.exports = router;