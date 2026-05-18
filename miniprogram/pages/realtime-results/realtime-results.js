/**
 * 实时成绩追踪页面逻辑
 * 支持GC排名、赛段成绩、冲刺/爬坡积分、青年排名的实时显示
 * 使用WebSocket或轮询实现实时更新（<2s延迟）
 */

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
    // 使用模拟数据（实际应该从API加载）
    const now = new Date();
    const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    this.setData({
      gcRankings: mockGCRankings,
      stageResults: mockStageResults,
      lastUpdate: lastUpdate
    });
    
    // TODO: 实际应该从后端API加载数据
    // this.fetchRankings('gc');
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
    // TODO: 实际应该调用后端API
    // 这里使用模拟数据
    wx.showLoading({ title: '加载中...' });
    
    setTimeout(() => {
      // 模拟API调用延迟
      const now = new Date();
      const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (tab === 'points') {
        // 模拟冲刺积分数据
        this.setData({
          pointsRankings: [
            { riderId: 4, rank: 1, riderName: 'Paul MAGNIER', teamName: 'Soudal Quick-Step', points: 105, isLeader: true },
            { riderId: 7, rank: 2, riderName: 'Diego Pablo SEVILLA', teamName: 'Team Polti VisitMalta', points: 72, isLeader: false },
            // 更多数据...
          ],
          lastUpdate: lastUpdate
        });
      } else if (tab === 'mountains') {
        // 模拟爬坡积分数据
        this.setData({
          mountainsRankings: [
            { riderId: 8, rank: 1, riderName: 'Climber NAME', teamName: 'Team Name', points: 65, isLeader: true },
            // 更多数据...
          ],
          lastUpdate: lastUpdate
        });
      } else if (tab === 'youth') {
        // 模拟青年排名数据
        this.setData({
          youthRankings: [
            { riderId: 5, rank: 1, riderName: 'Jan CHRISTEN', teamName: 'UAE Team Emirates - XRG', age: 21, timeGap: '-', isLeader: true },
            // 更多数据...
          ],
          lastUpdate: lastUpdate
        });
      }
      
      wx.hideLoading();
    }, 300);
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
    // TODO: 实际应该调用后端API获取最新数据
    // 这里模拟数据更新
    const now = new Date();
    const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 模拟实时数据变化（随机更新排名变化）
    const updatedGCRankings = this.data.gcRankings.map(item => {
      if (Math.random() > 0.7) { // 30%概率发生变化
        const change = Math.random() > 0.5 ? 1 : -1;
        return {
          ...item,
          rankChange: change,
          timeGap: change > 0 ? item.timeGap : item.timeGap // 简化处理
        };
      }
      return item;
    });
    
    this.setData({
      gcRankings: updatedGCRankings,
      lastUpdate: lastUpdate
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
  }
});
