/**
 * 车手详情页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');

Page({
  data: {
    riderId: '',
    rider: null,
    loading: true,
    loadError: false
  },

  onLoad(options) {
    const { id } = options || {};
    
    if (!id) {
      this.setData({ loading: false, loadError: true });
      showError(t('missingRiderId', getLocale()));
      return;
    }
    
    this.initI18n();
    this.setData({ riderId: id });
    this.loadRiderDetail();
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
   * 加载车手详情
   */
  async loadRiderDetail() {
    this.setData({ loading: true, loadError: false });

    try {
      const res = await get(`/riders/${this.data.riderId}`);
      
      if (res && res.code === 200 && res.data) {
        this.setData({ 
          rider: res.data, 
          loading: false 
        });
      } else {
        this.setData({ 
          rider: null, 
          loading: false 
        });
        showError(this.t('riderNotFound'));
      }
    } catch (err) {
      console.error('加载车手详情失败:', err);
      this.setData({ loading: false, loadError: true });
      showError(this.t('errorNetwork'));
    }
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.setData({ loadError: false, loading: true });
    this.loadRiderDetail();
  },

  /**
   * 跳转到车队详情
   */
  goToTeam(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({ 
      url: `/pages/team-detail/team-detail?id=${id}` 
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadRiderDetail().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
