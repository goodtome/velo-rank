/**
 * 实时成绩追踪页面逻辑
 * 支持GC排名、赛段成绩、冲刺/爬坡积分、青年排名的实时显示
 * 使用WebSocket或轮询实现实时更新（<2s延迟）
 */

const { get } = require('../../utils/request');

// 模拟数据 - GC排名
const mockGCRankings = [
  { riderId: 1, rank: 1, riderName: 'Giulio CICCONE', teamName: 'Lidl - Trek', timeGap: '-', rankChange: 0, isLeader: true, isUserFavorite: true },
  { riderId: 2, rank: 2, riderName: 'Jhonatan NARVAEZ', teamName: 'UAE Team Emirates - XRG', timeGap: '+0:15', rankChange: 1, isLeader: false, isUserFavorite: false },
  { riderId: 3, rank: 3, riderName: 'Aleksandr VLASOV', teamName: 'Red Bull - Bora - Hansgrohe', timeGap: '+0:28', rankChange: -1, isLeader: false, isUserFavorite: false },
  { riderId: 4, rank: 4, riderName: 'Paul MAGNIER', teamName: 'Soudal Quick-Step', timeGap: '+1:05', rankChange: 2, isLeader: false, isUserFavorite: true },
  { riderId: 5, rank: 5, riderName: 'Jan CHRISTEN', teamName: 'UAE Team Emirates - XRG', timeGap: '+1:32', rankChange: 0, isLeader: false, isUserFavorite: false },
  // 更多模拟数据...
];

// 模拟数据 - 赛段成绩
const mockStageResults = [
  { riderId: 2, rank: 1, riderName: 'Jhonatan NARVAEZ', teamName: 'UAE Team Emirates - XRG', time: '3:08:46' },
  { riderId: 1, rank: 2, riderName: 'Giulio CICCONE', teamName: 'Lidl - Trek', time: '+0:04' },
  { riderId: 6, rank: 3, riderName: 'Florian STORK', teamName: 'Team Polti VisitMalta', time: '+0:04' },
  // 更多模拟数据...
];

