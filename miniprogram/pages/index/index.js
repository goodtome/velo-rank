/**
 * 首页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');

Page({
  data: {
    currentSeason: 2026,
    activeRaces: [],
    recentRaces: [],
    loading: true,
    loadError: false
  },

  onLoad() {
    this.loadRaces();
  },

  /**
   * 加载赛事数据 — 并行请求进行中+近期赛事
   */
  async loadRaces() {
    this.setData({ loading: true, loadError: false });

    try {
      const [activeRes, recentRes] = await Promise.all([
        get('/races/active'),
        get('/races/recent', { limit: 5 })
      ]);

      let activeRaces = [];
      let recentRaces = [];

      // 处理进行中赛事
      if (activeRes && activeRes.code === 200 && Array.isArray(activeRes.data)) {
        activeRaces = activeRes.data.map(race => ({
          ...race,
          start_date: this.formatDate(race.start_date),
          end_date: this.formatDate(race.end_date)
        }));
      }

      // 处理近期完赛
      if (recentRes && recentRes.code === 200 && Array.isArray(recentRes.data)) {
        recentRaces = recentRes.data.map(race => ({
          ...race,
          start_date: this.formatDate(race.start_date),
          end_date: this.formatDate(race.end_date)
        }));
      }

      // 如果没有进行中赛事，用全部赛事兜底
      if (activeRaces.length === 0 && recentRaces.length === 0) {
        const allRes = await get('/races', { season: this.data.currentSeason, limit: 20 });
        if (allRes && allRes.code === 200 && Array.isArray(allRes.data)) {
          recentRaces = allRes.data.map(race => ({
            ...race,
            start_date: this.formatDate(race.start_date),
            end_date: this.formatDate(race.end_date)
          }));
        }
      }

      this.setData({
        activeRaces,
        recentRaces,
        loading: false
      });
    } catch (err) {
      console.error('加载赛事失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
    }
  },

  /**
   * 格式化日期 YYYY-MM-DD
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  },

  onShareAppMessage() {
    return {
      title: '正一领骑 - 自行车赛事数据',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: '正一领骑 - 自行车赛事数据'
    };
  }
});
