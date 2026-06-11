/**
 * 安全配置文件
 * 包含限流、CORS等安全相关的配置
 */

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

const isProd = process.env.NODE_ENV === 'production';
const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS);

// API限流配置
const apiLimiter = {
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
};

// 管理后台API限流配置（更宽松）
const adminLimiter = {
  windowMs: 60 * 60 * 1000, // 1小时
  max: 1000, // 最多1000次请求
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
};

// 数据同步API限流配置（更严格）
const syncLimiter = {
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 最多10次请求
  message: {
    code: 429,
    message: '同步操作过于频繁，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
};

// CORS配置
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (!isProd && (configuredOrigins.length === 0 || configuredOrigins.includes('*'))) {
      return callback(null, true);
    }

    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['Content-Length', 'Content-Range']
};

// 文件上传配置
const uploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx', '.xlsx'],
  maxFiles: 5
};

// Session配置
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
};

// 密码策略
const passwordConfig = {
  minLength: 8,
  minLengthEn: 12,
  requireUpperCase: false,
  requireLowerCase: false,
  requireNumber: false,
  requireSpecialChar: false,
  maxAttempts: 5, // 最多5次登录尝试
  lockTime: 30 * 60 * 1000 // 锁定30分钟
};

// XSS过滤规则
const xssFilterConfig = {
  enable: true,
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
  allowedAttributes: {},
  whiteList: {
    'a': ['href', 'target', 'title'],
    'img': ['src', 'alt', 'width', 'height']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script']
};

module.exports = {
  apiLimiter,
  adminLimiter,
  syncLimiter,
  corsOptions,
  uploadConfig,
  sessionConfig,
  passwordConfig,
  xssFilterConfig
};
