const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { PAGINATION, VALIDATION, ERROR_CODE } = require('../constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// GET /api/v1/teams - 车队列表
router.get('/', asyncHandler(async (req, res) => {
  const { q, limit, offset } = req.query;

  // 验证分页参数
  const limitNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || PAGINATION.DEFAULT_LIMIT));
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  if (isNaN(limitNum) || isNaN(offsetNum)) {
    throw new AppError('无效的分页参数', ERROR_CODE.BAD_REQUEST);
  }

  let sql = 'SELECT id, uci_code, team_name, team_name_zh, logo_url FROM teams';
  const params = [];

  if (q && typeof q === 'string' && q.trim().length > 0) {
    if (q.length > 50) {
      throw new AppError('搜索关键词过长', ERROR_CODE.BAD_REQUEST);
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
    pagination: { limit: limitNum, offset: offsetNum }
  });
}));

// GET /api/v1/teams/:id - 车队详情
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // UUID是字符串，不要用parseInt()
  if (!id || id.trim() === '') {
    throw new AppError('无效的车队ID', ERROR_CODE.BAD_REQUEST);
  }

  const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('车队不存在', ERROR_CODE.NOT_FOUND);
  }

  const team = rows[0];

  // 查询车队车手列表
  const [riderRows] = await pool.query(`
    SELECT DISTINCT r.id, r.rider_name, r.rider_name_zh, r.nationality, r.photo_url
    FROM stage_results sr
    JOIN riders r ON sr.rider_id = r.id
    WHERE sr.team_id = ?
    ORDER BY r.rider_name
    LIMIT 100
  `, [id]);

  team.riders = riderRows;

  res.json({ code: 200, data: team });
}));

// GET /api/v1/teams/:id/stats - 车队统计数据
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || id.trim() === '') {
    throw new AppError('无效的车队ID', ERROR_CODE.BAD_REQUEST);
  }

  const [team] = await pool.query('SELECT id FROM teams WHERE id = ?', [id]);
  if (team.length === 0) {
    throw new AppError('车队不存在', ERROR_CODE.NOT_FOUND);
  }

  // 统计车手人数
  const [riderCount] = await pool.query(`
    SELECT COUNT(DISTINCT rider_id) as total_riders
    FROM stage_results WHERE team_id = ?
  `, [id]);

  // 统计总参赛次数
  const [totalEntries] = await pool.query(
    'SELECT COUNT(*) as total FROM stage_results WHERE team_id = ?',
    [id]
  );

  // 统计赛段冠军数
  const [stageWins] = await pool.query(
    'SELECT COUNT(*) as wins FROM stage_results WHERE team_id = ? AND rank_pos = 1',
    [id]
  );

  // 统计领奖台数
  const [podStats] = await pool.query(
    'SELECT COUNT(*) as podiums FROM stage_results WHERE team_id = ? AND rank_pos <= 3',
    [id]
  );

  // 统计前10名次数
  const [top10Stats] = await pool.query(
    'SELECT COUNT(*) as top10 FROM stage_results WHERE team_id = ? AND rank_pos <= 10',
    [id]
  );

  // 持有领骑衫次数
  const [jerseyCount] = await pool.query(
    'SELECT COUNT(*) as total FROM jerseys WHERE team_id = ?',
    [id]
  );

  // 参赛赛事列表
  const [races] = await pool.query(`
    SELECT DISTINCT r.id, r.race_name, r.race_name_zh, r.season, r.category
    FROM races r
    JOIN stages s ON s.race_id = r.id
    JOIN stage_results sr ON sr.stage_id = s.id
    WHERE sr.team_id = ?
    ORDER BY r.season DESC
    LIMIT 10
  `, [id]);

  res.json({
    code: 200,
    data: {
      total_riders: riderCount[0].total_riders,
      total_entries: totalEntries[0].total,
      stage_wins: stageWins[0].wins,
      podiums: podStats[0].podiums,
      top10: top10Stats[0].top10,
      jerseys_held: jerseyCount[0].total,
      recent_races: races
    },
    message: 'success'
  });
}));

module.exports = router;
