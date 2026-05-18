/**
 * 推送通知API路由
 * 管理用户推送设置、订阅、发送推送
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { sendSubscribeMessage, batchSendSubscribeMessage } = require('../utils/wechat');

/**
 * POST /api/v1/push-settings
 * 保存用户推送设置
 */
router.post('/push-settings', async (req, res) => {
  try {
    const userId = req.user.id; // 假设已从JWT解析
    const {
      pushEnabled,
      notifyRaceStart,
      notifyStageEnd,
      notifyRiderChange,
      notifyKeyEvents,
      dndEnabled,
      dndStart,
      dndEnd,
      pushFrequency
    } = req.body;
    
    // 更新或插入设置
    await pool.query(`
      INSERT INTO user_push_settings 
        (user_id, push_enabled, notify_race_start, notify_stage_end, 
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
      userId, pushEnabled, notifyRaceStart, notifyStageEnd,
      notifyRiderChange, notifyKeyEvents, dndEnabled,
      dndStart, dndEnd, pushFrequency
    ]);
    
    res.json({
      success: true,
      message: '推送设置已保存'
    });
  } catch (error) {
    console.error('保存推送设置失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * GET /api/v1/push-settings
 * 获取用户推送设置
 */
router.get('/push-settings', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await pool.query(`
      SELECT * FROM user_push_settings WHERE user_id = ?
    `, [userId]);
    
    if (rows.length === 0) {
      // 返回默认设置
      return res.json({
        success: true,
        data: {
          pushEnabled: true,
          notifyRaceStart: true,
          notifyStageEnd: true,
          notifyRiderChange: true,
          notifyKeyEvents: false,
          dndEnabled: false,
          dndStart: '22:00',
          dndEnd: '07:00',
          pushFrequency: 'realtime'
        }
      });
    }
    
    const settings = rows[0];
    res.json({
      success: true,
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
  } catch (error) {
    console.error('获取推送设置失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * POST /api/v1/push/subscribe
 * 订阅推送（保存微信formId或模板消息ID）
 */
router.post('/subscribe', async (req, res) => {
  try {
    const userId = req.user.id;
    const { formId, templateId, subscribeTime } = req.body;
    
    await pool.query(`
      INSERT INTO user_push_subscriptions 
        (user_id, form_id, template_id, subscribe_time)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        form_id = VALUES(form_id),
        template_id = VALUES(template_id),
        subscribe_time = VALUES(subscribe_time)
    `, [userId, formId, templateId, subscribeTime]);
    
    res.json({
      success: true,
      message: '订阅成功'
    });
  } catch (error) {
    console.error('订阅推送失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * POST /api/v1/push/send
 * 发送推送通知（内部API，供定时任务或WebSocket触发）
 * 此API需要管理员权限
 */
router.post('/send', async (req, res) => {
  try {
    const { userIds, title, content, type, raceId, stageId } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: userIds (数组)'
      });
    }
    
    // 检查用户推送设置（是否开启、是否在免打扰时段）
    const [users] = await pool.query(`
      SELECT 
        u.id,
        u.open_id,
        ups.push_enabled,
        ups.dnd_enabled,
        ups.dnd_start,
        ups.dnd_end,
        ups.push_frequency
      FROM users u
      LEFT JOIN user_push_settings ups ON u.id = ups.user_id
      WHERE u.id IN (?)
    `, [userIds]);
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 过滤出应该接收推送的用户
    const validUsers = users.filter(user => {
      // 检查总开关
      if (!user.push_enabled) {
        return false;
      }
      
      // 检查免打扰时段
      if (user.dnd_enabled) {
        const dndStart = user.dnd_start;
        const dndEnd = user.dnd_end;
        
        // 判断当前时间是否在免打扰时段内
        if (isTimeInRange(currentTime, dndStart, dndEnd)) {
          console.log(`用户 ${user.id} 在免打扰时段内，不推送`);
          return false;
        }
      }
      
      return true;
    });
    
    // 实际发送微信订阅消息
    const messages = [];
    for (const user of validUsers) {
      if (!user.open_id) {
        console.log(`用户 ${user.id} 没有 open_id，跳过`);
        continue;
      }
      
      // 根据推送类型选择模板ID
      let templateId;
      switch(type) {
        case 'race_start':
          templateId = process.env.WECHAT_TEMPLATE_RACE_START;
          break;
        case 'stage_end':
          templateId = process.env.WECHAT_TEMPLATE_STAGE_END;
          break;
        case 'rank_change':
          templateId = process.env.WECHAT_TEMPLATE_RANK_CHANGE;
          break;
        default:
          templateId = process.env.WECHAT_TEMPLATE_RACE_START; // 默认模板
      }
      
      if (!templateId) {
        console.error('未配置微信模板消息ID');
        continue;
      }
      
      // 构造模板数据（需要根据实际模板调整字段）
      const templateData = {
        thing1: { value: title || '赛事通知' },
        time2: { value: new Date().toLocaleString('zh-CN') },
        thing3: { value: content || '' }
      };
      
      messages.push({
        touser: user.open_id,
        templateId: templateId,
        data: templateData,
        page: `/pages/race-detail/race-detail?id=${raceId}`
      });
    }
    
    // 批量发送
    const sendResults = await batchSendSubscribeMessage(messages);
    console.log(`推送完成: 成功 ${sendResults.success}, 失败 ${sendResults.failed}`);
    
    // 记录推送历史
    for (let i = 0; i < validUsers.length; i++) {
      const user = validUsers[i];
      await pool.query(`
        INSERT INTO push_history 
          (user_id, title, content, type, race_id, stage_id, send_time, status)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        user.id, 
        title, 
        content, 
        type, 
        raceId, 
        stageId,
        i < sendResults.success ? 'sent' : 'failed'
      ]);
    }
    
    res.json({
      success: true,
      data: {
        totalUsers: userIds.length,
        sentCount: sendResults.success,
        failedCount: sendResults.failed,
        skippedCount: userIds.length - validUsers.length,
        errors: sendResults.errors
      }
    });
  } catch (error) {
    console.error('发送推送失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * POST /api/v1/push/test
 * 发送测试推送
 */
router.post('/test', async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: title, content'
      });
    }
    
    // 获取用户的 open_id
    const [users] = await pool.query(`
      SELECT open_id FROM users WHERE id = ?
    `, [userId]);
    
    if (users.length === 0 || !users[0].open_id) {
      return res.status(400).json({
        success: false,
        error: '用户未绑定微信或缺少 open_id'
      });
    }
    
    const openId = users[0].open_id;
    const templateId = process.env.WECHAT_TEMPLATE_RACE_START; // 使用默认模板
    
    if (!templateId) {
      return res.status(500).json({
        success: false,
        error: '未配置微信模板消息ID'
      });
    }
    
    // 构造模板数据
    const templateData = {
      thing1: { value: title },
      time2: { value: new Date().toLocaleString('zh-CN') },
      thing3: { value: content }
    };
    
    // 实际发送微信订阅消息
    try {
      await sendSubscribeMessage({
        touser: openId,
        templateId: templateId,
        data: templateData,
        page: 'pages/index/index'
      });
      
      console.log(`测试推送成功给用户 ${userId}`);
      
      // 记录推送历史
      await pool.query(`
        INSERT INTO push_history 
          (user_id, title, content, type, send_time, status)
        VALUES (?, ?, ?, 'test', NOW(), 'sent')
      `, [userId, title, content]);
      
      res.json({
        success: true,
        message: '测试推送已发送'
      });
    } catch (sendError) {
      console.error('发送微信消息失败:', sendError);
      
      // 记录失败的推送
      await pool.query(`
        INSERT INTO push_history 
          (user_id, title, content, type, send_time, status)
        VALUES (?, ?, ?, 'test', NOW(), 'failed')
      `, [userId, title, content]);
      
      res.status(500).json({
        success: false,
        error: `发送失败: ${sendError.message}`
      });
    }
  } catch (error) {
    console.error('发送测试推送失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * 判断时间是否在范围内（处理跨天情况）
 * @param {string} time - 当前时间 (HH:MM)
 * @param {string} start - 开始时间 (HH:MM)
 * @param {string} end - 结束时间 (HH:MM)
 * @returns {boolean}
 */
function isTimeInRange(time, start, end) {
  const timeMinutes = convertToMinutes(time);
  const startMinutes = convertToMinutes(start);
  const endMinutes = convertToMinutes(end);
  
  if (startMinutes <= endMinutes) {
    // 不跨天：例如 22:00 - 07:00 不适用此情况
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  } else {
    // 跨天：例如 22:00 - 07:00
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }
}

/**
 * 将时间字符串转换为分钟数
 * @param {string} time - 时间字符串 (HH:MM)
 * @returns {number}
 */
function convertToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

module.exports = router;
