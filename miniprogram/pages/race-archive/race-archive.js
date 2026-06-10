const { get, formatErrorMessage } = require('../../utils/request');
const { navigateTo, formatDate } = require('../../utils/util');

const MIN_YEAR = 2020;

const CATEGORY_LABELS = {
  GRAND_TOUR: '大环赛',
  UCI_WORLD_TOUR: '世巡赛',
  WORLD_CHAMPIONSHIPS: '世锦赛',
  PRO_SERIES: '职业系列赛',
  CONTINENTAL: '洲际赛',
  CLASSICS: '古典赛',
  STAGE_RACE: '多日赛',
  ONE_DAY_RACE: '单日赛'
};

function toDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return null;
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isFinishedAfterEndOfDay(endDateValue, now = new Date()) {
  const endDate = parseDateOnly(endDateValue);
  if (!endDate) return false;
  endDate.setHours(23, 59, 59, 999);
  return now.getTime() > endDate.getTime();
}

function buildRaceDays(startDateValue, endDateValue) {
  const start = parseDateOnly(startDateValue);
  const end = parseDateOnly(endDateValue);
  if (!start || !end) return [];

  const raceDays = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (current <= end) {
    raceDays.push(toDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return raceDays;
}

function formatRange(startDate, endDate) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (start && end && start !== end) {
    return `${start} 至 ${end}`;
  }
  return start || end || '';
}

Page({
  data: {
    yearOptions: [],
    selectedYear: '',
    searchKeyword: '',
    categoryOptions: [],
    selectedCategory: 'ALL',
    sortOptions: [
      { value: 'start_date', label: '起始日期' },
      { value: 'total_stages', label: '总赛段数' }
    ],
    selectedSort: 'start_date',
    statusOptions: [
      { value: 'ALL', label: '全部状态' },
      { value: 'ongoing', label: '仅进行中' },
      { value: 'finished', label: '仅已结束' },
      { value: 'upcoming', label: '仅未开始' }
    ],
    selectedStatus: 'ALL',
    races: [],
    allRaces: [],
    loading: false,
    loadError: false,
    errorMessage: '',
    stats: {
      total: 0,
      ongoing: 0,
      finished: 0,
      upcoming: 0
    }
  },

  onLoad() {
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let year = currentYear; year >= MIN_YEAR; year -= 1) {
      yearOptions.push(year);
    }

    this.setData({
      yearOptions,
      selectedYear: currentYear
    });
    this.loadArchive(currentYear);
  },

  getCategoryLabel(category) {
    if (!category) return '未分类';
    return CATEGORY_LABELS[category] || category;
  },

  getSeasonTypeOptions(races) {
    const seen = new Set();
    const options = [{ value: 'ALL', label: '全部类型' }];

    for (const race of races || []) {
      const raw = race.category || '';
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      options.push({
        value: raw,
        label: this.getCategoryLabel(raw)
      });
    }

    return options;
  },

  filterRaces(races, category, status, keyword) {
    let visible = Array.isArray(races) ? races.slice() : [];
    const normalizedKeyword = (keyword || '').trim().toLowerCase();

    if (category && category !== 'ALL') {
      visible = visible.filter(race => race.category === category);
    }

    if (status && status !== 'ALL') {
      visible = visible.filter(race => race.status === status);
    }

    if (normalizedKeyword) {
      visible = visible.filter(race => {
        const haystack = [
          race.displayName,
          race.race_name,
          race.race_name_en,
          race.race_name_zh,
          race.race_code,
          race.country,
          race.categoryLabel,
          race.category
        ].filter(Boolean).join(' ').toLowerCase();

        return haystack.includes(normalizedKeyword);
      });
    }

    return visible;
  },

  sortRaces(races, sortKey) {
    const visible = Array.isArray(races) ? races.slice() : [];

    if (sortKey === 'total_stages') {
      return visible.sort((a, b) => {
        const totalB = Number(b.total_stages || 0);
        const totalA = Number(a.total_stages || 0);
        if (totalB !== totalA) return totalB - totalA;
        return (b.start_date || '').localeCompare(a.start_date || '');
      });
    }

    return visible.sort((a, b) => {
      const dateOrder = (b.start_date || '').localeCompare(a.start_date || '');
      if (dateOrder !== 0) return dateOrder;
      return Number(b.total_stages || 0) - Number(a.total_stages || 0);
    });
  },

  calcStats(races) {
    return (races || []).reduce((acc, race) => {
      acc.total += 1;
      acc[race.status] += 1;
      return acc;
    }, { total: 0, ongoing: 0, finished: 0, upcoming: 0 });
  },

  syncVisibleRaces(nextState = {}) {
    const allRaces = nextState.allRaces || this.data.allRaces;
    const categoryOptions = nextState.categoryOptions || this.data.categoryOptions;
    const selectedCategory = nextState.selectedCategory !== undefined
      ? nextState.selectedCategory
      : this.data.selectedCategory;
    const selectedStatus = nextState.selectedStatus !== undefined
      ? nextState.selectedStatus
      : this.data.selectedStatus;
    const searchKeyword = nextState.searchKeyword !== undefined
      ? nextState.searchKeyword
      : this.data.searchKeyword;
    const selectedSort = nextState.selectedSort !== undefined
      ? nextState.selectedSort
      : this.data.selectedSort;

    const categoryValid = categoryOptions.some(option => option.value === selectedCategory);
    const statusValid = this.data.statusOptions.some(option => option.value === selectedStatus);
    const sortValid = this.data.sortOptions.some(option => option.value === selectedSort);
    const normalizedCategory = categoryValid ? selectedCategory : 'ALL';
    const normalizedStatus = statusValid ? selectedStatus : 'ALL';
    const normalizedKeyword = typeof searchKeyword === 'string' ? searchKeyword : '';
    const normalizedSort = sortValid ? selectedSort : 'start_date';

    const visibleRaces = this.sortRaces(
      this.filterRaces(allRaces, normalizedCategory, normalizedStatus, normalizedKeyword),
      normalizedSort
    );
    const stats = this.calcStats(visibleRaces);

    this.setData({
      selectedCategory: normalizedCategory,
      selectedStatus: normalizedStatus,
      searchKeyword: normalizedKeyword,
      selectedSort: normalizedSort,
      races: visibleRaces,
      stats
    });
  },

  async loadArchive(year) {
    const yearNum = parseInt(year, 10) || new Date().getFullYear();
    this.setData({ loading: true, loadError: false, errorMessage: '' });

    try {
      let page = 1;
      const limit = 50;
      let total = 0;
      let collected = [];

      while (true) {
        const res = await get('/search/races', {
          season: yearNum,
          page,
          limit
        });

        if (!res || res.code !== 200 || !res.data) {
          break;
        }

        const pageRaces = Array.isArray(res.data.races) ? res.data.races : [];
        total = res.data.total || total;
        collected = collected.concat(pageRaces);

        if (!pageRaces.length || collected.length >= total) {
          break;
        }

        page += 1;
      }

      const now = new Date();
      const races = collected
        .map(race => {
          const startDate = toDateOnly(race.start_date);
          const endDate = toDateOnly(race.end_date);
          let status = 'upcoming';
          if (startDate && endDate) {
            if (startDate <= formatDate(now) && !isFinishedAfterEndOfDay(endDate, now)) {
              status = 'ongoing';
            } else if (isFinishedAfterEndOfDay(endDate, now)) {
              status = 'finished';
            }
          }
          return {
            ...race,
            start_date: startDate,
            end_date: endDate,
            status,
            raceDays: buildRaceDays(startDate, endDate),
            dateRange: formatRange(startDate, endDate),
            categoryLabel: this.getCategoryLabel(race.category)
          };
        });

      const categoryOptions = this.getSeasonTypeOptions(races);
      this.setData({
        selectedYear: yearNum,
        allRaces: races,
        categoryOptions,
        loading: false
      });
      this.syncVisibleRaces({
        allRaces: races,
        categoryOptions,
        selectedCategory: this.data.selectedCategory,
        selectedStatus: this.data.selectedStatus,
        searchKeyword: this.data.searchKeyword,
        selectedSort: this.data.selectedSort
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadError: true,
        errorMessage: error?.message || formatErrorMessage(error)
      });
    }
  },

  onYearTap(e) {
    const { year } = e.currentTarget.dataset;
    if (!year || year === this.data.selectedYear) return;
    this.loadArchive(year);
  },

  onKeywordInput(e) {
    const searchKeyword = e.detail.value || '';
    this.syncVisibleRaces({
      allRaces: this.data.allRaces,
      categoryOptions: this.data.categoryOptions,
      selectedCategory: this.data.selectedCategory,
      selectedStatus: this.data.selectedStatus,
      searchKeyword,
      selectedSort: this.data.selectedSort
    });
  },

  clearKeyword() {
    if (!this.data.searchKeyword) return;
    this.syncVisibleRaces({
      allRaces: this.data.allRaces,
      categoryOptions: this.data.categoryOptions,
      selectedCategory: this.data.selectedCategory,
      selectedStatus: this.data.selectedStatus,
      searchKeyword: '',
      selectedSort: this.data.selectedSort
    });
  },

  onCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    if (!category || category === this.data.selectedCategory) return;
    this.syncVisibleRaces({
      allRaces: this.data.allRaces,
      categoryOptions: this.data.categoryOptions,
      selectedCategory: category,
      selectedStatus: this.data.selectedStatus,
      searchKeyword: this.data.searchKeyword,
      selectedSort: this.data.selectedSort
    });
  },

  onStatTap(e) {
    const { status } = e.currentTarget.dataset;
    if (!status) return;

    if (status === 'ALL') {
      this.syncVisibleRaces({
        allRaces: this.data.allRaces,
        categoryOptions: this.data.categoryOptions,
        selectedCategory: this.data.selectedCategory,
        selectedStatus: 'ALL',
        searchKeyword: this.data.searchKeyword,
        selectedSort: this.data.selectedSort
      });
      return;
    }

    if (status !== 'ongoing' && status !== 'finished' && status !== 'upcoming') {
      return;
    }

    this.syncVisibleRaces({
      allRaces: this.data.allRaces,
      categoryOptions: this.data.categoryOptions,
      selectedCategory: this.data.selectedCategory,
      selectedStatus: status,
      searchKeyword: this.data.searchKeyword,
      selectedSort: this.data.selectedSort
    });
  },

  onStatusTap(e) {
    const { status } = e.currentTarget.dataset;
    if (!status || status === this.data.selectedStatus) return;
    this.syncVisibleRaces({
      allRaces: this.data.allRaces,
      categoryOptions: this.data.categoryOptions,
      selectedCategory: this.data.selectedCategory,
      selectedStatus: status,
      searchKeyword: this.data.searchKeyword,
      selectedSort: this.data.selectedSort
    });
  },

  onSortTap(e) {
    const { sort } = e.currentTarget.dataset;
    if (!sort || sort === this.data.selectedSort) return;
    this.syncVisibleRaces({
      allRaces: this.data.allRaces,
      categoryOptions: this.data.categoryOptions,
      selectedCategory: this.data.selectedCategory,
      selectedStatus: this.data.selectedStatus,
      searchKeyword: this.data.searchKeyword,
      selectedSort: sort
    });
  },

  resetFilters() {
    const currentYear = new Date().getFullYear();
    this.setData({
      selectedYear: currentYear,
      searchKeyword: '',
      selectedCategory: 'ALL',
      selectedStatus: 'ALL',
      selectedSort: 'start_date'
    });
    this.loadArchive(currentYear);
  },

  onRaceTap(e) {
    const { raceId } = e.currentTarget.dataset;
    if (!raceId) return;
    navigateTo({
      url: `/pages/race-detail/race-detail?id=${raceId}`
    });
  },

  retryLoad() {
    this.loadArchive(this.data.selectedYear);
  },

  onPullDownRefresh() {
    this.loadArchive(this.data.selectedYear).finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
