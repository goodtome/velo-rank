/**
 * 小程序入口文件（优化版）
 * 使用统一的配置管理 + 微信静默登录
 */

const { getEnv, getConfig } = require('./config/env');
const { login } = require('./utils/auth');

App({
  onLaunch() {
    // 小程序启动时的初始化逻辑
    console.log('正一领骑 小程序启动');

    // 获取系统信息（使用新API替换废弃的wx.getSystemInfoSync）
    const windowInfo = wx.getWindowInfo();
    const deviceInfo = wx.getDeviceInfo();
    this.globalData.statusBarHeight = windowInfo.statusBarHeight;
    this.globalData.systemInfo = { ...windowInfo, ...deviceInfo };

    // 根据环境设置API地址
    const config = getConfig();
    this.globalData.baseUrl = config.baseUrl;
    this.globalData.timeout = config.timeout;

    if (config.enableDebug) {
      console.log('当前环境:', getEnv());
      console.log('API地址:', this.globalData.baseUrl);
    }

    // 微信静默登录（非阻塞，失败不影响正常使用）
    login()
      .then(({ token, openid }) => {
        this.globalData.token = token;
        this.globalData.openid = openid;
        console.log('微信登录成功, openid:', openid);
      })
      .catch(err => {
        console.log('微信登录失败（非阻塞）:', err.message);
      });
  },

  globalData: {
    baseUrl: '',
    timeout: 10000,
    systemInfo: null,
    statusBarHeight: 0,

    // 当前赛季
    currentSeason: 2026,

    // 登录态
    token: '',
    openid: ''
  }
});
