const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { v4: uuidv4 } = require('uuid');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { adminMiddleware, checkRequiredFields, validateInput } = require('../middleware/auth');
const { routeLog } = require('../middleware/requestLogger');
const log = routeLog('sync');
const Joi = require('joi');

// 状态查询schema验证
const statusQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(5),
  offset: Joi.number().integer().min(0).default(0)
});

// 同步请求schema验证
const syncRequestSchema = Joi.object({
  race_code: Joi.string().allow('', null),
  force_refresh: Joi.boolean().default(false)
});

// GET /api/v1/sync/status - 查看同步状态
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const valid = statusQuerySchema.validate(req.query);
    if (valid.error) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        details: valid.error.details.map(d => d.message)
      });
    }
    const { limit, offset } = valid.value;
    const [races] = await pool.query(
      'SELECT race_name, race_code, updated_at FROM races ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit) || 5, parseInt(offset) || 0]
    );
    res.json({
      code: 200,
      data: {
        recent_sync: races,
        message: '数据同步服务运行正常',
        total: races.length,
        params: { limit, offset }
      }
    });
  } catch (err) {
    log.error('获取同步状态失败', { error: err.message });
    res.status(500).json({ code: 500, message: '获取同步状态失败' });
  }
}));

// POST /api/v1/sync/races/:id - 手动触发赛事数据同步（需认证）
router.post('/races/:id', adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // 验证race_id格式（必须是UUID）
    const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required();
    const uuidValidation = uuidSchema.validate(id);

    if (uuidValidation.error) {
      throw new AppError('无效的赛事ID格式', 400);
    }

    // 创建同步记录
    const syncId = uuidv4();
    const syncEntry = {
      id: syncId,
      race_id: id,
      requested_by: req.openid || 'unknown',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await pool.query(
      `INSERT INTO sync_logs (id, race_id, requested_by, status, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [syncEntry.id, id, syncEntry.requested_by, syncEntry.status, syncEntry.created_at]
    );

    // 检查race_id在数据库中是否存在
    const [races] = await pool.query('SELECT race_name FROM races WHERE id = ?', [id]);
    if (races.length === 0) {
      throw new AppError('赛事不存在', 404);
    }

    // TODO: 触发PCS爬虫脚本
    // 可以使用子进程启动爬虫
    /*
    const { spawn } = require('child_process');
    const syncScript = 'node server/scripts/sync-pcs.js';
    const syncProcess = spawn('node', [syncScript, id], {
      env: {
        ...process.env,
        RACE_ID: id,
        SYNC_LOG_ID: syncId
      },
      detached: true
    });
    syncProcess.unref();
    */

    log.info('同步任务已提交', { raceId: id, syncId });

    res.json({
      code: 200,
      message: '同步任务已提交,请查看同步状态',
      data: {
        race_id: id,
        race_name: races[0].race_name,
        sync_id: syncId,
        status: 'pending',
        requested_by: syncEntry.requested_by
      }
    });
  } catch (err) {
    log.error('提交同步任务失败', { error: err.message });
    if (err instanceof AppError) {
      throw err;
    }
    res.status(500).json({ code: 500, message: '触发同步失败' });
  }
}));

// GET /api/v1/sync/logs - 查询同步日志（需认证）
router.get('/logs', adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // 验证分页参数
    const paginationSchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    });

    const valid = paginationSchema.validate(req.query);
    if (valid.error) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        details: valid.error.details.map(d => d.message)
      });
    }

    const { page: pageNum, limit: limitNum } = valid.value;
    const offset = (pageNum - 1) * limitNum;

    // 查询同步日志
    const [logs] = await pool.query(`
      SELECT l.*,
             r.race_name,
             u.username AS requester_name
      FROM sync_logs l
      LEFT JOIN races r ON l.race_id = r.id
      LEFT JOIN users u ON l.requested_by = u.openid
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [limitNum, offset]);

    // 查询总数
    const [total] = await pool.query(`SELECT COUNT(*) as cnt FROM sync_logs`);

    res.json({
      code: 200,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total[0].cnt,
        totalPages: Math.ceil(total[0].cnt / limitNum)
      }
    });
  } catch (err) {
    log.error('查询同步日志失败', { error: err.message });
    res.status(500).json({ code: 500, message: '查询同步日志失败' });
  }
}));

module.exports = router;
