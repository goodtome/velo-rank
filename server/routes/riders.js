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

// GET /api/v1/riders - 车手列表
router.get('/', async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;

    // 验证分页参数
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 20));
    const offsetNum = Math.max(0, Math.min(MAX_OFFSET, parseInt(offset) || 0));

    if (isNaN(parseInt(limit)) || isNaN(parseInt(offset))) {
      return sendError(res, 400, '无效的分页参数');
    }

    let sql = 'SELECT id, rider_name, rider_name_zh, nationality, photo_url FROM riders';
    const params = [];

    if (q && typeof q === 'string' && q.trim().length > 0) {
      if (q.length > 50) {
        return sendError(res, 400, '搜索关键词过长');
      }
      sql += ' WHERE rider_name LIKE ? OR rider_name_zh LIKE ?';
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY rider_name LIMIT ? OFFSET ?';
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
    console.error('获取车手列表失败:', err);
    sendError(res, 500, '获取车手列表失败', err.message);
  }
});

// GET /api/v1/riders/:id - 车手详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 验证ID
    const riderId = parseInt(id);
    if (isNaN(riderId) || riderId <= 0) {
      return sendError(res, 400, '无效的车手ID');
    }

    const [rows] = await pool.query('SELECT * FROM riders WHERE id = ?', [riderId]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '车手不存在' });
    }

    const rider = rows[0];

    // 查询车手最近所属车队
    const [teamRows] = await pool.query(`
      SELECT t.id AS team_id, t.team_name, t.team_name_zh, t.team_name_en, t.uci_code
      FROM stage_results sr
      JOIN teams t ON sr.team_id = t.id
      WHERE sr.rider_id = ?
      ORDER BY sr.created_at DESC
      LIMIT 1
    `, [riderId]);

    if (teamRows.length > 0) {
      rider.team_id = teamRows[0].team_id;
      rider.team_name = teamRows[0].team_name;
      rider.team_name_zh = teamRows[0].team_name_zh;
      rider.team_name_en = teamRows[0].team_name_en;
      rider.uci_code = teamRows[0].uci_code;
    }

    res.json({ code: 200, data: rider });
  } catch (err) {
    console.error('获取车手详情失败:', err);
    sendError(res, 500, '获取车手详情失败', err.message);
  }
});

module.exports = router;
