const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();
const pool = require('../config/db-pool');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');
const { routeLog } = require('../middleware/requestLogger');

const log = routeLog('sync');

const statusQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(5),
  offset: Joi.number().integer().min(0).default(0)
});

const syncRequestSchema = Joi.object({
  force_refresh: Joi.boolean().default(false),
  race_code: Joi.string().trim().allow('', null)
});

let syncLogsSchemaReady = null;

async function ensureSyncLogsSchema() {
  if (!syncLogsSchemaReady) {
    syncLogsSchemaReady = (async () => {
      const [rows] = await pool.query(`
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sync_logs'
          AND COLUMN_NAME = 'race_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
        LIMIT 1
      `);

      if (rows.length > 0 && rows[0].REFERENCED_TABLE_NAME === 'races') {
        return;
      }

      if (rows.length > 0 && rows[0].CONSTRAINT_NAME) {
        try {
          await pool.query(`ALTER TABLE sync_logs DROP FOREIGN KEY ${rows[0].CONSTRAINT_NAME}`);
        } catch (err) {
          log.warn('Failed to drop legacy sync_logs foreign key', { error: err.message });
        }
      } else {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS sync_logs (
            id VARCHAR(36) PRIMARY KEY,
            race_id VARCHAR(36) NOT NULL,
            requested_by VARCHAR(50),
            status VARCHAR(20) DEFAULT 'pending',
            started_at TIMESTAMP NULL,
            completed_at TIMESTAMP NULL,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_race_id (race_id),
            INDEX idx_requested_by (requested_by),
            INDEX idx_status (status),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据同步日志表';
        `);
      }

      const [fkRows] = await pool.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sync_logs'
          AND COLUMN_NAME = 'race_id'
          AND REFERENCED_TABLE_NAME = 'races'
        LIMIT 1
      `);

      if (fkRows.length === 0) {
        await pool.query(`
          ALTER TABLE sync_logs
          ADD CONSTRAINT fk_sync_logs_race_id
          FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
        `);
      }
    })().catch(err => {
      syncLogsSchemaReady = null;
      throw err;
    });
  }

  return syncLogsSchemaReady;
}

async function createSyncLog({ raceId, requestedBy, status }) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO sync_logs (id, race_id, requested_by, status, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, raceId, requestedBy, status, now, now]
  );

  return id;
}

async function updateSyncLog(syncId, patch) {
  const fields = [];
  const params = [];

  if (patch.status !== undefined) {
    fields.push('status = ?');
    params.push(patch.status);
  }
  if (patch.started_at !== undefined) {
    fields.push('started_at = ?');
    params.push(patch.started_at);
  }
  if (patch.completed_at !== undefined) {
    fields.push('completed_at = ?');
    params.push(patch.completed_at);
  }
  if (patch.error_message !== undefined) {
    fields.push('error_message = ?');
    params.push(patch.error_message);
  }

  if (fields.length === 0) return;

  params.push(syncId);
  await pool.query(`UPDATE sync_logs SET ${fields.join(', ')} WHERE id = ?`, params);
}

function runSyncWorker({ raceCode, raceId, syncId, forceRefresh }) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'sync-pcs.js');
  const child = spawn(process.execPath, [scriptPath, raceCode], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      RACE_ID: raceId,
      SYNC_LOG_ID: syncId,
      FORCE_REFRESH: forceRefresh ? '1' : '0'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const prefix = `[sync:${syncId}]`;
  const forward = (stream, level) => {
    stream.on('data', chunk => {
      const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        log[level](`${prefix} ${line}`);
      }
    });
  };

  forward(child.stdout, 'info');
  forward(child.stderr, 'warn');

  child.on('error', async err => {
    log.error('Sync worker failed to start', { syncId, error: err.message });
    try {
      await updateSyncLog(syncId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: err.message
      });
    } catch (updateErr) {
      log.error('Failed to update sync log after spawn error', {
        syncId,
        error: updateErr.message
      });
    }
  });

  child.on('exit', async code => {
    const status = code === 0 ? 'success' : 'failed';
    const errorMessage = code === 0 ? null : `Sync worker exited with code ${code}`;

    try {
      await updateSyncLog(syncId, {
        status,
        completed_at: new Date().toISOString(),
        error_message: errorMessage
      });
    } catch (err) {
      log.error('Failed to update sync log on worker exit', {
        syncId,
        error: err.message
      });
    }

    if (code === 0) {
      log.info('Sync worker completed', { syncId, raceId, raceCode });
    } else {
      log.warn('Sync worker exited with non-zero code', { syncId, raceId, raceCode, code });
    }
  });

  return child;
}

