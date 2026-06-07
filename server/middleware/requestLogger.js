/**
 * 请求日志中间件（轻量版）
 * 
 * 输出格式：JSON 结构化日志，便于 Fly.io 收集和检索
 * 跳过健康检查端点，避免日志噪音
 */

/**
 * 请求日志中间件
 * 记录：method、path、状态码、耗时、请求体大小
 */
function requestLogger(req, res, next) {
  // 跳过健康检查
  if (req.path === '/health' || req.path === '/api/v1/health') {
    return next();
  }

  const start = Date.now();

  // 监听响应完成事件，记录完整请求信息
  res.on('finish', () => {
    const duration = Date.now() - start;

    const log = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      type: 'http',
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      ms: duration,
      // 请求体大小（字节）
      reqSize: req.headers['content-length'] || 0,
      // 响应体大小（字节）
      resSize: res.getHeader('content-length') || 0,
      // 客户端 IP（trust proxy 后为真实 IP）
      ip: req.ip || req.connection?.remoteAddress || '',
      // User-Agent（截断，避免日志过长）
      ua: (req.headers['user-agent'] || '').substring(0, 80)
    };

    // 慢请求额外标记
    if (duration > 2000) {
      log.slow = true;
    }

    // 500+ 错误在 errorHandler 中已有详细 stack trace，这里只记录摘要
    if (log.level === 'error') {
      console.error(JSON.stringify(log));
    } else if (log.level === 'warn') {
      console.warn(JSON.stringify(log));
    } else {
      console.log(JSON.stringify(log));
    }
  });

  next();
}

/**
 * 任务日志工具（用于同步脚本、定时任务等非 HTTP 场景）
 */
function taskLogger(taskName) {
  const start = Date.now();

  return {
    /**
     * 记录任务开始
     */
    start(meta = {}) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        type: 'task',
        task: taskName,
        action: 'start',
        ...meta
      }));
    },

    /**
     * 记录任务成功完成
     */
    success(result = {}) {
      const duration = Date.now() - start;
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        type: 'task',
        task: taskName,
        action: 'success',
        ms: duration,
        ...result
      }));
    },

    /**
     * 记录任务失败
     */
    fail(error, meta = {}) {
      const duration = Date.now() - start;
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        type: 'task',
        task: taskName,
        action: 'fail',
        ms: duration,
        error: error.message || String(error),
        stack: error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : undefined,
        ...meta
      }));
    },

    /**
     * 记录任务进度
     */
    progress(message, meta = {}) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        type: 'task',
        task: taskName,
        action: 'progress',
        ms: Date.now() - start,
        message,
        ...meta
      }));
    }
  };
}

/**
 * 路由级别的结构化日志辅助函数
 * 替代路由文件中的 console.log/error，输出 JSON 格式
 *
 * @param {string} route - 路由标识（如 'auth', 'stages', 'admin'）
 * @returns {{ info, warn, error }} 日志方法
 *
 * 用法：
 *   const { routeLog } = require('../middleware/requestLogger');
 *   const log = routeLog('admin');
 *   log.info('开始导入', { race: 'tdf-2026', stage: 1 });
 *   log.error('导入失败', { error: err.message });
 */
function routeLog(route) {
  function emit(level, message, meta) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      type: 'route',
      route,
      message
    };
    if (meta) Object.assign(entry, meta);
    const out = JSON.stringify(entry);
    if (level === 'error') console.error(out);
    else if (level === 'warn') console.warn(out);
    else console.log(out);
  }

  return {
    info(message, meta) { emit('info', message, meta); },
    warn(message, meta) { emit('warn', message, meta); },
    error(message, meta) { emit('error', message, meta); }
  };
}

module.exports = { requestLogger, taskLogger, routeLog };
