/**
 * 赛事详情页。
 * 展示赛事概览、赛程节奏、领骑衫、总成绩和分类榜入口。
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { jerseyTypeName, detectRaceType, getClassificationConfig } = require('../../utils/jersey-config');
const dataCache = require('../../utils/cache');
const { CACHE } = require('../../utils/constants');
const {
  normalizeStageType,
  stageTypeName: getStageTypeName,
  stageTypeWeight,
  isTerrainHeavyStageType,
  compareStageTypes
} = require('../../utils/stage-type');

const ADMIN_KEY_STORAGE = 'adminSyncKey';

Page({
  data: {
    raceId: '',
    raceCode: '',
    raceType: '',
    race: {},
    stages: [],
    jerseys: [],
    visualization: {
      totalStages: 0,
      totalDistance: 0,
      avgDistance: 0,
      maxDistance: 0,
      minDistance: 0,
      raceSpanText: '',
      stageDensityText: '',
      restDays: 0,
      longStageCount: 0,
      expandedBreakdownKey: 'distance',
      distanceBars: [],
      typeBreakdown: [],
      timelineItems: []
    },
    loading: true,
    loadError: false,
    errorMessage: '',
    cacheNotice: '',
    isAdminToolsVisible: false,
    genderLabel: '',
    clfEntries: [
      { type: 'points', icon: '🏁', title: '冲刺积分榜', sub: '按冲刺积分排名' },
      { type: 'mountains', icon: '⛰️', title: '爬坡积分榜', sub: '按爬坡积分排名' },
      { type: 'youth', icon: '⭐', title: '青年车手榜', sub: '青年车手总成绩排名' }
    ]
  },

  onLoad(options) {
    const { id } = options || {};
    if (!id) {
      showError('缺少赛事ID');
      return;
    }

    this.setData({ raceId: id });
    this.refreshAdminToolsVisibility();
    this.loadData();
  },

  onShow() {
    this.refreshAdminToolsVisibility();
  },

  refreshAdminToolsVisibility() {
    const adminKey = wx.getStorageSync(ADMIN_KEY_STORAGE) || '';
    this.setData({ isAdminToolsVisible: !!adminKey });
  },

  async loadData() {
    this.setData({ loading: true, loadError: false, errorMessage: '' });
    const cacheKey = dataCache.makeKey('race-detail', { raceId: this.data.raceId });
    const cached = dataCache.get(cacheKey, { ttl: CACHE.RACE_DETAIL_TTL, allowStale: true });
    if (cached) {
      this.applyCachedRaceData(cached.data, cached.isExpired ? '离线浏览 · 数据更新于' : '缓存数据 · 更新于', cached.cachedAt);
    }

    try {
      const [raceRes, stagesRes, jerseysRes] = await Promise.all([
        get(`/races/${this.data.raceId}`),
        get(`/races/${this.data.raceId}/stages`),
        get(`/races/${this.data.raceId}/latest-jerseys`)
      ]);

      let race = {};
      let stages = [];
      let jerseys = [];

      if (raceRes && raceRes.code === 200 && raceRes.data) {
        race = raceRes.data;
        race._category_zh = this.categoryName(race.category);
        race._start_date_fmt = this.formatDate(race.start_date);
        race._end_date_fmt = this.formatDate(race.end_date);
      }

      if (stagesRes && stagesRes.code === 200 && Array.isArray(stagesRes.data)) {
        stages = stagesRes.data.map(stage => ({
          ...stage,
          _date_fmt: this.formatDate(stage.date)
        }));
      }

      if (jerseysRes && jerseysRes.code === 200 && Array.isArray(jerseysRes.data)) {
        jerseys = jerseysRes.data.map(jersey => ({
          ...jersey,
          _jersey_type_zh: jerseyTypeName(jersey.jersey_type)
        }));
      }

      const title = race.race_name_zh || race.race_name || '赛事详情';
      wx.setNavigationBarTitle({ title });

      const visualization = this.buildVisualization(stages, race);

      this.setData({
        race,
        raceCode: race.race_code || '',
        stages,
        jerseys,
        visualization,
        loading: false,
        genderLabel: this.genderName(race.gender),
        cacheNotice: ''
      });

      dataCache.set(cacheKey, { race, stages, jerseys });

      this._updateClfEntries();
    } catch (err) {
      console.error('加载赛事失败:', err);
      const message = formatErrorMessage(err);
      if (cached) {
        this.setData({ loading: false, cacheNotice: `离线浏览 · 数据更新于 ${dataCache.formatCachedAt(cached.cachedAt)}` });
      } else {
        this.setData({ loading: false, loadError: true, errorMessage: message });
        showError(message);
      }
    }
  },

  applyCachedRaceData(payload, notice, cachedAt) {
    const race = payload.race || {};
    const stages = payload.stages || [];
    const jerseys = payload.jerseys || [];
    wx.setNavigationBarTitle({ title: race.race_name_zh || race.race_name || '赛事详情' });
    this.setData({
      race,
      raceCode: race.race_code || '',
      stages,
      jerseys,
      visualization: this.buildVisualization(stages, race),
      loading: false,
      loadError: false,
      genderLabel: this.genderName(race.gender),
      cacheNotice: `${notice} ${dataCache.formatCachedAt(cachedAt)}`
    });
    this._updateClfEntries();
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  },

  jerseyTypeName(type) {
    return jerseyTypeName(type);
  },

  categoryName(cat) {
    const map = {
      'Grand Tour': '大环赛',
      GRAND_TOUR: '大环赛',
      WorldTour: '世巡赛',
      ProSeries: '职业系列赛',
      Continental: '洲际赛',
      'Women-WorldTour': '女子世巡赛',
      'Women-ProSeries': '女子职业系列赛'
    };
    return map[cat] || cat;
  },

  genderName(gender) {
    if (!gender) return '';
    const g = String(gender).toUpperCase();
    return g === 'MEN' ? '男子' : g === 'WOMEN' ? '女子' : gender;
  },

  stageTypeName(type) {
    return getStageTypeName(type);
  },

  getStageRouteLabel(stage) {
    if (!stage) return '';

    const zhStart = stage.start_city_zh || '';
    const zhFinish = stage.finish_city_zh || '';
    const enStart = stage.start_city || '';
    const enFinish = stage.finish_city || '';

    if (zhStart && zhFinish) {
      return `${zhStart} -> ${zhFinish}`;
    }
    if (enStart && enFinish) {
      return `${enStart} -> ${enFinish}`;
    }

    return stage.stage_name_zh || stage.stage_name || '';
  },

  formatDistance(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return '0 km';
    const fixed = Number.isInteger(num) ? String(num) : num.toFixed(1);
    return `${fixed} km`;
  },

  formatCompactDistance(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return '0Km';
    return `${num.toFixed(1)}Km`;
  },

  getStageDistance(stage) {
    const value = Number(stage && stage.distance_km);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  },

  getStageDifficultyWeight(type) {
    return stageTypeWeight(type);
  },

  getDateValue(dateStr) {
    if (!dateStr) return null;
    const value = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  },

  buildVisualization(stages, race) {
    const list = Array.isArray(stages)
      ? stages
          .map(stage => ({
            ...stage,
            _distance_value: this.getStageDistance(stage)
          }))
          .filter(stage => stage._distance_value >= 0)
      : [];

    const totalStages = list.length;
    const distances = list.map(stage => stage._distance_value);
    const totalDistance = distances.reduce((sum, value) => sum + value, 0);
    const avgDistance = totalStages > 0 ? totalDistance / totalStages : 0;
    const maxDistance = distances.length ? Math.max(...distances) : 0;
    const minDistance = distances.length ? Math.min(...distances) : 0;

    const distanceBars = list
      .slice()
      .sort((a, b) => Number(a.stage_number || 0) - Number(b.stage_number || 0))
      .map(stage => {
        const distance = stage._distance_value;
        const normalizedType = normalizeStageType(stage.stage_type);
        const barHeight = maxDistance > 0
          ? Math.max(32, Math.round((distance / maxDistance) * 180))
          : 32;
        const markerLabels = [];
        if (maxDistance > 0 && distance === maxDistance) markerLabels.push('最长');
        if (normalizedType === 'itt' || normalizedType === 'ttt') markerLabels.push('计时');
        if (normalizedType === 'mountain') markerLabels.push('山地');

        return {
          id: stage.id,
          stageNumber: stage.stage_number || '',
          route: stage.stage_name || '',
          stageType: stage.stage_type || '',
          stageTypeLabel: this.stageTypeName(stage.stage_type),
          distanceLabel: this.formatDistance(distance),
          labelText: `${stage.stage_number || ''}${stage.stage_name ? ` · ${stage.stage_name}` : ''}`,
          barHeight,
          markerText: markerLabels.join(' · '),
          isKeyStage: markerLabels.length > 0
        };
      });

    const typeCounts = {};

    list.forEach(stage => {
      const key = normalizeStageType(stage.stage_type);
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });

    const sortedTypeKeys = Object.keys(typeCounts).sort(compareStageTypes);

    const typeBreakdown = sortedTypeKeys.map(type => {
      const count = typeCounts[type];
      const percent = totalStages > 0 ? Math.round((count / totalStages) * 100) : 0;
      return {
        type,
        label: this.stageTypeName(type),
        count,
        percent,
        width: percent
      };
    });

    const timelineSource = list
      .slice()
      .sort((a, b) => {
        const aDate = this.getDateValue(a.date);
        const bDate = this.getDateValue(b.date);
        const aTime = aDate ? aDate.getTime() : 0;
        const bTime = bDate ? bDate.getTime() : 0;
        if (aTime !== bTime) return aTime - bTime;
        return Number(a.stage_number || 0) - Number(b.stage_number || 0);
      });

    const timelineItems = timelineSource.map((stage, index) => {
      const stageNumber = stage.stage_number || index + 1;
      const currentDate = this.getDateValue(stage.date);
      const prevDate = index > 0 ? this.getDateValue(timelineSource[index - 1].date) : null;
      const gapDays = currentDate && prevDate
        ? Math.max(0, Math.round((currentDate.getTime() - prevDate.getTime()) / 86400000))
        : 0;

      return {
        id: stage.id,
        stageNumber,
        stageLabel: `S${stageNumber}`,
        dateLabel: this.formatDate(stage.date),
        routeLabel: this.getStageRouteLabel(stage),
        distanceLabel: this.formatDistance(stage._distance_value),
        stageType: stage.stage_type || 'Unknown',
        stageTypeLabel: this.stageTypeName(stage.stage_type),
        gapLabel: `第 ${stageNumber} 赛段`,
        isRestDay: gapDays > 1,
        isLeader: index === 0,
        isLast: index === timelineSource.length - 1
      };
    });

    let restDays = 0;
    for (let i = 1; i < timelineSource.length; i += 1) {
      const currentDate = this.getDateValue(timelineSource[i].date);
      const prevDate = this.getDateValue(timelineSource[i - 1].date);
      if (currentDate && prevDate) {
        const gap = Math.max(0, Math.round((currentDate.getTime() - prevDate.getTime()) / 86400000));
        if (gap > 1) {
          restDays += gap - 1;
        }
      }
    }

    const longStageCount = list.filter(stage => stage._distance_value >= 200).length;
    const avgTypeDifficulty = totalStages > 0
      ? list.reduce((sum, stage) => sum + this.getStageDifficultyWeight(stage.stage_type), 0) / totalStages
      : 0;
    const uniqueStageDates = new Set(timelineSource.map(stage => stage.date).filter(Boolean));
    const raceStart = this.getDateValue(race && race.start_date);
    const raceEnd = this.getDateValue(race && race.end_date);
    const spanDays = raceStart && raceEnd
      ? Math.max(1, Math.round((raceEnd.getTime() - raceStart.getTime()) / 86400000) + 1)
      : uniqueStageDates.size || totalStages;
    const stageDensity = spanDays > 0 ? Math.round((totalStages / spanDays) * 100) : 0;
    const raceSpanText = race && race.start_date && race.end_date
      ? `${this.formatDate(race.start_date)} - ${this.formatDate(race.end_date)}`
      : '';
    const terrainHeavyCount = list.filter(stage => {
      return isTerrainHeavyStageType(stage.stage_type);
    }).length;

    const difficultyRaw =
      (avgDistance / 4.5) +
      avgTypeDifficulty +
      Math.min(15, stageDensity / 4) +
      Math.min(12, longStageCount * 2.5) -
      Math.min(10, restDays * 0.8);

    const difficultyScore = Math.max(0, Math.min(100, Math.round(difficultyRaw)));
    const difficultyLabel = difficultyScore >= 85
      ? '极限'
      : difficultyScore >= 65
        ? '高强度'
        : difficultyScore >= 45
          ? '偏高'
          : difficultyScore >= 25
            ? '中等'
            : '轻松';
    const difficultyReason = [
      `平均赛段 ${this.formatDistance(avgDistance)}`,
      `长赛段 ${longStageCount} 个`,
      `山地/丘陵 ${terrainHeavyCount} 个`
    ].join(' · ');

    const distanceDifficulty = Math.max(
      0,
      Math.min(100, Math.round((avgDistance / 3.8) + (longStageCount * 6)))
    );
    const terrainDifficulty = Math.max(
      0,
      Math.min(100, Math.round((avgTypeDifficulty * 7) + (terrainHeavyCount * 4)))
    );
    const densityDifficulty = Math.max(
      0,
      Math.min(100, Math.round((stageDensity / 1.8) - (restDays * 3)))
    );
    const difficultyBreakdown = [
      {
        key: 'distance',
        label: '距离',
        score: distanceDifficulty,
        icon: '📏',
        levelKey: distanceDifficulty >= 85 ? 'extreme' : distanceDifficulty >= 65 ? 'high' : distanceDifficulty >= 45 ? 'medium' : 'easy',
        text: `平均 ${this.formatDistance(avgDistance)} · 长赛段 ${longStageCount} 个`,
        details: [
          `平均赛段越长，比赛对体能和补给的要求越高。`,
          `超过 200 km 的长赛段会明显推高这一项。`,
          `当前平均赛段为 ${this.formatDistance(avgDistance)}，长赛段共 ${longStageCount} 个。`
        ]
      },
      {
        key: 'terrain',
        label: '地形',
        score: terrainDifficulty,
        icon: '⛰️',
        levelKey: terrainDifficulty >= 85 ? 'extreme' : terrainDifficulty >= 65 ? 'high' : terrainDifficulty >= 45 ? 'medium' : 'easy',
        text: `山地/丘陵 ${terrainHeavyCount} 个 · 地形权重 ${avgTypeDifficulty.toFixed(1)}`,
        details: [
          `山地、丘陵和计时赛等赛段会让路线更难。`,
          `地形权重越高，说明赛段中包含更多起伏或技术路段。`,
          `当前山地/丘陵赛段共 ${terrainHeavyCount} 个，平均权重 ${avgTypeDifficulty.toFixed(1)}。`
        ]
      },
      {
        key: 'density',
        label: '密度',
        score: densityDifficulty,
        icon: '🧭',
        levelKey: densityDifficulty >= 85 ? 'extreme' : densityDifficulty >= 65 ? 'high' : densityDifficulty >= 45 ? 'medium' : 'easy',
        text: `赛程密度 ${stageDensity}% · 休息日 ${restDays} 天`,
        details: [
          `赛程越紧凑，恢复时间越少，整体难度通常越高。`,
          `休息日越多，密度项会适度下降。`,
          `当前赛程密度为 ${stageDensity}%，休息日共 ${restDays} 天。`
        ]
      }
    ];

    const totalDistanceValue = race && race.total_distance ? Number(race.total_distance) || totalDistance : totalDistance;

    return {
      totalStages,
      totalDistance: totalDistanceValue,
      totalDistanceText: this.formatDistance(totalDistanceValue),
      totalDistanceCompactText: this.formatCompactDistance(totalDistanceValue),
      avgDistance,
      avgDistanceText: this.formatDistance(avgDistance),
      avgDistanceCompactText: this.formatCompactDistance(avgDistance),
      maxDistance,
      maxDistanceText: this.formatDistance(maxDistance),
      maxDistanceCompactText: this.formatCompactDistance(maxDistance),
      minDistance,
      minDistanceText: this.formatDistance(minDistance),
      minDistanceCompactText: this.formatCompactDistance(minDistance),
      raceSpanText,
      stageDensityText: `${stageDensity}%`,
      restDays,
      longStageCount,
      expandedBreakdownKey: 'distance',
      difficultyScore,
      difficultyLabel,
      difficultyReason,
      difficultyBreakdown,
      longestStage: distanceBars[0] || null,
      shortestStage: distanceBars.slice().sort((a, b) => a.barHeight - b.barHeight)[0] || null,
      distanceBars,
      typeBreakdown,
      timelineItems
    };
  },

  retryLoad() {
    this.loadData();
  },

  toggleDifficultyBreakdown(e) {
    const { key } = e.currentTarget.dataset;
    const current = this.data.visualization && this.data.visualization.expandedBreakdownKey;
    const nextKey = current === key ? '' : key;
    this.setData({
      'visualization.expandedBreakdownKey': nextKey
    });
  },

  onStageTap(e) {
    const { stageId, stageNumber } = e.currentTarget.dataset;
    const { raceId, raceCode } = this.data;

    if (!stageId) {
      showError('赛段数据异常');
      return;
    }

    let url = `/pages/stage-results/stage-results?stageId=${stageId}&stageNumber=${stageNumber}&raceId=${raceId}`;
    if (raceCode) {
      url += `&raceCode=${encodeURIComponent(raceCode)}`;
    }
    navigateTo(url);
  },

  getLatestStageId() {
    const { stages } = this.data;
    if (!stages || stages.length === 0) {
      showError('暂无赛段数据');
      return null;
    }
    return stages[stages.length - 1].id;
  },

  onGCTap() {
    const { raceId, raceCode } = this.data;
    const stageId = this.getLatestStageId();
    if (!stageId) return;

    let url = `/pages/stage-results/stage-results?stageId=${stageId}&raceId=${raceId}&type=gc`;
    if (raceCode) {
      url += `&raceCode=${encodeURIComponent(raceCode)}`;
    }
    navigateTo(url);
  },

  _updateClfEntries() {
    const raceType = detectRaceType(this.data.raceCode);
    const types = ['points', 'mountains', 'youth'];
    const clfEntries = types.map(type => {
      const config = getClassificationConfig(type, raceType);
      return {
        type,
        icon: config.typeIcon,
        title: config.typeName,
        sub: config.typeSub
      };
    });
    this.setData({ clfEntries, raceType });
  },

  onClassTap(e) {
    const { type } = e.currentTarget.dataset;
    const { raceId, raceCode } = this.data;

    let url = `/pages/stage-results/stage-results?raceId=${raceId}&type=${type}`;
    if (raceCode) {
      url += `&raceCode=${encodeURIComponent(raceCode)}`;
    }
    navigateTo(url);
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage() {
    const race = this.data.race || {};
    const title = race.race_name_zh || race.race_name || '赛事详情';
    return {
      title: `${title} - 正一领骑`,
      path: `/pages/race-detail/race-detail?id=${this.data.raceId}`
    };
  },

  onShareTimeline() {
    const race = this.data.race || {};
    const title = race.race_name_zh || race.race_name || '赛事详情';
    return {
      title: `${title} - 正一领骑`,
      query: `id=${this.data.raceId}`
    };
  }
});
