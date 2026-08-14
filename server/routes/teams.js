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
    'SELECT COUNT(*) as wins FROM stage_results WHERE team_id = ? AND `rank` = 1',
    [id]
  );

  // 统计领奖台数
  const [podStats] = await pool.query(
    'SELECT COUNT(*) as podiums FROM stage_results WHERE team_id = ? AND `rank` <= 3',
    [id]
  );

  // 统计前10名次数
  const [top10Stats] = await pool.query(
    'SELECT COUNT(*) as top10 FROM stage_results WHERE team_id = ? AND `rank` <= 10',
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

  const [teamClassificationStats] = await pool.query(`
    SELECT MIN(tc.\`rank\`) AS best_team_rank,
           SUM(CASE WHEN tc.\`rank\` <= 3 THEN 1 ELSE 0 END) AS team_podiums
    FROM team_classification tc
    JOIN stages s ON tc.stage_id = s.id
    WHERE tc.team_id = ?
  `, [id]);

  const [profileStats] = await pool.query(`
    SELECT COUNT(DISTINCT sr.nationality) AS nationalities,
           COUNT(DISTINCT s.race_id) AS races_count,
           COUNT(DISTINCT r.season) AS seasons_count
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    JOIN races r ON s.race_id = r.id
    WHERE sr.team_id = ?
  `, [id]);

  const [topRiders] = await pool.query(`
    SELECT r.id, r.rider_name, r.rider_name_zh, r.nationality,
           SUM(CASE WHEN sr.\`rank\` = 1 THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN sr.\`rank\` <= 3 THEN 1 ELSE 0 END) AS podiums,
           MIN(sr.\`rank\`) AS best_rank
    FROM stage_results sr
    JOIN riders r ON sr.rider_id = r.id
    WHERE sr.team_id = ?
    GROUP BY r.id, r.rider_name, r.rider_name_zh, r.nationality
    ORDER BY wins DESC, podiums DESC, best_rank ASC, r.rider_name ASC
    LIMIT 5
  `, [id]);

  const [seasonSummaries] = await pool.query(`
    SELECT r.season,
           COUNT(*) AS starts,
           SUM(CASE WHEN sr.\`rank\` = 1 THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN sr.\`rank\` <= 3 THEN 1 ELSE 0 END) AS podiums
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    JOIN races r ON s.race_id = r.id
    WHERE sr.team_id = ?
    GROUP BY r.season
    ORDER BY r.season DESC
    LIMIT 4
  `, [id]);

  const [recentHighlights] = await pool.query(`
    SELECT sr.\`rank\` AS rank, s.id AS stage_id, s.stage_number, s.stage_name,
           s.date, r.id AS race_id, r.race_name, r.race_name_zh,
           rd.id AS rider_id, rd.rider_name, rd.rider_name_zh
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    JOIN races r ON s.race_id = r.id
    JOIN riders rd ON sr.rider_id = rd.id
    WHERE sr.team_id = ? AND sr.\`rank\` <= 3
    ORDER BY s.date DESC, s.stage_number DESC, sr.\`rank\` ASC
    LIMIT 5
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
      recent_races: races,
      profile: {
        best_team_rank: teamClassificationStats[0].best_team_rank,
        team_podiums: teamClassificationStats[0].team_podiums || 0,
        nationalities: profileStats[0].nationalities || 0,
        races_count: profileStats[0].races_count || 0,
        seasons_count: profileStats[0].seasons_count || 0
      },
      top_riders: topRiders,
      season_summaries: seasonSummaries,
      recent_highlights: recentHighlights
    },
    message: 'success'
  });
}));

module.exports = router;
