/**
 * 推送设置页面逻辑
 * 管理推送通知偏好、免打扰时段、推送频率
 */

const { t, getLocale } = require('../../utils/i18n');

Page({
  data: {
    pushEnabled: true, // 总开关
    notifyRaceStart: true, // 赛事开始提醒
    notifyStageEnd: true, // 赛段结束通知
    notifyRiderChange: true, // 关注车手排名变化
    notifyKeyEvents: false, // 关键事件通知
    dndEnabled: false, // 免打扰开关
    dndStart: '22:00', // 免打扰开始时间
    dndEnd: '07:00', // 免打扰结束时间
    pushFrequency: 'realtime' // realtime, 30min, daily
  },
  
  onLoad() {
    this.initI18n();
    // 加载用户保存的设置
    this.loadSettings();
  },

  /**
   * 初始化i18n
   */
  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({
      t: this.t
    });
  },
  
  // 加载设置
  loadSettings() {
    try {
      const settings = wx.getStorageSync('pushSettings');
      if (settings) {
        this.setData(settings);
      }
    } catch (error) {
      console.error('加载推送设置失败:', error);
    }
  },
  
  // 保存设置
  saveSettings() {
    try {
      wx.setStorageSync('pushSettings', this.data);
      
      // 同步到后端（如果已登录）
      this.syncToServer();
    } catch (error) {
      console.error('保存推送设置失败:', error);
    }
  },
  
  // 同步到后端
  syncToServer() {
    const { pushEnabled, notifyRaceStart, notifyStageEnd, 
          notifyRiderChange, notifyKeyEvents, 
          dndEnabled, dndStart, dndEnd, pushFrequency } = this.data;
    
    wx.request({
      url: `${getApp().globalData.baseUrl}/api/v1/user/push-settings`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      data: {
        pushEnabled,
        notifyRaceStart,
        notifyStageEnd,
        notifyRiderChange,
        notifyKeyEvents,
        dndEnabled,
        dndStart,
        dndEnd,
        pushFrequency
      },
      success: (res) => {
        if (res.data.success) {
          console.log('推送设置已同步到服务器');
        }
      },
      fail: (err) => {
        console.error('同步推送设置失败:', err);
      }
    });
  },
  
  // 切切换总开关
  togglePush(e) {
    const pushEnabled = e.detail.value;
    this.setData({ pushEnabled });
    this.saveSettings();
    
    if (pushEnabled) {
      // 申请推送权限
      wx.requestSubscribeMessage({
        tmplIds: ['your-template-id-1', 'your-template-id-2'], // 替换为实际模板ID
        success: (res) => {
          console.log('推送权限申请结果:', res);
        }
      });
    }
  },
  
  // 切换赛事开始提醒
  toggleRaceStart(e) {
    this.setData({ notifyRaceStart: e.detail.value });
    this.saveSettings();
  },
  
  // 切换赛段结束通知
  toggleStageEnd(e) {
    this.setData({ notifyStageEnd: e.detail.value });
    this.saveSettings();
  },
    
  // 切换关注车手排名变化
  toggleRiderChange(e) {
    this.setData({ notifyRiderChange: e.detail.value });
    this.saveSettings();
  },
  
  // 切换关键事件通知
  toggleKeyEvents(e) {
    this.setData({ notifyKeyEvents: e.detail.value });
    this.saveSettings();
  },
  
  // 切换免打扰
  toggleDnd(e) {
    const dndEnabled = e.detail.value;
    this.setData({ dndEnabled });
    this.saveSettings();
  },
  
  // 免打扰开始时间变化
  onDndStartChange(e) {
    this.setData({ dndStart: e.detail.value });
    this.saveSettings();
  },
  
  // 免打扰结束时间变化
  onDndEndChange(e) {
    this.setData({ dndEnd: e.detail.value });
    this.saveSettings();
  },
  
  // 设置推送频率
  setFrequency(e) {
    const pushFrequency = e.currentTarget.dataset.frequency;
    this.setData({ pushFrequency });
    this.saveSettings();
  },
  
  // 发送测试推送
  sendTestNotification() {
    wx.showLoading({ title: this.t('testPushSending') });
    
    wx.request({
      url: `${getApp().globalData.baseUrl}/api/v1/push/test`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      data: {
        title: this.t('testPush'),
        content: this.t('testPushContent')
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.success) {
          wx.showToast({
            title: this.t('testPushSent'),
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.data.message || this.t('errorServer'),
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: this.t('errorNetwork'),
          icon: 'none'
        });
        console.error('发送测试推送失败:', err);
      }
    });
  },
  
  // 分享
  onShareAppMessage() {
    return {
      title: this.t('pushSettings') + ' - ' + this.t('appName'),
      path: '/pages/push-settings/push-settings'
    };
  }
});
