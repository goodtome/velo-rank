/**
 * 赛段成绩页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');

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
    type: 'stage', // stage, gc, team, points, mountains, youth
    currentPage: 1,
    pageSize: 30,
    hasMore: false,
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

    // 如果没有 stageId 但有 raceId，先获取最新赛段ID
    if (!stageId && raceId) {
      this.fetchLatestStageId().then(() => this.loadData());
    } else {
      this.loadData();
    }
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
      loading: true 
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
    const { stageId } = this.data;
    this.setData({ loading: true, loadError: false });
    try {
      const res = await get(`/stages/${stageId}/team-classification`);
      if (res && res.code === 200) {
        this.setData({ 
          results: res.data,
          loading: false 
        });
      }
    } catch (err) {
      console.error('加载车队成绩失败:', err);
      this.setData({ loading: false, loadError: true });
    }
  },

  /**
   * 加载冲刺积分排名
   */
  async loadPointsResults() {
    const { stageId, raceId } = this.data;
    this.setData({ loading: true, loadError: false });

    // 优先用 raceId 查赛事累计，否则用 stageId 查赛段数据
    const url = raceId ? `/races/${raceId}/points` : `/stages/${stageId}/points`;

    try {
      const res = await get(url);
      if (res && res.code === 200) {
        this.setData({
          results: res.data,
          loading: false
        });
      }
    } catch (err) {
      console.error('加载冲刺积分失败:', err);
      this.setData({ loading: false, loadError: true });
    }
  },

  /**
   * 加载爬坡积分排名
   */
  async loadMountainsResults() {
    const { stageId, raceId } = this.data;
    this.setData({ loading: true, loadError: false });

    // 优先用 raceId 查赛事累计，否则用 stageId 查赛段数据
    const url = raceId ? `/races/${raceId}/kom` : `/stages/${stageId}/mountains`;

    try {
      const res = await get(url);
      if (res && res.code === 200) {
        this.setData({
          results: res.data,
          loading: false
        });
      }
    } catch (err) {
      console.error('加载爬坡积分失败:', err);
      this.setData({ loading: false, loadError: true });
    }
  },

  /**
   * 加载青年车手排名
   */
  async loadYouthResults() {
    const { stageId, raceId } = this.data;
    this.setData({ loading: true, loadError: false });

    // 优先用 raceId 查赛事累计，否则用 stageId 查赛段数据
    const url = raceId ? `/races/${raceId}/youth` : `/stages/${stageId}/youth`;

    try {
      const res = await get(url);
      if (res && res.code === 200) {
        this.setData({
          results: res.data,
          loading: false
        });
      }
    } catch (err) {
      console.error('加载青年车手排名失败:', err);
      this.setData({ loading: false, loadError: true });
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
    const map = {
      'Flat': '平路赛段',
      'Hills': '丘陵赛段',
      'Mountain': '山地赛段',
      'TTT': '团队计时赛',
      'ITT': '个人计时赛'
    };
    return map[type] || type;
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
   * 领骑衫类型中文名
   */
  jerseyTypeName(type) {
    const map = {
      'pink': '粉衫 GC',
      'PINK': '粉衫 GC',
      'purple': '紫衫 积分',
      'PURPLE': '紫衫 积分',
      'blue': '蓝衫 冲刺',
      'BLUE': '蓝衫 冲刺',
      'BLUE_SPRINT': '蓝衫 冲刺',
      'white': '白衫 青年',
      'WHITE': '白衫 青年',
      'WHITE_YOUTH': '白衫 青年'
    };
    return map[type] || type;
  },

  /**
   * 加载赛段成绩
   */
  async loadStageResults() {
    this.setData({ loading: true, loadError: false });

    const { stageId } = this.data;

    if (!stageId) {
      this.setData({ loading: false });
      showError('缺少赛段ID');
      return;
    }

    try {
      // 并行请求赛段信息和成绩
      const [stageRes, resultsRes] = await Promise.all([
        get(`/stages/${stageId}`),
        get(`/stages/${stageId}/results`, { limit: 100 })
      ]);

      // 处理赛段信息
      if (stageRes && stageRes.code === 200 && stageRes.data) {
        const stage = stageRes.data;
        // 预处理：WXML 不支持调用 JS 方法，提前计算好显示字段
        stage._stage_type_zh = this.stageTypeName(stage.stage_type);
        stage._date_formatted = this.formatDate(stage.date);
        stage._distance_formatted = stage.distance_km ? `距离：${parseFloat(stage.distance_km)}Km` : '';
        stage._route_en = this.stageRouteNameEn(stage);
        stage._route_zh = this.stageRouteNameZh(stage);
        stage._route_combined = this.combineRoute(stage);
        this.setData({ stage });
      }

      // 处理成绩数据
      let results = [];
      if (resultsRes && resultsRes.code === 200 && Array.isArray(resultsRes.data)) {
        results = resultsRes.data;
      }

      this.setData({ 
        results,
        hasMore: results.length >= 100 
      });

      // 加载领骑衫信息
      await this.loadJerseys();
    } catch (err) {
      console.error('加载赛段成绩失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
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
      this.setData({ loading: false, loadError: true });
    }
  },

  /**
   * 加载总成绩榜(GC)
   */
  async loadGCResults() {
    this.setData({ loading: true, loadError: false });

    const { raceId } = this.data;

    if (!raceId) {
      this.setData({ loading: false });
      showError('缺少赛事ID');
      return;
    }

    try {
      const res = await get(`/races/${raceId}/gc`);
      
      let results = [];
      if (res && res.code === 200 && Array.isArray(res.data)) {
        results = res.data;
      }

      this.setData({ results });

      // GC页面也显示领骑衫
      await this.loadJerseys();
    } catch (err) {
      console.error('加载总成绩榜失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
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

    wx.navigateTo({ 
      url: `/pages/rider-detail/rider-detail?id=${id}` 
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
