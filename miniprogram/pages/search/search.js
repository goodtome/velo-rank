/**
 * Search page
 * Supports riders, teams, and races.
 */

const { get } = require('../../utils/request');
const { debounce, navigateTo } = require('../../utils/util');
const { t, getLocale } = require('../../utils/i18n');
const { DEBOUNCE, STORAGE } = require('../../utils/constants');
const { getCountryName } = require('../../utils/country-map');
const { formatRiderName, formatTeamName, formatRaceName } = require('../../utils/string-format');

const INITIAL_LIMIT = 50;
const LOAD_MORE_LIMIT = 100;

const SEARCH_LABELS = {
  riders: '车手',
  teams: '车队',
  races: '赛事'
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function formatDateRange(startDate, endDate) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end) return `${start} - ${end}`;
  return start || end || '';
}

Page({
  data: {
    keyword: '',
    searchType: 'riders',
    searchTypeLabel: SEARCH_LABELS.riders,
    results: [],
    totalCount: 0,
    loading: false,
    loadingMore: false,
    searched: false,
    loadError: false,
    hasMore: false,
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
    this.setData({
      t: this.t,
      searchTypeLabel: SEARCH_LABELS[this.data.searchType] || SEARCH_LABELS.riders
    });
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
        loading: false,
        loadingMore: false,
        hasMore: false
      });
      return;
    }

    this.debouncedSearch();
  },

  clearInput() {
    this.setData({ keyword: '' });
    this.doSearch();
  },

  switchTab(e) {
    const { type } = e.currentTarget.dataset;
    if (type === this.data.searchType) return;

    this.setData({
      searchType: type,
      searchTypeLabel: SEARCH_LABELS[type] || SEARCH_LABELS.riders,
      results: [],
      totalCount: 0,
      searched: false,
      loadError: false,
      loadingMore: false,
      hasMore: false
    });

    this.doSearch();
  },

  getSearchPath() {
    return this.data.searchType === 'riders'
      ? '/search/riders'
      : this.data.searchType === 'teams'
        ? '/search/teams'
        : '/search/races';
  },

  formatResults(data) {
    if (this.data.searchType === 'riders' && data.riders) {
      return data.riders.map(rider => {
        const name = formatRiderName(rider);
        return {
          ...rider,
          nationalityZh: getCountryName(rider.nationality),
          displayName: name.zh || name.en,
          displaySub: name.zh ? name.en : ''
        };
      });
    }

    if (this.data.searchType === 'teams' && data.teams) {
      return data.teams.map(team => {
        const name = formatTeamName(team);
        return {
          ...team,
          displayName: name.zh || name.en,
          displaySub: name.zh ? name.en : ''
        };
      });
    }

    if (this.data.searchType === 'races' && data.races) {
      return data.races.map(race => {
        const name = formatRaceName(race);
        return {
          ...race,
          displayName: name.zh || name.en,
          displaySub: [
            race.season ? `${race.season} 赛季` : '',
            race.country || '',
            formatDateRange(race.start_date, race.end_date)
          ].filter(Boolean).join(' · '),
          typeLabel: race.category || '',
          genderLabel: race.gender === 'MEN' ? '男子' : race.gender === 'WOMEN' ? '女子' : ''
        };
      });
    }

    return [];
  },

  async fetchSearchResults({ append = false } = {}) {
    if (this._isLoading) return;

    const keyword = this.data.keyword.trim();
    const offset = append ? this.data.results.length : 0;

    this._isLoading = true;
    this.setData(append
      ? { loadingMore: true, loadError: false }
      : { loading: true, loadingMore: false, loadError: false, searched: false, hasMore: false }
    );

    try {
      const params = {
        limit: append ? LOAD_MORE_LIMIT : INITIAL_LIMIT,
        offset
      };
      if (keyword) {
        params.q = keyword;
      }

      const res = await get(this.getSearchPath(), params);
      const data = res && res.code === 200 && res.data ? res.data : {};
      const nextResults = this.formatResults(data);
      const results = append ? this.data.results.concat(nextResults) : nextResults;
      const totalCount = data.total !== undefined ? data.total : results.length;

      this.setData({
        results,
        totalCount,
        loading: false,
        loadingMore: false,
        searched: true,
        hasMore: results.length < totalCount
      });

      this.saveHistory(keyword);
    } catch (err) {
      console.error('搜索失败:', err);
      this.setData({
        loading: false,
        loadingMore: false,
        loadError: !append,
        searched: true
      });
      if (append) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    } finally {
      this._isLoading = false;
    }
  },

  doSearch() {
    return this.fetchSearchResults({ append: false });
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.fetchSearchResults({ append: true });
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
    }, DEBOUNCE.SAVE_HISTORY_DELAY || 300);
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
      : this.data.searchType === 'teams'
        ? `/pages/team-detail/team-detail?id=${id}`
        : `/pages/race-detail/race-detail?id=${id}`;

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
