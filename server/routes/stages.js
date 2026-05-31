const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

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

// GET /api/v1/stages/:id/results - 获取赛段成绩
router.get('/:id/results', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 20 } = req.query;
  
  const stageId = id; // UUID是字符串
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
    
  // 验证并限制查询结果数量
  const parsedLimit = parseInt(limit);
  if (isNaN(parsedLimit)) {
    throw new AppError('无效的limit参数', ERROR_CODE.BAD_REQUEST);
  }
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parsedLimit));
    
  // 使用参数化查询避免语法问题
  const sql = `
    SELECT sr.*, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM stage_results sr
    JOIN riders r ON sr.rider_id = r.id
    JOIN teams t ON sr.team_id = t.id
    WHERE sr.stage_id = ?
    ORDER BY sr.rank_pos
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
  const stageId = id; // UUID是字符串
    
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
    
  // 查询领骑衫持有者，联表查询车手和车队信息
  const sql = `
    SELECT j.jersey_type, j.rider_id, j.team_id,
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM jerseys j
    JOIN riders r ON j.rider_id = r.id
    JOIN teams t ON j.team_id = t.id
    WHERE j.stage_id = ?
  `;
    
  const [rows] = await pool.query(sql, [stageId]);
    
  // 为每个领骑衫获取积分或时间差
  const jerseysList = await Promise.all(rows.map(async (row) => {
    let time_gap = null;
    let points = null;
    
    // 根据领骑衫类型，从对应classification表获取积分或时间差
    if (row.jersey_type === 'pink') {
      // 粉衫：从general_classification获取time_gap
      const [gc] = await pool.query(
        'SELECT time_gap FROM general_classification WHERE stage_id = ? AND rider_id = ? ORDER BY `rank` LIMIT 1',
        [stageId, row.rider_id]
      );
      if (gc.length > 0) time_gap = gc[0].time_gap;
    } else if (row.jersey_type === 'purple') {
      // 紫衫：从points_classification获取points
      const [pc] = await pool.query(
        'SELECT points FROM points_classification WHERE stage_id = ? AND rider_id = ? ORDER BY points DESC LIMIT 1',
        [stageId, row.rider_id]
      );
      if (pc.length > 0) points = pc[0].points;
    } else if (row.jersey_type === 'blue') {
      // 蓝衫：从points_classification获取points（冲刺积分）
      const [pc] = await pool.query(
        'SELECT points FROM points_classification WHERE stage_id = ? AND rider_id = ? ORDER BY points DESC LIMIT 1',
        [stageId, row.rider_id]
      );
      if (pc.length > 0) points = pc[0].points;
    } else if (row.jersey_type === 'white') {
      // 白衫：从youth_classification获取time_gap
      const [yc] = await pool.query(
        'SELECT time_gap FROM youth_classification WHERE stage_id = ? AND rider_id = ? ORDER BY `rank` LIMIT 1',
        [stageId, row.rider_id]
      );
      if (yc.length > 0) time_gap = yc[0].time_gap;
    }
    
    return {
      jersey_type: row.jersey_type,
      rider_name: row.rider_name,
      rider_name_zh: row.rider_name_zh,
      team_name: row.team_name,
      team_name_zh: row.team_name_zh,
      uci_code: row.uci_code,
      time_gap,
      points
    };
  }));
    
  res.json({
    code: 200,
    data: jerseysList
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
  
  const sql = 'INSERT INTO stages (id, race_id, stage_number, stage_name, stage_code, date, distance_km, stage_type, start_city, finish_city, start_city_zh, finish_city_zh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  await pool.query(sql, [
    id,
    race_id,
    stage_number,
    stage_name,
    stage_code || null,
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
router.put('/:id', asyncHandler(async (req, res) => {
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
    console.error('更新赛段失败:', err);
    throw new AppError('更新赛段失败: ' + err.message, ERROR_CODE.INTERNAL_ERROR);
  }
}));

// DELETE /api/v1/stages/:id - 删除赛段
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id; // UUID是字符串
    
  if (!id || id.trim() === '') {
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

// GET /api/v1/stages/:id/general-classification - 获取GC总成绩排名
router.get('/:id/general-classification', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id; // UUID是字符串
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  // 查询GC总成绩排名，关联车手和车队信息
  const sql = `
    SELECT gc.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM general_classification gc
    JOIN riders r ON gc.rider_id = r.id
    LEFT JOIN stage_results sr ON gc.stage_id = sr.stage_id AND gc.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE gc.stage_id = ?
    ORDER BY gc.\`rank\`
  `;
  
  const [rows] = await pool.query(sql, [stageId]);
  
  res.json({
    code: 200,
    data: rows,
    message: 'success'
  });
}));

// GET /api/v1/stages/:id/points - 获取冲刺积分排名
router.get('/:id/points', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  const sql = `
    SELECT p.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM points_classification p
    JOIN riders r ON p.rider_id = r.id
    LEFT JOIN stage_results sr ON p.stage_id = sr.stage_id AND p.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE p.stage_id = ?
    ORDER BY p.points DESC
  `;
  
  const [rows] = await pool.query(sql, [stageId]);
  
  res.json({
    code: 200,
    data: rows,
    message: 'success'
  });
}));

// GET /api/v1/stages/:id/mountains - 获取爬坡积分排名
router.get('/:id/mountains', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  const sql = `
    SELECT m.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM mountains_classification m
    JOIN riders r ON m.rider_id = r.id
    LEFT JOIN stage_results sr ON m.stage_id = sr.stage_id AND m.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE m.stage_id = ?
    ORDER BY m.points DESC
  `;
  
  const [rows] = await pool.query(sql, [stageId]);
  
  res.json({
    code: 200,
    data: rows,
    message: 'success'
  });
}));

// GET /api/v1/stages/:id/youth - 获取青年排名
router.get('/:id/youth', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stageId = id;
  
  if (!id || id.trim() === '') {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }
  
  const sql = `
    SELECT y.*, 
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM youth_classification y
    JOIN riders r ON y.rider_id = r.id
    LEFT JOIN stage_results sr ON y.stage_id = sr.stage_id AND y.rider_id = sr.rider_id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE y.stage_id = ?
    ORDER BY y.\`rank\`
  `;
  
  const [rows] = await pool.query(sql, [stageId]);
  
  res.json({
    code: 200,
    data: rows,
    message: 'success'
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
