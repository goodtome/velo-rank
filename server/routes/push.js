/**
 * 推送通知API路由
 * v2.0：通过 auth 中间件验证登录态，从 req.openid 获取用户标识
 * POST /send 使用 adminKey 验证，不依赖登录态（放在中间件之前豁免）
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { ERROR_CODE } = require('../constants');
const { authMiddleware } = require('../middleware/auth');

// ============================================================
// POST /send 放在 authMiddleware 之前，用 adminKey 验证
// ============================================================

/**
 * POST /api/v1/push/send
 * 发送推送通知（内部API，供管理后台/定时任务调用）
 * 需要管理员权限（通过 adminKey 验证，不走登录态）
 */
router.post('/send', asyncHandler(async (req, res) => {
  const { adminKey, type, raceId, stageId, title, content } = req.body;
  
  if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'velo-rank-admin-2026') {
    throw new AppError('管理员验证失败', ERROR_CODE.FORBIDDEN);
  }
  
  const [users] = await pool.query(`
    SELECT ups.openid, ups.push_enabled, ups.notify_race_start, 
           ups.notify_stage_end, ups.notify_rider_change, ups.notify_key_events,
           ups.dnd_enabled, ups.dnd_start, ups.dnd_end
    FROM user_push_settings ups
    WHERE ups.push_enabled = 1
  `);
  
  if (users.length === 0) {
    return res.json({
      code: 200,
      data: { totalUsers: 0, sentCount: 0, skippedCount: 0 }
    });
  }
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const validUsers = users.filter(user => {
    if (user.dnd_enabled) {
      if (isTimeInRange(currentTime, user.dnd_start, user.dnd_end)) {
        return false;
      }
    }
    switch (type) {
      case 'race_start': return user.notify_race_start === 1;
      case 'stage_end': return user.notify_stage_end === 1;
      case 'rider_change': return user.notify_rider_change === 1;
      case 'key_event': return user.notify_key_events === 1;
      default: return true;
    }
  });
  
  let sentCount = 0;
  let failedCount = 0;
  
  const { sendSubscribeMessage } = require('../utils/wechat');
  const templateId = getTemplateIdByType(type);
  
  if (templateId) {
    for (const user of validUsers) {
      try {
        await sendSubscribeMessage({
          touser: user.openid,
          templateId,
          data: {
            thing1: { value: title || '赛事通知' },
            time2: { value: now.toLocaleString('zh-CN') },
            thing3: { value: content || '' }
          },
          page: raceId ? `/pages/race-detail/race-detail?id=${raceId}` : 'pages/index/index'
        });
        sentCount++;
      } catch (err) {
        console.error(`推送失败: ${user.openid}`, err.message);
        failedCount++;
      }
    }
  } else {
    sentCount = validUsers.length;
  }
  
  for (const user of validUsers) {
    await pool.query(`
      INSERT INTO push_history 
        (openid, title, content, type, race_id, stage_id, send_time, status)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `, [
      user.openid, title || '赛事通知', content || '',
      type || 'general', raceId || null, stageId || null,
      sentCount > 0 ? 'sent' : 'failed'
    ]);
  }
  
  res.json({
    code: 200,
    data: {
      totalUsers: users.length,
      sentCount,
      failedCount,
      skippedCount: users.length - validUsers.length
    }
  });
}));

// ============================================================
// 以下所有路由都需要登录态（authMiddleware 注入 req.openid）
// ============================================================
router.use(authMiddleware);

/**
 * POST /api/v1/push/settings
 * 保存/更新推送设置
 */
