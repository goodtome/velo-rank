/**
 * 服务器端常量配置文件
 * 集中管理所有魔法数字，提升代码可维护性
 */

// 分页配置
const PAGINATION = {
  // 默认每页条数
  DEFAULT_LIMIT: 20,
  // 最小每页条数
  MIN_LIMIT: 1,
  // 最大每页条数
  MAX_LIMIT: 100,
  // 最大页数
  MAX_PAGE: 1000,
};

// 缓存配置
const CACHE = {
  // 统计数据缓存有效期（毫秒）- 5分钟
  STATS_TTL: 5 * 60 * 1000,
  // 赛事数据缓存有效期（毫秒）- 10分钟
  RACE_TTL: 10 * 60 * 1000,
};

// 验证配置
const VALIDATION = {
  // 允许的赛事类别
  ALLOWED_CATEGORIES: ['WorldTour', 'ProSeries', 'Continental', 'Women-WorldTour', 'Women-ProSeries'],
  // 允许的性别
  ALLOWED_GENDERS: ['Male', 'Female'],
  // 最小赛季年份
  MIN_SEASON: 2000,
  // 最大赛季年份
  MAX_SEASON: 2100,
  // 最小ID值
  MIN_ID: 1,
};

// 错误码
const ERROR_CODE = {
  // 请求成功
  SUCCESS: 200,
  // 客户端错误
  BAD_REQUEST: 400,
  // 未授权
  UNAUTHORIZED: 401,
  // 禁止访问
  FORBIDDEN: 403,
  // 资源不存在
  NOT_FOUND: 404,
  // 服务器错误
  INTERNAL_ERROR: 500,
  // 服务不可用
  SERVICE_UNAVAILABLE: 503,
};

module.exports = {
  PAGINATION,
  CACHE,
  VALIDATION,
  ERROR_CODE,
};
