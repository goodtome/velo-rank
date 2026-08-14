/**
 * 统一网络请求封装（优化版）
 * 支持 Promise API、自动错误处理、超时控制、重试机制
 * 自动注入登录 token
 * 弱网环境自动延长超时时间
 * 
 * @module request
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
 * 检测当前是否为弱网环境
 * @returns {Promise<boolean>}
 */
function isWeakNetwork() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => {
        const type = (res.networkType || '').toLowerCase();
        resolve(REQUEST.WEAK_NETWORK_TYPES.includes(type));
      },
      fail: () => resolve(false) // 检测失败不视为弱网
    });
  });
}

/**
 * 根据错误类型生成用户友好的消息
 * @param {Object} err - requestWithRetry reject 的错误对象
 * @returns {string} 用户可读的错误消息
 */
function formatErrorMessage(err) {
  if (!err) return '请求出错';
  // 服务端已返回明确消息
  if (err.message && err.errorType !== 'unknown') return err.message;
  // 按 errorType 兜底
  switch (err.errorType) {
    case 'timeout':  return '连接超时，请检查网络后重试';
    case 'network':  return '网络连接失败，请确认网络正常';
    case 'server':   return '服务器繁忙，请稍后重试';
    case 'client':   return `请求异常(${err.code || '?'})`;
    default:         return '请求出错，请稍后重试';
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
 */
async function requestWithRetry(options, retries = REQUEST.MAX_RETRIES, delay = REQUEST.RETRY_DELAY_BASE) {
  return new Promise((resolve, reject) => {
    const baseUrl = app.globalData.baseUrl;
    const url = options.url.startsWith('http')
      ? options.url
      : baseUrl + options.url;
    const startedAt = Date.now();

    // 自动注入 auth token
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      ...options.header
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 弱网检测：若调用方未指定 timeout，根据网络类型自动调整
    const timeoutPromise = options.timeout
      ? Promise.resolve(options.timeout)
      : isWeakNetwork().then(weak =>
          weak ? REQUEST.TIMEOUT_WEAK : (app.globalData.timeout || REQUEST.TIMEOUT)
        );

    timeoutPromise.then(timeout => {
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
            const errorType = res.statusCode >= 500 ? 'server' : 'client';
            reject({
              code: res.statusCode,
              errorType,
              message: res.data?.message || (res.statusCode >= 500 ? '服务器繁忙，请稍后重试' : `请求失败(${res.statusCode})`),
              data: res.data
            });
          }
        },
        fail: (err) => {
          const elapsed = Date.now() - startedAt;
          const isTimeout = err.errMsg?.includes('timeout');
          const isNetworkError = err.errMsg?.includes('fail');
          const debugDetail = {
            url,
            method: options.method || 'GET',
            timeout,
            elapsed,
            retries,
            errMsg: err.errMsg
          };

          // 超时错误只重试1次（避免Fly.io冷启动时等待过久）
          const maxRetriesForError = isTimeout ? Math.min(retries, 1) : retries;

          if (maxRetriesForError > 0 && (isTimeout || isNetworkError)) {
            // 超时或网络错误，尝试重试
            console.log(`网络请求失败，${delay}ms后重试，剩余${maxRetriesForError}次`, debugDetail);
            setTimeout(() => {
              requestWithRetry(options, maxRetriesForError - 1, delay * 2)
                .then(resolve)
                .catch(reject);
            }, delay);
          } else {
            let errorMessage, errorType;
            if (isTimeout) {
              errorMessage = '连接超时，请检查网络后重试';
              errorType = 'timeout';
            } else if (isNetworkError) {
              errorMessage = '网络连接失败，请确认网络正常后重试';
              errorType = 'network';
            } else {
              errorMessage = '请求出错，请稍后重试';
              errorType = 'unknown';
            }
            reject({
              code: -1,
              errorType,
              message: errorMessage,
              detail: {
                ...debugDetail,
                raw: err
              }
            });
          }
        }
      });
    });
  });
}

/**
 * 基础请求方法（对外接口）
 */
function request(options) {
  return requestWithRetry(options, REQUEST.MAX_RETRIES, REQUEST.RETRY_DELAY_BASE);
}

/**
 * GET 请求
 */
function get(url, data = {}, options = {}) {
  return request({ url, method: 'GET', data, ...options });
}

/**
 * POST 请求
 */
function post(url, data = {}, options = {}) {
  return request({ url, method: 'POST', data, ...options });
}

/**
 * PUT 请求
 */
function put(url, data = {}, options = {}) {
  return request({ url, method: 'PUT', data, ...options });
}

/**
 * DELETE 请求
 */
function del(url, data = {}, options = {}) {
  return request({ url, method: 'DELETE', data, ...options });
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  formatErrorMessage,
  REQUEST
};
