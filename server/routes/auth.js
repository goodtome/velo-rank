/**
 * 微信登录 API 路由
 * POST /api/v1/auth/login — 用 wx.login() 返回的 code 换取 token
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db-pool');
const { code2Session } = require('../utils/wechat');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { routeLog } = require('../middleware/requestLogger');
const log = routeLog('auth');

/**
 * POST /api/v1/auth/login
 * 微信小程序登录：code → openid → token
 * Body: { code: string }
 * Response: { code: 200, data: { token, openid } }
 */
router.post('/login', asyncHandler(async (req, res) => {
  const code = req.body && typeof req.body.code === 'string' ? req.body.code.trim() : '';

  if (!code) {
    throw new AppError('缺少 code 参数', 400);
  }

  // 调用微信 code2Session 换取 openid
  const wxSession = await code2Session(code);
  const { openid } = wxSession;

  // 生成 UUID token，有效期 30 天
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // 保存 token（同一 openid 允许多设备登录，各自独立 token）
  await pool.query(
    `INSERT INTO user_tokens (token, openid, expires_at) VALUES (?, ?, ?)`,
    [token, openid, expiresAt]
  );

  log.info('用户登录成功');

  res.json({
    code: 200,
    data: { token, openid }
  });
}));

/**
 * POST /api/v1/auth/logout
 * 退出登录：删除当前 token
 * 需要登录态
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.slice(7);

  await pool.query('DELETE FROM user_tokens WHERE token = ?', [token]);

  res.json({ code: 200, message: '已退出登录' });
}));

/**
 * GET /api/v1/auth/check
 * 检查登录状态，返回当前用户 openid
 * 需要登录态
 */
router.get('/check', authMiddleware, asyncHandler(async (req, res) => {
  res.json({
    code: 200,
    data: { openid: req.openid }
  });
}));

/**
 * 安全删除：表不存在（ER_NO_SUCH_TABLE=1146）时静默跳过，避免阻塞注销事务
 */
async function deleteIfExists(conn, sql, params) {
  try {
    await conn.query(sql, params);
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') return;
    throw err;
  }
}

/**
 * DELETE /api/v1/auth/account
 * 注销账号：删除该用户的所有数据（token、设置、收藏、推送订阅、历史记录、日志）
 * 需要登录态
 */
router.delete('/account', authMiddleware, asyncHandler(async (req, res) => {
  const openid = req.openid;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 删除当前 token
    const authHeader = req.headers.authorization;
    const token = authHeader.slice(7);
    await conn.query('DELETE FROM user_tokens WHERE token = ?', [token]);

    // 删除该 openid 的所有 token（多设备）
    await conn.query('DELETE FROM user_tokens WHERE openid = ?', [openid]);

    // 删除用户收藏
    await conn.query('DELETE FROM riders_favorites WHERE user_id = ?', [openid]);

    // 删除用户设置
    await conn.query('DELETE FROM users_settings WHERE user_id = ?', [openid]);

    // 删除旧版用户偏好设置表（部分环境未创建，缺表时跳过）
    await deleteIfExists(conn, 'DELETE FROM riders_settings WHERE user_id = ?', [openid]);

    // 删除推送设置 / 订阅记录 / 推送历史（隐私政策承诺的"全部个人数据"）
    await conn.query('DELETE FROM user_push_settings WHERE openid = ?', [openid]);
    await conn.query('DELETE FROM user_push_subscriptions WHERE openid = ?', [openid]);
    await conn.query('DELETE FROM push_history WHERE openid = ?', [openid]);

    // 删除管理操作日志 / 同步日志中与该用户相关的记录
    await conn.query('DELETE FROM admin_logs WHERE user_id = ?', [openid]);
    // 同步日志表部分环境未创建，缺表时跳过
    await deleteIfExists(conn, 'DELETE FROM sync_logs WHERE requested_by = ?', [openid]);

    await conn.commit();
    log.info('用户注销账号成功');

    res.json({ code: 200, message: '账号已注销，所有数据已删除' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
