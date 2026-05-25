/**
 * 推送设置页面逻辑
 * v1.0 简化版：本地存储优先，服务端同步为辅
 * 不依赖JWT，使用openid做简单标识
 */

const { t, getLocale } = require('../../utils/i18n');
const { post, get: fetchGet } = require('../../utils/request');

Page({
  data: {
    pushEnabled: true,
    notifyRaceStart: true,
    notifyStageEnd: true,
    notifyRiderChange: true,
    notifyKeyEvents: false,
    dndEnabled: false,
    dndStart: '22:00',
    dndEnd: '07:00',
    pushFrequency: 'realtime',
    openid: '',
    syncing: false,
    syncStatus: '' // 'synced', 'error', ''
  },

  onLoad() {
    this.initI18n();
    this.loadSettings();
  },

  /**
   * 初始化i18n
   */
  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({ t: this.t });
  },

  /**
   * 加载设置（本地优先 → 服务端覆盖）
   */
  async loadSettings() {
    try {
      // 先从本地读取
      const localSettings = wx.getStorageSync('pushSettings');
      if (localSettings) {
        this.setData(localSettings);
      }

      // 尝试获取openid
      const openid = wx.getStorageSync('openid') || '';
      if (openid) {
        this.setData({ openid });
        // 从服务端同步最新设置
        const res = await fetchGet('/push/settings', { openid });
        if (res && res.code === 200 && res.data) {
          const serverData = res.data;
          this.setData({
            pushEnabled: serverData.pushEnabled,
            notifyRaceStart: serverData.notifyRaceStart,
            notifyStageEnd: serverData.notifyStageEnd,
            notifyRiderChange: serverData.notifyRiderChange,
            notifyKeyEvents: serverData.notifyKeyEvents,
            dndEnabled: serverData.dndEnabled,
            dndStart: serverData.dndStart || '22:00',
            dndEnd: serverData.dndEnd || '07:00',
            pushFrequency: serverData.pushFrequency || 'realtime'
          });
          // 同步到本地存储
          this.saveToLocal();
        }
      }
    } catch (error) {
      console.error('加载推送设置失败:', error);
    }
  },

  /**
   * 保存到本地存储
   */
  saveToLocal() {
    const {
      pushEnabled, notifyRaceStart, notifyStageEnd,
      notifyRiderChange, notifyKeyEvents,
      dndEnabled, dndStart, dndEnd, pushFrequency
    } = this.data;

    wx.setStorageSync('pushSettings', {
      pushEnabled, notifyRaceStart, notifyStageEnd,
      notifyRiderChange, notifyKeyEvents,
      dndEnabled, dndStart, dndEnd, pushFrequency
    });
  },

  /**
   * 同步到服务端
   */
  async syncToServer() {
    const { openid } = this.data;
    if (!openid) {
      // 没有openid，仅本地保存
      return;
    }

    this.setData({ syncing: true, syncStatus: '' });

    try {
      const {
        pushEnabled, notifyRaceStart, notifyStageEnd,
        notifyRiderChange, notifyKeyEvents,
        dndEnabled, dndStart, dndEnd, pushFrequency
      } = this.data;

      const res = await post('/push/settings', {
        openid,
        pushEnabled,
        notifyRaceStart,
        notifyStageEnd,
        notifyRiderChange,
        notifyKeyEvents,
        dndEnabled,
        dndStart,
        dndEnd,
        pushFrequency
      });

      if (res && res.code === 200) {
        this.setData({ syncStatus: 'synced' });
        setTimeout(() => this.setData({ syncStatus: '' }), 2000);
      }
    } catch (error) {
      console.error('同步推送设置失败:', error);
      this.setData({ syncStatus: 'error' });
      setTimeout(() => this.setData({ syncStatus: '' }), 3000);
    } finally {
      this.setData({ syncing: false });
    }
  },

  /**
   * 保存设置（本地 + 服务端）
   */
  saveSettings() {
    this.saveToLocal();
    this.syncToServer();
  },

  // ===== 切换事件 =====

  togglePush(e) {
    const pushEnabled = e.detail.value;
    this.setData({ pushEnabled });
    this.saveSettings();

    if (pushEnabled) {
      // 申请推送权限
      this.requestSubscribe();
    }
  },

  toggleRaceStart(e) {
    this.setData({ notifyRaceStart: e.detail.value });
    this.saveSettings();
  },

  toggleStageEnd(e) {
    this.setData({ notifyStageEnd: e.detail.value });
    this.saveSettings();
  },

  toggleRiderChange(e) {
    this.setData({ notifyRiderChange: e.detail.value });
    this.saveSettings();
  },

  toggleKeyEvents(e) {
    this.setData({ notifyKeyEvents: e.detail.value });
    this.saveSettings();
  },

  toggleDnd(e) {
    const dndEnabled = e.detail.value;
    this.setData({ dndEnabled });
    this.saveSettings();
  },

  onDndStartChange(e) {
    this.setData({ dndStart: e.detail.value });
    this.saveSettings();
  },

  onDndEndChange(e) {
    this.setData({ dndEnd: e.detail.value });
    this.saveSettings();
  },

  setFrequency(e) {
    const pushFrequency = e.currentTarget.dataset.frequency;
    this.setData({ pushFrequency });
    this.saveSettings();
  },

  /**
   * 请求订阅消息权限
   */
  requestSubscribe() {
    // 微信订阅消息模板ID（需要在小程序后台配置后填入）
    const tmplIds = [
      // 'your-template-id-1', // 赛事开始模板
      // 'your-template-id-2', // 赛段结束模板
    ].filter(id => id); // 过滤空值

    if (tmplIds.length === 0) {
      console.log('未配置订阅消息模板ID，跳过订阅请求');
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        console.log('订阅消息权限申请结果:', res);
        // 保存订阅记录到服务端
        const openid = this.data.openid || wx.getStorageSync('openid');
        if (openid) {
          const agreedTemplateIds = tmplIds.filter(id => res[id] === 'accept');
          if (agreedTemplateIds.length > 0) {
            post('/push/subscribe', { openid, templateIds: agreedTemplateIds })
              .catch(err => console.error('保存订阅记录失败:', err));
          }
        }
      },
      fail: (err) => {
        console.log('订阅消息权限申请失败:', err);
      }
    });
  },

  /**
   * 发送测试推送
   */
  async sendTestNotification() {
    const openid = this.data.openid || wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '请先登录后测试',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '发送中...' });

    try {
      const res = await post('/push/test', {
        openid,
        title: '正一领骑 通知测试',
        content: '如果您看到这条消息，说明推送功能正常工作！'
      });

      wx.hideLoading();

      if (res && res.code === 200) {
        wx.showToast({
          title: res.data?.sent ? '测试推送已发送' : '推送已记录',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res?.message || '发送失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
      console.error('发送测试推送失败:', err);
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '推送设置 - 正一领骑',
      path: '/pages/push-settings/push-settings'
    };
  },

  onShareTimeline() {
    return {
      title: '推送设置 - 正一领骑'
    };
  }
});