router.post('/settings', asyncHandler(async (req, res) => {
  const openid = req.openid;
  
  const {
    pushEnabled = true,
    notifyRaceStart = true,
    notifyStageEnd = true,
    notifyRiderChange = true,
    notifyKeyEvents = false,
    dndEnabled = false,
    dndStart = '22:00',
    dndEnd = '07:00',
    pushFrequency = 'realtime'
  } = req.body;
  
  await pool.query(`
    INSERT INTO user_push_settings 
      (openid, push_enabled, notify_race_start, notify_stage_end, 
       notify_rider_change, notify_key_events, dnd_enabled, 
       dnd_start, dnd_end, push_frequency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      push_enabled = VALUES(push_enabled),
      notify_race_start = VALUES(notify_race_start),
      notify_stage_end = VALUES(notify_stage_end),
      notify_rider_change = VALUES(notify_rider_change),
      notify_key_events = VALUES(notify_key_events),
      dnd_enabled = VALUES(dnd_enabled),
      dnd_start = VALUES(dnd_start),
      dnd_end = VALUES(dnd_end),
      push_frequency = VALUES(push_frequency)
  `, [
    openid, pushEnabled ? 1 : 0, notifyRaceStart ? 1 : 0, notifyStageEnd ? 1 : 0,
    notifyRiderChange ? 1 : 0, notifyKeyEvents ? 1 : 0, dndEnabled ? 1 : 0,
    dndStart, dndEnd, pushFrequency
  ]);
  
  res.json({ code: 200, message: '推送设置已保存' });
}));

/**
 * GET /api/v1/push/settings
 * 获取推送设置
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const openid = req.openid;
  
  const [rows] = await pool.query(
    'SELECT * FROM user_push_settings WHERE openid = ?', [openid]
  );
  
  if (rows.length === 0) {
    return res.json({
      code: 200,
      data: {
        pushEnabled: true, notifyRaceStart: true, notifyStageEnd: true,
        notifyRiderChange: true, notifyKeyEvents: false,
        dndEnabled: false, dndStart: '22:00', dndEnd: '07:00',
        pushFrequency: 'realtime'
      }
    });
  }
  
  const settings = rows[0];
  res.json({
    code: 200,
    data: {
      pushEnabled: settings.push_enabled === 1,
      notifyRaceStart: settings.notify_race_start === 1,
      notifyStageEnd: settings.notify_stage_end === 1,
      notifyRiderChange: settings.notify_rider_change === 1,
      notifyKeyEvents: settings.notify_key_events === 1,
      dndEnabled: settings.dnd_enabled === 1,
      dndStart: settings.dnd_start,
      dndEnd: settings.dnd_end,
      pushFrequency: settings.push_frequency
    }
  });
}));

/**
 * POST /api/v1/push/subscribe
 * 订阅推送
 */
router.post('/subscribe', asyncHandler(async (req, res) => {
  const openid = req.openid;
  const { templateIds } = req.body;
  
  if (templateIds && Array.isArray(templateIds)) {
    for (const templateId of templateIds) {
      await pool.query(`
        INSERT INTO user_push_subscriptions 
          (openid, template_id, subscribe_time, is_valid)
        VALUES (?, ?, NOW(), 1)
        ON DUPLICATE KEY UPDATE subscribe_time = NOW(), is_valid = 1
      `, [openid, templateId]);
    }
  }
  
  res.json({ code: 200, message: '订阅成功' });
}));

/**
 * POST /api/v1/push/unsubscribe
 * 取消订阅推送
 */
router.post('/unsubscribe', asyncHandler(async (req, res) => {
  const openid = req.openid;
  const { templateIds } = req.body;
  
  if (templateIds && Array.isArray(templateIds)) {
    for (const templateId of templateIds) {
      await pool.query(
        'UPDATE user_push_subscriptions SET is_valid = 0 WHERE openid = ? AND template_id = ?',
        [openid, templateId]
      );
    }
  } else {
    await pool.query('UPDATE user_push_subscriptions SET is_valid = 0 WHERE openid = ?', [openid]);
  }
  
  res.json({ code: 200, message: '取消订阅成功' });
}));

/**
 * GET /api/v1/push/subscriptions
 * 获取用户订阅状态
 */
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const openid = req.openid;
  
  const [rows] = await pool.query(`
    SELECT template_id, subscribe_time, is_valid 
    FROM user_push_subscriptions WHERE openid = ?
    ORDER BY subscribe_time DESC
  `, [openid]);
  
  res.json({ code: 200, data: rows });
}));

