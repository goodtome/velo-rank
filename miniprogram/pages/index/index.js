/**
 * 首页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError, formatDate } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');

Page({
  data: {
    currentSeason: 2026,
    activeRaces: [],
    upcomingRaces: [],
    loading: true,
    loadError: false
  },

  onLoad() {
    this.initI18n();
    this.loadRaces();
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
  async loadRaces() {
    this.setData({ loading: true, loadError: false });

    try {
      const res = await get('/races', {
        season: this.data.currentSeason,
        limit: 50
      });

      if (res && res.code === 200 && Array.isArray(res.data)) {
        // 使用本地时间（修复UTC时间Bug）
        const now = formatDate(new Date());
        const active = [];
        const upcoming = [];

        res.data.forEach(race => {
          if (race.start_date && race.start_date <= now && race.end_date >= now) {
            active.push(race);
          } else if (race.start_date && race.start_date > now) {
            upcoming.push(race);
          } else {
            // 已结束的比赛也放在活跃列表
            active.push(race);
          }
        });

        this.setData({
          activeRaces: active,
          upcomingRaces: upcoming,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('加载赛事失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
    }
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadRaces();
  },

  /**
   * 点击赛事卡片
   */
  onRaceTap(e) {
    const { raceId } = e.currentTarget.dataset;
    if (!raceId) return;

    wx.navigateTo({
      url: `/pages/race-detail/race-detail?id=${raceId}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadRaces().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
