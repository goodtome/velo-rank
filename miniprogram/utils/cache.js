/**
 * Public data cache for detail and ranking pages.
 * Entries are always returned with expiry metadata so callers can render stale
 * data immediately and refresh it in the background.
 */

const PREFIX = 'velo_rank_cache_v1:';

function makeKey(namespace, params) {
  const suffix = Object.keys(params || {})
    .sort()
    .map(key => `${key}=${encodeURIComponent(params[key] || '')}`)
    .join('&');
  return `${namespace}:${suffix}`;
}

function get(key, options = {}) {
  const { ttl = 0, allowStale = false } = options;
  try {
    const entry = wx.getStorageSync(`${PREFIX}${key}`);
    if (!entry || !entry.cachedAt || !Object.prototype.hasOwnProperty.call(entry, 'data')) return null;
    const isExpired = ttl > 0 && Date.now() - entry.cachedAt > ttl;
    if (isExpired && !allowStale) return null;
    return { data: entry.data, cachedAt: entry.cachedAt, isExpired };
  } catch (error) {
    console.warn('Read cache failed:', error);
    return null;
  }
}

function set(key, data) {
  try {
    wx.setStorageSync(`${PREFIX}${key}`, { cachedAt: Date.now(), data });
  } catch (error) {
    // Storage pressure must never block the page from rendering fresh data.
    console.warn('Write cache failed:', error);
  }
}

function formatCachedAt(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

module.exports = { makeKey, get, set, formatCachedAt };
