/**
 * 赛事详情页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get, formatErrorMessage } = require('../../utils/request');
const { showError, navigateTo } = require('../../utils/util');
const { jerseyTypeName, detectRaceType, getClassificationConfig } = require('../../utils/jersey-config');

Page({
  data: {
    raceId: '',
    raceCode: '',
    raceType: '',
    race: {},
    stages: [],
    jerseys: [],
    loading: true,
    loadError: false,
    // 分类榜入口配置（根据赛事类型动态生成）
    clfEntries: [
      { type: 'points',    icon: '🟣', title: '冲刺积分榜', sub: 'Points Classification' },
      { type: 'mountains', icon: '🔵', title: '爬坡积分榜', sub: 'Mountains Classification' },
      { type: 'youth',     icon: '⚪', title: '青年车手榜',  sub: 'Youth Classification' }
    ]
  },

  onLoad(options) {
    const { id } = options || {};
    if (!id) {
      showError('缺少赛事ID');
      return;
    }
    
    this.setData({ raceId: id });
    this.loadData();
  },

  /**
   * 加载赛事数据 — 并行请求
   */
  async loadData() {
    this.setData({ loading: true, loadError: false });

    try {
      // 并行请求赛事详情、赛段列表、领骑衫
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
        // 预处理：WXML 中不支持调用 JS 函数，需要提前计算
        race._category_zh = this.categoryName(race.category);
        race._start_date_fmt = this.formatDate(race.start_date);
        race._end_date_fmt = this.formatDate(race.end_date);
      }
      if (stagesRes && stagesRes.code === 200 && Array.isArray(stagesRes.data)) {
        stages = stagesRes.data.map(s => ({
          ...s,
          _date_fmt: this.formatDate(s.date)
        }));
      }
      if (jerseysRes && jerseysRes.code === 200 && Array.isArray(jerseysRes.data)) {
        jerseys = jerseysRes.data.map(j => ({
          ...j,
          _jersey_type_zh: jerseyTypeName(j.jersey_type)
        }));
      }

      // 设置导航栏标题
      const title = race.race_name_zh || race.race_name || '赛事详情';
      wx.setNavigationBarTitle({ title });

      this.setData({
        race,
        raceCode: race.race_code || '',
        stages,
        jerseys,
        loading: false,
        genderLabel: race.gender === 'MEN' ? '男子' : race.gender === 'WOMEN' ? '女子' : ''
      });

      // 根据赛事类型动态更新分类榜入口配置
      this._updateClfEntries();
    } catch (err) {
      console.error('加载赛事失败:', err);
      this.setData({ loading: false, loadError: true, errorMessage: formatErrorMessage(err) });
      showError(formatErrorMessage(err));
    }
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  },

  /**
   * 领骑衫类型中文名（使用统一配置模块）
   */
  jerseyTypeName(type) {
    return jerseyTypeName(type);
  },

  /**
   * 赛事类别中文名
   */
  categoryName(cat) {
    const map = {
      'Grand Tour': '大环赛',
      'GRAND_TOUR': '大环赛',
      'WorldTour': '世巡赛',
      'ProSeries': '职业系列赛',
      'Continental': '洲际赛',
      'Women-WorldTour': '女子世巡赛',
      'Women-ProSeries': '女子职业系列赛'
    };
    return map[cat] || cat;
  },

  /**
   * 性别显示名称
   */
  genderName(gender) {
    if (!gender) return '';
    const g = String(gender).toUpperCase();
    return g === 'MEN' ? '男子' : g === 'WOMEN' ? '女子' : gender;
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadData();
  },

  /**
   * 点击赛段卡片
   */
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

  /**
   * 获取最新赛段ID
   */
  getLatestStageId() {
    const { stages } = this.data;
    if (!stages || stages.length === 0) {
      showError('暂无赛段数据');
      return null;
    }
    return stages[stages.length - 1].id;
  },

  /**
   * 点击总成绩榜(GC)
   */
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

  /**
   * 根据赛事类型更新分类榜入口配置
   */
  _updateClfEntries() {
    const raceType = detectRaceType(this.data.raceCode);
    const types = ['points', 'mountains', 'youth'];
    const clfEntries = types.map(t => {
      const config = getClassificationConfig(t, raceType);
      return {
        type: t,
        icon: config.typeIcon,
        title: config.typeName,
        sub: config.typeSub
      };
    });
    this.setData({ clfEntries, raceType });
  },

  /**
   * 点击分类榜入口（积分/爬坡/青年）
   * 显示赛事累计排名，不传 stageId
   */
  onClassTap(e) {
    const { type } = e.currentTarget.dataset;
    const { raceId, raceCode } = this.data;

    let url = `/pages/stage-results/stage-results?raceId=${raceId}&type=${type}`;
    if (raceCode) {
      url += `&raceCode=${encodeURIComponent(raceCode)}`;
    }
    navigateTo(url);
  },

  /**
   * 下拉刷新
   */
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
