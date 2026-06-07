/**
 * 车手详情页 - Week 6 优化版本
 * 新增：统计卡片、奖牌高亮、车队信息
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');
const { getCountryName } = require('../../utils/country-map');
const { formatRiderName, toTitleCase } = require('../../utils/string-format');
const { jerseyNameShort } = require('../../utils/jersey-config');

// 奖牌映射
const MEDAL_MAP = { 1: '🥇', 2: '🥈', 3: '🥉' };

// 赛段类型颜色映射
const STAGE_COLOR = {
  'Flat': 'green',
  'Hills': 'orange',
  'Mountain': 'red',
  'ITT': 'purple',
  'TTT': 'blue'
};

Page({
  data: {
    riderId: '',
    rider: null,
    results: [],
    stats: null,          // 统计数据
    loading: true,
    loadError: false,
    resultsLoading: false
  },

  onLoad(options) {
    const { id } = options || {};
    
    if (!id) {
      this.setData({ loading: false, loadError: true });
      showError(t('missingRiderId', getLocale()));
      return;
    }
    
    this.initI18n();
    this.setData({ riderId: id });
    this.loadRiderDetail();
  },

  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({ t: this.t });
  },

  async loadRiderDetail() {
    this.setData({ loading: true, loadError: false });
    
    try {
      const res = await get(`/riders/${this.data.riderId}`);
      
      if (res && res.code === 200 && res.data) {
        const statusText = res.data.is_retired ? '已退役' : '现役';
        const nationalityZh = getCountryName(res.data.nationality);
        const riderName = formatRiderName(res.data);
        const teamName = res.data.team_name ? toTitleCase(res.data.team_name) : '';
        
        this.setData({ 
          rider: res.data, 
          statusText,
          nationalityZh,
          riderName,
          teamName,
          loading: false 
        });
        // 并行加载成绩和统计
        this.loadRiderResults();
        this.loadRiderStats();
      } else {
        this.setData({ rider: null, loading: false });
        showError(this.t('riderNotFound'));
      }
    } catch (err) {
      console.error('加载车手详情失败:', err);
      const msg = formatErrorMessage(err);
      this.setData({ loading: false, loadError: true, errorMessage: msg });
      showError(msg);
    }
  },

  /**
   * 加载车手统计数据
   */
  async loadRiderStats() {
    try {
      const res = await get(`/riders/${this.data.riderId}/stats`);
      
      if (res && res.code === 200 && res.data) {
        const stats = res.data;
        // 将领骑衫类型转为中文名
        if (stats.jerseys && Array.isArray(stats.jerseys)) {
          stats.jerseys = stats.jerseys.map(j => ({
            ...j,
            _jersey_name_zh: jerseyNameShort(j.jersey_type)
          }));
        }
        this.setData({ stats });
      }
    } catch (err) {
      console.error('加载车手统计数据:', err);
    }
  },

  /**
   * 加载车手历史成绩（含奖牌高亮）
   */
  async loadRiderResults() {
    this.setData({ resultsLoading: true });
    
    try {
      const res = await get(`/riders/${this.data.riderId}/results?limit=20`);
      
      if (res && res.code === 200) {
        const results = (res.data || []).map(item => ({
          ...item,
          isPodium: item.stage_rank <= 3,
          medal: MEDAL_MAP[item.stage_rank] || '',
          typeColor: STAGE_COLOR[item.stage_type] || 'green',
          // 格式化时间差
          timeStr: item.time_gap 
            ? (item.stage_rank === 1 ? item.time_gap : `+${item.time_gap}`)
            : (item.stage_rank === 1 ? 'Winner' : 's.t.')
        }));
        
        this.setData({ 
          results,
          resultsLoading: false 
        });
      } else {
        this.setData({ resultsLoading: false });
      }
    } catch (err) {
      console.error('加载车手成绩失败:', err);
      this.setData({ resultsLoading: false });
    }
  },

  retryLoad() {
    this.setData({ loadError: false, loading: true });
    this.loadRiderDetail();
  },

  goToTeam(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    navigateTo({ url: `/pages/team-detail/team-detail?id=${id}` });
  },

  onPullDownRefresh() {
    this.loadRiderDetail().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage() {
    const rider = this.data.rider || {};
    const name = rider.rider_name_zh || rider.rider_name || '车手详情';
    return {
      title: `${name} - 正一领骑`,
      path: `/pages/rider-detail/rider-detail?id=${this.data.riderId}`
    };
  },

  onShareTimeline() {
    const rider = this.data.rider || {};
    const name = rider.rider_name_zh || rider.rider_name || '车手详情';
    return {
      title: `${name} - 正一领骑`,
      query: `id=${this.data.riderId}`
    };
  }
});
