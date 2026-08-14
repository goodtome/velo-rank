/**
 * 赛段成绩页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { jerseyTypeName, detectRaceType } = require('../../utils/jersey-config');
const { stageTypeFullName } = require('../../utils/stage-type');
const dataCache = require('../../utils/cache');
const { CACHE } = require('../../utils/constants');

const ADMIN_KEY_STORAGE = 'adminSyncKey';

Page({
  data: {
    stageId: '',
    raceId: '',
    stageNumber: 0,
    stage: null,
    results: [],
    jerseys: [],
    loading: true,
    loadError: false,
    loadingMore: false,
    errorMessage: '',
    type: 'stage', // stage, gc, team, points, mountains, youth
    currentPage: 1,
    pageSize: 20,
    hasMore: false,
    cacheNotice: '',
    raceCode: '',
    gcHeaderClass: '',
    stageResultKind: '',
    isAdminToolsVisible: false,
    gcTrend: {
      status: 'idle',
      chartWidth: 0,
      chartHeight: 300,
      maxGapLabel: '',
      message: '',
      selectedRiderId: '',
      riders: [],
      points: [],
      segments: [],
      raw: null
    },
    tabs: [
      { id: 'stage', name: '赛段' },
      { id: 'gc', name: '总成绩' },
      { id: 'team', name: '车队' },
      { id: 'points', name: '冲刺' },
      { id: 'mountains', name: '爬坡' },
      { id: 'youth', name: '青年' }
    ]
  },

  onLoad(options) {
    const { stageId = '', raceId = '', stageNumber = 0, type = 'stage' } = options || {};
    
    this.setData({
      stageId,
      raceId,
      stageNumber: parseInt(stageNumber) || 0,
      type
    });

    this.updateTitle();
    this.refreshAdminToolsVisibility();

    // 如果没有 stageId 但有 raceId，先获取最新赛段ID
    if (!stageId && raceId) {
      this.fetchLatestStageId().then(() => this.loadData());
    } else {
      this.loadData();
    }
  },

  onShow() {
    this.refreshAdminToolsVisibility();
  },

  refreshAdminToolsVisibility() {
    const adminKey = wx.getStorageSync(ADMIN_KEY_STORAGE) || '';
    this.setData({ isAdminToolsVisible: !!adminKey });
  },

  /**
   * 更新页面标题
   */
  updateTitle() {
    const { type, stageNumber } = this.data;
    let title = '成绩榜单';
    switch (type) {
      case 'gc': title = '总成绩榜 (GC)'; break;
      case 'team': title = '车队成绩排名'; break;
      case 'points': title = '冲刺积分排名'; break;
      case 'mountains': title = '爬坡积分排名'; break;
      case 'youth': title = '青年车手排名'; break;
      default: title = `第 ${stageNumber} 赛段成绩`;
    }
    wx.setNavigationBarTitle({ title });
  },

  /**
   * 统一加载数据入口
   */
  async loadData() {
    const { type } = this.data;
    switch (type) {
      case 'gc': return this.loadGCResults();
      case 'team': return this.loadTeamResults();
      case 'points': return this.loadPointsResults();
      case 'mountains': return this.loadMountainsResults();
      case 'youth': return this.loadYouthResults();
      default: return this.loadStageResults();
    }
  },

  /**
   * 切换标签页
   */
  switchTab(e) {
    const { id } = e.currentTarget.dataset;
    if (this.data.type === id) return;

    this.setData({ 
      type: id,
      results: [],
      loading: true,
      currentPage: 1,
      hasMore: false,
      stageResultKind: ''
    });
    this.updateTitle();

    // 确保有 stageId（从 GC 入口进来时可能缺失）
    if (!this.data.stageId && this.data.raceId) {
      this.fetchLatestStageId().then(() => this.loadData());
    } else {
      this.loadData();
    }
  },

  /**
   * 获取赛事最新赛段ID
   * 从 GC 入口进入时 stageId 为空，需要先获取
   */
  async fetchLatestStageId() {
    const { raceId } = this.data;
    try {
      const res = await get(`/races/${raceId}/stages`);
      if (res && res.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const latestStage = res.data[res.data.length - 1];
        this.setData({
          stageId: latestStage.id,
          stageNumber: latestStage.stage_number || this.data.stageNumber
        });
      }
    } catch (err) {
      console.error('获取赛段列表失败:', err);
    }
  },

  /**
   * 加载车队成绩排名
   */
  async loadTeamResults() {
    const { stageId, raceId, pageSize } = this.data;
    this.setData({ loading: true, loadError: false, currentPage: 1, errorMessage: '' });
    try {
      const url = raceId ? `/races/${raceId}/team-classification` : `/stages/${stageId}/team-classification`;
      const res = await get(url, { page: 1, limit: pageSize });
      if (res && res.code === 200) {
        const pagination = res.pagination || {};
        this.setData({
          results: res.data,
          hasMore: pagination.pages ? pagination.page < pagination.pages : false,
          loading: false
        });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: '服务器返回异常数据' });
      }
    } catch (err) {
      console.error('加载车队成绩失败:', err);
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
    }
  },

  /**
   * 加载冲刺积分排名
   */
  async loadPointsResults() {
    const { stageId, raceId, pageSize } = this.data;
    this.setData({ loading: true, loadError: false, currentPage: 1, errorMessage: '' });

    const url = raceId ? `/races/${raceId}/points` : `/stages/${stageId}/points`;
    const params = { page: 1, limit: pageSize };

    try {
      const res = await get(url, params);
      if (res && res.code === 200) {
        const pagination = res.pagination || {};
        this.setData({
          results: res.data,
          loading: false,
          hasMore: pagination.pages ? pagination.page < pagination.pages : res.data.length >= pageSize
        });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: '服务器返回异常数据' });
      }
    } catch (err) {
      console.error('加载冲刺积分失败:', err);
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
    }
  },

  /**
   * 加载爬坡积分排名
   */
  async loadMountainsResults() {
    const { stageId, raceId, pageSize } = this.data;
    this.setData({ loading: true, loadError: false, currentPage: 1, errorMessage: '' });

    const url = raceId ? `/races/${raceId}/kom` : `/stages/${stageId}/mountains`;
    const params = { page: 1, limit: pageSize };

    try {
      const res = await get(url, params);
      if (res && res.code === 200) {
        const pagination = res.pagination || {};
        this.setData({
          results: res.data,
          loading: false,
          hasMore: pagination.pages ? pagination.page < pagination.pages : res.data.length >= pageSize
        });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: '服务器返回异常数据' });
      }
    } catch (err) {
      console.error('加载爬坡积分失败:', err);
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
    }
  },

  /**
   * 加载青年车手排名
   */
  async loadYouthResults() {
    const { stageId, raceId, pageSize } = this.data;
    this.setData({ loading: true, loadError: false, currentPage: 1, errorMessage: '' });

    const url = raceId ? `/races/${raceId}/youth` : `/stages/${stageId}/youth`;
    const params = { page: 1, limit: pageSize };

    try {
      const res = await get(url, params);
      if (res && res.code === 200) {
        const pagination = res.pagination || {};
        this.setData({
          results: res.data,
          loading: false,
          hasMore: pagination.pages ? pagination.page < pagination.pages : res.data.length >= pageSize
        });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: '服务器返回异常数据' });
      }
    } catch (err) {
      console.error('加载青年车手排名失败:', err);
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
    }
  },

  /**
   * 格式化日期  YYYY-MM-DD
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `日期：${year}-${month}-${day}`;
  },

  /**
   * 赛段类型中文名
   */
  stageTypeName(type) {
    return stageTypeFullName(type);
  },

  /**
   * 将 GC 时间差转为秒
   */
  parseTimeGapToSeconds(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (!str) return null;

    const normalized = str.replace(/^\+/, '').trim();
    const specialTokens = ['S.T.', 'ST', 'DNF', 'DNS', 'OTL', 'DSQ', 'LAP', 'NC'];
    if (specialTokens.includes(normalized.toUpperCase())) return null;

    const parts = normalized.split(':').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0 || parts.length > 3) return null;
    if (!parts.every(part => /^\d+(?:\.\d+)?$/.test(part))) return null;

    let seconds = 0;
    if (parts.length === 3) {
      seconds = (parseFloat(parts[0]) * 3600) + (parseFloat(parts[1]) * 60) + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      seconds = (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
    } else {
      seconds = parseFloat(parts[0]);
    }

    return Number.isFinite(seconds) ? seconds : null;
  },

  /**
   * 格式化 GC 时间差文本
   */
  formatGapText(seconds) {
    if (!Number.isFinite(seconds)) return '';
    if (seconds <= 0) return '+0:00';

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `+${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `+${minutes}:${String(secs).padStart(2, '0')}`;
  },

  /**
   * 构建 GC 时间差走势图
   */
  buildGcTrend(payload, selectedRiderId = '', error = false) {
    const chartHeight = 300;
    const fallback = {
      status: error ? 'error' : 'empty',
      chartWidth: 0,
      chartHeight,
      maxGapLabel: '',
      message: error ? '走势数据暂时不可用，当前总成绩榜不受影响。' : '尚未积累足够的 GC 时间差数据。',
      selectedRiderId: '',
      riders: [],
      points: [],
      segments: [],
      raw: payload || null
    };

    if (!payload || !Array.isArray(payload.stages) || !Array.isArray(payload.riders)) {
      return fallback;
    }

    const stages = payload.stages
      .filter(stage => stage && stage.id)
      .slice()
      .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
    const riders = payload.riders
      .filter(rider => rider && rider.id)
      .slice(0, 10);

    if (stages.length < 2 || riders.length === 0) {
      return {
        ...fallback,
        status: payload.status === 'partial' ? 'partial' : 'empty',
        message: stages.length < 2 ? '至少需要两个已完成赛段，才能展示 GC 时间差走势。' : fallback.message
      };
    }

    const colorPalette = ['#1565c0', '#e65100', '#7b1fa2', '#00897b', '#c62828', '#6d4c41', '#546e7a', '#ad1457', '#2e7d32', '#5d4037'];
    const selectedId = riders.some(rider => rider.id === selectedRiderId)
      ? selectedRiderId
      : riders[0].id;
    const pointsByRider = new Map();
    let maxGap = 0;
    let validPointCount = 0;

    riders.forEach(rider => {
      const stageMap = new Map();
      (Array.isArray(rider.points) ? rider.points : []).forEach(point => {
        if (!point || !point.stageId) return;
        const parsedGap = Number(point.rank) === 1 ? 0 : this.parseTimeGapToSeconds(point.timeGap);
        const gapSeconds = Number.isFinite(parsedGap) ? Math.max(0, parsedGap) : null;
        if (gapSeconds !== null) {
          maxGap = Math.max(maxGap, gapSeconds);
          validPointCount += 1;
        }
        stageMap.set(point.stageId, {
          rank: point.rank,
          timeGap: point.timeGap,
          gapSeconds
        });
      });
      pointsByRider.set(rider.id, stageMap);
    });

    if (validPointCount < 2) {
      return {
        ...fallback,
        status: payload.status === 'partial' ? 'partial' : 'empty',
        message: '已获取 GC 数据，但有效时间差不足，暂不能绘制可靠走势。',
        riders: riders.map((rider, index) => ({
          id: rider.id,
          name: rider.name || `车手 ${index + 1}`,
          rank: rider.rank,
          color: colorPalette[index],
          selected: rider.id === selectedId
        }))
      };
    }

    const chartWidth = Math.max(640, stages.length * 118 + 80);
    const minY = 44;
    const maxY = chartHeight - 58;
    const chartPoints = [];
    const segments = [];
    const riderOptions = riders.map((rider, riderIndex) => ({
      id: rider.id,
      name: rider.name || `车手 ${riderIndex + 1}`,
      rank: rider.rank,
      color: colorPalette[riderIndex],
      selected: rider.id === selectedId
    }));

    riders.forEach((rider, riderIndex) => {
      const color = colorPalette[riderIndex];
      const stageMap = pointsByRider.get(rider.id) || new Map();
      let previous = null;

      stages.forEach((stage, stageIndex) => {
        const item = stageMap.get(stage.id);
        if (!item || item.gapSeconds === null) {
          previous = null;
          return;
        }

        const x = 40 + stageIndex * 118;
        const ratio = maxGap > 0 ? item.gapSeconds / maxGap : 0;
        const y = maxY - ratio * (maxY - minY);
        const isHighlighted = rider.id === selectedId;
        const point = {
          key: `${rider.id}-${stage.id}`,
          riderId: rider.id,
          stageId: stage.id,
          stageNumber: stage.number,
          riderName: rider.name || '',
          rank: item.rank,
          gapLabel: Number(item.rank) === 1 ? '+0:00' : (item.timeGap || this.formatGapText(item.gapSeconds)),
          isHighlighted,
          pointStyle: `left:${x}rpx;top:${y}rpx;`,
          dotStyle: `background:${color};opacity:${isHighlighted ? 1 : 0.42};`,
          labelStyle: `top:-42rpx;color:${color};`,
        };
        chartPoints.push(point);

        if (previous) {
          const dx = x - previous.x;
          const dy = y - previous.y;
          const length = Math.sqrt((dx * dx) + (dy * dy));
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          segments.push({
            key: `${rider.id}-${previous.stageId}-${stage.id}`,
            highlighted: isHighlighted,
            style: `left:${previous.x}rpx;top:${previous.y}rpx;width:${length}rpx;background:${color};opacity:${isHighlighted ? 0.88 : 0.22};transform:rotate(${angle}deg);`
          });
        }

        previous = { x, y, stageId: stage.id };
      });
    });

    return {
      status: payload.status === 'partial' ? 'partial' : 'ready',
      chartWidth,
      chartHeight,
      maxGapLabel: maxGap > 0 ? `最大差距 ${this.formatGapText(maxGap)}` : '全部同秒',
      message: payload.status === 'partial' ? '部分赛段或车手缺少 GC 数据，走势已在缺口处断开。' : '',
      selectedRiderId: selectedId,
      riders: riderOptions,
      points: chartPoints,
      segments,
      stages: stages.map((stage, index) => ({
        id: stage.id,
        number: stage.number,
        name: stage.name || '',
        style: `left:${40 + index * 118}rpx;`
      })),
      raw: payload
    };
  },

  /**
   * 赛段路线中文名（使用 stage_name_zh 字段）
   */
  stageRouteNameZh(stage) {
    if (!stage) return '';
    return stage.stage_name_zh || '';
  },

  /**
   * 赛段路线英文名
   */
  stageRouteNameEn(stage) {
    if (!stage) return '';
    const start = stage.start_city;
    const finish = stage.finish_city;
    if (start && finish) return `${start} → ${finish}`;
    return stage.stage_name || '';
  },

  /**
   * 合并中英文路线为一行
   * 格式：Nessebar (内塞伯尔) → Burgas (布尔加斯)
   */
  combineRoute(stage) {
    if (!stage) return '';
    const enStart = stage.start_city || '';
    const enFinish = stage.finish_city || '';
    const zhStart = stage.start_city_zh || '';
    const zhFinish = stage.finish_city_zh || '';

    // 如果没有英文城市名，回退到 stage_name
    if (!enStart && !enFinish) {
      return stage.stage_name_zh || stage.stage_name || '';
    }

    const startPart = zhStart ? `${enStart} (${zhStart})` : enStart;
    const finishPart = zhFinish ? `${enFinish} (${zhFinish})` : enFinish;

    return `${startPart} → ${finishPart}`;
  },

  /**
   * 领骑衫类型中文名（使用统一配置模块）
   */
  jerseyTypeName(type) {
    return jerseyTypeName(type);
  },

  /**
   * 加载赛段成绩
   */
  async loadStageResults() {
    this.setData({ loading: true, loadError: false, currentPage: 1, errorMessage: '' });

    const { stageId, pageSize } = this.data;
    const cacheKey = dataCache.makeKey('stage-results', { stageId, type: 'stage', page: 1 });
    const cached = dataCache.get(cacheKey, { ttl: CACHE.STAGE_RESULTS_TTL, allowStale: true });
    if (cached) {
      this.setData({
        stage: cached.data.stage || null,
        results: cached.data.results || [],
        hasMore: !!cached.data.hasMore,
        stageResultKind: cached.data.stageResultKind || '',
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
      // 并行请求赛段信息和成绩
      const [stageRes, resultsRes] = await Promise.all([
        get(`/stages/${stageId}`),
        get(`/stages/${stageId}/results`, { page: 1, limit: pageSize })
      ]);

      // 处理赛段信息
      if (stageRes && stageRes.code === 200 && stageRes.data) {
        const stage = stageRes.data;
        stage._stage_type_zh = this.stageTypeName(stage.stage_type);
        stage._date_formatted = this.formatDate(stage.date);
        stage._distance_formatted = stage.distance_km ? `距离：${parseFloat(stage.distance_km)}Km` : '';
        stage._route_en = this.stageRouteNameEn(stage);
        stage._route_zh = this.stageRouteNameZh(stage);
        stage._route_combined = this.combineRoute(stage);
        this.setData({ stage });
      }

      const isTeamTimeTrial = String((stageRes && stageRes.data && stageRes.data.stage_type) || '').trim().toLowerCase() === 'ttt';
      if (isTeamTimeTrial) {
        const teamUrl = this.data.raceId ? `/races/${this.data.raceId}/team-classification` : `/stages/${stageId}/team-classification`;
        const teamRes = await get(teamUrl, { page: 1, limit: pageSize });
        const teamResults = teamRes && teamRes.code === 200 && Array.isArray(teamRes.data) ? teamRes.data : [];
        const pagination = (teamRes && teamRes.pagination) || {};
        this.setData({
          results: teamResults,
          hasMore: pagination.pages ? pagination.page < pagination.pages : false,
          loading: false,
          stageResultKind: 'team',
          cacheNotice: ''
        });
        dataCache.set(cacheKey, {
          stage: this.data.stage,
          results: teamResults,
          hasMore: pagination.pages ? pagination.page < pagination.pages : false,
          stageResultKind: 'team'
        });
        return;
      }

      // 处理成绩数据
      let results = [];
      let hasMore = false;
      if (resultsRes && resultsRes.code === 200 && Array.isArray(resultsRes.data)) {
        results = resultsRes.data;
        const pagination = resultsRes.pagination || {};
        hasMore = pagination.pages ? pagination.page < pagination.pages : results.length >= pageSize;
      }

      this.setData({ results, hasMore, loading: false, cacheNotice: '' });
      dataCache.set(cacheKey, { stage: this.data.stage, results, hasMore, stageResultKind: '' });

      // 加载领骑衫信息（独立 try/catch，失败不影响已加载的成绩）
      try {
        await this.loadJerseys();
      } catch (jerseyErr) {
        console.warn('领骑衫加载失败（不影响成绩显示）:', jerseyErr);
      }
    } catch (err) {
      console.error('加载赛段成绩失败:', err);
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
   * 加载领骑衫信息
   */
  async loadJerseys() {
    const { stageId, raceId } = this.data;

    try {
      let jerseys = [];
      // 优先用 stageId 获取该赛段领骑衫，否则用赛事最新领骑衫
      if (stageId) {
        const stageJerseysRes = await get(`/stages/${stageId}/jerseys`);
        if (stageJerseysRes && stageJerseysRes.code === 200 && Array.isArray(stageJerseysRes.data)) {
          jerseys = stageJerseysRes.data;
        }
      } else if (raceId) {
        const raceJerseysRes = await get(`/races/${raceId}/latest-jerseys`);
        if (raceJerseysRes && raceJerseysRes.code === 200 && Array.isArray(raceJerseysRes.data)) {
          jerseys = raceJerseysRes.data;
        }
      }

      jerseys = jerseys.map(j => ({
        ...j,
        _jersey_type_zh: this.jerseyTypeName(j.jersey_type)
      }));

      this.setData({
        jerseys,
        loading: false
      });
    } catch (err) {
      console.error('加载领骑衫失败:', err);
      // 领骑衫加载失败不影响主数据显示，只设置 jerseys 为空
      this.setData({ jerseys: [] });
    }
  },

  /**
   * 加载总成绩榜(GC)
   */
  async loadGCResults() {
    this.setData({ loading: true, loadError: false, currentPage: 1, errorMessage: '' });

    const { raceId, pageSize } = this.data;
    const cacheKey = dataCache.makeKey('stage-results', { raceId, type: 'gc', page: 1 });
    const cached = dataCache.get(cacheKey, { ttl: CACHE.STAGE_RESULTS_TTL, allowStale: true });
    if (cached) {
      const cachedResults = cached.data.results || [];
      const cachedTrend = this.buildGcTrend(cached.data.gcTrendData || null);
      this.setData({
        results: cachedResults,
        raceCode: cached.data.raceCode || this.data.raceCode,
        gcHeaderClass: cached.data.gcHeaderClass || '',
        hasMore: !!cached.data.hasMore,
        gcTrend: cachedTrend,
        loading: false,
        loadError: false,
        cacheNotice: `${cached.isExpired ? '离线浏览' : '缓存数据'} · 更新于 ${dataCache.formatCachedAt(cached.cachedAt)}`
      });
    }

    if (!raceId) {
      this.setData({ loading: false });
      showError('缺少赛事ID');
      return;
    }

    try {
      // 并行加载 GC 成绩和赛事信息（用于领骑衫配色）
      const [res, raceRes, trendRes] = await Promise.all([
        get(`/races/${raceId}/gc`, { page: 1, limit: pageSize }),
        get(`/races/${raceId}`),
        get(`/races/${raceId}/visualization/gc-trend`, { limit: 5 }).catch(err => ({ trendError: err }))
      ]);

      // 根据赛事类型设置 GC header 配色
      if (raceRes && raceRes.code === 200 && raceRes.data) {
        const raceCode = raceRes.data.race_code || '';
        const raceType = detectRaceType(raceCode);
        const classMap = { tdf: 'gc-tdf', giro: 'gc-giro', vuelta: 'gc-vuelta' };
        this.setData({
          raceCode,
          gcHeaderClass: classMap[raceType] || ''
        });
      }

      let results = [];
      let hasMore = false;
      if (res && res.code === 200 && Array.isArray(res.data)) {
        results = res.data;
        const pagination = res.pagination || {};
        hasMore = pagination.pages ? pagination.page < pagination.pages : results.length >= pageSize;
      }

      const gcTrend = trendRes && trendRes.code === 200
        ? this.buildGcTrend(trendRes.data)
        : this.buildGcTrend(null, '', true);
      this.setData({ results, hasMore, loading: false, gcTrend, cacheNotice: '' });
      dataCache.set(cacheKey, {
        results,
        hasMore,
        raceCode: this.data.raceCode,
        gcHeaderClass: this.data.gcHeaderClass,
        gcTrendData: trendRes && trendRes.code === 200 ? trendRes.data : null
      });

      // GC页面也显示领骑衫（独立 try/catch，失败不影响已加载的成绩）
      try {
        await this.loadJerseys();
      } catch (jerseyErr) {
        console.warn('领骑衫加载失败（不影响成绩显示）:', jerseyErr);
      }
    } catch (err) {
      console.error('加载总成绩榜失败:', err);
      if (cached) {
        this.setData({ loading: false, cacheNotice: `离线浏览 · 数据更新于 ${dataCache.formatCachedAt(cached.cachedAt)}` });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
        showError(formatErrorMessage(err));
      }
    }
  },

  /**
   * 加载更多（触底分页）
   */
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;

    this.setData({ loadingMore: true });

    const { type, stageId, raceId, currentPage, pageSize, results } = this.data;
    const nextPage = currentPage + 1;

    try {
      let url = '';
      const params = { page: nextPage, limit: pageSize };

      switch (type) {
        case 'stage':
          url = `/stages/${stageId}/results`;
          break;
        case 'gc':
          url = raceId ? `/races/${raceId}/gc` : `/stages/${stageId}/general-classification`;
          break;
        case 'team':
          url = raceId ? `/races/${raceId}/team-classification` : `/stages/${stageId}/team-classification`;
          break;
        case 'points':
          url = raceId ? `/races/${raceId}/points` : `/stages/${stageId}/points`;
          break;
        case 'mountains':
          url = raceId ? `/races/${raceId}/kom` : `/stages/${stageId}/mountains`;
          break;
        case 'youth':
          url = raceId ? `/races/${raceId}/youth` : `/stages/${stageId}/youth`;
          break;
        default:
          return;
      }

      const res = await get(url, params);

      if (res && res.code === 200 && Array.isArray(res.data)) {
        const newResults = this.appendUniqueResults(results, res.data);
        const pagination = res.pagination || {};
        const hasMore = pagination.pages ? pagination.page < pagination.pages : res.data.length >= pageSize;
        const gcTrend = this.data.gcTrend;

        this.setData({
          results: newResults,
          currentPage: nextPage,
          hasMore,
          gcTrend
        });
      }
    } catch (err) {
      console.error('加载更多失败:', err);
      wx.showToast({ title: formatErrorMessage(err), icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
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

  selectGcTrendRider(e) {
    const riderId = e.currentTarget.dataset.id;
    const currentTrend = this.data.gcTrend || {};
    if (!riderId || riderId === currentTrend.selectedRiderId || !currentTrend.raw) return;

    this.setData({
      gcTrend: this.buildGcTrend(currentTrend.raw, riderId)
    });
  },

  goToGcTrendStage(e) {
    const { stageId, stageNumber } = e.currentTarget.dataset;
    if (!stageId) return;

    navigateTo({
      url: `/pages/stage-results/stage-results?stageId=${stageId}&raceId=${this.data.raceId}&stageNumber=${stageNumber || 0}&type=stage`
    });
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
    const stage = this.data.stage || {};
    const stageName = stage.stage_name || `第${this.data.stageNumber}赛段`;
    return {
      title: `${stageName} - 正一领骑`,
      path: `/pages/stage-results/stage-results?stageId=${this.data.stageId}&raceId=${this.data.raceId}&stageNumber=${this.data.stageNumber}`
    };
  },

  onShareTimeline() {
    const stage = this.data.stage || {};
    const stageName = stage.stage_name || `第${this.data.stageNumber}赛段`;
    return {
      title: `${stageName} - 正一领骑`,
      query: `stageId=${this.data.stageId}&raceId=${this.data.raceId}&stageNumber=${this.data.stageNumber}`
    };
  }
});
