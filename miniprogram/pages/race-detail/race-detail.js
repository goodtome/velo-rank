/**
 * 赛事详情页 - 优化版本
 * 使用 ES6+ 语法、统一请求封装、Async/Await
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');

Page({
  data: {
    raceId: '',
    race: {},
    stages: [],
    jerseys: [],
    loading: true,
    loadError: false
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
      }
      if (stagesRes && stagesRes.code === 200 && Array.isArray(stagesRes.data)) {
        stages = stagesRes.data;
      }
      if (jerseysRes && jerseysRes.code === 200 && Array.isArray(jerseysRes.data)) {
        jerseys = jerseysRes.data;
      }

      // 设置导航栏标题
      const title = race.race_name_zh || race.race_name || '赛事详情';
      wx.setNavigationBarTitle({ title });

      this.setData({
        race,
        stages,
        jerseys,
        loading: false,
        genderLabel: race.gender === 'MEN' ? '男子' : race.gender === 'WOMEN' ? '女子' : ''
      });
    } catch (err) {
      console.error('加载赛事失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
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
   * 领骑衫类型中文名
   */
  jerseyTypeName(type) {
    const map = {
      'pink': '粉衫 GC',
      'PINK': '粉衫 GC',
      'purple': '紫衫 积分',
      'PURPLE': '紫衫 积分',
      'blue': '蓝衫 冲刺',
      'BLUE': '蓝衫 冲刺',
      'BLUE_SPRINT': '蓝衫 冲刺',
      'white': '白衫 青年',
      'WHITE': '白衫 青年',
      'WHITE_YOUTH': '白衫 青年'
    };
    return map[type] || type;
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
    const { raceId } = this.data;

    if (!stageId) {
      showError('赛段数据异常');
      return;
    }

    wx.navigateTo({
      url: `/pages/stage-results/stage-results?stageId=${stageId}&stageNumber=${stageNumber}&raceId=${raceId}`
    });
  },

  /**
   * 点击总成绩榜(GC)
   */
  onGCTap() {
    const { raceId } = this.data;
    wx.navigateTo({
      url: `/pages/stage-results/stage-results?type=gc&raceId=${raceId}`
    });
  },

  /**
   * 点击分类榜入口（积分/爬坡/青年）
   */
  onClassTap(e) {
    const { type } = e.currentTarget.dataset;
    const { raceId, stages } = this.data;

    if (!stages || stages.length === 0) {
      showError('暂无赛段数据');
      return;
    }

    // 使用最后一个赛段的ID（最新赛段）
    const latestStage = stages[stages.length - 1];
    const stageId = latestStage.id;

    wx.navigateTo({
      url: `/pages/classification/classification?stageId=${stageId}&raceId=${raceId}&type=${type}`
    });
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
