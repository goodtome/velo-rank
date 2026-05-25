/**
 * 统一网络请求封装（优化版）
 * 支持 Promise API、自动错误处理、超时控制、重试机制
 * 自动注入登录 token
 * 
 * @module request
 * @author 高级开发工程师
 * @since 2026-05-16
 */

const app = getApp();
const { REQUEST } = require('./constants');

/**
 * 从 Storage 读取 auth token（避免循环依赖 auth.js）
 */
function getAuthToken() {
  try {
    return wx.getStorageSync('auth_token') || '';
  } catch (e) {
    return '';
  }
}

/**
 * 基础请求方法（内部使用，支持重试）
 * @param {Object} options - 请求配置
 * @param {string} options.url - 请求地址
 * @param {string} [options.method=GET] - 请求方法
 * @param {Object} [options.data] - 请求数据
 * @param {Object} [options.header] - 请求头
 * @param {number} [options.timeout] - 超时时间（毫秒）
 * @param {number} [retries=2] - 剩余重试次数
 * @param {number} [delay=1000] - 当前重试延迟（毫秒）
 * @returns {Promise<Object>} 请求结果
 * @resolve {Object} res - 响应数据
 * @reject {Object} err - 错误信息
 */
function requestWithRetry(options, retries = REQUEST.MAX_RETRIES, delay = REQUEST.RETRY_DELAY_BASE) {
  return new Promise((resolve, reject) => {
    const baseUrl = app.globalData.baseUrl;
    const url = options.url.startsWith('http')
      ? options.url
      : baseUrl + options.url;

    const timeout = options.timeout || app.globalData.timeout || REQUEST.TIMEOUT;

    // 自动注入 auth token
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.header
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    wx.request({
      url: url,
      method: options.method || 'GET',
      data: options.data || {},
      header: headers,
      timeout: timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode >= 500 && retries > 0) {
          // 服务器错误，尝试重试
          console.log(`请求失败(${res.statusCode})，${delay}ms后重试，剩余${retries}次`);
          setTimeout(() => {
            requestWithRetry(options, retries - 1, delay * 2)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          reject({
            code: res.statusCode,
            message: res.data?.message || `请求失败(${res.statusCode})`,
            data: res.data
          });
        }
      },
      fail: (err) => {
        const isTimeout = err.errMsg?.includes('timeout');
        const isNetworkError = err.errMsg?.includes('fail');

        if (retries > 0 && (isTimeout || isNetworkError)) {
          // 超时或网络错误，尝试重试
          console.log(`网络请求失败，${delay}ms后重试，剩余${retries}次`);
          setTimeout(() => {
            requestWithRetry(options, retries - 1, delay * 2)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          reject({
            code: -1,
            message: isTimeout ? '网络连接超时' : '网络连接失败',
            detail: err
          });
        }
      }
    });
  });
}

/**
 * 基础请求方法（对外接口）
 * @param {Object} options - 请求配置
 * @param {string} options.url - 请求地址
 * @param {string} [options.method=GET] - 请求方法
 * @param {Object} [options.data] - 请求数据
 * @param {Object} [options.header] - 请求头
 * @param {number} [options.timeout] - 超时时间（毫秒）
 * @returns {Promise<Object>} 请求结果
 * @example
 * request({
 *   url: '/api/v1/races',
 *   method: 'GET',
 *   data: { page: 1 }
 * })
 */
function request(options) {
  return requestWithRetry(options, REQUEST.MAX_RETRIES, REQUEST.RETRY_DELAY_BASE);
}

/**
 * GET 请求
 * @param {string} url - 请求地址
 * @param {Object} [data={}] - 请求参数
 * @param {Object} [options={}] - 额外配置（timeout, retries等）
 * @returns {Promise<Object>} 请求结果
 * @example
 * get('/api/v1/races', { page: 1, limit: 20 })
 */
function get(url, data = {}, options = {}) {
  return request({
    url,
    method: 'GET',
    data,
    ...options
  });
}

/**
 * POST 请求
 * @param {string} url - 请求地址
 * @param {Object} [data={}] - 请求数据
 * @param {Object} [options={}] - 额外配置（timeout, retries等）
 * @returns {Promise<Object>} 请求结果
 * @example
 * post('/api/v1/races', { race_name: '新规赛事' })
 */
function post(url, data = {}, options = {}) {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  });
}

/**
 * PUT 请求
 * @param {string} url - 请求地址
 * @param {Object} [data={}] - 请求数据
 * @param {Object} [options={}] - 额外配置（timeout, retries等）
 * @returns {Promise<Object>} 请求结果
 * @example
 * put('/api/v1/races/1', { race_name: '更新赛事' })
 */
function put(url, data = {}, options = {}) {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  });
}

/**
 * DELETE 请求
 * @param {string} url - 请求地址
 * @param {Object} [data={}] - 请求数据
 * @param {Object} [options={}] - 额外配置（timeout, retries等）
 * @returns {Promise<Object>} 请求结果
 * @example
 * del('/api/v1/races/1')
 */
function del(url, data = {}, options = {}) {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  });
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  REQUEST
};
