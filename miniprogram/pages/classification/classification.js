/**
 * 分类榜页面 — 冲刺积分 / 爬坡积分 / 青年车手
 * 通过 type 参数复用：points | mountains | youth
 */

const { get } = require('../../utils/request');
const { showError } = require('../../utils/util');

Page({
  data: {
    stageId: '',
    raceId: '',
    type: 'points',
    stage: null,
    results: [],
    loading: true,
    loadError: false,
    currentPage: 1,
    pageSize: 50,
    hasMore: false,

    // 类型配置
    typeName: {
      points: '冲刺积分榜',
      mountains: '爬坡积分榜',
      youth: '青年车手榜'
    },
    typeSub: {
      points: 'Points Classification',
      mountains: 'Mountains Classification',
      youth: 'Youth Classification'
    },
    typeIcon: {
      points: '🟣',
      mountains: '🔵',
      youth: '⚪'
    }
  },

  onLoad(options) {
    const { stageId = '', raceId = '', type = 'points' } = options || {};

    this.setData({
      stageId,
      raceId,
      type
    });

    // 设置导航栏标题
    const titles = {
      points: '冲刺积分榜',
      mountains: '爬坡积分榜',
      youth: '青年车手榜'
    };
    wx.setNavigationBarTitle({ title: titles[type] || '分类榜' });

    this.loadData();
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
   * 加载分类数据
   */
  async loadData() {
    this.setData({ loading: true, loadError: false });

    const { stageId, type } = this.data;

    if (!stageId) {
      this.setData({ loading: false });
      showError('缺少赛段ID');
      return;
    }

    try {
      // 并行请求赛段信息和分类数据
      const [stageRes, classRes] = await Promise.all([
        get(`/stages/${stageId}`),
        get(`/stages/${stageId}/${type}`)
      ]);

      // 处理赛段信息
      if (stageRes && stageRes.code === 200 && stageRes.data) {
        this.setData({ stage: stageRes.data });
      }

      // 处理分类数据
      let results = [];
      if (classRes && classRes.code === 200 && Array.isArray(classRes.data)) {
        results = classRes.data;
        // 确保每条记录有 rank 字段（youth 表有 rank，points/mountains 按 points DESC 排序）
        results = results.map((item, index) => ({
          ...item,
          rank: item.rank != null ? item.rank : (index + 1)
        }));
      }

      this.setData({
        results,
        hasMore: results.length >= this.data.pageSize,
        loading: false
      });
    } catch (err) {
      console.error('加载分类数据失败:', err);
      this.setData({ loading: false, loadError: true });
      showError('网络请求失败');
    }
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadData();
  },

  /**
   * 加载更多
   */
  async loadMore() {
    // 当前API不支持分页，一次性加载所有数据
    wx.showToast({ title: '已加载全部数据', icon: 'none' });
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
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  }
});