// GET /api/v1/sync/status - 查看同步状态
router.get('/status', asyncHandler(async (req, res) => {
  const valid = statusQuerySchema.validate(req.query);
  if (valid.error) {
    return res.status(400).json({
      code: 400,
      message: '参数校验失败',
      details: valid.error.details.map(d => d.message)
    });
  }

  const { limit, offset } = valid.value;
  const [rows] = await pool.query(
    `
      SELECT l.*,
             r.race_name,
             r.race_code
      FROM sync_logs l
      LEFT JOIN races r ON l.race_id = r.id
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [limit, offset]
  );

  const [totalRows] = await pool.query('SELECT COUNT(*) AS cnt FROM sync_logs');

  res.json({
    code: 200,
    data: {
      recent_sync: rows,
      message: '数据同步服务运行正常',
      total: totalRows[0].cnt,
      params: { limit, offset }
    }
  });
}));

// POST /api/v1/sync/races/:id - 手动触发赛事数据同步（需认证）
router.post('/races/:id', adminMiddleware, asyncHandler(async (req, res) => {
  await ensureSyncLogsSchema();

  const { id } = req.params;
  const bodyValid = syncRequestSchema.validate(req.body || {});
  if (bodyValid.error) {
    return res.status(400).json({
      code: 400,
      message: '参数校验失败',
      details: bodyValid.error.details.map(d => d.message)
    });
  }

  const { force_refresh, race_code: requestedRaceCode } = bodyValid.value;
  const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required();
  const uuidValidation = uuidSchema.validate(id);

  if (uuidValidation.error) {
    throw new AppError('无效的赛事ID格式', 400);
  }

  const [races] = await pool.query(
    'SELECT id, race_name, race_code FROM races WHERE id = ? LIMIT 1',
    [id]
  );

  if (races.length === 0) {
    throw new AppError('赛事不存在', 404);
  }

  const race = races[0];
  const raceCode = requestedRaceCode || race.race_code;
  if (!raceCode) {
    throw new AppError('赛事缺少 race_code，无法触发同步', 400);
  }

  const requestedBy = req.openid || req.user?.openid || 'unknown';
  const syncId = await createSyncLog({
    raceId: race.id,
    requestedBy,
    status: 'running'
  });

  runSyncWorker({
    raceCode,
    raceId: race.id,
    syncId,
    forceRefresh: force_refresh
  });

  log.info('Sync task submitted', {
    raceId: race.id,
    raceCode,
    syncId,
    requestedBy,
    forceRefresh: !!force_refresh
  });

  res.status(202).json({
    code: 202,
    message: '同步任务已提交，请查看同步状态',
    data: {
      race_id: race.id,
      race_name: race.race_name,
      race_code: raceCode,
      sync_id: syncId,
      status: 'running',
      requested_by: requestedBy,
      force_refresh: !!force_refresh
    }
  });
}));

// GET /api/v1/sync/logs - 查看同步日志（需认证）
router.get('/logs', adminMiddleware, asyncHandler(async (req, res) => {
  const valid = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }).validate(req.query);

  if (valid.error) {
    return res.status(400).json({
      code: 400,
      message: '参数校验失败',
      details: valid.error.details.map(d => d.message)
    });
  }

  const { page, limit } = valid.value;
  const offset = (page - 1) * limit;

  const [logs] = await pool.query(
    `
      SELECT l.*,
             r.race_name,
             r.race_code
      FROM sync_logs l
      LEFT JOIN races r ON l.race_id = r.id
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [limit, offset]
  );

  const [totalRows] = await pool.query('SELECT COUNT(*) AS cnt FROM sync_logs');

  res.json({
    code: 200,
    data: logs,
    pagination: {
      page,
      limit,
      total: totalRows[0].cnt,
      totalPages: Math.ceil(totalRows[0].cnt / limit)
    }
  });
}));

module.exports = router;
