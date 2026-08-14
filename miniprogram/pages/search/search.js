/**
 * Search page.
 * Supports riders, teams, and filtered race search.
 */

const { get } = require('../../utils/request');
const { debounce, navigateTo } = require('../../utils/util');
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

const SEARCH_PLACEHOLDERS = {
  riders: '搜索车手姓名',
  teams: '搜索车队名称或 UCI 代码',
  races: '搜索赛事名称、国家或年份'
};

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'ALL' },
  { label: '未开始', value: 'upcoming' },
  { label: '进行中', value: 'ongoing' },
  { label: '已完赛', value: 'finished' }
];

const GENDER_OPTIONS = [
  { label: '全部组别', value: 'ALL' },
  { label: '男子', value: 'MEN' },
  { label: '女子', value: 'WOMEN' }
];

const CATEGORY_OPTIONS = [
  { label: '全部类别', value: 'ALL' },
  { label: 'Grand Tour', value: 'GRAND_TOUR' },
  { label: 'WorldTour', value: 'WORLD_TOUR' },
  { label: 'ProSeries', value: 'ProSeries' },
  { label: 'Women WT', value: 'Women-WorldTour' },
  { label: 'Women Pro', value: 'Women-ProSeries' }
];

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return [
    { label: '全部年份', value: 'ALL' },
    ...Array.from({ length: 5 }, (_, index) => {
      const year = currentYear + 1 - index;
      return { label: `${year}`, value: String(year) };
    })
  ];
}

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
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end || '';
}

function getOptionLabel(options, value) {
  const item = options.find(option => option.value === value);
  return item ? item.label : options[0].label;
}

function statusLabel(status) {
  if (status === 'upcoming') return '未开始';
  if (status === 'ongoing' || status === 'active') return '进行中';
  if (status === 'finished') return '已完赛';
  return '';
}

function genderLabel(gender) {
  if (gender === 'MEN') return '男子';
  if (gender === 'WOMEN') return '女子';
  return '';
}

Page({
  data: {
    keyword: '',
    searchType: 'riders',
    searchTypeLabel: SEARCH_LABELS.riders,
    searchPlaceholder: SEARCH_PLACEHOLDERS.riders,
    results: [],
    totalCount: 0,
    loading: false,
    loadingMore: false,
    searched: false,
    loadError: false,
    hasMore: false,
    searchHistory: [],
    yearOptions: buildYearOptions(),
    statusOptions: STATUS_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    categoryOptions: CATEGORY_OPTIONS,
    selectedYearIndex: 0,
    selectedStatusIndex: 0,
    selectedGenderIndex: 0,
    selectedCategoryIndex: 0,
    selectedYearLabel: '全部年份',
    selectedStatusLabel: '全部状态',
    selectedGenderLabel: '全部组别',
    selectedCategoryLabel: '全部类别'
  },

  debouncedSearch: null,
  _isLoading: false,
  _saveHistoryTimer: null,

  onLoad() {
    this.loadSearchHistory();
    this.debouncedSearch = debounce(() => {
      this.doSearch();
    }, DEBOUNCE.SEARCH_INPUT_DELAY);

    // 默认展示车手列表，避免首次进入搜索页时只有空白引导。
    this.doSearch();
  },

  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history });
  },

  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });

    if (!keyword.trim() && this.data.searchType !== 'races') {
      // 车手、车队标签在未输入关键词时展示默认列表。
      this.doSearch();
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
      searchPlaceholder: SEARCH_PLACEHOLDERS[type] || SEARCH_PLACEHOLDERS.riders,
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

  getRaceFilterParams() {
    const {
      yearOptions, statusOptions, genderOptions, categoryOptions,
      selectedYearIndex, selectedStatusIndex, selectedGenderIndex, selectedCategoryIndex
    } = this.data;

    const filters = {};
    const year = yearOptions[selectedYearIndex].value;
    const status = statusOptions[selectedStatusIndex].value;
    const gender = genderOptions[selectedGenderIndex].value;
    const category = categoryOptions[selectedCategoryIndex].value;

    if (year !== 'ALL') filters.year = year;
    if (status !== 'ALL') filters.status = status;
    if (gender !== 'ALL') filters.gender = gender;
    if (category !== 'ALL') filters.category = category;
    return filters;
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
        const dateRange = formatDateRange(race.start_date, race.end_date);
        return {
          ...race,
          displayName: name.zh || name.en,
          displaySub: [
            race.season ? `${race.season} 赛季` : '',
            race.country || '',
            dateRange
          ].filter(Boolean).join(' · '),
          typeLabel: race.category || '',
          genderLabel: genderLabel(race.gender),
          statusLabel: statusLabel(race.status)
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
      if (keyword) params.q = keyword;
      if (this.data.searchType === 'races') {
        Object.assign(params, this.getRaceFilterParams());
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

  onYearChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      selectedYearIndex: index,
      selectedYearLabel: getOptionLabel(this.data.yearOptions, this.data.yearOptions[index].value)
    });
    this.doSearch();
  },

  onStatusChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      selectedStatusIndex: index,
      selectedStatusLabel: getOptionLabel(this.data.statusOptions, this.data.statusOptions[index].value)
    });
    this.doSearch();
  },

  onGenderChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      selectedGenderIndex: index,
      selectedGenderLabel: getOptionLabel(this.data.genderOptions, this.data.genderOptions[index].value)
    });
    this.doSearch();
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      selectedCategoryIndex: index,
      selectedCategoryLabel: getOptionLabel(this.data.categoryOptions, this.data.categoryOptions[index].value)
    });
    this.doSearch();
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
      title: '提示',
      content: '确定清除搜索历史？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ searchHistory: [] });
          wx.showToast({ title: '已清除', icon: 'success' });
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
