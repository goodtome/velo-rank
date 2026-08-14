/**
 * 车手详情页 - Week 6 优化版本
 * 新增：统计卡片、奖牌高亮、车队信息
 */

const { get, post, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');
const { getCountryName } = require('../../utils/country-map');
const { formatRiderName, toTitleCase } = require('../../utils/string-format');
const { jerseyNameShort } = require('../../utils/jersey-config');
const { stageTypeName, stageTypeColor } = require('../../utils/stage-type');
const auth = require('../../utils/auth');

// 奖牌映射
const MEDAL_MAP = { 1: '🥇', 2: '🥈', 3: '🥉' };

// 赛段类型颜色映射
Page({
  data: {
    riderId: '',
    rider: null,
    results: [],
    stats: null,          // 统计数据
    loading: true,
    loadError: false,
    resultsLoading: false,
    isFavorite: false,
    favoriteLoading: false,
    performanceViz: {
      hasData: false,
      summary: [],
      rankBars: [],
      typeBreakdown: []
    },
    riderInsights: {
      hasData: false,
      careerItems: [],
      seasonSummaries: [],
      recentForm: []
    }
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
        this.loadFavoriteStatus();
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

  async ensureLogin() {
    if (auth.isLoggedIn()) return true;
    try {
      wx.showLoading({ title: '登录中...' });
      await auth.login();
      wx.hideLoading();
      return true;
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
      console.error('登录失败:', err);
      return false;
    }
  },

  async loadFavoriteStatus() {
    if (!auth.isLoggedIn()) {
      this.setData({ isFavorite: false });
      return;
    }

    try {
      const res = await get(`/favorites/check/${this.data.riderId}`);
      if (res && res.code === 200 && res.data) {
        this.setData({ isFavorite: !!res.data.is_favorite });
      }
    } catch (err) {
      console.error('加载关注状态失败:', err);
    }
  },

  async toggleFavorite() {
    if (this.data.favoriteLoading) return;

    const loggedIn = await this.ensureLogin();
    if (!loggedIn) return;

    const nextFavorite = !this.data.isFavorite;
    this.setData({ favoriteLoading: true });

    try {
      const url = nextFavorite ? '/favorites/add' : '/favorites/remove';
      const res = await post(url, { rider_id: this.data.riderId });
      if (res && res.code === 200) {
        this.setData({ isFavorite: nextFavorite });
        wx.showToast({
          title: nextFavorite ? '已关注' : '已取消关注',
          icon: 'success'
        });
      }
    } catch (err) {
      wx.showToast({
        title: nextFavorite ? '关注失败' : '取消关注失败',
        icon: 'none'
      });
      console.error('更新关注状态失败:', err);
    } finally {
      this.setData({ favoriteLoading: false });
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
        this.setData({
          stats,
          performanceViz: this.buildPerformanceViz(this.data.results, stats),
          riderInsights: this.buildRiderInsights(stats)
        });
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
          typeColor: stageTypeColor(item.stage_type),
          stageTypeLabel: stageTypeName(item.stage_type),
          // 格式化时间差
          timeStr: item.time_gap 
            ? (item.stage_rank === 1 ? item.time_gap : `+${item.time_gap}`)
            : (item.stage_rank === 1 ? 'Winner' : 's.t.')
        }));
        
        this.setData({ 
          results,
          resultsLoading: false,
          performanceViz: this.buildPerformanceViz(results, this.data.stats)
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

  buildPerformanceViz(results, stats) {
    const list = Array.isArray(results) ? results.slice() : [];
    const validRanks = list
      .map(item => Number(item.stage_rank))
      .filter(rank => Number.isFinite(rank) && rank > 0);
    const hasData = validRanks.length > 0 || !!stats;

    const podiums = validRanks.filter(rank => rank <= 3).length;
    const top10 = validRanks.filter(rank => rank <= 10).length;
    const wins = validRanks.filter(rank => rank === 1).length;
    const bestRank = validRanks.length ? Math.min(...validRanks) : null;
    const avgRank = validRanks.length
      ? Math.round(validRanks.reduce((sum, rank) => sum + rank, 0) / validRanks.length)
      : null;

    const summary = [
      {
        key: 'best',
        label: '最好名次',
        value: bestRank ? `#${bestRank}` : '-',
        tone: 'blue'
      },
      {
        key: 'avg',
        label: '平均名次',
        value: avgRank ? `#${avgRank}` : '-',
        tone: 'green'
      },
      {
        key: 'podium',
        label: '近期领奖台',
        value: String(stats && stats.podiums !== undefined ? stats.podiums : podiums),
        tone: 'gold'
      },
      {
        key: 'top10',
        label: '近期前十',
        value: String(stats && stats.top10 !== undefined ? stats.top10 : top10),
        tone: 'purple'
      }
    ];

    const maxRank = validRanks.length ? Math.max(...validRanks, 10) : 10;
    const rankBars = list.slice(0, 10).map((item, index) => {
      const rank = Number(item.stage_rank);
      const safeRank = Number.isFinite(rank) && rank > 0 ? rank : maxRank;
      const height = Math.max(24, Math.round(((maxRank - safeRank + 1) / maxRank) * 150));
      return {
        id: item.stage_id || `${index}`,
        label: `S${item.stage_number || index + 1}`,
        rankLabel: Number.isFinite(rank) ? `#${rank}` : '-',
        height,
        isPodium: Number.isFinite(rank) && rank <= 3,
        isWin: rank === 1
      };
    });

    const typeCounts = {};
    list.forEach(item => {
      const key = item.stageTypeLabel || stageTypeName(item.stage_type) || '其他';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });
    const typeTotal = Object.values(typeCounts).reduce((sum, value) => sum + value, 0);
    const typeBreakdown = Object.keys(typeCounts).map(label => {
      const count = typeCounts[label];
      const percent = typeTotal > 0 ? Math.round((count / typeTotal) * 100) : 0;
      return {
        label,
        count,
        percent,
        width: Math.max(6, percent)
      };
    });

    return {
      hasData,
      summary,
      rankBars,
      typeBreakdown,
      wins
    };
  },

  buildRiderInsights(stats) {
    const safeStats = stats || {};
    const career = safeStats.career || {};
    const careerItems = [
      { key: 'seasons', label: '征战赛季', value: career.total_seasons || 0, tone: 'blue' },
      { key: 'races', label: '参赛赛事', value: career.total_races || 0, tone: 'green' },
      { key: 'best-gc', label: '最佳 GC', value: career.best_gc_rank ? `#${career.best_gc_rank}` : '-', tone: 'purple' },
      { key: 'gc-races', label: 'GC 赛事', value: career.gc_races || 0, tone: 'gold' }
    ];
    const seasonSummaries = (safeStats.season_summaries || []).map(item => ({
      season: item.season || '-',
      starts: item.starts || 0,
      wins: item.wins || 0,
      podiums: item.podiums || 0,
      bestRank: item.best_rank ? `#${item.best_rank}` : '-'
    }));
    const recentForm = (safeStats.recent_form || []).map(item => ({
      id: item.stage_id,
      raceName: item.race_name_zh || item.race_name || '赛事',
      stageLabel: `S${item.stage_number || '-'}`,
      rankLabel: item.rank ? `#${item.rank}` : '-',
      isPodium: Number(item.rank) <= 3,
      isWin: Number(item.rank) === 1
    }));

    return {
      hasData: career.total_races > 0 || seasonSummaries.length > 0 || recentForm.length > 0,
      careerItems,
      seasonSummaries,
      recentForm
    };
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
