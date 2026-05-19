const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');

const MAX_LIMIT = 100;
const MAX_OFFSET = 10000;

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

// GET /api/v1/teams - 车队列表
router.get('/', async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;

    // 验证分页参数
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 20));
    const offsetNum = Math.max(0, Math.min(MAX_OFFSET, parseInt(offset) || 0));

    if (isNaN(parseInt(limit)) || isNaN(parseInt(offset))) {
      return sendError(res, 400, '无效的分页参数');
    }

    let sql = 'SELECT id, uci_code, team_name, team_name_zh, logo_url FROM teams';
    const params = [];

    if (q && typeof q === 'string' && q.trim().length > 0) {
      if (q.length > 50) {
        return sendError(res, 400, '搜索关键词过长');
      }
      sql += ' WHERE team_name LIKE ? OR team_name_zh LIKE ? OR uci_code LIKE ?';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY team_name LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const [rows] = await pool.query(sql, params);
    res.json({
      code: 200,
      data: rows,
      pagination: {
        limit: limitNum,
        offset: offsetNum
      }
    });
  } catch (err) {
    console.error('获取车队列表失败:', err);
    sendError(res, 500, '获取车队列表失败', err.message);
  }
});

// GET /api/v1/teams/:id - 车队详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // UUID是字符串，不要用parseInt()
    if (!id || id.trim() === '') {
      return sendError(res, 400, '无效的车队ID');
    }

    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '车队不存在' });
    }

    // 查询车队车手列表
    const [riderRows] = await pool.query(`
      SELECT DISTINCT r.id, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url
      FROM stage_results sr
      JOIN riders r ON sr.rider_id = r.id
      WHERE sr.team_id = ?
      ORDER BY r.rider_name
      LIMIT 100
    `, [id]);

    const team = rows[0];
    team.riders = riderRows;

    res.json({ code: 200, data: team });
  } catch (err) {
    console.error('获取车队详情失败:', err);
    sendError(res, 500, '获取车队详情失败', err.message);
  }
});

module.exports = router;
