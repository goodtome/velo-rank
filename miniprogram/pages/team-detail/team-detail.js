/**
 * 车队详情页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');
const { formatTeamName } = require('../../utils/string-format');

Page({
  data: {
    teamId: '',
    team: null,
    riders: [],
    loading: true,
    loadError: false
  },

  onLoad(options) {
    const { id } = options || {};
    
    if (!id) {
      this.setData({ loading: false, loadError: true });
      showError('缺少车队ID');
      return;
    }

    this.setData({ teamId: id });
    this.loadTeamDetail();
  },

  /**
   * 加载车队详情
   */
  async loadTeamDetail() {
    this.setData({ loading: true, loadError: false });

    try {
      const res = await get(`/teams/${this.data.teamId}`);
      
      if (res && res.code === 200 && res.data) {
        // 格式化车队名字
        const teamName = formatTeamName(res.data);
        // 格式化车手名字
        const riders = (res.data.riders || []).map(rider => ({
          ...rider,
          displayName: rider.rider_name_zh || rider.rider_name,
          displaySub: rider.rider_name_zh ? rider.rider_name : ''
        }));

        this.setData({
          team: res.data,
          teamName: teamName,
          riders: riders,
          loading: false
        });
      } else {
        this.setData({ 
          team: null, 
          riders: [],
          loading: false 
        });
        showError('车队不存在');
      }
    } catch (err) {
      console.error('加载车队详情失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
    }
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.setData({ loadError: false, loading: true });
    this.loadTeamDetail();
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
    this.loadTeamDetail().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
