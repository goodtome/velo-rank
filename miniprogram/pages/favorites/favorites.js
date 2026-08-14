const { get, post, formatErrorMessage } = require('../../utils/request');
const { navigateTo } = require('../../utils/util');
const { getCountryName } = require('../../utils/country-map');
const { formatRiderName } = require('../../utils/string-format');
const auth = require('../../utils/auth');

Page({
  data: {
    loading: true,
    loadError: false,
    errorMessage: '',
    favorites: [],
    removingId: ''
  },

  onLoad() {
    this.loadFavorites();
  },

  async ensureLogin() {
    if (auth.isLoggedIn()) return true;
    try {
      wx.showLoading({ title: '登录中...' });
      await auth.login();
      wx.hideLoading();
      return true;
    } catch (err) {
      wx.hideLoading();
      this.setData({
        loading: false,
        loadError: true,
        errorMessage: '登录失败，请稍后重试'
      });
      return false;
    }
  },

  async loadFavorites() {
    this.setData({ loading: true, loadError: false, errorMessage: '' });

    const loggedIn = await this.ensureLogin();
    if (!loggedIn) return;

    try {
      const res = await get('/favorites');
      const list = res && res.code === 200 && Array.isArray(res.data) ? res.data : [];
      const favorites = list.map(item => {
        const name = formatRiderName(item);
        return {
          ...item,
          displayName: name.zh || name.en,
          displaySub: name.zh ? name.en : '',
          nationalityZh: getCountryName(item.nationality)
        };
      });

      this.setData({
        favorites,
        loading: false,
        loadError: false
      });
    } catch (err) {
      this.setData({
        loading: false,
        loadError: true,
        errorMessage: formatErrorMessage(err)
      });
    }
  },

  goToRider(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    navigateTo(`/pages/rider-detail/rider-detail?id=${id}`);
  },

  removeFavorite(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id || this.data.removingId) return;

    wx.showModal({
      title: '取消关注',
      content: `确定不再关注 ${name || '该车手'}？`,
      confirmText: '取消关注',
      confirmColor: '#d93025',
      success: async (res) => {
        if (!res.confirm) return;
        await this.confirmRemove(id);
      }
    });
  },

  async confirmRemove(riderId) {
    this.setData({ removingId: riderId });
    try {
      const res = await post('/favorites/remove', { rider_id: riderId });
      if (res && res.code === 200) {
        this.setData({
          favorites: this.data.favorites.filter(item => item.rider_id !== riderId)
        });
        wx.showToast({ title: '已取消关注', icon: 'success' });
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      this.setData({ removingId: '' });
    }
  },

  retryLoad() {
    this.loadFavorites();
  },

  onPullDownRefresh() {
    this.loadFavorites().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage() {
    return {
      title: '我的关注 - 正一领骑',
      path: '/pages/favorites/favorites'
    };
  }
});
