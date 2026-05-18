const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 创建HTTP服务器（支持WebSocket升级）
const server = http.createServer(app);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 管理后台静态页面
app.use('/admin', express.static(`${__dirname}/admin`));

// 用户端预览页面
app.get('/user', (req, res) => {
  res.sendFile(`${__dirname}/admin/user-view.html`);
});

// API路由
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

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// 初始化WebSocket服务器
const { initWebSocket } = require('./websocket');
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`领骑后端服务启动成功 - http://localhost:${PORT}`);
  console.log(`WebSocket服务已启动 - ws://localhost:${PORT}/ws/realtime`);
  console.log(`API文档：http://localhost:${PORT}/api/v1`);
});

module.exports = { app, server };
