/**
 * 启动环境校验
 * 
 * 在 app.js 启动时校验关键环境变量是否已正确配置。
 * 生产环境缺失关键变量时输出 ERROR 级别日志；
 * 开发环境仅输出 WARN。
 * 
 * 用法：
 *   const { validateEnv } = require('./config/env-check');
 *   validateEnv();
 */

/**
 * 校验环境变量
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  function parseIntEnv(name) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  // ---------- 数据库 ----------
  const dbHost = isProd
    ? (process.env.DB_HOST_PROD || process.env.DB_HOST)
    : process.env.DB_HOST;
  const dbPass = isProd
    ? (process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD)
    : process.env.DB_PASSWORD;
  const dbName = isProd
    ? (process.env.DB_NAME_PROD || process.env.DB_NAME)
    : process.env.DB_NAME;

  if (!dbHost) {
    (isProd ? errors : warnings).push('DB_HOST 未配置，将使用默认值 localhost');
  }
  if (!dbPass) {
    (isProd ? errors : warnings).push('DB_PASSWORD 未配置，数据库连接可能失败');
  }
  if (isProd) {
    if (!process.env.DB_HOST_PROD) {
      errors.push('DB_HOST_PROD 未配置，生产数据库连接将失败');
    }
    if (!process.env.DB_PASSWORD_PROD) {
      errors.push('DB_PASSWORD_PROD 未配置，生产数据库连接将失败');
    }
    if (!dbName) {
      warnings.push('DB_NAME_PROD 未配置，将回退到 DB_NAME 或默认值');
    }
  }

  // ---------- 安全 ----------
  const sessionSecret = process.env.SESSION_SECRET;
  const defaultSecrets = ['change-me-in-production', 'your-secret-key-change-in-production', ''];
  if (!sessionSecret || defaultSecrets.includes(sessionSecret)) {
    if (isProd) {
      errors.push('SESSION_SECRET 使用默认值！生产环境必须设置强随机密钥');
    } else {
      warnings.push('SESSION_SECRET 使用默认值（开发环境可忽略）');
    }
  }

  const cors = process.env.CORS_ORIGINS;
  if (isProd && (!cors || cors === '*')) {
    errors.push('CORS_ORIGINS 未配置为明确白名单，生产环境必须限制来源');
  }

  const poolConnectionLimit = parseIntEnv('DB_POOL_CONNECTION_LIMIT');
  const poolQueueLimit = parseIntEnv('DB_POOL_QUEUE_LIMIT');
  if (poolConnectionLimit !== null && (!Number.isInteger(poolConnectionLimit) || poolConnectionLimit < 1)) {
    errors.push('DB_POOL_CONNECTION_LIMIT 必须是大于 0 的整数');
  }
  if (poolQueueLimit !== null && (!Number.isInteger(poolQueueLimit) || poolQueueLimit < 0)) {
    errors.push('DB_POOL_QUEUE_LIMIT 必须是大于等于 0 的整数');
  }
  if (isProd && poolQueueLimit === 0) {
    warnings.push('DB_POOL_QUEUE_LIMIT 为 0（无限排队），生产环境建议设置上限');
  }

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || adminKey === 'your-admin-key') {
    if (isProd) {
      errors.push('ADMIN_API_KEY 未配置，生产环境管理接口必须设置');
    }
  }

  // ---------- 微信 ----------
  if (isProd) {
    if (!process.env.WECHAT_APPID || process.env.WECHAT_APPID === 'your_appid') {
      errors.push('WECHAT_APPID 未配置，微信登录和推送功能不可用');
    }
    const wechatSecret = process.env.WECHAT_APPSECRET;
    if (!wechatSecret || wechatSecret === 'your_appsecret') {
      errors.push('WECHAT_APPSECRET 未配置，微信登录和推送功能不可用');
    }
  }

  // ---------- 输出日志 ----------
  const logLevel = isProd ? 'error' : 'warn';

  if (errors.length > 0) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      type: 'env-check',
      message: `环境变量校验失败 (${errors.length} 个错误)`,
      errors,
      warnings
    }));
  } else if (warnings.length > 0) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      type: 'env-check',
      message: `环境变量校验通过 (${warnings.length} 个警告)`,
      warnings
    }));
  } else {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      type: 'env-check',
      message: '环境变量校验通过'
    }));
  }

  // 生产环境有 error 时不阻止启动，但打印醒目提示
  if (isProd && errors.length > 0) {
    console.error('⚠️  生产环境配置存在问题，请检查上述错误并修复');
  }

  return { errors, warnings };
}

module.exports = { validateEnv };
