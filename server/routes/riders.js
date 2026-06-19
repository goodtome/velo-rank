const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// GET /api/v1/riders - 车手列表
router.get('/', asyncHandler(async (req, res) => {
  const { q, limit, offset } = req.query;

  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || PAGINATION.DEFAULT_LIMIT));
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  if (isNaN(limitNum) || isNaN(offsetNum)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  let sql = 'SELECT id, rider_name, rider_name_zh, nationality, photo_url FROM riders';
  const params = [];

  if (q && typeof q === 'string' && q.trim().length > 0) {
    if (q.length > 50) {
      throw new AppError('搜索关键词过长', ERROR_CODE.BAD_REQUEST);
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
    pagination: { limit: limitNum, offset: offsetNum }
  });
}));

// GET /api/v1/riders/:id - 车手详情
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id.trim() === '') {
    throw new AppError('无效的车手ID', ERROR_CODE.BAD_REQUEST);
  }

  const [rows] = await pool.query('SELECT * FROM riders WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('车手不存在', ERROR_CODE.NOT_FOUND);
  }

  const rider = rows[0];

  const [teamRows] = await pool.query(`
    SELECT t.id AS team_id, t.team_name, t.team_name_zh, t.team_name_en, t.uci_code
    FROM stage_results sr
    JOIN teams t ON sr.team_id = t.id
    WHERE sr.rider_id = ?
    ORDER BY sr.created_at DESC
    LIMIT 1
  `, [id]);

  if (teamRows.length > 0) {
    rider.team_id = teamRows[0].team_id;
    rider.team_name = teamRows[0].team_name;
    rider.team_name_zh = teamRows[0].team_name_zh;
    rider.team_name_en = teamRows[0].team_name_en;
    rider.uci_code = teamRows[0].uci_code;
  }

  res.json({ code: 200, data: rider });
}));

// GET /api/v1/riders/:id/stats - 车手统计数据
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id.trim() === '') {
    throw new AppError('无效的车手ID', ERROR_CODE.BAD_REQUEST);
  }

  const [rider] = await pool.query('SELECT id FROM riders WHERE id = ?', [id]);
  if (rider.length === 0) {
    throw new AppError('车手不存在', ERROR_CODE.NOT_FOUND);
  }

  const [totalRaces] = await pool.query(
    'SELECT COUNT(*) as total FROM stage_results WHERE rider_id = ?',
    [id]
  );

  const [podStats] = await pool.query(`
    SELECT COUNT(*) as podiums FROM stage_results 
    WHERE rider_id = ? AND \`rank\` <= 3
  `, [id]);

  const [winStats] = await pool.query(`
    SELECT COUNT(*) as wins FROM stage_results 
    WHERE rider_id = ? AND \`rank\` = 1
  `, [id]);

  const [top10Stats] = await pool.query(`
    SELECT COUNT(*) as top10 FROM stage_results 
    WHERE rider_id = ? AND \`rank\` <= 10
  `, [id]);

  const [stageTypeStats] = await pool.query(`
    SELECT s.stage_type, COUNT(*) as count
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    WHERE sr.rider_id = ?
    GROUP BY s.stage_type
    ORDER BY count DESC
  `, [id]);

  const [latestResult] = await pool.query(`
    SELECT sr.\`rank\`, s.stage_name, s.date, r.race_name, r.race_name_zh
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    JOIN races r ON s.race_id = r.id
    WHERE sr.rider_id = ?
    ORDER BY s.date DESC
    LIMIT 1
  `, [id]);

  const [jerseys] = await pool.query(`
    SELECT j.jersey_type, s.stage_number, s.stage_name
    FROM jerseys j
    JOIN stages s ON j.stage_id = s.id
    WHERE j.rider_id = ?
    ORDER BY s.stage_number DESC
    LIMIT 5
  `, [id]);

  res.json({
    code: 200,
    data: {
      total_races: totalRaces[0].total,
      podiums: podStats[0].podiums,
      wins: winStats[0].wins,
      top10: top10Stats[0].top10,
      stage_types: stageTypeStats,
      latest_result: latestResult.length > 0 ? latestResult[0] : null,
      jerseys: jerseys
    },
    message: 'success'
  });
}));

// GET /api/v1/riders/:id/results - 车手历史成绩
router.get('/:id/results', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit, offset } = req.query;

  if (!id || id.trim() === '') {
    throw new AppError('无效的车手ID', ERROR_CODE.BAD_REQUEST);
  }

  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || 50));
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  if (isNaN(limitNum) || isNaN(offsetNum)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  const [rows] = await pool.query(`
    SELECT sr.\`rank\` AS stage_rank, sr.time_gap,
           s.stage_number, s.stage_name, s.date, s.stage_type,
           r.race_name, r.race_name_zh, r.race_code,
           t.team_name, t.team_name_zh, t.uci_code
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    JOIN races r ON s.race_id = r.id
    LEFT JOIN teams t ON sr.team_id = t.id
    WHERE sr.rider_id = ?
    ORDER BY r.season DESC, s.stage_number
    LIMIT ? OFFSET ?
  `, [id, limitNum, offsetNum]);

  const [countRows] = await pool.query(
    'SELECT COUNT(*) as total FROM stage_results WHERE rider_id = ?',
    [id]
  );

  res.json({
    code: 200,
    data: rows,
    pagination: {
      total: countRows[0].total,
      limit: limitNum,
      offset: offsetNum
    },
    message: 'success'
  });
}));

module.exports = router;
