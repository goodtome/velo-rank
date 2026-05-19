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
    type: 'stage',
    currentPage: 1,
    pageSize: 30,
    hasMore: false
  },

  onLoad(options) {
    const { stageId = '', raceId = '', stageNumber = 0, type = 'stage' } = options || {};
    
    this.setData({
      stageId,
      raceId,
      stageNumber: parseInt(stageNumber) || 0,
      type
    });

    if (type === 'gc') {
      wx.setNavigationBarTitle({ title: '总成绩榜 (GC)' });
      this.loadGCResults();
    } else {
      wx.setNavigationBarTitle({ title: `第 ${stageNumber} 赛段成绩` });
      this.loadStageResults();
    }
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
        this.setData({ stage: stageRes.data });
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
      // 优先用赛事最新领骑衫（数据更全）
      let jerseysRes;
      if (raceId) {
        jerseysRes = await get(`/races/${raceId}/latest-jerseys`);
      }
      
      // 如果赛事领骑衫为空，尝试赛段领骑衫
      let jerseys = [];
      if (jerseysRes && jerseysRes.code === 200 && Array.isArray(jerseysRes.data) && jerseysRes.data.length > 0) {
        jerseys = jerseysRes.data;
      } else {
        const stageJerseysRes = await get(`/stages/${stageId}/jerseys`);
        if (stageJerseysRes && stageJerseysRes.code === 200 && Array.isArray(stageJerseysRes.data)) {
          jerseys = stageJerseysRes.data;
        }
      }

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

      this.setData({ 
        results,
        loading: false 
      });
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
    const { type } = this.data;
    if (type === 'gc') {
      this.loadGCResults();
    } else {
      this.loadStageResults();
    }
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
    const { type } = this.data;
    
    const loadPromise = type === 'gc' 
      ? this.loadGCResults() 
      : this.loadStageResults();

    loadPromise.then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
