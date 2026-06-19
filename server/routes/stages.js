const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');
const { routeLog } = require('../middleware/requestLogger');
const { getJerseysForStage } = require('../services/jerseyService');
const log = routeLog('stages');

const STAGE_CHILD_TABLES = [
  'stage_results',
  'jerseys',
  'general_classification',
  'points_classification',
  'mountains_classification',
  'youth_classification',
  'team_classification'
];

async function deleteStageData(conn, stageId) {
  for (const table of STAGE_CHILD_TABLES) {
    await conn.query(`DELETE FROM ${table} WHERE stage_id = ?`, [stageId]);
  }
}

// GET /api/v1/stages - 获取赛段列表
router.get('/', asyncHandler(async (req, res) => {
  const { race_id, stage_type, page = 1, limit = 20 } = req.query;

  // 验证分页参数
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(PAGINATION.MIN_LIMIT, parseInt(limit) || PAGINATION.DEFAULT_LIMIT));
  const offset = (pageNum - 1) * limitNum;

  if (isNaN(pageNum) || pageNum > PAGINATION.MAX_PAGE) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  // 构建WHERE条件
  const where = [];
  const params = [];

  if (race_id) {
    where.push('s.race_id = ?');
    params.push(race_id);
  }

  if (stage_type && ['Flat', 'Hills', 'Mountain', 'TTT', 'ITT'].includes(stage_type)) {
    where.push('s.stage_type = ?');
    params.push(stage_type);
  }

  const whereSQL = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // 查询总数
  const countSql = `
    SELECT COUNT(*) as total
    FROM stages s
    ${whereSQL}
  `;
  const [countResult] = await pool.query(countSql, params);
  const total = countResult[0].total;

  // 查询列表（联表获取赛事名称）
  const listParams = [...params, limitNum, offset];
  const listSql = `
    SELECT s.*, r.race_name, r.race_name_zh
    FROM stages s
    LEFT JOIN races r ON s.race_id = r.id
    ${whereSQL}
    ORDER BY s.race_id, s.stage_number
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(listSql, listParams);

  res.json({
    code: 200,
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
}));

// GET /api/v1/stages/:id - 获取赛段详情
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id; // UUID是字符串，不要用parseInt()
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  const [rows] = await pool.query('SELECT * FROM stages WHERE id = ?', [stageId]);
  if (rows.length === 0) {
    throw new AppError('赛段不存在', ERROR_CODE.NOT_FOUND);
  }
  res.json({ code: 200, data: rows[0] });
}));

// GET /api/v1/stages/:id/results - 获取赛段成绩（支持分页）
router.get('/:id/results', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  
  const stageId = id;
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // 查总数
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM stage_results WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;
    
  const sql = `
    SELECT sr.*,
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM stage_results sr
    JOIN riders r ON sr.rider_id = r.id
    JOIN teams t ON sr.team_id = t.id
    WHERE sr.stage_id = ?
    ORDER BY sr.\`rank\`
    LIMIT ? OFFSET ?
  `;
    
  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);
    
  res.json({
    code: 200,
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
}));

// GET /api/v1/stages/:id/jerseys - 获取领骑衫持有者
router.get('/:id/jerseys', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id; // UUID是字符串
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
    
  const jerseysList = await getJerseysForStage(pool, stageId);
    
  res.json({
    code: 200,
    data: jerseysList
  });
}));

// POST /api/v1/stages - 创建赛段
router.post('/', adminMiddleware, asyncHandler(async (req, res) => {
  const {
    race_id,
    stage_number,
    stage_name,
    stage_code,
    date,
    distance_km,
    stage_type,
    start_city,
    finish_city,
    start_city_zh,
    finish_city_zh
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
  const [race] = await pool.query('SELECT id, race_code FROM races WHERE id = ?', [race_id]);
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
  const resolvedStageCode = typeof stage_code === 'string' && stage_code.trim()
    ? stage_code.trim()
    : `${race[0].race_code}-s${stage_number}`;
  
  const sql = 'INSERT INTO stages (id, race_id, stage_number, stage_name, stage_code, date, distance_km, stage_type, start_city, finish_city, start_city_zh, finish_city_zh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  await pool.query(sql, [
    id,
    race_id,
    stage_number,
    stage_name,
    resolvedStageCode,
    date || null,
    distance_km || null,
    stage_type || 'Flat',
    start_city || null,
    finish_city || null,
    start_city_zh || null,
    finish_city_zh || null
  ]);

  res.status(201).json({
    code: 201,
    message: '赛段创建成功',
    data: { id }
  });
}));

