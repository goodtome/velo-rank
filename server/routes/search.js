const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const MAX_LIMIT = 50;

// GET /api/v1/search/riders - 搜索车手 / 获取全部车手列表
router.get('/riders', asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 20));

  // 有搜索关键词 → 模糊搜索
  if (q && q.trim().length > 0) {
    if (q.length > 50) {
      throw new AppError('搜索关键词过长', ERROR_CODE.BAD_REQUEST);
    }

    const [rows] = await pool.query(
      `SELECT id, rider_name, rider_name_zh, nationality, photo_url
       FROM riders
       WHERE rider_name LIKE ? OR rider_name_zh LIKE ?
       ORDER BY rider_name ASC
       LIMIT ?`,
      [`%${q}%`, `%${q}%`, limitNum]
    );
    return res.json({ code: 200, data: { riders: rows, total: rows.length } });
  }

  // 无搜索关键词 → 返回全部车手（按名称排序 + 分页）
  const offset = (pageNum - 1) * limitNum;
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM riders');
  const [rows] = await pool.query(
    `SELECT id, rider_name, rider_name_zh, nationality, photo_url
     FROM riders
     ORDER BY rider_name ASC
     LIMIT ? OFFSET ?`,
    [limitNum, offset]
  );
  res.json({ code: 200, data: { riders: rows, total, page: pageNum, limit: limitNum } });
}));

// GET /api/v1/search/teams - 搜索车队 / 获取全部车队列表
router.get('/teams', asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 20));

  // 有搜索关键词 → 模糊搜索
  if (q && q.trim().length > 0) {
    if (q.length > 50) {
      throw new AppError('搜索关键词过长', ERROR_CODE.BAD_REQUEST);
    }

    const [rows] = await pool.query(
      `SELECT id, uci_code, team_name, team_name_zh, logo_url
       FROM teams
       WHERE team_name LIKE ? OR team_name_zh LIKE ? OR uci_code LIKE ?
       ORDER BY team_name ASC
       LIMIT ?`,
      [`%${q}%`, `%${q}%`, `%${q}%`, limitNum]
    );
    return res.json({ code: 200, data: { teams: rows, total: rows.length } });
  }

  // 无搜索关键词 → 返回全部车队（按名称排序 + 分页）
  const offset = (pageNum - 1) * limitNum;
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM teams');
  const [rows] = await pool.query(
    `SELECT id, uci_code, team_name, team_name_zh, logo_url
     FROM teams
     ORDER BY team_name ASC
     LIMIT ? OFFSET ?`,
    [limitNum, offset]
  );
  res.json({ code: 200, data: { teams: rows, total, page: pageNum, limit: limitNum } });
}));

module.exports = router;
