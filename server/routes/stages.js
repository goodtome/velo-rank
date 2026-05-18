const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// GET /api/v1/stages/:id - 获取赛段详情
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = parseInt(id);
  
  if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  const [rows] = await pool.query('SELECT * FROM stages WHERE id = ?', [stageId]);
  if (rows.length === 0) {
    throw new AppError('赛段不存在', ERROR_CODE.NOT_FOUND);
  }
  res.json({ code: 200, data: rows[0] });
}));

// GET /api/v1/stages/:id/results - 获取赛段成绩
router.get('/:id/results', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 20 } = req.query;
  
  const stageId = parseInt(id);
  if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  // 验证并限制查询结果数量
  const limitNum = Math.min(VALIDATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 20));
  if (isNaN(parseInt(limit))) {
    throw new AppError('无效的limit参数', ERROR_CODE.BAD_REQUEST);
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
}));

// GET /api/v1/stages/:id/jerseys - 获取领骑衫持有者
router.get('/:id/jerseys', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = parseInt(id);
  
  if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  // 查询领骑衫持有者，联表查询车手和车队信息
  const sql = `
    SELECT j.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM jerseys j
    JOIN riders r ON j.rider_id = r.id
    JOIN teams t ON j.team_id = t.id
    WHERE j.stage_id = ?
  `;
  
  const [rows] = await pool.query(sql, [stageId]);
  
  // 转换为对象格式（按jersey_type分组）
  const jerseys = {};
  rows.forEach(row => {
    jerseys[row.jersey_type] = {
      rider_name: row.rider_name,
      rider_name_zh: row.rider_name_zh,
      team_name: row.team_name,
      team_name_zh: row.team_name_zh,
      time_gap: row.time_gap,
      points: row.points
    };
  });
  
  res.json({
    code: 200,
    data: jerseys
  });
}));

module.exports = router;
