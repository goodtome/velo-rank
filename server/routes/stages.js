const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { VALIDATION, ERROR_CODE } = require('../constants');

// GET /api/v1/stages/:id - 获取赛段详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stageId = parseInt(id);
    
    if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛段ID');
    }
    
    const [rows] = await pool.query('SELECT * FROM stages WHERE id = ?', [stageId]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '赛段不存在' });
    }
    res.json({ code: 200, data: rows[0] });
  } catch (err) {
    console.error('获取赛段详情失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取赛段详情失败', err.message);
  }
});

// GET /api/v1/stages/:id/results - 获取赛段成绩
router.get('/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const stageId = parseInt(id);
    if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
      return sendError(res, ERROR_CODE.BAD_REQUEST, '无效的赛段ID');
    }
    
    // 验证并限制查询结果数量
    const limitNum = Math.min(VALIDATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 20));
    if (isNaN(parseInt(limit))) {
      return sendError(res, 400, '无效的limit参数');
    }
    
    // 使用参数化查询避免语法问题
    const sql = `
      SELECT sr.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
             t.team_name, t.team_name_zh, t.uci_code
      FROM stage_results sr
      JOIN riders r ON sr.rider_id = r.id
      JOIN teams t ON sr.team_id = t.id
      WHERE sr.stage_id = ?
      ORDER BY sr.\`rank\`
      LIMIT ?
    `;
    
    const [rows] = await pool.query(sql, [stageId, limitNum]);
    
    res.json({
      code: 200,
      data: rows,
      pagination: {
        limit: limitNum
      }
    });
  } catch (err) {
    console.error('获取赛段成绩失败:', err);
    sendError(res, ERROR_CODE.INTERNAL_ERROR, '获取赛段成绩失败', err.message);
  }
});

// 统一错误响应
function sendError(res, statusCode, message, details = null) {
  const response = { code: statusCode, message };
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  res.status(statusCode).json(response);
}

module.exports = router;