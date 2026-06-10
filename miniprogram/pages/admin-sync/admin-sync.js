const { get, post } = require('../../utils/request');
const { debounce, showSuccess } = require('../../utils/util');

const ADMIN_KEY_STORAGE = 'adminSyncKey';
const AUTO_REFRESH_STORAGE = 'adminSyncAutoRefreshEnabled';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    adminKey: '',
    keyword: '',
    raceResults: [],
    selectedRace: null,
    forceRefresh: false,
    searching: false,
    submitting: false,
    loadingLogs: false,
    autoRefreshEnabled: false,
    autoRefreshManualOff: false,
    lastRefreshedAt: '',
    loadError: false,
    errorMessage: '',
    recentLogs: []
  },

  debouncedSearch: null,
  refreshTimer: null,
  refreshIntervalMs: 10000,

  onLoad() {
    this.restoreAdminKey();
    this.debouncedSearch = debounce(() => {
      this.searchRaces();
    }, 350);
  },

  onShow() {
    this.startAutoRefresh();
  },

  onHide() {
    this.clearAutoRefreshTimer();
  },

  onUnload() {
    this.clearAutoRefreshTimer();
  },

  restoreAdminKey() {
    const adminKey = wx.getStorageSync(ADMIN_KEY_STORAGE) || '';
    const autoRefreshEnabled = wx.getStorageSync(AUTO_REFRESH_STORAGE);
    if (adminKey) {
      this.setData({
        adminKey,
        autoRefreshEnabled: autoRefreshEnabled !== false,
        autoRefreshManualOff: autoRefreshEnabled === false
      }, () => {
        this.loadRecentLogs();
        if (this.data.autoRefreshEnabled) {
          this.startAutoRefresh();
        }
      });
    }
  },

  onAdminKeyInput(e) {
    const adminKey = e.detail.value.trim();
    this.setData({ adminKey });
    wx.setStorageSync(ADMIN_KEY_STORAGE, adminKey);

    if (adminKey) {
      if (!this.data.autoRefreshManualOff) {
        this.startAutoRefresh();
      }
      this.loadRecentLogs();
    } else {
      this.stopAutoRefresh();
      this.setData({
        recentLogs: [],
        lastRefreshedAt: '',
        autoRefreshEnabled: false,
        autoRefreshManualOff: false
      });
      wx.setStorageSync(AUTO_REFRESH_STORAGE, false);
    }
  },

  onKeywordInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });

    if (!keyword.trim()) {
      this.setData({ raceResults: [], selectedRace: null });
      return;
    }

    this.debouncedSearch();
  },

  async searchRaces() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      this.setData({ raceResults: [], selectedRace: null });
      return;
    }

    this.setData({ searching: true, loadError: false, errorMessage: '' });

    try {
      const res = await get('/search/races', { q: keyword, limit: 20, page: 1 });
      const raceResults = res?.code === 200 ? (res.data?.races || []) : [];

      this.setData({
        raceResults,
        selectedRace: raceResults.length > 0 ? raceResults[0] : null
      });
    } catch (error) {
      this.setData({
        loadError: true,
        errorMessage: error?.message || '搜索失败'
      });
    } finally {
      this.setData({ searching: false });
    }
  },

  selectRace(e) {
    const { index } = e.currentTarget.dataset;
    const race = this.data.raceResults[index];
    if (!race) return;
    this.setData({ selectedRace: race });
  },

  toggleForceRefresh(e) {
    this.setData({ forceRefresh: e.detail.value });
  },

  async submitSync() {
    const { adminKey, selectedRace, forceRefresh } = this.data;
    if (!adminKey) {
      wx.showToast({ title: '请先填写管理员密钥', icon: 'none' });
      return;
    }
    if (!selectedRace?.id) {
      wx.showToast({ title: '请先选择赛事', icon: 'none' });
      return;
    }

    this.setData({ submitting: true, loadError: false, errorMessage: '' });

    try {
      const res = await post(
        `/sync/races/${selectedRace.id}`,
        {
          race_code: selectedRace.race_code,
          force_refresh: forceRefresh
        },
        {
          header: {
            'x-admin-key': adminKey
          }
        }
      );

      if (res?.code === 202) {
        showSuccess('同步任务已提交');
        this.loadRecentLogs();
      } else {
        wx.showToast({ title: '提交失败', icon: 'none' });
      }
    } catch (error) {
      this.setData({
        loadError: true,
        errorMessage: error?.message || '提交同步失败'
      });
      wx.showToast({ title: '提交同步失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async loadRecentLogs() {
    const { adminKey } = this.data;
    if (!adminKey) {
      this.setData({ recentLogs: [], autoRefreshEnabled: false });
      return;
    }

    this.setData({ loadingLogs: true });

    try {
      const res = await get(
        '/sync/logs',
        { page: 1, limit: 8 },
        {
          header: {
            'x-admin-key': adminKey
          }
        }
      );

      const recentLogs = (res?.code === 200 && Array.isArray(res.data))
        ? res.data.map(item => ({
          ...item,
          startedAt: formatDateTime(item.started_at),
          completedAt: formatDateTime(item.completed_at)
        }))
        : [];

      this.setData({
        recentLogs,
        lastRefreshedAt: formatDateTime(new Date().toISOString())
      });
    } catch (error) {
      this.setData({
        loadError: true,
        errorMessage: error?.message || '加载日志失败'
      });
    } finally {
      this.setData({ loadingLogs: false });
    }
  },

  refreshLogs() {
    this.loadRecentLogs();
  },

  toggleAutoRefresh(e) {
    const enabled = !!e.detail.value;
    this.setData({
      autoRefreshEnabled: enabled,
      autoRefreshManualOff: !enabled
    });
    wx.setStorageSync(AUTO_REFRESH_STORAGE, enabled);

    if (enabled) {
      this.startAutoRefresh();
      this.loadRecentLogs();
    } else {
      this.stopAutoRefresh();
    }
  },

  clearAutoRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  startAutoRefresh() {
    if (this.refreshTimer) return;
    if (!this.data.adminKey) return;
    if (!this.data.autoRefreshEnabled) return;

    this.setData({ autoRefreshEnabled: true });
    this.refreshTimer = setInterval(() => {
      if (this.data.adminKey && !this.data.loadingLogs) {
        this.loadRecentLogs();
      }
    }, this.refreshIntervalMs);
  },

  stopAutoRefresh() {
    this.clearAutoRefreshTimer();
    this.setData({ autoRefreshEnabled: false });
  },

  onPullDownRefresh() {
    Promise.all([this.searchRaces(), this.loadRecentLogs()]).finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
