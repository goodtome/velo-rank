/**
 * 赛事详情页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError, showSuccess } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');

Page({
  data: {
    raceId: '',
    race: null,
    stages: [],
    loading: true,
    loadError: false
  },

  onLoad(options) {
    const { id } = options || {};
    if (!id) {
      showError(t('missingRaceId', getLocale()));
      return;
    }
    
    this.initI18n();
    this.setData({ raceId: id });
    this.loadData();
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
   * 加载赛事数据
   */
  async loadData() {
    this.setData({ loading: true, loadError: false });

    try {
      const res = await get(`/races/${this.data.raceId}`);
      
      if (res && res.code === 200 && res.data) {
        this.setData({ race: res.data });
        await this.loadStages();
      } else {
        this.setData({ loading: false });
        showError(this.t('raceNotFound'));
      }
    } catch (err) {
      console.error('加载赛事失败:', err);
      this.setData({ loading: false, loadError: true });
      showError(this.t('errorNetwork'));
    }
  },

  /**
   * 加载赛段列表
   */
  async loadStages() {
    try {
      const res = await get(`/races/${this.data.raceId}/stages`);
      
      if (res && res.code === 200 && Array.isArray(res.data)) {
        this.setData({
          stages: res.data,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('加载赛段失败:', err);
      this.setData({ loading: false, loadError: true });
      showError(this.t('errorNetwork'));
    }
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadData();
  },

  /**
   * 点击赛段卡片
   */
  onStageTap(e) {
    const { stageId, stageNumber } = e.currentTarget.dataset;
    const { raceId } = this.data;

    if (!stageId) {
      showError(this.t('dataError'));
      return;
    }

    wx.navigateTo({
      url: `/pages/stage-results/stage-results?stageId=${stageId}&stageNumber=${stageNumber}&raceId=${raceId}`
    });
  },

  /**
   * 点击总成绩榜(GC)
   */
  onGCTap() {
    const { raceId } = this.data;
    wx.navigateTo({
      url: `/pages/stage-results/stage-results?type=gc&raceId=${raceId}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
