/**
 * 实时成绩 API 路由
 * 提供 GC 排名、赛段成绩、冲刺积分、爬坡积分、青年排名的实时数据
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { routeLog } = require('../middleware/requestLogger');

const log = routeLog('realtime');

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function parseRankValue(row, fallbackIndex) {
  return Number.isFinite(Number(row.rank)) ? Number(row.rank) : fallbackIndex + 1;
}

/**
 * GET /api/v1/realtime/gc
 * 获取GC排名（总成绩）
 */
router.get('/gc', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;

    if (isBlank(raceId) || isBlank(stageId)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }

    const [rows] = await pool.query(`
      SELECT
        r.id AS riderId,
        r.rider_name AS riderName,
        t.team_name AS teamName,
        gc.rank,
        gc.total_time,
        gc.time_gap AS timeGap
      FROM general_classification gc
      JOIN stages s ON gc.stage_id = s.id
      JOIN riders r ON gc.rider_id = r.id
      JOIN teams t ON gc.team_id = t.id
      WHERE gc.stage_id = ? AND s.race_id = ?
      ORDER BY gc.\`rank\` ASC
      LIMIT 50
    `, [stageId, raceId]);

    const gcRankings = rows.map((row, index) => ({
      riderId: row.riderId,
      rank: parseRankValue(row, index),
      riderName: row.riderName,
      teamName: row.teamName,
      timeGap: row.timeGap || '-',
      isLeader: Number(row.rank) === 1 || index === 0
    }));

    res.json({
      success: true,
      data: {
        raceId,
        stageId,
        lastUpdate: new Date().toISOString(),
        rankings: gcRankings
      }
    });
  } catch (error) {
    log.error('获取GC排名失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * GET /api/v1/realtime/stage
 * 获取赛段成绩
 */
router.get('/stage', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;

    if (isBlank(raceId) || isBlank(stageId)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }

    const [rows] = await pool.query(`
      SELECT
        sr.\`rank\`,
        r.id AS riderId,
        r.rider_name AS riderName,
        t.team_name AS teamName,
        sr.time_gap AS timeGap
      FROM stage_results sr
      JOIN stages s ON sr.stage_id = s.id
      JOIN riders r ON sr.rider_id = r.id
      JOIN teams t ON sr.team_id = t.id
      WHERE sr.stage_id = ? AND s.race_id = ?
      ORDER BY sr.\`rank\` ASC
      LIMIT 50
    `, [stageId, raceId]);

    res.json({
      success: true,
      data: {
        raceId,
        stageId,
        lastUpdate: new Date().toISOString(),
        results: rows
      }
    });
  } catch (error) {
    log.error('获取赛段成绩失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * GET /api/v1/realtime/points
 * 获取冲刺积分排名
 */
router.get('/points', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;

    if (isBlank(raceId) || isBlank(stageId)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }

    const [rows] = await pool.query(`
      SELECT
        r.id AS riderId,
        r.rider_name AS riderName,
        t.team_name AS teamName,
        pc.points,
        pc.\`rank\`
      FROM points_classification pc
      JOIN stages s ON pc.stage_id = s.id
      JOIN riders r ON pc.rider_id = r.id
      LEFT JOIN general_classification gc ON pc.stage_id = gc.stage_id AND pc.rider_id = gc.rider_id
      LEFT JOIN teams t ON gc.team_id = t.id
      WHERE pc.stage_id = ? AND s.race_id = ?
      ORDER BY pc.points DESC, pc.\`rank\` ASC
      LIMIT 20
    `, [stageId, raceId]);

    const pointsRankings = rows.map((row, index) => ({
      rank: parseRankValue(row, index),
      riderId: row.riderId,
      riderName: row.riderName,
      teamName: row.teamName,
      points: Number(row.points) || 0,
      isLeader: Number(row.rank) === 1 || index === 0
    }));

    res.json({
      success: true,
      data: {
        raceId,
        stageId,
        lastUpdate: new Date().toISOString(),
        rankings: pointsRankings
      }
    });
  } catch (error) {
    log.error('获取冲刺积分排名失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * GET /api/v1/realtime/mountains
 * 获取爬坡积分排名
 */
router.get('/mountains', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;

    if (isBlank(raceId) || isBlank(stageId)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }

    const [rows] = await pool.query(`
      SELECT
        r.id AS riderId,
        r.rider_name AS riderName,
        t.team_name AS teamName,
        mc.points,
        mc.\`rank\`
      FROM mountains_classification mc
      JOIN stages s ON mc.stage_id = s.id
      JOIN riders r ON mc.rider_id = r.id
      LEFT JOIN general_classification gc ON mc.stage_id = gc.stage_id AND mc.rider_id = gc.rider_id
      LEFT JOIN teams t ON gc.team_id = t.id
      WHERE mc.stage_id = ? AND s.race_id = ?
      ORDER BY mc.points DESC, mc.\`rank\` ASC
      LIMIT 20
    `, [stageId, raceId]);

    const mountainsRankings = rows.map((row, index) => ({
      rank: parseRankValue(row, index),
      riderId: row.riderId,
      riderName: row.riderName,
      teamName: row.teamName,
      points: Number(row.points) || 0,
      isLeader: Number(row.rank) === 1 || index === 0
    }));

    res.json({
      success: true,
      data: {
        raceId,
        stageId,
        lastUpdate: new Date().toISOString(),
        rankings: mountainsRankings
      }
    });
  } catch (error) {
    log.error('获取爬坡积分排名失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * GET /api/v1/realtime/youth
 * 获取青年排名
 */
router.get('/youth', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;

    if (isBlank(raceId) || isBlank(stageId)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }

    const [rows] = await pool.query(`
      SELECT
        r.id AS riderId,
        r.rider_name AS riderName,
        t.team_name AS teamName,
        TIMESTAMPDIFF(YEAR, r.birth_date, CURDATE()) AS age,
        yc.\`rank\`,
        yc.time_gap AS timeGap
      FROM youth_classification yc
      JOIN stages s ON yc.stage_id = s.id
      JOIN riders r ON yc.rider_id = r.id
      LEFT JOIN general_classification gc ON yc.stage_id = gc.stage_id AND yc.rider_id = gc.rider_id
      LEFT JOIN teams t ON gc.team_id = t.id
      WHERE yc.stage_id = ? AND s.race_id = ?
      ORDER BY yc.\`rank\` ASC
      LIMIT 20
    `, [stageId, raceId]);

    const youthRankings = rows.map((row, index) => ({
      rank: parseRankValue(row, index),
      riderId: row.riderId,
      riderName: row.riderName,
      teamName: row.teamName,
      age: row.age,
      timeGap: row.timeGap || '-',
      isLeader: Number(row.rank) === 1 || index === 0
    }));

    res.json({
      success: true,
      data: {
        raceId,
        stageId,
        lastUpdate: new Date().toISOString(),
        rankings: youthRankings
      }
    });
  } catch (error) {
    log.error('获取青年排名失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * GET /api/v1/realtime/race-status
 * 获取赛事实时状态
 */
router.get('/race-status', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;

    if (isBlank(raceId) || isBlank(stageId)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }

    res.json({
      success: true,
      data: {
        raceId,
        stageId,
        status: 'live',
        elapsedTime: '3:45:20',
        remainingDistance: 45.2,
        leaderName: 'Giulio CICCONE',
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    log.error('获取赛事状态失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

module.exports = router;
