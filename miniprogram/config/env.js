/**
 * 小程序配置管理
 * 集中管理所有环境配置
 */

const ENV = {
  development: {
    baseUrl: 'http://localhost:3000/api/v1',
    timeout: 10000,
    enableDebug: true
  },
  production: {
    baseUrl: 'https://your-domain.com/api/v1', // 部署时修改为实际域名
    timeout: 15000,
    enableDebug: false
  }
};

module.exports = {
  ENV,
  /**
   * 获取当前环境
   */
  getEnv() {
    const deviceInfo = wx.getDeviceInfo();
    return deviceInfo.platform === 'devtools' ? 'development' : 'production';
  },

  /**
   * 获取配置
   */
  getConfig() {
    const env = module.exports.getEnv();
    return ENV[env];
  }
};
