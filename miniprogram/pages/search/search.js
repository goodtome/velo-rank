/**
 * 搜索页面 - Week 6 优化版本
 * 新增：结果计数显示
 */

const { get } = require('../../utils/request');
const { debounce, showError, navigateTo } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');
const { DEBOUNCE, STORAGE, PAGINATION } = require('../../utils/constants');
const { getCountryName } = require('../../utils/country-map');
const { formatRiderName, formatTeamName } = require('../../utils/string-format');

Page({
  data: {
    keyword: '',
    searchType: 'riders',
    results: [],
    totalCount: 0,       // 搜索结果总数
    loading: false,
    searched: false,
    loadError: false,
    searchHistory: []
  },

  debouncedSearch: null,
  _isLoading: false,
  _saveHistoryTimer: null,

  onLoad() {
    this.initI18n();
    this.loadSearchHistory();
    this.debouncedSearch = debounce(() => {
      this.doSearch();
    }, DEBOUNCE.SEARCH_INPUT_DELAY);
  },

  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({ t: this.t });
  },

  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history });
  },

  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });

    if (!keyword.trim()) {
      this.setData({
        results: [],
        totalCount: 0,
        searched: false,
        loadError: false,
        loading: false
      });
      return;
    }

    this.debouncedSearch();
  },

  clearInput() {
    this.setData({
      keyword: ''
    });
    // 清空输入→重新加载当前Tab的全部列表
    this.doSearch();
  },

  switchTab(e) {
    const { type } = e.currentTarget.dataset;
    if (type === this.data.searchType) return;

    this.setData({
      searchType: type,
      results: [],
      totalCount: 0,
      searched: false,
      loadError: false
    });

    this.doSearch();
  },

  async doSearch() {
    if (this._isLoading) return;

    const keyword = this.data.keyword.trim();

    this._isLoading = true;
    this.setData({ loading: true, loadError: false, searched: false });

    const path = this.data.searchType === 'riders'
      ? '/search/riders'
      : '/search/teams';

    try {
      const params = { limit: keyword ? PAGINATION.DEFAULT_LIMIT : 50 };
      if (keyword) {
        params.q = keyword;
      }

      const res = await get(path, params);

      let results = [];
      let totalCount = 0;

      if (res && res.code === 200) {
        if (this.data.searchType === 'riders' && res.data.riders) {
          results = res.data.riders.map(rider => {
            const name = formatRiderName(rider);
            return {
              ...rider,
              nationalityZh: getCountryName(rider.nationality),
              displayName: name.zh || name.en,
              displaySub: name.zh ? name.en : ''
            };
          });
          totalCount = res.data.total || results.length;
        } else if (this.data.searchType === 'teams' && res.data.teams) {
          results = res.data.teams.map(team => {
            const name = formatTeamName(team);
            return {
              ...team,
              displayName: name.zh || name.en,
              displaySub: name.zh ? name.en : ''
            };
          });
          totalCount = res.data.total || results.length;
        }
      }

      this.setData({
        results,
        totalCount,
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

  saveHistory(keyword) {
    if (!keyword || !keyword.trim()) return;

    if (this._saveHistoryTimer) {
      clearTimeout(this._saveHistoryTimer);
    }

    this._saveHistoryTimer = setTimeout(() => {
      try {
        let history = wx.getStorageSync('searchHistory') || [];
        const index = history.indexOf(keyword);
        if (index > -1) history.splice(index, 1);
        history.unshift(keyword);
        if (history.length > STORAGE.MAX_SEARCH_HISTORY) {
          history = history.slice(0, STORAGE.MAX_SEARCH_HISTORY);
        }
        wx.setStorageSync('searchHistory', history);
        this.setData({ searchHistory: history });
      } catch (err) {
        console.error('保存搜索历史失败:', err);
      }
    }, 300);
  },

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

  tapHistory(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({ keyword });
    this.doSearch();
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    const url = this.data.searchType === 'riders'
      ? `/pages/rider-detail/rider-detail?id=${id}`
      : `/pages/team-detail/team-detail?id=${id}`;

    navigateTo(url);
  },

  retrySearch() {
    this.doSearch();
  },

  onShareAppMessage() {
    return {
      title: '搜索 - 正一领骑',
      path: '/pages/search/search'
    };
  },

  onShareTimeline() {
    return {
      title: '搜索 - 正一领骑'
    };
  }
});
