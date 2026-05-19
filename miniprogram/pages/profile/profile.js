/**
 * 个人中心页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showSuccess } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');

Page({
  data: {
    showAbout: false,
    raceCount: '--',
    riderCount: '--',
    teamCount: '--'
  },

  onLoad() {
    this.initI18n();
    this.loadCounts();
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

  /**
   * 加载统计数据
   */
  async loadCounts() {
    try {
      const res = await get('/races/stats/overview');
      
      if (res && res.code === 200 && res.data) {
        const { races = '--', riders = '--', teams = '--' } = res.data;
        
        this.setData({
          raceCount: races,
          riderCount: riders,
          teamCount: teams
        });
      }
    } catch (err) {
      // 静默失败，保持 -- 显示
      console.error('加载统计数据失败:', err);
    }
  },

  /**
   * 跳转到搜索页
   */
  goToSearch() {
    wx.switchTab({ 
      url: '/pages/search/search' 
    });
  },

  /**
   * 跳转到赛事日历页
   */
  goToCalendar() {
    wx.navigateTo({
      url: '/pages/race-calendar/race-calendar'
    });
  },

  /**
   * 跳转到推送设置页
   */
  goToPushSettings() {
    wx.navigateTo({
      url: '/pages/push-settings/push-settings'
    });
  },

  /**
   * 跳转到首页
   */
  goToHome() {
    wx.switchTab({ 
      url: '/pages/index/index' 
    });
  },

  /**
   * 清除缓存
   */
  clearCache() {
    const self = this;
    wx.showModal({
      title: self.t('tips'),
      content: self.t('confirmClearCache'),
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          showSuccess(self.t('cacheCleared'));
        }
      }
    });
  },

  /**
   * 切换关于信息显示
   */
  toggleAbout() {
    this.setData({ 
      showAbout: !this.data.showAbout 
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadCounts().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