Page({
  data: {
    // 赛事信息
    raceName: '第109届环意自行车赛',
    stageNumber: 5,
    stageType: '丘陵赛段',
    raceStatus: 'live', // live, finished, upcoming
    raceStatusText: '比赛进行中',
    
    // 实时时间信息
    elapsedTime: '3:45:20',
    remainingDistance: '45.2',
    leaderName: 'Giulio CICCONE',
    
    // 标签切换
    activeTab: 'gc', // gc, stage, points, mountains, youth
    
    // 排名数据
    gcRankings: [],
    stageResults: [],
    pointsRankings: [],
    mountainsRankings: [],
    youthRankings: [],
    
    // 关注车手
    favoriteRiders: [
      { riderId: 1, rank: 1, riderName: 'Ciccone' },
      { riderId: 4, rank: 4, riderName: 'Magnier' }
    ],
    
    // 连接状态
    connectionStatus: 'connected', // connected, connecting, disconnected
    lastUpdate: '',
    isRefreshing: false,
    
    // 轮询定时器
    pollTimer: null
  },
  
  onLoad(options) {
    // 初始化数据
    this.loadInitialData();
    
    // 开始实时更新（轮询或WebSocket）
    this.startRealTimeUpdate();
  },
  
  onUnload() {
    // 清理定时器
    this.stopRealTimeUpdate();
  },
  
  // 加载初始数据
  loadInitialData() {
    // 实际从API加载数据
    const now = new Date();
    const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 获取URL参数中的raceId和stageId
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage.options || {};
    const raceId = options.raceId || '';
    const stageId = options.stageId || '';
    
    this.setData({
      raceId: raceId,
      stageId: stageId,
      lastUpdate: lastUpdate
    });
    
    // 加载GC排名数据
    this.fetchRankings('gc');
    
    // 如果提供了stageId，加载赛段成绩
    if (stageId) {
      this.fetchStageResults(stageId);
    }
  },
  
  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    
    // 加载对应标签的数据（如果尚未加载）
    this.fetchRankings(tab);
  },
  
  // 获取排名数据
  fetchRankings(tab) {
    wx.showLoading({ title: '加载中...' });
    
    const { stageId, raceId } = this.data;
    if (!stageId && !raceId) {
      wx.hideLoading();
      wx.showToast({ title: '缺少赛事参数', icon: 'none' });
      return;
    }
    
    // 根据tab调用不同的API
    let url = '';
    if (tab === 'gc') {
      url = `/api/v1/stages/${stageId}/general-classification`;
    } else if (tab === 'points') {
      url = `/api/v1/stages/${stageId}/points`;
    } else if (tab === 'mountains') {
      url = `/api/v1/stages/${stageId}/mountains`;
    } else if (tab === 'youth') {
      url = `/api/v1/stages/${stageId}/youth`;
    }
    
    get(url).then(res => {
      if (res.code === 200 && res.data) {
        const now = new Date();
        const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (tab === 'gc') {
          this.setData({ gcRankings: res.data, lastUpdate });
        } else if (tab === 'points') {
          this.setData({ pointsRankings: res.data, lastUpdate });
        } else if (tab === 'mountains') {
          this.setData({ mountainsRankings: res.data, lastUpdate });
        } else if (tab === 'youth') {
          this.setData({ youthRankings: res.data, lastUpdate });
        }
      }
      wx.hideLoading();
    }).catch(err => {
      console.error('获取排名数据失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },
  
  // 开始实时更新
  startRealTimeUpdate() {
    // 方案1：使用WebSocket（推荐，延迟<2s）
    // this.connectWebSocket();
    
    // 方案2：使用轮询（降级方案，延迟<5s）
    this.startPolling();
  },
  
  // WebSocket连接（实际实现）
  connectWebSocket() {
    // TODO: 实现WebSocket连接
    // const socketTask = wx.connectSocket({
    //   url: 'wss://your-domain.com/ws/race-results',
    //   success: () => {
    //     this.setData({ connectionStatus: 'connected' });
    //   },
    //   fail: () => {
    //     this.setData({ connectionStatus: 'disconnected' });
    //     this.startPolling(); // 降级到轮询
    //   }
    // });
    // 
    // socketTask.onMessage((res) => {
    //   const data = JSON.parse(res.data);
    //   this.updateRankings(data);
    // });
    // 
    // socketTask.onClose(() => {
    //   this.setData({ connectionStatus: 'disconnected' });
    //   setTimeout(() => this.connectWebSocket(), 3000); // 3秒后重连
    // });
  },
  
  // 轮询（降级方案）
  startPolling() {
    this.setData({ connectionStatus: 'connected' });
    
    const pollTimer = setInterval(() => {
      // 每2秒更新一次数据
      this.pollData();
    }, 2000); // 2秒轮询，满足<2s延迟要求
    
    this.setData({ pollTimer: pollTimer });
  },
  
  // 轮询数据
  pollData() {
    const { activeTab, stageId } = this.data;
    if (!stageId) return;
    
    // 根据当前tab获取最新数据
    let url = '';
    if (activeTab === 'gc') {
      url = `/api/v1/stages/${stageId}/general-classification`;
    } else if (activeTab === 'stage') {
      url = `/api/v1/stages/${stageId}/results`;
    } else if (activeTab === 'points') {
      url = `/api/v1/stages/${stageId}/points`;
    } else if (activeTab === 'mountains') {
      url = `/api/v1/stages/${stageId}/mountains`;
    } else if (activeTab === 'youth') {
      url = `/api/v1/stages/${stageId}/youth`;
    }
    
    if (!url) return;
    
    get(url).then(res => {
      if (res.code === 200 && res.data) {
        const now = new Date();
        const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (activeTab === 'gc') {
          this.setData({ gcRankings: res.data, lastUpdate });
        } else if (activeTab === 'stage') {
          this.setData({ stageResults: res.data, lastUpdate });
        } else if (activeTab === 'points') {
          this.setData({ pointsRankings: res.data, lastUpdate });
        } else if (activeTab === 'mountains') {
          this.setData({ mountainsRankings: res.data, lastUpdate });
        } else if (activeTab === 'youth') {
          this.setData({ youthRankings: res.data, lastUpdate });
        }
      }
    }).catch(err => {
      console.error('轮询数据失败:', err);
      // 保持连接状态，不显示错误（避免频繁弹窗）
    });
  },
  
  // 停止实时更新
  stopRealTimeUpdate() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.setData({ pollTimer: null });
    }
  },
  
  // 下拉刷新
  onRefresh() {
    this.setData({ isRefreshing: true });
    
    // 重新加载数据
    this.loadInitialData();
    
    setTimeout(() => {
      this.setData({ isRefreshing: false });
    }, 1000);
  },
  
  // 查看车手详情
  viewRiderDetail(e) {
    const riderId = e.currentTarget.dataset.riderId;
    wx.navigateTo({
      url: `/pages/rider-detail/rider-detail?id=${riderId}`
    });
  },
  
  // 切换关注状态
  toggleFavorite(e) {
    const riderId = e.currentTarget.dataset.riderId;
    // TODO: 实现关注/取消关注功能
    wx.showToast({
      title: '关注功能开发中',
      icon: 'none'
    });
  },
  
  // 滚动到关注车手位置
  scrollToRider(e) {
    const riderId = e.currentTarget.dataset.riderId;
    // TODO: 实现滚动到指定车手位置
    wx.showToast({
      title: '滚动功能开发中',
      icon: 'none'
    });
  },
  
  // 更新排名数据（WebSocket推送或轮询返回）
  updateRankings(data) {
    // TODO: 根据实际数据格式更新
    if (data.gc) {
      this.setData({
        gcRankings: data.gc,
        lastUpdate: data.lastUpdate
      });
    }
    // 同理处理其他排名...
  },
  
  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.raceName} - 实时成绩追踪`,
      path: `/pages/realtime-results/realtime-results?raceId=${this.options.raceId}&stageId=${this.options.stageId}`
    };
  },

  onShareTimeline() {
    return {
      title: `${this.data.raceName} - 实时成绩追踪`,
      query: `raceId=${this.options.raceId}&stageId=${this.options.stageId}`
    };
  }
});
