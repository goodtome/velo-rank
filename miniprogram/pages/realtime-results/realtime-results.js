/**
 * 实时成绩追踪页面逻辑
 * 支持GC排名、赛段成绩、冲刺/爬坡积分、青年排名的实时显示
 * 使用WebSocket或轮询实现实时更新
 */

const { get, post } = require('../../utils/request');
const { navigateTo } = require('../../utils/util');

Page({
  data: {
    // 赛事信息
    raceName: '',
    stageNumber: 0,
    stageType: '',
    raceStatus: 'upcoming',
    raceStatusText: '等待比赛',

    // 标签切换
    activeTab: 'gc',

    // 排名数据
    gcRankings: [],
    stageResults: [],
    pointsRankings: [],
    mountainsRankings: [],
    youthRankings: [],

    // 加载状态
    loading: true,
    loadError: false,
    errorMessage: '',

    // 连接状态
    connectionStatus: 'disconnected',
    lastUpdate: '',
    isRefreshing: false,

    // 内部
    raceId: '',
    stageId: '',
    pollTimer: null,
    socketTask: null
  },

  onLoad(options) {
    const { raceId = '', stageId = '', raceName = '' } = options || {};
    this.setData({ raceId, stageId, raceName });

    if (raceName) {
      wx.setNavigationBarTitle({ title: raceName });
    }

    if (!raceId && !stageId) {
      this.setData({ loading: false, loadError: true, errorMessage: '缺少赛事参数' });
      return;
    }

    this.loadInitialData();
    this.startRealTimeUpdate();
  },

  onUnload() {
    this.stopRealTimeUpdate();
    if (this.data.socketTask) {
      try { this.data.socketTask.close(); } catch (e) { /* ignore */ }
    }
  },

  /**
   * 加载初始数据
   */
  loadInitialData() {
    this.setData({ loading: true, loadError: false, errorMessage: '' });
    this.fetchRankings('gc');
  },

  /**
   * 切换标签
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;

    this.setData({ activeTab: tab });
    this.fetchRankings(tab);
  },

  /**
   * 获取排名数据
   */
  fetchRankings(tab) {
    const { stageId, raceId } = this.data;
    if (!stageId && !raceId) return;

    const urlMap = {
      gc: raceId ? `/races/${raceId}/gc` : (stageId ? `/stages/${stageId}/general-classification` : ''),
      stage: stageId ? `/stages/${stageId}/results` : '',
      points: raceId ? `/races/${raceId}/points` : (stageId ? `/stages/${stageId}/points` : ''),
      mountains: raceId ? `/races/${raceId}/kom` : (stageId ? `/stages/${stageId}/mountains` : ''),
      youth: raceId ? `/races/${raceId}/youth` : (stageId ? `/stages/${stageId}/youth` : '')
    };

    const url = urlMap[tab];
    if (!url) {
      this.setData({ loading: false });
      return;
    }

    return get(url, { page: 1, limit: 50 }).then(res => {
      if (res && res.code === 200 && Array.isArray(res.data)) {
        const now = new Date();
        const lastUpdate = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const update = { lastUpdate, loading: false, loadError: false, errorMessage: '' };
        switch (tab) {
          case 'gc': update.gcRankings = res.data; break;
          case 'stage': update.stageResults = res.data; break;
          case 'points': update.pointsRankings = res.data; break;
          case 'mountains': update.mountainsRankings = res.data; break;
          case 'youth': update.youthRankings = res.data; break;
        }
        this.setData(update);
      } else {
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('获取排名数据失败:', err);
      this.setData({
        loading: false,
        loadError: true,
        errorMessage: err.message || '加载失败'
      });
    });
  },

  /**
   * 开始实时更新
   */
  startRealTimeUpdate() {
    this.connectWebSocket();
  },

  /**
   * WebSocket 连接
   */
  connectWebSocket() {
    const { getWsUrl } = require('../../config/env');
    const wsUrl = getWsUrl();

    if (!wsUrl) {
      this.startPolling();
      return;
    }

    const socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => {
        this.setData({ connectionStatus: 'connecting' });
      },
      fail: () => {
        this.setData({ connectionStatus: 'disconnected' });
        setTimeout(() => this.startPolling(), 2000);
      }
    });

    socketTask.onOpen(() => {
      this.setData({ connectionStatus: 'connected' });
      const { raceId, stageId } = this.data;
      if (raceId && stageId) {
        this.subscribeToData(raceId, stageId);
      }
    });

    socketTask.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        this.handleWebSocketMessage(data);
      } catch (e) { /* ignore parse errors */ }
    });

    socketTask.onClose(() => {
      this.setData({ connectionStatus: 'disconnected' });
      // 3秒后重连
      setTimeout(() => {
        if (this.data.activeTab) { // 页面还在
          this.connectWebSocket();
        }
      }, 3000);
    });

    socketTask.onError(() => {
      this.setData({ connectionStatus: 'disconnected' });
    });

    this.setData({ socketTask });
  },

  /**
   * 订阅实时数据
   */
  subscribeToData(raceId, stageId) {
    const st = this.data.socketTask;
    if (!st) return;

    st.send({
      data: JSON.stringify({ type: 'subscribe', raceId, stageId }),
      fail: (err) => console.error('订阅失败:', err)
    });
  },

  /**
   * 处理 WebSocket 消息
   */
  handleWebSocketMessage(data) {
    if ((data.type === 'update' || data.type === 'data') && data.dataType && Array.isArray(data.data)) {
      const now = new Date();
      const lastUpdate = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const update = { lastUpdate };
      switch (data.dataType) {
        case 'gc': update.gcRankings = data.data; break;
        case 'stage': update.stageResults = data.data; break;
        case 'results': update.stageResults = data.data; break;
        case 'points': update.pointsRankings = data.data; break;
        case 'mountains': update.mountainsRankings = data.data; break;
        case 'youth': update.youthRankings = data.data; break;
      }
      this.setData(update);
    }
  },

  /**
   * 轮询（降级方案）
   */
  startPolling() {
    this.setData({ connectionStatus: 'connected' });
    const pollTimer = setInterval(() => {
      this.fetchRankings(this.data.activeTab);
    }, 30000); // 30秒轮询
    this.setData({ pollTimer });
  },

  /**
   * 停止实时更新
   */
  stopRealTimeUpdate() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.setData({ pollTimer: null });
    }
  },

  /**
   * 下拉刷新
   */
  onRefresh() {
    this.setData({ isRefreshing: true });
    this.fetchRankings(this.data.activeTab);
    setTimeout(() => this.setData({ isRefreshing: false }), 1000);
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadInitialData();
  },

  /**
   * 查看车手详情
   */
  viewRiderDetail(e) {
    const riderId = e.currentTarget.dataset.riderId;
    if (!riderId) return;
    navigateTo({ url: `/pages/rider-detail/rider-detail?id=${riderId}` });
  },

  /**
   * 获取当前排名数据（根据 activeTab）
   */
  getCurrentRankings() {
    const { activeTab, gcRankings, stageResults, pointsRankings, mountainsRankings, youthRankings } = this.data;
    switch (activeTab) {
      case 'gc': return gcRankings;
      case 'stage': return stageResults;
      case 'points': return pointsRankings;
      case 'mountains': return mountainsRankings;
      case 'youth': return youthRankings;
      default: return [];
    }
  },

  onPullDownRefresh() {
    this.fetchRankings(this.data.activeTab).then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage() {
    const { raceName, raceId, stageId } = this.data;
    return {
      title: `${raceName || '实时成绩'} - 正一领骑`,
      path: `/pages/realtime-results/realtime-results?raceId=${raceId}&stageId=${stageId}`
    };
  },

  onShareTimeline() {
    const { raceName, raceId, stageId } = this.data;
    return {
      title: `${raceName || '实时成绩'} - 正一领骑`,
      query: `raceId=${raceId}&stageId=${stageId}`
    };
  }
});
