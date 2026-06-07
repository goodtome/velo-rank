/**
 * Utility helpers.
 */

function formatDate(date, fmt = 'YYYY-MM-DD') {
  if (typeof date === 'string') {
    date = new Date(date);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return fmt
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

function showError(message) {
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  });
}

function showSuccess(message) {
  wx.showToast({
    title: message,
    icon: 'success',
    duration: 1500
  });
}

function getSafeData(obj, key, defaultValue = '') {
  if (!obj || typeof obj !== 'object') return defaultValue;
  return obj[key] !== undefined ? obj[key] : defaultValue;
}

function navigateTo(target, options = {}) {
  const config = typeof target === 'string'
    ? { url: target, ...options }
    : { ...(target || {}), ...options };

  const { url } = config;
  if (!url || typeof url !== 'string') {
    console.error('导航失败: url must be a string', target);
    return;
  }

  wx.navigateTo({
    ...config,
    url,
    fail: (err) => {
      console.error('导航失败:', { url }, err);
      if (err.errMsg && err.errMsg.includes('limit')) {
        wx.redirectTo({ ...config, url });
      }
    }
  });
}

module.exports = {
  formatDate,
  debounce,
  throttle,
  showError,
  showSuccess,
  getSafeData,
  navigateTo
};
