/**
 * 认证中间件
 * 从 Authorization header 提取 Bearer token，
 * 验证有效性后将 openid 挂载到 req.openid
 */

function getPool() {
  return require('../config/db-pool');
}

function getConfiguredAdminKey() {
  return process.env.ADMIN_API_KEY;
}

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const pairs = cookieHeader.split(';').map(part => part.trim()).filter(Boolean);

  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) continue;

    const key = pair.slice(0, index);
    if (key !== name) continue;

    return decodeURIComponent(pair.slice(index + 1));
  }

  return '';
}

function getProvidedAdminKey(req) {
  return req.headers['x-admin-key']
    || req.query?.admin_key
    || req.query?.key
    || getCookieValue(req, 'admin_key');
}

function setAdminCookie(req, res, adminKey) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = 60 * 60 * 8;
  res.setHeader(
    'Set-Cookie',
    `admin_key=${encodeURIComponent(adminKey)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

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

  getPool().query(
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

function adminMiddleware(req, res, next) {
  const configuredKey = getConfiguredAdminKey();
  const providedKey = getProvidedAdminKey(req);

  if (configuredKey) {
    if (providedKey === configuredKey) {
      req.adminAuthenticated = true;
      req.adminKeySource = req.headers['x-admin-key'] ? 'header' : (req.query?.admin_key || req.query?.key ? 'query' : 'cookie');
      return next();
    }
    return res.status(403).json({ code: 403, message: '管理密钥无效' });
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ code: 503, message: '管理密钥未配置' });
  }

  return authMiddleware(req, res, next);
}

function adminPageMiddleware(req, res, next) {
  const configuredKey = getConfiguredAdminKey();
  const providedKey = getProvidedAdminKey(req);

  if (configuredKey) {
    if (providedKey === configuredKey) {
      req.adminAuthenticated = true;
      setAdminCookie(req, res, configuredKey);
      return next();
    }

    res.status(403).type('html').send(`
      <!doctype html>
      <html lang="zh-CN">
        <head><meta charset="utf-8"><title>管理后台受保护</title></head>
        <body style="font-family: sans-serif; padding: 32px;">
          <h1>管理后台受保护</h1>
          <p>请使用管理员密钥访问，例如：<code>/admin?admin_key=YOUR_KEY</code></p>
        </body>
      </html>
    `);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    res.status(503).type('html').send('管理密钥未配置');
    return;
  }

  next();
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

  getPool().query(
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
  adminPageMiddleware,
  adminMiddleware,
  authMiddleware,
  optionalAuth,
  validateInput,
  checkRequiredFields
};
