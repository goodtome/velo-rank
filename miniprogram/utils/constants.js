/**
 * 常量配置文件
 * 集中管理所有魔法数字，提升代码可维护性
 */

// 请求配置
const REQUEST = {
  // 请求超时时间（毫秒）
  TIMEOUT: 10000,
  // 重试次数
  MAX_RETRIES: 2,
  // 重试延迟基础值（毫秒）
  RETRY_DELAY_BASE: 1000,
};

// 防抖配置
const DEBOUNCE = {
  // 搜索输入防抖延迟（毫秒）
  SEARCH_INPUT_DELAY: 300,
  // 搜索历史保存防抖延迟（毫秒）
  SAVE_HISTORY_DELAY: 300,
};

// 存储配置
const STORAGE = {
  // 最大搜索历史记录数
  MAX_SEARCH_HISTORY: 10,
  // 最大浏览历史记录数
  MAX_VIEW_HISTORY: 50,
};

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
  // 赛事名称最小长度
  MIN_RACE_NAME_LENGTH: 2,
  // 赛事名称最大长度
  MAX_RACE_NAME_LENGTH: 100,
};

// 错误码
const ERROR_CODE = {
  // 请求成功
  SUCCESS: 0,
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

// 主题配置
const THEME = {
  // 主题存储键名
  STORAGE_KEY: 'theme',
  // 可选主题列表
  THEMES: ['light', 'dark', 'system'],
  // 默认主题
  DEFAULT: 'system',
};

module.exports = {
  REQUEST,
  DEBOUNCE,
  STORAGE,
  PAGINATION,
  CACHE,
  VALIDATION,
  ERROR_CODE,
  THEME,
};
