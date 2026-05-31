const express = require('express');
const cors = require('cors');
const http = require('http');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 创建HTTP服务器（支持WebSocket升级）
const server = http.createServer(app);

// 安全中间件
const { apiLimiter, adminLimiter, syncLimiter, corsOptions } = require('./config/security');

// 预先创建限流中间件实例（避免每次请求都创建新实例）
const apiLimiterMiddleware = rateLimit(apiLimiter);
const adminLimiterMiddleware = rateLimit(adminLimiter);
const syncLimiterMiddleware = rateLimit(syncLimiter);

// 应用CORS配置
app.use(cors(corsOptions));

// 请求大小限制
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API限流 - 不允许心跳检查和404
app.use('/api/v1/health', (req, res, next) => next()); // 心跳检查不限制
app.use((req, res, next) => {
  // 对于公开的、查询类的API使用普通限流
  if (['GET'].includes(req.method) && req.path.startsWith('/api/v1/search')) {
    return apiLimiterMiddleware(req, res, next);
  }
  next();
});

// 限流 - 所有非健康检查的API
app.use('/api/v1', (req, res, next) => {
  if (req.path.startsWith('/health')) {
    return next();
  }

  // 管理后台使用宽松限流
  if (req.path.startsWith('/admin')) {
    return adminLimiterMiddleware(req, res, next);
  }

  // 数据同步使用严格限流
  if (req.path.startsWith('/sync')) {
    return syncLimiterMiddleware(req, res, next);
  }

  // 其他API使用默认限流
  return apiLimiterMiddleware(req, res, next);
});

// XSS防护中间件
app.use((req, res, next) => {
  if (req.body) {
    // 对body中的数据进行简单清理
    if (typeof req.body === 'object') {
      // 将特殊字符转义
      const sanitize = (obj) => {
        if (typeof obj === 'string') {
          return obj
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        } else if (Array.isArray(obj)) {
          return obj.map(sanitize);
        } else if (typeof obj === 'object' && obj !== null) {
          return Object.keys(obj).reduce((acc, key) => {
            acc[key] = sanitize(obj[key]);
            return acc;
          }, {});
        }
        return obj;
      };
      req.body = sanitize(req.body);
    }
  }
  next();
});

// 统一响应格式中间件（放在路由之前）
const { responseFormatter } = require('./middleware/responseFormatter');
app.use(responseFormatter);

// 请求日志（仅记录非健康检查）
app.use((req, res, next) => {
  if (!req.path.startsWith('/health')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// 健康检查（不需要统一响应格式）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 管理后台静态页面
app.use('/admin', express.static(`${__dirname}/admin`));

// 用户端预览页面
app.get('/user', (req, res) => {
  res.sendFile(`${__dirname}/admin/user-view.html`);
});

// API路由 - 同步需要认证的路由
const { authMiddleware } = require('./middleware/auth');

// 处理OPTIONS预检请求
app.options('*', cors(corsOptions));

// API路由
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/races', require('./routes/races'));
app.use('/api/v1/stats', require('./routes/stats'));
app.use('/api/v1/stages', require('./routes/stages'));
app.use('/api/v1/riders', require('./routes/riders'));
app.use('/api/v1/teams', require('./routes/teams'));
app.use('/api/v1/search', require('./routes/search'));
app.use('/api/v1/sync', require('./routes/sync'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/realtime', require('./routes/realtime'));
app.use('/api/v1/push', require('./routes/push'));

// 404处理（使用统一错误格式）
app.use('*', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

// 统一错误处理中间件（必须放在最后）
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// 初始化WebSocket服务器
const { initWebSocket } = require('./websocket');
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`正一领骑后端服务启动成功 - http://localhost:${PORT}`);
  console.log(`WebSocket服务已启动 - ws://localhost:${PORT}/ws/realtime`);
  console.log(`API文档：http://localhost:${PORT}/api/v1`);
  console.log(`安全配置已加载:`);
  console.log(`  - API限流: 15分钟100次`);
  console.log(`  - 管理后台限流: 1小时1000次`);
  console.log(`  - 数据同步限流: 1小时10次`);
  console.log(`  - CORS已启用`);
});

module.exports = { app, server };