// PUT /api/v1/stages/:id - 更新赛段
router.put('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id; // UUID是字符串
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const {
    stage_number,
    stage_name,
    stage_code,
    date,
    distance_km,
    stage_type,
    start_city,
    finish_city,
    start_city_zh,
    finish_city_zh
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

  if (stage_number !== undefined) {
    updates.push('stage_number = ?');
    params.push(stage_number);
  }
  if (stage_name !== undefined) {
    updates.push('stage_name = ?');
    params.push(stage_name);
  }
  if (stage_code !== undefined) {
    updates.push('stage_code = ?');
    params.push(stage_code);
  }
  if (date !== undefined) {
    updates.push('date = ?');
    params.push(date || null);
  }
  if (distance_km !== undefined) {
    updates.push('distance_km = ?');
    params.push(distance_km || null);
  }
  if (stage_type !== undefined) {
    updates.push('stage_type = ?');
    params.push(stage_type);
  }
  if (start_city !== undefined) {
    updates.push('start_city = ?');
    params.push(start_city || null);
  }
  if (finish_city !== undefined) {
    updates.push('finish_city = ?');
    params.push(finish_city || null);
  }
  if (start_city_zh !== undefined) {
    updates.push('start_city_zh = ?');
    params.push(start_city_zh || null);
  }
  if (finish_city_zh !== undefined) {
    updates.push('finish_city_zh = ?');
    params.push(finish_city_zh || null);
  }

  if (updates.length === 0) {
    throw new AppError('没有提供要更新的字段', ERROR_CODE.BAD_REQUEST);
  }

  params.push(stageId); // WHERE id = ?

  const sql = `UPDATE stages SET ${updates.join(', ')} WHERE id = ?`;
    
  try {
    await pool.query(sql, params);
      
    res.json({
      code: 200,
      message: '赛段更新成功'
    });
  } catch (err) {
    log.error('更新赛段失败', { error: err.message });
    throw new AppError('更新赛段失败: ' + err.message, ERROR_CODE.INTERNAL_ERROR);
  }
}));

// DELETE /api/v1/stages/:id - 删除赛段
router.delete('/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id; // UUID是字符串
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM stages WHERE id = ? FOR UPDATE', [stageId]);
    if (existing.length === 0) {
      throw new AppError('赛段不存在', ERROR_CODE.NOT_FOUND);
    }

    await deleteStageData(conn, stageId);
    await conn.query('DELETE FROM stages WHERE id = ?', [stageId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({
    code: 200,
    message: '赛段删除成功'
  });
}));

// GET /api/v1/stages/:id/general-classification - 获取GC总成绩排名（支持分页）
router.get('/:id/general-classification', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const stageId = id; // UUID是字符串
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // 查总数
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM general_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;
  
  // 查询GC总成绩排名，关联车手和车队信息
  const sql = `
    SELECT gc.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM general_classification gc
    JOIN riders r ON gc.rider_id = r.id
    LEFT JOIN teams t ON gc.team_id = t.id
    WHERE gc.stage_id = ?
    ORDER BY gc.\`rank\`
    LIMIT ? OFFSET ?
  `;
  
  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);
  
  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    message: 'success'
  });
}));

// GET /api/v1/stages/:id/points - 获取冲刺积分排名（支持分页）
router.get('/:id/points', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;
  
  // 查总数
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM points_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT sub.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM (
      SELECT id, stage_id, rider_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS \`rank\`
      FROM points_classification
      WHERE stage_id = ?
    ) sub
    JOIN riders r ON sub.rider_id = r.id
    LEFT JOIN general_classification gc ON sub.stage_id = gc.stage_id AND sub.rider_id = gc.rider_id
    LEFT JOIN teams t ON gc.team_id = t.id
    ORDER BY sub.\`rank\`, sub.points DESC, sub.rider_id
    LIMIT ? OFFSET ?
  `;
  
  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/stages/:id/mountains - 获取爬坡积分排名（支持分页）
router.get('/:id/mountains', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // 查总数
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM mountains_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT sub.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM (
      SELECT id, stage_id, rider_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS \`rank\`
      FROM mountains_classification
      WHERE stage_id = ?
    ) sub
    JOIN riders r ON sub.rider_id = r.id
    LEFT JOIN general_classification gc ON sub.stage_id = gc.stage_id AND sub.rider_id = gc.rider_id
    LEFT JOIN teams t ON gc.team_id = t.id
    ORDER BY sub.\`rank\`, sub.points DESC, sub.rider_id
    LIMIT ? OFFSET ?
  `;
  
  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);

  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/stages/:id/youth - 获取青年排名（支持分页）
router.get('/:id/youth', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  // 查总数
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM youth_classification WHERE stage_id = ?',
    [stageId]
  );
  const total = countResult[0].total;

  const sql = `
    SELECT y.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM youth_classification y
    JOIN riders r ON y.rider_id = r.id
    LEFT JOIN general_classification gc ON y.stage_id = gc.stage_id AND y.rider_id = gc.rider_id
    LEFT JOIN teams t ON gc.team_id = t.id
    WHERE y.stage_id = ?
    ORDER BY y.\`rank\`
    LIMIT ? OFFSET ?
  `;
  
  const [rows] = await pool.query(sql, [stageId, limitNum, offset]);
  
  res.json({
    code: 200,
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
}));

// GET /api/v1/stages/:id/team-classification - 获取车队成绩排名
router.get('/:id/team-classification', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  const sql = `
    SELECT tc.*, 
           t.team_name, t.team_name_zh, t.uci_code, t.logo_url
    FROM team_classification tc
    JOIN teams t ON tc.team_id = t.id
    WHERE tc.stage_id = ?
    ORDER BY tc.\`rank\`
  `;
  
  const [rows] = await pool.query(sql, [stageId]);
  
  res.json({
    code: 200,
    data: rows,
    message: 'success'
  });
}));

module.exports = router;
