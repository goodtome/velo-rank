/**
 * 车队详情页 - Week 6 优化版本
 * 新增：统计数据卡片、赛事历史
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { formatTeamName } = require('../../utils/string-format');

Page({
  data: {
    teamId: '',
    team: null,
    riders: [],
    stats: null,          // 统计数据
    loading: true,
    loadError: false,
    teamInsights: {
      hasData: false,
      profileItems: [],
      topRiders: [],
      seasonSummaries: [],
      highlights: []
    }
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
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
      showError(formatErrorMessage(err));
    }
  },

  /**
   * 加载车队统计数据
   */
  async loadTeamStats() {
    try {
      const res = await get(`/teams/${this.data.teamId}/stats`);
      
      if (res && res.code === 200 && res.data) {
        this.setData({
          stats: res.data,
          teamInsights: this.buildTeamInsights(res.data)
        });
      }
    } catch (err) {
      console.error('加载车队统计失败:', err);
    }
  },

  retryLoad() {
    this.setData({ loadError: false, loading: true });
    this.loadTeamDetail();
  },

  buildTeamInsights(stats) {
    const safeStats = stats || {};
    const profile = safeStats.profile || {};
    const profileItems = [
      { key: 'team-rank', label: '最佳车队榜', value: profile.best_team_rank ? `#${profile.best_team_rank}` : '-', tone: 'blue' },
      { key: 'team-podiums', label: '车队榜领奖台', value: profile.team_podiums || 0, tone: 'gold' },
      { key: 'countries', label: '代表国家', value: profile.nationalities || 0, tone: 'green' },
      { key: 'seasons', label: '数据赛季', value: profile.seasons_count || 0, tone: 'purple' }
    ];
    const topRiders = (safeStats.top_riders || []).map(item => ({
      id: item.id,
      name: item.rider_name_zh || item.rider_name || '车手',
      nationality: item.nationality || '',
      wins: item.wins || 0,
      podiums: item.podiums || 0,
      bestRank: item.best_rank ? `#${item.best_rank}` : '-'
    }));
    const seasonSummaries = (safeStats.season_summaries || []).map(item => ({
      season: item.season || '-',
      starts: item.starts || 0,
      wins: item.wins || 0,
      podiums: item.podiums || 0
    }));
    const highlights = (safeStats.recent_highlights || []).map(item => ({
      id: item.stage_id,
      raceName: item.race_name_zh || item.race_name || '赛事',
      riderName: item.rider_name_zh || item.rider_name || '车手',
      stageLabel: `S${item.stage_number || '-'}`,
      rankLabel: item.rank ? `#${item.rank}` : '-',
      isWin: Number(item.rank) === 1
    }));

    return {
      hasData: profile.races_count > 0 || topRiders.length > 0 || highlights.length > 0,
      profileItems,
      topRiders,
      seasonSummaries,
      highlights
    };
  },

  goToRider(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    navigateTo({ url: `/pages/rider-detail/rider-detail?id=${id}` });
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
