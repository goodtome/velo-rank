const express = require('express');
const cors = require('cors');
const http = require('http');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, 'config', '.env') });

const { validateEnv } = require('./config/env-check');
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Required when the app runs behind Fly.io, Nginx, or another reverse proxy.
app.set('trust proxy', 1);

const server = http.createServer(app);

const { apiLimiter, adminLimiter, syncLimiter, corsOptions } = require('./config/security');
const apiLimiterMiddleware = rateLimit(apiLimiter);
const adminLimiterMiddleware = rateLimit(adminLimiter);
const syncLimiterMiddleware = rateLimit(syncLimiter);

app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.charset = 'utf-8';
  res.setHeader('Content-Language', 'zh-CN');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Keep health checks out of the limiter chain.
app.use('/api/v1/health', (req, res, next) => next());

app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/v1/search')) {
    return apiLimiterMiddleware(req, res, next);
  }
  next();
});

app.use('/api/v1', (req, res, next) => {
  if (req.path.startsWith('/health')) {
    return next();
  }

  if (req.path.startsWith('/admin')) {
    return adminLimiterMiddleware(req, res, next);
  }

  if (req.path.startsWith('/sync')) {
    return syncLimiterMiddleware(req, res, next);
  }

  return apiLimiterMiddleware(req, res, next);
});

// Do not mutate request bodies globally. Validation and output encoding handle XSS.

const { responseFormatter } = require('./middleware/responseFormatter');
app.use(responseFormatter);

const { requestLogger } = require('./middleware/requestLogger');
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/admin', express.static(`${__dirname}/admin`, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

app.get('/user', (req, res) => {
  res.sendFile(`${__dirname}/admin/user-view.html`);
});

app.options('*', cors(corsOptions));

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/races', require('./routes/races'));
app.use('/api/v1/stats', require('./routes/stats'));
app.use('/api/v1/stages', require('./routes/stages'));
app.use('/api/v1/riders', require('./routes/riders'));
app.use('/api/v1/teams', require('./routes/teams'));
app.use('/api/v1/search', require('./routes/search'));
app.use('/api/v1/favorites', require('./routes/favorites'));
app.use('/api/v1/sync', require('./routes/sync'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/realtime', require('./routes/realtime'));
app.use('/api/v1/push', require('./routes/push'));

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use('*', notFoundHandler);
app.use(errorHandler);

const { initWebSocket } = require('./websocket');
initWebSocket(server);

server.listen(PORT, () => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    type: 'startup',
    message: 'Server started successfully',
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    ws: '/ws/realtime',
  }));

  if (process.env.NODE_ENV !== 'production') {
    console.log(`API docs: http://localhost:${PORT}/api/v1`);
  }
});

if (process.env.NODE_ENV === 'production') {
  try {
    require('./scripts/schedule-backup');
  } catch (err) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      type: 'startup',
      message: 'Backup scheduler failed to start',
      error: err.message,
    }));
  }
}

module.exports = { app, server };
