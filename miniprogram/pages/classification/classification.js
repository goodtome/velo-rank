/**
 * 分类榜页面 — 冲刺积分 / 爬坡积分 / 青年车手
 * 通过 type 参数复用：points | mountains | youth
 * 支持环意/环法/环西不同赛事的领骑衫配色
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { detectRaceType, getClassificationConfig } = require('../../utils/jersey-config');
const { stageTypeName } = require('../../utils/stage-type');
const dataCache = require('../../utils/cache');
const { CACHE } = require('../../utils/constants');

Page({
  data: {
    stageId: '',
    raceId: '',
    raceCode: '',
    type: 'points',
    stage: null,
    results: [],
    loading: true,
    loadError: false,
    loadingMore: false,
    errorMessage: '',
    currentPage: 1,
    pageSize: 20,
    hasMore: false,
    cacheNotice: '',

    // 类型配置（会在 onLoad 中根据赛事动态设置）
    typeName: {
      points: '冲刺积分榜',
      mountains: '爬坡积分榜',
      youth: '青年车手榜'
    },
    typeSub: {
      points: '按冲刺积分排名',
      mountains: '按爬坡积分排名',
      youth: '青年车手总成绩排名'
    },
    typeIcon: {
      points: '🟣',
      mountains: '🔵',
      youth: '⚪'
    },
    headerClasses: {
      points: 'class-points',
      mountains: 'class-mountains',
      youth: 'class-youth'
    }
  },

  onLoad(options) {
    const { stageId = '', raceId = '', type = 'points', raceCode = '' } = options || {};

    this.setData({
      stageId,
      raceId,
      raceCode,
      type
    });

    // 根据赛事类型动态设置分类榜配置
    const raceType = detectRaceType(raceCode);
    if (raceType !== 'unknown') {
      const types = ['points', 'mountains', 'youth'];
      const typeName = {};
      const typeSub = {};
      const typeIcon = {};
      const headerClasses = {};
      types.forEach(t => {
        const config = getClassificationConfig(t, raceType);
        typeName[t] = config.typeName;
        typeSub[t] = config.typeSub;
        typeIcon[t] = config.typeIcon;
        headerClasses[t] = config.headerClass || `class-${t}`;
      });
      this.setData({ typeName, typeSub, typeIcon, headerClasses });
    }

    // 设置导航栏标题
    const titles = this.data.typeName;
    wx.setNavigationBarTitle({ title: titles[type] || '分类榜' });

    this.loadData();
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  },

  stageTypeName(type) {
    return stageTypeName(type);
  },

  /**
   * 加载分类数据（首页）
   */
  async loadData() {
    this.setData({ loading: true, loadError: false, currentPage: 1 });

    const { stageId, type, pageSize } = this.data;
    this._prefetchedPage = null;
    const cacheKey = dataCache.makeKey('classification', { stageId, type, page: 1 });
    const cached = dataCache.get(cacheKey, { ttl: CACHE.CLASSIFICATION_TTL, allowStale: true });
    if (cached) {
      this.setData({
        stage: cached.data.stage,
        results: cached.data.results || [],
        hasMore: !!cached.data.hasMore,
        loading: false,
        loadError: false,
        cacheNotice: `${cached.isExpired ? '离线浏览' : '缓存数据'} · 更新于 ${dataCache.formatCachedAt(cached.cachedAt)}`
      });
    }

    if (!stageId) {
      this.setData({ loading: false });
      showError('缺少赛段ID');
      return;
    }

    try {
      // 并行请求赛段信息和分类数据
      const [stageRes, classRes] = await Promise.all([
        get(`/stages/${stageId}`),
        get(`/stages/${stageId}/${type}`, { page: 1, limit: pageSize })
      ]);

      // 处理赛段信息
      if (stageRes && stageRes.code === 200 && stageRes.data) {
        const stage = stageRes.data;
        stage._date_fmt = this.formatDate(stage.date);
        stage._stage_type_zh = this.stageTypeName(stage.stage_type);
        this.setData({ stage });
      }

      // 处理分类数据（后端已确保 rank 字段和正确排序）
      let results = [];
      let hasMore = false;
      if (classRes && classRes.code === 200 && Array.isArray(classRes.data)) {
        results = classRes.data;
        const pagination = classRes.pagination || {};
        hasMore = pagination.pages ? pagination.page < pagination.pages : results.length >= pageSize;
      }

      this.setData({
        results,
        hasMore,
        loading: false,
        cacheNotice: ''
      });
      dataCache.set(cacheKey, { stage: this.data.stage, results, hasMore });
      this.prefetchNextPage();
    } catch (err) {
      console.error('加载分类数据失败:', err);
      const msg = formatErrorMessage(err);
      if (cached) {
        this.setData({ loading: false, cacheNotice: `离线浏览 · 数据更新于 ${dataCache.formatCachedAt(cached.cachedAt)}` });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: msg });
        showError(msg);
      }
    }
  },

  /**
   * 加载更多（触底分页）
   */
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;

    this.setData({ loadingMore: true });

    const { stageId, type, currentPage, pageSize, results } = this.data;
    const nextPage = currentPage + 1;

    try {
      const prefetched = this._prefetchedPage;
      const classRes = prefetched && prefetched.page === nextPage
        ? prefetched.response
        : await get(`/stages/${stageId}/${type}`, { page: nextPage, limit: pageSize });
      this._prefetchedPage = null;

      if (classRes && classRes.code === 200 && Array.isArray(classRes.data)) {
        const newResults = this.appendUniqueResults(results, classRes.data);
        const pagination = classRes.pagination || {};
        const hasMore = pagination.pages ? pagination.page < pagination.pages : classRes.data.length >= pageSize;

        this.setData({
          results: newResults,
          currentPage: nextPage,
          hasMore
        });
      }
    } catch (err) {
      console.error('加载更多失败:', err);
      wx.showToast({ title: formatErrorMessage(err), icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
      this.prefetchNextPage();
    }
  },

  appendUniqueResults(current, incoming) {
    const seen = new Set(current.map(item => item.rider_id || item.team_id || `${item.rank}:${item.rider_name || item.team_name || ''}`));
    return current.concat(incoming.filter(item => {
      const key = item.rider_id || item.team_id || `${item.rank}:${item.rider_name || item.team_name || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  },

  async prefetchNextPage() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    const nextPage = this.data.currentPage + 1;
    if (this._prefetchedPage && this._prefetchedPage.page === nextPage) return;
    try {
      const response = await get(`/stages/${this.data.stageId}/${this.data.type}`, {
        page: nextPage,
        limit: this.data.pageSize
      });
      if (response && response.code === 200 && Array.isArray(response.data)) {
        this._prefetchedPage = { page: nextPage, response };
      }
    } catch (error) {
      // Prefetch is opportunistic; the explicit load-more path remains available.
      console.warn('Prefetch classification page failed:', error);
    }
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadData();
  },

  /**
   * 跳转到车手详情
   */
  goToRider(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    navigateTo({
      url: `/pages/rider-detail/rider-detail?id=${id}`
    });
  },

  /**
   * 触底自动加载下一页
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
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
  },

  onShareAppMessage() {
    const typeNames = this.data.typeName || {};
    const typeName = typeNames[this.data.type] || '积分榜';
    return {
      title: `${typeName} - 正一领骑`,
      path: `/pages/classification/classification?stageId=${this.data.stageId}&raceId=${this.data.raceId}&type=${this.data.type}&raceCode=${encodeURIComponent(this.data.raceCode || '')}`
    };
  },

  onShareTimeline() {
    const typeNames = this.data.typeName || {};
    const typeName = typeNames[this.data.type] || '积分榜';
    return {
      title: `${typeName} - 正一领骑`,
      query: `stageId=${this.data.stageId}&raceId=${this.data.raceId}&type=${this.data.type}&raceCode=${encodeURIComponent(this.data.raceCode || '')}`
    };
  }
});
