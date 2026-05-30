/**
 * 小程序环境配置管理
 * 
 * 切换环境：
 *   1. 修改下方 CURRENT_ENV 常量（默认值）
 *   2. 或运行时调用 switchEnv() 持久化到本地存储
 * 
 * 用法：
 *   const config = require('./config/env');
 *   const baseUrl = config.getConfig().baseUrl;
 */

// ============================================================
// 当前活跃环境：修改此处切换 'development' | 'production'
// 类似 server 端 NODE_ENV 的作用
// ============================================================
const CURRENT_ENV = 'development';

const STORAGE_KEY = 'app_env_mode';

const ENV = {
  development: {
    baseUrl: 'http://localhost:3000/api/v1',
    wsUrl: 'ws://localhost:3000/ws/realtime',
    timeout: 10000,
    enableDebug: true,
    label: '本地开发'
  },
  production: {
    baseUrl: 'https://velo-rank-api.fly.dev/api/v1',
    wsUrl: 'wss://velo-rank-api.fly.dev/ws/realtime',
    timeout: 15000,
    enableDebug: false,
    label: '正式环境'
  }
};

// 内部函数：获取当前环境名称（不依赖 this）
function _getEnv() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    if (stored && ENV[stored]) return stored;
  } catch (e) {
    // storage 不可用时忽略
  }
  return CURRENT_ENV;
}

module.exports = {
  ENV,

  /**
   * 获取当前环境名称
   * 优先级：本地存储 > 代码默认值
   */
  getEnv: _getEnv,

  /**
   * 获取当前环境配置
   */
  getConfig() {
    return ENV[_getEnv()];
  },

  /**
   * 运行时切换环境（持久化到本地存储）
   * @param {string} env - 'development' | 'production'
   */
  switchEnv(env) {
    if (!ENV[env]) {
      console.error(`无效的环境: ${env}，可选值: ${Object.keys(ENV).join(', ')}`);
      return false;
    }
    wx.setStorageSync(STORAGE_KEY, env);
    console.log(`环境已切换至: ${env} (${ENV[env].baseUrl})`);
    return true;
  },

  /**
   * 获取当前 baseUrl
   */
  getBaseUrl() {
    return ENV[_getEnv()].baseUrl;
  },

  /**
   * 获取当前 WebSocket URL
   */
  getWsUrl() {
    return ENV[_getEnv()].wsUrl;
  }
};
