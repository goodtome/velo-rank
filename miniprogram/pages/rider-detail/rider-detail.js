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
    results: [],
    loading: true,
    loadError: false,
    resultsLoading: false
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
        // 计算状态文本
        const statusText = res.data.is_retired ? '已退役' : '现役';
        
        this.setData({ 
          rider: res.data, 
          statusText: statusText,
          loading: false 
        });
        // 加载车手成绩
        this.loadRiderResults();
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
   * 加载车手历史成绩
   */
  async loadRiderResults() {
    this.setData({ resultsLoading: true });
    
    try {
      const res = await get(`/riders/${this.data.riderId}/results?limit=20`);
      
      if (res && res.code === 200) {
        this.setData({ 
          results: res.data || [],
          resultsLoading: false 
        });
      } else {
        this.setData({ resultsLoading: false });
      }
    } catch (err) {
      console.error('加载车手成绩失败:', err);
      this.setData({ resultsLoading: false });
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
