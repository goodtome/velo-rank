const { post, get: fetchGet } = require('../../utils/request');
const { getSubscribeTemplateIds } = require('../../config/env');
const auth = require('../../utils/auth');

function getEnabledSubscribeTemplateIds() {
  return Object.values(getSubscribeTemplateIds()).filter(Boolean);
}

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
    syncStatus: '',
    hasSubscribeTemplates: getEnabledSubscribeTemplateIds().length > 0,
    subscriptionStatus: {},
    subscriptionSummary: '未同步授权状态'
  },

  onLoad() {
    this.loadSettings();
  },

  async ensureLogin() {
    let openid = auth.getOpenid();
    if (auth.isLoggedIn() && openid) {
      this.setData({ openid });
      return true;
    }

    try {
      wx.showLoading({ title: '登录中...' });
      const loginResult = await auth.login();
      wx.hideLoading();
      openid = loginResult.openid || auth.getOpenid();
      this.setData({ openid });
      return !!openid;
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({
        title: '登录失败，请稍后重试',
        icon: 'none'
      });
      return false;
    }
  },

  async loadSettings() {
    try {
      const localSettings = wx.getStorageSync('pushSettings');
      if (localSettings) {
        this.setData(localSettings);
      }

      const loggedIn = await this.ensureLogin();
      if (!loggedIn) return;

      const res = await fetchGet('/push/settings');
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
        this.saveToLocal();
      }
      await this.syncSubscriptionStatus();
    } catch (error) {
      console.error('加载推送设置失败:', error);
    }
  },

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

  async syncSubscriptionStatus() {
    try {
      const res = await fetchGet('/push/subscriptions');
      if (!res || res.code !== 200 || !Array.isArray(res.data)) return;
      const subscriptionStatus = res.data.reduce((statusMap, item) => {
        statusMap[item.template_id] = item.is_valid === 1 || item.is_valid === true ? 'accepted' : 'rejected';
        return statusMap;
      }, {});
      const acceptedCount = Object.values(subscriptionStatus).filter(status => status === 'accepted').length;
      const subscriptionSummary = acceptedCount > 0
        ? `已授权 ${acceptedCount} 个订阅模板`
        : '尚未授权可用订阅模板';
      this.setData({ subscriptionStatus, subscriptionSummary });
    } catch (error) {
      console.warn('Unable to sync subscription status:', error);
    }
  },

  async syncToServer() {
    const loggedIn = await this.ensureLogin();
    if (!loggedIn) return;

    this.setData({ syncing: true, syncStatus: '' });

    try {
      const {
        pushEnabled, notifyRaceStart, notifyStageEnd,
        notifyRiderChange, notifyKeyEvents,
        dndEnabled, dndStart, dndEnd, pushFrequency
      } = this.data;

      const res = await post('/push/settings', {
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

  saveSettings() {
    this.saveToLocal();
    this.syncToServer();
  },

  async togglePush(e) {
    const pushEnabled = e.detail.value;
    this.setData({ pushEnabled });
    this.saveToLocal();
    await this.syncToServer();

    if (pushEnabled) {
      this.requestSubscribe();
    } else {
      await this.cancelSubscriptions();
    }
  },

  async cancelSubscriptions() {
    const loggedIn = await this.ensureLogin();
    if (!loggedIn) return;
    try {
      await post('/push/unsubscribe', { templateIds: getEnabledSubscribeTemplateIds() });
      await this.syncSubscriptionStatus();
    } catch (error) {
      console.error('Unable to cancel subscriptions:', error);
      wx.showToast({ title: '取消订阅同步失败', icon: 'none' });
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
    this.setData({ dndEnabled: e.detail.value });
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

  requestSubscribe() {
    const tmplIds = getEnabledSubscribeTemplateIds();

    if (tmplIds.length === 0) {
      wx.showToast({
        title: '订阅模板待配置',
        icon: 'none'
      });
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds,
      success: async (res) => {
        console.log('订阅消息授权结果:', res);
        const openid = this.data.openid || auth.getOpenid();
        if (openid) {
          const agreedTemplateIds = tmplIds.filter(id => res[id] === 'accept');
          if (agreedTemplateIds.length > 0) {
            await post('/push/subscribe', { templateIds: agreedTemplateIds })
              .catch(err => console.error('保存订阅记录失败:', err));
          }
        }
        const rejectedTemplateIds = tmplIds.filter(id => ['reject', 'ban'].includes(res[id]));
        if (rejectedTemplateIds.length > 0) {
          try {
            await post('/push/subscribe', { templateIds: [], rejectedTemplateIds });
          } catch (err) {
            console.error('Unable to persist rejected subscription:', err);
          }
        }
        await this.syncSubscriptionStatus();
      },
      fail: (err) => {
        console.log('订阅消息授权失败:', err);
      }
    });
  },

  async sendTestNotification() {
    const loggedIn = await this.ensureLogin();
    if (!loggedIn) return;

    wx.showLoading({ title: '发送中...' });

    try {
      const res = await post('/push/test', {
        title: '正一领骑 通知测试',
        content: '如果您看到这条消息，说明推送功能正常工作。'
      });

      wx.hideLoading();

      if (res && res.code === 200) {
        wx.showToast({
          title: res.data && res.data.sent ? '测试推送已发送' : '推送已记录',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: (res && res.message) || '发送失败',
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
