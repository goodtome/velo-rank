/**
 * 搜索页面 - 优化版本（修复竞态条件和加载状态）
 * 使用 ES6+ 语法、防抖优化、统一请求封装
 */

const { get } = require('../../utils/request');
const { debounce, showError } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');
const { DEBOUNCE, STORAGE, PAGINATION } = require('../../utils/constants');

Page({
  data: {
    keyword: '',
    searchType: 'riders',
    results: [],
    loading: false,
    searched: false,
    loadError: false,
    searchHistory: []
  },

  // 防抖后的搜索函数
  debouncedSearch: null,

  // 防止重复请求的标志
  _isLoading: false,

  // 保存搜索历史的定时器
  _saveHistoryTimer: null,

  onLoad() {
    this.initI18n();
    this.loadSearchHistory();
    // 创建防抖函数
    this.debouncedSearch = debounce(() => {
      this.doSearch();
    }, DEBOUNCE.SEARCH_INPUT_DELAY);
  },

  /**
   * 初始化i18n
   */
  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({
      t: this.t
    });
  },

  /**
   * 加载搜索历史
   */
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history });
  },

  /**
   * 输入框变化事件
   */
  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });

    if (!keyword.trim()) {
      this.setData({
        results: [],
        searched: false,
        loadError: false,
        loading: false
      });
      return;
    }

    // 使用防抖搜索
    this.debouncedSearch();
  },

  /**
   * 清除输入
   */
  clearInput() {
    this.setData({
      keyword: '',
      results: [],
      searched: false,
      loadError: false,
      loading: false
    });
  },

  /**
   * 切换搜索类型（车手/车队）
   */
  switchTab(e) {
    const { type } = e.currentTarget.dataset;
    if (type === this.data.searchType) return;

    this.setData({
      searchType: type,
      results: [],
      searched: false,
      loadError: false
    });

    if (this.data.keyword.trim()) {
      this.doSearch();
    }
  },

  /**
   * 执行搜索（带防止重复请求保护）
   */
  async doSearch() {
    // 防止重复请求
    if (this._isLoading) {
      console.log('请求进行中，跳过重复请求');
      return;
    }

    const keyword = this.data.keyword.trim();
    if (!keyword) return;

    this._isLoading = true;
    this.setData({ loading: true, loadError: false, searched: false });

    const path = this.data.searchType === 'riders'
      ? '/search/riders'
      : '/search/teams';

    try {
      const res = await get(path, { q: keyword, limit: PAGINATION.DEFAULT_LIMIT });

      let results = [];
      if (res && res.code === 200) {
        if (this.data.searchType === 'riders' && Array.isArray(res.data.riders)) {
          results = res.data.riders;
        } else if (this.data.searchType === 'teams' && Array.isArray(res.data.teams)) {
          results = res.data.teams;
        }
      }

      this.setData({
        results,
        loading: false,
        searched: true
      });

      this.saveHistory(keyword);
    } catch (err) {
      console.error('搜索失败:', err);
      this.setData({
        loading: false,
        loadError: true,
        searched: true
      });
    } finally {
      this._isLoading = false;
    }
  },

  /**
   * 保存搜索历史（使用防抖避免频繁写入）
   */
  saveHistory(keyword) {
    if (!keyword || !keyword.trim()) return;

    // 清除之前的定时器
    if (this._saveHistoryTimer) {
      clearTimeout(this._saveHistoryTimer);
    }

    // 使用防抖延迟写入
    this._saveHistoryTimer = setTimeout(() => {
      try {
        let history = wx.getStorageSync('searchHistory') || [];

        // 移除重复项
        const index = history.indexOf(keyword);
        if (index > -1) {
          history.splice(index, 1);
        }

        // 添加到开头
        history.unshift(keyword);

        // 限制最大条数
        if (history.length > STORAGE.MAX_SEARCH_HISTORY) {
          history = history.slice(0, STORAGE.MAX_SEARCH_HISTORY);
        }

        wx.setStorageSync('searchHistory', history);
        this.setData({ searchHistory: history });

        console.log('搜索历史已保存:', keyword);
      } catch (err) {
        console.error('保存搜索历史失败:', err);
      }
    }, 300);
  },

  /**
   * 清除搜索历史
   */
  clearHistory() {
    wx.showModal({
      title: this.t('tips'),
      content: this.t('clearHistoryConfirm'),
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ searchHistory: [] });
          wx.showToast({ title: this.t('historyCleared'), icon: 'success' });
        }
      }
    });
  },

  /**
   * 点击历史记录
   */
  tapHistory(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({ keyword });
    this.doSearch();
  },

  /**
   * 跳转到详情页
   */
  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    const url = this.data.searchType === 'riders'
      ? `/pages/rider-detail/rider-detail?id=${id}`
      : `/pages/team-detail/team-detail?id=${id}`;

    wx.navigateTo({ url });
  },

  /**
   * 重试搜索
   */
  retrySearch() {
    this.doSearch();
  }
});
