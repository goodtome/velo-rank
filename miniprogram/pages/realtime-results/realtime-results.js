/**
 * 实时成绩追踪页面逻辑
 * 支持GC排名、赛段成绩、冲刺/爬坡积分、青年排名的实时显示
 * 使用WebSocket或轮询实现实时更新（<2s延迟）
 */

  const { get, post } = require('../../utils/request');

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
    // 优先使用WebSocket
    this.connectWebSocket();
  },
  
  // WebSocket连接（实现）
  connectWebSocket() {
    const baseUrl = getApp().globalData.baseUrl;

    const socketTask = wx.connectSocket({
      url: `ws://${baseUrl}/ws/realtime`,
      success: () => {
        console.log('WebSocket连接请求已发送');
        this.setData({ connectionStatus: 'connected' });
      },
      fail: (err) => {
        console.error('WebSocket连接失败:', err);
        this.setData({ connectionStatus: 'disconnected' });
        wx.showToast({
          title: '连接失败，切换至轮询模式',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => this.startPolling(), 2000); // 2秒后降级到轮询
      }
    });

    // 监听打开事件
    socketTask.onOpen(() => {
      console.log('WebSocket已连接');
      // 连接成功后立即订阅
      const { raceId, stageId } = this.data;
      if (raceId && stageId) {
        this.subscribeToData(raceId, stageId);
      }
    });

    // 监听消息事件
    socketTask.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error, res.data);
      }
    });

    // 关闭连接
    socketTask.onClose(() => {
      console.log('WebSocket连接已关闭');
      this.setData({ connectionStatus: 'disconnected' });

      // 3秒后自动重连
      wx.showToast({
        title: '连接断开，即将重连',
        icon: 'none',
        duration: 1500
      });

      setTimeout(() => {
        this.connectWebSocket();
      }, 3000);
    });

    // 错误处理
    socketTask.onError((err) => {
      console.error('WebSocket错误:', err);
      this.setData({ connectionStatus: 'disconnected' });
    });

    // 保存socketTask供后续使用
    this.setData({ socketTask });
  },

  // 订阅实时数据
  subscribeToData(raceId, stageId) {
    if (!this.data.socketTask || this.data.socketTask.readyState !== 1) {
      console.log('WebSocket未连接，跳过订阅');
      return;
    }

    const message = JSON.stringify({
      type: 'subscribe',
      raceId: raceId,
      stageId: stageId
    });

    this.data.socketTask.send({
      data: message,
      success: () => {
        console.log('订阅消息已发送');
      },
      fail: (err) => {
        console.error('订阅消息发送失败:', err);
      }
    });
  },

  // 处理WebSocket消息
  handleWebSocketMessage(data) {
    console.log('接收到WebSocket消息:', data.type);

    switch (data.type) {
      case 'welcome':
        console.log('服务器欢迎消息:', data.message);
        break;

      case 'subscribed':
        console.log('订阅成功:', data.room);
        break;

      case 'unsubscribed':
        console.log('取消订阅成功:', data.room);
        break;

      case 'update':
        // 收到数据更新
        this.updateRankings(data);
        break;

      case 'error':
        console.error('服务器错误:', data.message);
        wx.showToast({
          title: data.message || '数据更新错误',
          icon: 'none'
        });
        break;

      default:
        console.warn('未知消息类型:', data.type);
    }
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
    const { riderId, rank, riderName } = e.currentTarget.dataset;

    if (!riderId) {
      wx.showToast({ title: '无法获取车手ID', icon: 'none' });
      return;
    }

    // 检查是否已关注
    const isFavorite = this.data.favoriteRiders.find(r => r.riderId === riderId);

    try {
      const postData = {
        rider_id: riderId
      };

      if (isFavorite) {
        // 取消关注
        const newFavorites = this.data.favoriteRiders.filter(r => r.riderId !== riderId);
        this.setData({ favoriteRiders: newFavorites });

        // 调用API取消关注
        this.get().post('/favorites/remove', postData)
          .then(() => {
            wx.showToast({
              title: '已取消关注',
              icon: 'success',
              duration: 1500
            });
          })
          .catch(err => {
            console.error('取消关注失败:', err);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          });
      } else {
        // 添加关注
        const newFavorites = [...this.data.favoriteRiders, { riderId, rank, riderName }];
        this.setData({ favoriteRiders: newFavorites });

        // 调用API添加关注
        this.get().post('/favorites/add', postData)
          .then(() => {
            wx.showToast({
              title: '关注成功',
              icon: 'success',
              duration: 1500
            });
          })
          .catch(err => {
            console.error('关注失败:', err);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          });
      }
    } catch (error) {
      console.error('切换关注失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 滚动到关注车手位置
  scrollToRider(e) {
    const { riderId } = e.currentTarget.dataset;

    // 获取列表容器
    const query = wx.createSelectorQuery();
    query.select('.race-list-container').boundingClientRect();

    query.exec((res) => {
      if (res && res[0]) {
        // 获取目标车手元素
        const riderQuery = wx.createSelectorQuery();
        riderQuery.select(`#rider-${riderId}`).boundingClientRect();

        riderQuery.exec((riderRes) => {
          if (riderRes && riderRes[0]) {
            const riderRect = riderRes[0];
            const containerRect = res[0];

            // 计算滚动位置（将目标元素显示在中间，并留出100px空间）
            const scrollTop = riderRect.top - containerRect.top - 100;

            if (scrollTop > 0) {
              wx.pageScrollTo({
                scrollTop: scrollTop,
                duration: 300  // 300ms渐显动画
              });

              // 600ms后高亮显示（可选，需要配合wxml）
              setTimeout(() => {
                const highlightQuery = wx.createSelectorQuery();
                highlightQuery.select(`#rider-card-${riderId}`).addClass('highlight');
                highlightQuery.exec();
              }, 600);
            }
          } else {
            wx.showToast({
              title: '车手位置不可见',
              icon: 'none',
              duration: 1500
            });
          }
        });
      } else {
        wx.showToast({
          title: '列表容器不可见',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },
  
  // 更新排名数据（WebSocket推送或轮询返回）
  updateRankings(data) {
    try {
      if (data.type === 'update') {
        // WebSocket更新数据
        const { dataType, data: updateData } = data;

        const now = new Date();
        const lastUpdate = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        switch (dataType) {
          case 'gc':
            this.setData({
              gcRankings: updateData,
              lastUpdate
            });
            break;
          case 'stage':
            this.setData({
              stageResults: updateData,
              lastUpdate
            });
            break;
          case 'points':
            this.setData({
              pointsRankings: updateData,
              lastUpdate
            });
            break;
          case 'mountains':
            this.setData({
              mountainsRankings: updateData,
              lastUpdate
            });
            break;
          case 'youth':
            this.setData({
              youthRankings: updateData,
              lastUpdate
            });
            break;
        }
      }
    } catch (error) {
      console.error('更新排名数据失败:', error);
    }
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
