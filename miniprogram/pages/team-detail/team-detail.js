/**
 * 车队详情页 - Week 6 优化版本
 * 新增：统计数据卡片、赛事历史
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');
const { formatTeamName } = require('../../utils/string-format');

Page({
  data: {
    teamId: '',
    team: null,
    riders: [],
    stats: null,          // 统计数据
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
        const teamName = formatTeamName(res.data);
        const riders = (res.data.riders || []).map(rider => ({
          ...rider,
          displayName: rider.rider_name_zh || rider.rider_name,
          displaySub: rider.rider_name_zh ? rider.rider_name : ''
        }));

        this.setData({
          team: res.data,
          teamName,
          riders,
          loading: false
        });
        // 加载统计数据
        this.loadTeamStats();
      } else {
        this.setData({ team: null, riders: [], loading: false });
        showError('车队不存在');
      }
    } catch (err) {
      console.error('加载车队详情失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
    }
  },

  /**
   * 加载车队统计数据
   */
  async loadTeamStats() {
    try {
      const res = await get(`/teams/${this.data.teamId}/stats`);
      
      if (res && res.code === 200 && res.data) {
        this.setData({ stats: res.data });
      }
    } catch (err) {
      console.error('加载车队统计失败:', err);
    }
  },

  retryLoad() {
    this.setData({ loadError: false, loading: true });
    this.loadTeamDetail();
  },

  goToRider(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/rider-detail/rider-detail?id=${id}` });
  },

  onPullDownRefresh() {
    this.loadTeamDetail().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage() {
    const team = this.data.team || {};
    const name = team.team_name_zh || team.team_name || '车队详情';
    return {
      title: `${name} - 正一领骑`,
      path: `/pages/team-detail/team-detail?id=${this.data.teamId}`
    };
  },

  onShareTimeline() {
    const team = this.data.team || {};
    const name = team.team_name_zh || team.team_name || '车队详情';
    return {
      title: `${name} - 正一领骑`,
      query: `id=${this.data.teamId}`
    };
  }
});
