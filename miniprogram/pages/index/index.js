/**
 * 首页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');

Page({
  data: {
    currentSeason: 2026,
    activeRaces: [],
    recentRaces: [],
    loading: true,
    loadError: false
  },

  onLoad() {
    // 先展示缓存数据（如有），再后台刷新
    this.loadCache();
    this.loadRaces();
  },

  /**
   * 读取本地缓存，快速首屏展示
   * 缓存有效期 30 分钟，过期则不展示但仍可用作兜底
   */
  loadCache() {
    try {
      const cached = wx.getStorageSync('home_races_cache');
      if (cached && cached.activeRaces) {
        const age = Date.now() - (cached.timestamp || 0);
        const isFresh = age < 30 * 60 * 1000; // 30 分钟
        this.setData({
          activeRaces: cached.activeRaces,
          recentRaces: cached.recentRaces || [],
          loading: !isFresh // 过期数据仍展示但保留 loading 状态
        });
      }
    } catch (e) { /* ignore cache read errors */ }
  },

  /**
   * 保存数据到本地缓存
   */
  saveCache(activeRaces, recentRaces) {
    try {
      wx.setStorageSync('home_races_cache', {
        activeRaces,
        recentRaces,
        timestamp: Date.now()
      });
    } catch (e) { /* ignore cache write errors */ }
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
      this.saveCache(activeRaces, recentRaces);
    } catch (err) {
      console.error('加载赛事失败:', err);
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
      showError(formatErrorMessage(err));
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

    navigateTo({
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
