/**
 * 个人中心页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get, del, formatErrorMessage } = require('../../utils/request');
const { showSuccess, navigateTo } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');

Page({
  data: {
    showAbout: false,
    raceCount: '--',
    riderCount: '--',
    teamCount: '--',
    loadError: false,
    errorMessage: ''
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
    this.setData({ loadError: false, errorMessage: '' });
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
      console.error('加载统计数据失败:', err);
      this.setData({
        loadError: true,
        errorMessage: formatErrorMessage(err)
      });
    }
  },

  /**
   * 重试加载统计数据
   */
  retryLoad() {
    this.loadCounts();
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
    navigateTo({
      url: '/pages/race-calendar/race-calendar'
    });
  },

  /**
   * 跳转到推送设置页
   */
  goToPushSettings() {
    navigateTo({
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
   * 跳转到赛事百科
   */
  goToEncyclopedia() {
    wx.switchTab({
      url: '/pages/encyclopedia/encyclopedia'
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
   * 跳转隐私政策
   */
  goToPrivacyPolicy() {
    navigateTo({ url: '/pages/privacy-policy/privacy-policy' });
  },

  /**
   * 跳转用户协议
   */
  goToUserAgreement() {
    navigateTo({ url: '/pages/user-agreement/user-agreement' });
  },

  /**
   * 注销账号
   */
  deleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '确定要注销账号吗？注销后，您的收藏、推送偏好等所有数据将被永久删除且无法恢复。',
      confirmText: '确认注销',
      confirmColor: '#e74c3c',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;

        // 二次确认
        wx.showModal({
          title: '再次确认',
          content: '此操作不可撤销，真的要删除您的全部数据吗？',
          confirmText: '确定删除',
          confirmColor: '#e74c3c',
          success: async (res2) => {
            if (!res2.confirm) return;

            try {
              const res = await del('/auth/account');
              if (res && res.code === 200) {
                wx.clearStorageSync();
                wx.showToast({ title: '账号已注销', icon: 'success', duration: 1500 });
                // 返回首页
                setTimeout(() => {
                  wx.switchTab({ url: '/pages/index/index' });
                }, 1500);
              }
            } catch (err) {
              wx.showToast({ title: '注销失败，请稍后重试', icon: 'none' });
              console.error('注销账号失败:', err);
            }
          }
        });
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
  },

  onShareAppMessage() {
    return {
      title: '个人中心 - 正一领骑',
      path: '/pages/profile/profile'
    };
  },

  onShareTimeline() {
    return {
      title: '个人中心 - 正一领骑'
    };
  }
});
