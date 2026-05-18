const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');

const MAX_LIMIT = 50; // 搜索结果数量限制

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

// GET /api/v1/search/riders - 搜索车手
router.get('/riders', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    // 验证搜索关键词
    if (!q || typeof q !== 'string') {
      return sendError(res, 400, '缺少搜索关键词q');
    }

    if (q.length > 50) {
      return sendError(res, 400, '搜索关键词过长');
    }

    if (q.trim().length === 0) {
      return res.json({ code: 200, data: { riders: [] } });
    }

    // 验证并限制查询结果数量
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 10));
    if (isNaN(parseInt(limit))) {
      return sendError(res, 400, '无效的limit参数');
    }

    const [rows] = await pool.query(
      `SELECT id, rider_name, rider_name_zh, nationality, photo_url
       FROM riders
       WHERE rider_name LIKE ? OR rider_name_zh LIKE ?
       LIMIT ?`,
      [`%${q}%`, `%${q}%`, limitNum]
    );
    res.json({ code: 200, data: { riders: rows } });
  } catch (err) {
    console.error('搜索车手失败:', err);
    sendError(res, 500, '搜索车手失败', err.message);
  }
});

// GET /api/v1/search/teams - 搜索车队
router.get('/teams', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    // 验证搜索关键词
    if (!q || typeof q !== 'string') {
      return sendError(res, 400, '缺少搜索关键词q');
    }

    if (q.length > 50) {
      return sendError(res, 400, '搜索关键词过长');
    }

    if (q.trim().length === 0) {
      return res.json({ code: 200, data: { teams: [] } });
    }

    // 验证并限制查询结果数量
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 10));
    if (isNaN(parseInt(limit))) {
      return sendError(res, 400, '无效的limit参数');
    }

    const [rows] = await pool.query(
      `SELECT id, uci_code, team_name, team_name_zh, logo_url
       FROM teams
       WHERE team_name LIKE ? OR team_name_zh LIKE ? OR uci_code LIKE ?
       LIMIT ?`,
      [`%${q}%`, `%${q}%`, `%${q}%`, limitNum]
    );
    res.json({ code: 200, data: { teams: rows } });
  } catch (err) {
    console.error('搜索车队失败:', err);
    sendError(res, 500, '搜索车队失败', err.message);
  }
});

module.exports = router;