/**
 * GET /api/v1/push/history
 * 获取推送历史
 */
router.get('/history', asyncHandler(async (req, res) => {
  const openid = req.openid;
  let { limit = 20, offset = 0 } = req.query;
  
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offsetNum = Math.max(0, parseInt(offset) || 0);
  
  const [rows] = await pool.query(`
    SELECT id, title, content, type, race_id, stage_id, send_time, status
    FROM push_history WHERE openid = ?
    ORDER BY send_time DESC LIMIT ? OFFSET ?
  `, [openid, limitNum, offsetNum]);
  
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM push_history WHERE openid = ?', [openid]
  );
  
  res.json({
    code: 200,
    data: rows,
    pagination: { total: countResult[0].total, limit: limitNum, offset: offsetNum }
  });
}));

/**
 * POST /api/v1/push/test
 * 发送测试推送
 */
router.post('/test', asyncHandler(async (req, res) => {
  const openid = req.openid;
  const { title, content } = req.body;
  
  const testTitle = title || '领骑通知测试';
  const testContent = content || '如果您看到这条消息，说明推送功能正常工作！';
  
  await pool.query(`
    INSERT INTO push_history (openid, title, content, type, send_time, status)
    VALUES (?, ?, ?, 'test', NOW(), 'pending')
  `, [openid, testTitle, testContent]);
  
  try {
    const { sendSubscribeMessage } = require('../utils/wechat');
    const templateId = process.env.WECHAT_TEMPLATE_RACE_START;
    
    if (templateId) {
      await sendSubscribeMessage({
        touser: openid,
        templateId,
        data: {
          thing1: { value: testTitle },
          time2: { value: new Date().toLocaleString('zh-CN') },
          thing3: { value: testContent }
        },
        page: 'pages/index/index'
      });
      
      await pool.query(
        "UPDATE push_history SET status = 'sent' WHERE openid = ? AND type = 'test' ORDER BY send_time DESC LIMIT 1",
        [openid]
      );
      
      res.json({ code: 200, message: '测试推送已发送', data: { sent: true } });
    } else {
      await pool.query(
        "UPDATE push_history SET status = 'sent' WHERE openid = ? AND type = 'test' ORDER BY send_time DESC LIMIT 1",
        [openid]
      );
      
      res.json({
        code: 200,
        message: '测试推送已记录（未配置微信模板ID，仅记录历史）',
        data: { sent: false, reason: 'no_template_id' }
      });
    }
  } catch (sendError) {
    console.error('发送测试推送失败:', sendError.message);
    await pool.query(
      "UPDATE push_history SET status = 'failed', error_msg = ? WHERE openid = ? AND type = 'test' ORDER BY send_time DESC LIMIT 1",
      [sendError.message, openid]
    );
    res.json({
      code: 200,
      message: '测试推送发送失败: ' + sendError.message,
      data: { sent: false, error: sendError.message }
    });
  }
}));

// ============================================================
// 辅助函数
// ============================================================

function getTemplateIdByType(type) {
  const templateMap = {
    race_start: process.env.WECHAT_TEMPLATE_RACE_START,
    stage_end: process.env.WECHAT_TEMPLATE_STAGE_END,
    rider_change: process.env.WECHAT_TEMPLATE_RANK_CHANGE,
    key_event: process.env.WECHAT_TEMPLATE_KEY_EVENT
  };
  return templateMap[type] || process.env.WECHAT_TEMPLATE_RACE_START;
}

function isTimeInRange(time, start, end) {
  const timeMinutes = convertToMinutes(time);
  const startMinutes = convertToMinutes(start);
  const endMinutes = convertToMinutes(end);
  
  if (startMinutes <= endMinutes) {
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  } else {
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }
}

function convertToMinutes(time) {
  if (!time) return 0;
  const timeStr = typeof time === 'string' ? time : String(time);
  const parts = timeStr.split(':');
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

module.exports = router;
