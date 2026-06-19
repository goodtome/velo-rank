/**
 * 统一错误处理中间件
 * 捕获所有未处理的错误，返回标准JSON响应
 */

const { ERROR_CODE } = require('../constants');

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 统一错误响应格式
 */
function sendError(res, statusCode, message, details = null) {
  const response = { 
    code: statusCode, 
    message 
  };
  
  // 在开发环境下返回详细错误信息
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  res.status(statusCode).json(response);
}

/**
 * 错误处理中间件（必须放在所有路由之后）
 */
function errorHandler(err, req, res, next) {
  // 结构化错误日志（JSON 格式，便于 Fly.io 收集和检索）
  const errorLog = {
    ts: new Date().toISOString(),
    level: 'error',
    type: 'unhandled_error',
    method: req.method,
    path: req.originalUrl || req.path,
    message: err.message,
    stack: err.stack ? err.stack.split('\n').slice(0, 5).join(' | ') : undefined,
    code: err.code || undefined,
    statusCode: err.statusCode || 500
  };
  console.error(JSON.stringify(errorLog));

  // 默认错误
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let details = err.details || null;
  const isProd = process.env.NODE_ENV === 'production';

  // MySQL错误处理
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = '数据已存在（重复键）';
    details = process.env.NODE_ENV === 'development' ? err.sqlMessage : null;
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = '关联数据不存在（外键约束失败）';
    details = process.env.NODE_ENV === 'development' ? err.sqlMessage : null;
  } else if (err.code === 'ER_BAD_FIELD_ERROR') {
    statusCode = 500;
    message = '数据库字段错误';
    details = process.env.NODE_ENV === 'development' ? err.sqlMessage : null;
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = '数据库连接失败';
  } else if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    statusCode = 503;
    message = '数据库连接丢失';
  }

  // Joi验证错误（如果使用Joi）
  if (err.isJoi) {
    statusCode = 400;
    message = '请求参数验证失败';
    details = err.details?.map(d => d.message);
  }

  // Express验证错误
  if (err.array && typeof err.array === 'function') {
    statusCode = 400;
    message = '请求参数验证失败';
    details = err.array();
  }

  if (isProd && statusCode >= 500 && !err.isOperational) {
    message = '服务器内部错误';
    details = null;
  }

  // 发送错误响应
  sendError(res, statusCode, message, details);
}

/**
 * 404错误处理中间件
 */
function notFoundHandler(req, res, next) {
  const err = new AppError(`接口不存在: ${req.method} ${req.path}`, 404);
  next(err);
}

/**
 * 异步错误捕获包装器
 * 避免在每个async路由中写try-catch
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  sendError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};
