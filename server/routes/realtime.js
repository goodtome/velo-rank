/**
 * 实时成绩API路由
 * 提供GC排名、赛段成绩、冲刺/爬坡积分、青年排名的实时数据
 * 支持WebSocket推送和HTTP轮询两种模式
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { routeLog } = require('../middleware/requestLogger');
const log = routeLog('realtime');
// 暂时禁用认证，先让服务器启动
// const { authenticate } = require('./auth');

/**
 * GET /api/v1/realtime/gc
 * 获取GC排名（总成绩）
 */
router.get('/gc', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;
    
    if (!raceId || !stageId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }
    
    // 查询GC排名
    const [rows] = await pool.query(`
      SELECT 
        r.id as riderId,
        r.rider_name as riderName,
        t.team_name as teamName,
        gc.rank,
        gc.total_time,
        gc.time_gap as timeGap,
        gc.is_leader as isLeader
      FROM general_classification gc
      JOIN riders r ON gc.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE gc.race_id = ? AND gc.stage_id = ?
      ORDER BY gc.rank ASC
      LIMIT 50
    `, [raceId, stageId]);
    
    // 格式化数据
    const gcRankings = rows.map(row => ({
      riderId: row.riderId,
      rank: row.rank,
      riderName: row.riderName,
      teamName: row.teamName,
      timeGap: row.timeGap || '-',
      isLeader: row.isLeader === 1
    }));
    
    res.json({
      success: true,
      data: {
        raceId: parseInt(raceId),
        stageId: parseInt(stageId),
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
    
    if (!raceId || !stageId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: raceId, stageId'
      });
    }
    
    // 查询赛段成绩
    const [rows] = await pool.query(`
      SELECT 
        sr.rank,
        r.id as riderId,
        r.rider_name as riderName,
        t.name as teamName,
        sr.time
      FROM stage_results sr
      JOIN riders r ON sr.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE sr.race_id = ? AND sr.stage_id = ?
      ORDER BY sr.rank_pos ASC
      LIMIT 50
    `, [raceId, stageId]);
    
    res.json({
      success: true,
      data: {
        raceId: parseInt(raceId),
        stageId: parseInt(stageId),
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
    
    // 查询冲刺积分排名（从jerseys表获取积分数据）
    const [rows] = await pool.query(`
      SELECT 
        r.id as riderId,
        r.rider_name as riderName,
        t.name as teamName,
        SUM(j.points) as points
      FROM jerseys j
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE j.race_id = ? AND j.type = 'PURPLE'
      GROUP BY j.rider_id
      ORDER BY points DESC
      LIMIT 20
    `, [raceId]);
    
    const pointsRankings = rows.map((row, index) => ({
      rank: index + 1,
      riderId: row.riderId,
      riderName: row.riderName,
      teamName: row.teamName,
      points: row.points || 0,
      isLeader: index === 0
    }));
    
    res.json({
      success: true,
      data: {
        raceId: parseInt(raceId),
        stageId: parseInt(stageId),
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
    const { raceId } = req.query;
    
    // 查询爬坡积分排名（从jerseys表获取蓝衫数据）
    const [rows] = await pool.query(`
      SELECT 
        r.id as riderId,
        r.rider_name as riderName,
        t.name as teamName,
        SUM(j.points) as points
      FROM jerseys j
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE j.race_id = ? AND j.type = 'BLUE_SPRINT'
      GROUP BY j.rider_id
      ORDER BY points DESC
      LIMIT 20
    `, [raceId]);
    
    const mountainsRankings = rows.map((row, index) => ({
      rank: index + 1,
      riderId: row.riderId,
      riderName: row.riderName,
      teamName: row.teamName,
      points: row.points || 0,
      isLeader: index === 0
    }));
    
    res.json({
      success: true,
      data: {
        raceId: parseInt(raceId),
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
    
    // 查询青年排名（25岁以下车手的GC排名）
    const [rows] = await pool.query(`
      SELECT 
        r.id as riderId,
        r.rider_name as riderName,
        t.name as teamName,
        r.age,
        gc.rank,
        gc.time_gap as timeGap
      FROM general_classification gc
      JOIN riders r ON gc.rider_id = r.id
      JOIN teams t ON r.team_id = t.id
      WHERE gc.race_id = ? AND gc.stage_id = ? AND r.age <= 25
      ORDER BY gc.rank ASC
      LIMIT 20
    `, [raceId, stageId]);
    
    const youthRankings = rows.map(row => ({
      rank: row.rank,
      riderId: row.riderId,
      riderName: row.riderName,
      teamName: row.teamName,
      age: row.age,
      timeGap: row.timeGap || '-',
      isLeader: row.rank === 1
    }));
    
    res.json({
      success: true,
      data: {
        raceId: parseInt(raceId),
        stageId: parseInt(stageId),
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
 * 获取赛事实时状态（已用时间、剩余距离、领先者等）
 */
router.get('/race-status', async (req, res) => {
  try {
    const { raceId, stageId } = req.query;
    
    // 模拟数据（实际应该从实时数据源获取）
    const raceStatus = {
      raceId: parseInt(raceId),
      stageId: parseInt(stageId),
      status: 'live', // live, finished, upcoming
      elapsedTime: '3:45:20',
      remainingDistance: 45.2,
      leaderName: 'Giulio CICCONE',
      lastUpdate: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: raceStatus
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
