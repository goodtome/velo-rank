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

// POST /api/v1/stages - 创建赛段
router.post('/', asyncHandler(async (req, res) => {
  const {
    race_id,
    stage_number,
    stage_name,
    stage_code,
    date,
    distance_km,
    stage_type
  } = req.body;

  // 数据校验
  if (!race_id || !stage_number || !stage_name) {
    throw new AppError('缺少必填字段（race_id, stage_number, stage_name）', ERROR_CODE.BAD_REQUEST);
  }

  if (!Number.isInteger(stage_number) || stage_number < 1) {
    throw new AppError('stage_number必须是大于0的整数', ERROR_CODE.BAD_REQUEST);
  }

  if (distance_km && (!Number.isInteger(distance_km) || distance_km < 0)) {
    throw new AppError('distance_km必须是大于0的整数', ERROR_CODE.BAD_REQUEST);
  }

  if (stage_type && !['Flat', 'Hills', 'Mountain', 'TTT', 'ITT'].includes(stage_type)) {
    throw new AppError('无效的stage_type', ERROR_CODE.BAD_REQUEST);
  }

  // 检查赛事是否存在
  const [race] = await pool.query('SELECT id FROM races WHERE id = ?', [race_id]);
  if (race.length === 0) {
    throw new AppError('赛事不存在', ERROR_CODE.NOT_FOUND);
  }

  // 检查赛段编号是否重复
  const [existing] = await pool.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?',
    [race_id, stage_number]
  );
  if (existing.length > 0) {
    throw new AppError('该赛事下已存在相同编号的赛段', ERROR_CODE.BAD_REQUEST);
  }

  const id = require('crypto').randomUUID();
  // 修正：8个字段对应8个?占位符（包含stage_code）
  const sql = `INSERT INTO stages (id, race_id, stage_number, stage_name, stage_code, date, distance_km, stage_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await pool.query(sql, [
    id, race_id, stage_number, stage_name, stage_code || null, date || null,
    distance_km || null, stage_type || 'Flat'
  ]);

  res.status(201).json({
    code: 201,
    message: '赛段创建成功',
    data: { id }
  });
}));

// PUT /api/v1/stages/:id - 更新赛段
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = parseInt(id);
  
  if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const {
    stage_number,
    stage_name,
    date,
    distance_km,
    stage_type
  } = req.body;

  // 检查赛段是否存在
  const [existing] = await pool.query('SELECT id, race_id FROM stages WHERE id = ?', [stageId]);
  if (existing.length === 0) {
    throw new AppError('赛段不存在', ERROR_CODE.NOT_FOUND);
  }

  // 数据校验
  if (stage_number && (!Number.isInteger(stage_number) || stage_number < 1)) {
    throw new AppError('stage_number必须是大于0的整数', ERROR_CODE.BAD_REQUEST);
  }

  if (distance_km && (!Number.isInteger(distance_km) || distance_km < 0)) {
    throw new AppError('distance_km必须是大于0的整数', ERROR_CODE.BAD_REQUEST);
  }

  if (stage_type && !['Flat', 'Hills', 'Mountain', 'TTT', 'ITT'].includes(stage_type)) {
    throw new AppError('无效的stage_type', ERROR_CODE.BAD_REQUEST);
  }

  // 检查赛段编号是否与其他赛段重复
  if (stage_number) {
    const [duplicate] = await pool.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = ? AND id != ?',
      [existing[0].race_id, stage_number, stageId]
    );
    if (duplicate.length > 0) {
      throw new AppError('该赛事下已存在相同编号的赛段', ERROR_CODE.BAD_REQUEST);
    }
  }

  // 构建动态更新SQL
  const updates = [];
  const params = [];

  if (stage_number) {
    updates.push('stage_number = ?');
    params.push(stage_number);
  }
  if (stage_name) {
    updates.push('stage_name = ?');
    params.push(stage_name);
  }
  if (date !== undefined) {
    updates.push('date = ?');
    params.push(date || null);
  }
  if (distance_km !== undefined) {
    updates.push('distance_km = ?');
    params.push(distance_km || null);
  }
  if (stage_type) {
    updates.push('stage_type = ?');
    params.push(stage_type);
  }

  if (updates.length === 0) {
    throw new AppError('没有提供要更新的字段', ERROR_CODE.BAD_REQUEST);
  }

  params.push(stageId); // WHERE id = ?

  const sql = `UPDATE stages SET ${updates.join(', ')} WHERE id = ?`;
  await pool.query(sql, params);

  res.json({
    code: 200,
    message: '赛段更新成功'
  });
}));

// DELETE /api/v1/stages/:id - 删除赛段
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = parseInt(id);
  
  if (isNaN(stageId) || stageId < VALIDATION.MIN_ID) {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  // 检查赛段是否存在
  const [existing] = await pool.query('SELECT id FROM stages WHERE id = ?', [stageId]);
  if (existing.length === 0) {
    throw new AppError('赛段不存在', ERROR_CODE.NOT_FOUND);
  }

  // 删除关联的赛段成绩和领骑衫数据
  await pool.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
  await pool.query('DELETE FROM jerseys WHERE stage_id = ?', [stageId]);
  
  // 删除赛段
  await pool.query('DELETE FROM stages WHERE id = ?', [stageId]);

  res.json({
    code: 200,
    message: '赛段删除成功'
  });
}));

module.exports = router;
