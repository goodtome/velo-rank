/**
 * 认证中间件
 * 从 Authorization header 提取 Bearer token，
 * 验证有效性后将 openid 挂载到 req.openid
 */

const pool = require('../config/db-pool');

/**
 * 输入验证辅助函数
 * 使用Joi进行参数验证，防止SQL注入和非法输入
 * @param {*} input - 要验证的输入
 * @param {*} schema - Joi验证schema
 * @returns {Object} 验证结果 { error, value }
 */
function validateInput(input, schema) {
  const Joi = require('joi');
  return schema.validate(input, { abortEarly: false });
}

/**
 * 检查并提示输入字段名
 * 用于验证请求参数中的必填字段
 * @param {Object} data - 请求数据
 * @param {Object} schema - Joi schemas
 * @returns {number|null} - 返回第一个错误参数名，无错误返回null
 */
function checkRequiredFields(data, schemaName) {
  if (!schemaName || !schemaName[schemaName]) return null;

  const result = validateInput(data, schemaName[schemaName]);
  if (result.error && result.error.details.length > 0) {
    // 返回第一个错误字段的名称
    return result.error.details[0].context.key;
  }
  return null;
}

/**
 * 需要登录的接口中间件
 * 用法：router.use(authMiddleware) 或 router.post('/xxx', authMiddleware, handler)
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }

  const token = authHeader.slice(7);

  pool.query(
    'SELECT openid FROM user_tokens WHERE token = ? AND expires_at > NOW()',
    [token]
  ).then(([rows]) => {
    if (rows.length === 0) {
      return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
    }
    req.openid = rows[0].openid;
    next();
  }).catch(next);
}

/**
 * 可选登录中间件：有 token 时解析 openid，没有也不报错
 * 用于需要区分登录/未登录用户的公开接口
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  pool.query(
    'SELECT openid FROM user_tokens WHERE token = ? AND expires_at > NOW()',
    [token]
  ).then(([rows]) => {
    if (rows.length > 0) {
      req.openid = rows[0].openid;
    }
    next();
  }).catch(next);
}

module.exports = {
  authMiddleware,
  optionalAuth,
  validateInput,
  checkRequiredFields
};

