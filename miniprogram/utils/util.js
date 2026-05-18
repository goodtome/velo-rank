/**
 * 工具函数库
 */

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或字符串
 * @param {string} fmt - 格式字符串，如 'YYYY-MM-DD'
 * @returns {string}
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

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} interval - 间隔时间（毫秒）
 * @returns {Function}
 */
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

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 */
function showError(message) {
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  });
}

/**
 * 显示成功提示
 * @param {string} message - 成功消息
 */
function showSuccess(message) {
  wx.showToast({
    title: message,
    icon: 'success',
    duration: 1500
  });
}

/**
 * 安全获取数据（避免 undefined）
 * @param {Object} obj - 对象
 * @param {string} key - 键名
 * @param {*} defaultValue - 默认值
 * @returns {*}
 */
function getSafeData(obj, key, defaultValue = '') {
  if (!obj || typeof obj !== 'object') return defaultValue;
  return obj[key] !== undefined ? obj[key] : defaultValue;
}

module.exports = {
  formatDate,
  debounce,
  throttle,
  showError,
  showSuccess,
  getSafeData
};
