/**
 * 微信登录模块
 * 封装 wx.login、token 管理、登录态检查
 *
 * 注意：此模块直接使用 wx.request 避免与 request.js 循环依赖
 */

const STORAGE_KEY_TOKEN = 'auth_token';
const STORAGE_KEY_OPENID = 'openid';

/**
 * 微信登录：调用 wx.login 获取 code，发送到服务端换取 token
 * 成功后自动存储 token 和 openid 到本地 Storage
 *
 * @returns {Promise<{token: string, openid: string}>}
 */
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('wx.login 未返回 code'));
          return;
        }

        const app = getApp();
        const baseUrl = app.globalData.baseUrl;

        // 直接用 wx.request 避免循环依赖 request.js
        wx.request({
          url: `${baseUrl}/auth/login`,
          method: 'POST',
          data: { code: loginRes.code },
          header: { 'Content-Type': 'application/json' },
          timeout: 10000, // 10秒超时，避免Fly.io冷启动时无限等待
          success: (res) => {
            if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.data) {
              const { token, openid } = res.data.data;
              wx.setStorageSync(STORAGE_KEY_TOKEN, token);
              wx.setStorageSync(STORAGE_KEY_OPENID, openid);
              resolve({ token, openid });
            } else {
              reject(new Error(res.data?.message || '登录失败'));
            }
          },
          fail: (err) => {
            reject(new Error(err.errMsg || '网络请求失败'));
          }
        });
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'wx.login 调用失败'));
      }
    });
  });
}

/**
 * 获取本地存储的 token
 * @returns {string}
 */
function getToken() {
  try {
    return wx.getStorageSync(STORAGE_KEY_TOKEN) || '';
  } catch (e) {
    return '';
  }
}

/**
 * 获取本地存储的 openid
 * @returns {string}
 */
function getOpenid() {
  try {
    return wx.getStorageSync(STORAGE_KEY_OPENID) || '';
  } catch (e) {
    return '';
  }
}

/**
 * 是否已登录（有 token 就算）
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!getToken();
}

/**
 * 退出登录：清除本地 token 和 openid
 */
function logout() {
  try {
    wx.removeStorageSync(STORAGE_KEY_TOKEN);
    wx.removeStorageSync(STORAGE_KEY_OPENID);
  } catch (e) {
    // ignore
  }
}

module.exports = { login, getToken, getOpenid, isLoggedIn, logout };
