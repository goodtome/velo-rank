# 正一领骑小程序 - BUG和待修复问题汇总

## 版本信息
- 项目名称: 正一领骑 (zhengyi-lingqi)
- 当前版本: 1.0.0
- 最后更新: 2026-05-29

---

## 文件位置说明
- 前端代码: `miniprogram/` 目录
- 后端代码: `server/` 目录
- 数据库配置: `server/config/`

---

## 一、未完成功能(TODO标记)

### 1. 实时成绩追踪页面 (`miniprogram/pages/realtime-results/realtime-results.js`)
#### 问题1.1: WebSocket连接未实现
**位置**: L174-196

```javascript
connectWebSocket() {
  // TODO: 实现WebSocket连接
  // 当前只是注释掉的占位代码
}
```

**影响**:
- 实时更新功能缺失
- 依赖轮询实现,延迟较高(2秒轮询一次)

**修复方案**:
```javascript
connectWebSocket() {
  socketTask = wx.connectSocket({
    url: `wss://${app.globalData.baseUrl}/ws/realtime`,
    success: () => {
      this.setData({ connectionStatus: 'connected' });
    },
    fail: () => {
      this.setData({ connectionStatus: 'disconnected' });
      this.startPolling(); // 降级到轮询
    }
  });

  socketTask.onMessage((res) => {
    const data = JSON.parse(res.data);
    this.updateRankings(data);
  });

  socketTask.onClose(() => {
    this.setData({ connectionStatus: 'disconnected' });
    setTimeout(() => this.connectWebSocket(), 3000);
  });
}
```

#### 问题1.2: 关注功能未实现
**位置**: L283-290

```javascript
toggleFavorite(e) {
  const riderId = e.currentTarget.dataset.riderId;
  // TODO: 实现关注/取消关注功能
  wx.showToast({
    title: '关注功能开发中',
    icon: 'none'
  });
}
```

**修复方案**:
```javascript
toggleFavorite(e) {
  const riderId = e.currentTarget.dataset.riderId;
  const isFavorite = this.data.favoriteRiders.find(r => r.riderId === riderId);

  if (isFavorite) {
    // 取消关注
    const newFavorites = this.data.favoriteRiders.filter(r => r.riderId !== riderId);
    this.setData({ favoriteRiders: newFavorites });

    // 调用API保存关注状态
    post('/favorites/toggle', { riderId })
      .then(() => wx.showToast({ title: '已取消关注', icon: 'success' }))
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));

  } else {
    // 添加关注
    const { rank, riderName } = e.currentTarget.dataset;
    const newFavorites = [...this.data.favoriteRiders, { riderId, rank, riderName }];

    this.setData({ favoriteRiders: newFavorites });

    post('/favorites/toggle', { riderId })
      .then(() => wx.showToast({ title: '关注成功', icon: 'success' }))
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));
  }
}
```

#### 问题1.3: 滚动到关注车手功能未实现
**位置**: L293-300

```javascript
scrollToRider(e) {
  const riderId = e.currentTarget.dataset.riderId;
  // TODO: 实现滚动到指定车手位置
  wx.showToast({
    title: '滚动功能开发中',
    icon: 'none'
  });
}
```

**修复方案**:
```javascript
scrollToRider(e) {
  const { riderId, index } = e.currentTarget.dataset;
  // 获取列表容器
  const query = wx.createSelectorQuery();
  query.select(`#rider-${riderId}`).fields({ node: true, size: true }).exec((res) => {
    if (res && res[0]) {
      const rect = res[0].getBoundingClientRect();
      wx.pageScrollTo({
        scrollTop: rect.top - 100, // 留出100px的顶部边距
        duration: 300
      });
    }
  });
}
```

#### 问题1.4: updateRankings方法未完成
**位置**: L303-312

```javascript
updateRankings(data) {
  // TODO: 根据实际数据格式更新
  if (data.gc) {
    this.setData({
      gcRankings: data.gc,
      lastUpdate: data.lastUpdate
    });
  }
  // 同理处理其他排名...
}
```

**影响**: WebSocket接收数据后无法正确更新界面

---

### 2. 数据同步接口未实现 (`server/routes/sync.js`)

#### 问题2.1: 缺少认证中间件
**位置**: L29-43

```javascript
router.post('/races/:id', async (req, res) => {
  try {
    // TODO: 添加认证中间件
    const { id } = req.params;
    // TODO: 触发PCS爬取脚本
    res.json({
      code: 200,
      message: '同步任务已提交,请查看同步状态',
      data: { race_id: id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '触发同步失败' });
  }
});
```

**影响**:
- 任何人都可触发数据同步
- 安全风险高

**修复方案**:
```javascript
const { authenticateAdmin } = require('../middleware/auth');

router.post('/races/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const raceId = id;

    // 触发PCS爬虫脚本 (使用子进程或队列)
    const { spawn } = require('child_process');
    const syncProcess = spawn('node', ['server/scripts/sync-pcs.js'], {
      env: {
        ...process.env,
        RACE_ID: raceId
      }
    });

    syncProcess.on('error', (err) => {
      console.error('启动同步进程失败:', err);
      return res.status(500).json({
        code: 500,
        message: '触发同步失败'
      });
    });

    res.json({
      code: 200,
      message: '同步任务已提交,请查看同步状态',
      data: { race_id: raceId, status: 'running' }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '触发同步失败' });
  }
});
```

#### 问题2.2: 缺少同步状态查询API
**位置**: L5-26

```javascript
router.get('/status', async (req, res) => {
  try {
    // 查询最近同步的赛事
    const [races] = await pool.query(`
      SELECT race_name, updated_at
      FROM races
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    res.json({
      code: 200,
      data: {
        recent_sync: races,
        message: '数据同步服务运行正常'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '获取同步状态失败' });
  }
});
```

**影响**: 用户无法查看同步进度

---

## 二、安全问题

### 问题3.1: 未对SQL查询进行防注入二次验证
**所有路由文件**: `server/routes/*.js`

**当前状态**: 虽然使用了参数化查询,但未使用ORM或Joi验证输入

**修复方案**:
```javascript
// 安装依赖
// npm install joi

// 创建验证schema
const Joi = require('joi');
const { asyncHandler } = require('../middleware/errorHandler');

// 示例验证
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 验证ID格式
  const schema = Joi.string().uuid().required();
  const { error } = schema.validate(id);

  if (error) {
    throw new AppError('无效的赛段ID', ERROR_CODE.BAD_REQUEST);
  }

  // ... 原有查询逻辑
}));
```

---

### 问题3.2: 缺少限流和防刷机制
**所有公开API**: `server/routes/*.js`

**影响**: 恶意用户可能频繁请求导致服务器过载

**修复方案**:
```javascript
// 安装依赖
// npm install express-rate-limit

const rateLimit = require('express-rate-limit');

// 创建限流器
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: {
    code: 429,
    message: '请求过于频繁,请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 应用到所有API
app.use('/api/v1', apiLimiter);
```

---

## 三、用户体验问题

### 问题4.1: 分类榜页面不支持分页
**位置**: `miniprogram/pages/classification/classification.js` L131-134

```javascript
async loadMore() {
  // 当前API不支持分页,一次性加载所有数据
  wx.showToast({ title: '已加载全部数据', icon: 'none' });
}
```

**影响**:
- 数据量大时一次性加载过多数据
- 可能导致页面卡顿
- 性能差

**修复方案**:
1. 后端实现分页API:
```javascript
// server/routes/stages.js
router.get('/:id/points', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  // ... 查询逻辑

  const total = await pool.query('SELECT COUNT(*) as cnt FROM points_classification WHERE stage_id = ?', [stageId]);

  res.json({
    code: 200,
    data: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total[0].cnt
    }
  });
}));
```

2. 前端实现分页:
```javascript
loadMore() {
  const { page, pageSize } = this.data;
  if (!this.data.hasMore) {
    wx.showToast({ title: '已加载全部数据', icon: 'none' });
    return;
  }

  this.setData({ loading: true });

  get(`/stages/${stageId}/points`, { page: page + 1, limit: pageSize })
    .then(res => {
      if (res.code === 200 && Array.isArray(res.data)) {
        this.setData({
          results: [...this.data.results, ...res.data],
          page: page + 1,
          hasMore: this.data.results.length + res.data.length >= this.data.pageSize
        });
      }
      this.setData({ loading: false });
    });
}
```

---

### 问题4.2: 网络错误处理不够友好
**位置**: `miniprogram/utils/request.js`

**当前状态**: 只在控制台打印错误,用户看到的提示不够详细

**修复方案**:
```javascript
wx.request({
  // ... 其他配置
  fail: (err) => {
    const isTimeout = err.errMsg?.includes('timeout');
    const isNetworkError = err.errMsg?.includes('fail');

    let errorMessage;

    // 根据错误类型提供更友好的提示
    if (isTimeout) {
      errorMessage = '网络连接超时,请检查网络后重试';
    } else if (isNetworkError) {
      errorMessage = '网络连接失败,请确认网络正常';
    } else {
      errorMessage = '请求出错,请稍后重试';
    }

    reject({
      code: -1,
      message: errorMessage,
      detail: err
    });
  }
});
```

同时在前端页面增加重试次数提示:
```javascript
catch(err) {
  console.error('加载比赛失败:', err);
  this.setData({ loading: false, loadError: true });

  showError(`${err.message} (${err.errorCode || ''})`);
}
```

---

### 问题4.3: 地图坐标字段未使用
**位置**: 多个数据库表,如`riders`表包含`latitude, longitude`字段

**影响**:
- 数据库有字段但前端未使用
- 可能的历史遗留问题

**状态**: 需要确认该字段是否应该使用,如不需要可考虑删除或添加使用场景

---

## 四、代码质量与优化

### 问题5.1: 缺少API文档
**所有API端点**: `server/routes/*.js`

**影响**: 前后端协作困难,新手开发体验差

**修复方案**:
使用Swagger/OpenAPI生成文档:
```bash
# 安装依赖
npm install swagger-jsdoc swagger-ui-express

# 创建 docs/api.js
const swaggerJsdoc = require('swagger-jsdoc');
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '正一领骑API',
      version: '1.0.0',
      description: '自行车赛事成绩查询API'
    },
    servers: [{ url: 'http://localhost:3000', description: '开发环境' }]
  },
  apis: ['./server/routes/*.js']
};

module.exports = swaggerJsdoc(options);

// 在 server/app.js 中添加
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/api');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

访问 `http://localhost:3000/api-docs` 查看文档

---

### 问题5.2: 缺少单元测试
**状态**: 项目中无测试文件

**影响**:
- 代码变更风险高
- Bug修复可能引入新问题
- 重构困难

**修复方案**:
```bash
# 安装测试框架
npm install --save-dev jest supertest

# 创建测试文件结构
/server
  ├── routes
  │   ├── stages.test.js
  │   └── riders.test.js
  ├── middleware
  │   └── errorHandler.test.js
  └── app.test.js

# 示例测试 (stages.test.js)
const request = require('supertest');
const app = require('../app');

describe('GET /api/v1/stages/:id', () => {
  it('应该返回赛段详情', async () => {
    const res = await request(app)
      .get('/api/v1/stages/00000000-0000-4000-8000-000000000001')
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data).toHaveProperty('stage_name');
  });

  it('不存在的ID应该返回404', async () => {
    const res = await request(app)
      .get('/api/v1/stages/non-existent-id')
      .expect(404);

    expect(res.body.code).toBe(404);
  });
});

# 在package.json添加测试脚本
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

---

### 问题5.3: 环境变量使用不统一
**位置**: `server/config/database.js`,项目多处引用

**影响**: 部署环境配置困难,可能出错

**修复方案**:
创建统一的配置管理:
```javascript
// server/config/database.js
require('dotenv').config();

module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'jersey_db',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
};
```

同时检查所有环境变量使用位置,统一命名规范:
```bash
# 推荐 .env 文件命名
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=jersey_db
PORT=3000
NODE_ENV=production
# WebSocket连接
WS_HOST=your-domain.com
WS_PORT=3000
```

---

## 五、数据库相关问题

### 问题6.1: 分类榜中排名计算不一致
**位置**: `miniprogram/pages/classification/classification.js` L102-106

```javascript
// 确保每条记录有 rank 字段（youth 表有 rank，points/mountains 按 points DESC 排序）
results = results.map((item, index) => ({
  ...item,
  rank: item.rank != null ? item.rank : (index + 1)
}));
```

**问题**:
- points和mountains分类的ranking应该基于积分排序,但这里回退到数组索引
- 容易产生混淆

**修复方案**:
在前端API响应时就确保正确排序:
```javascript
// server/routes/stages.js
router.get('/:id/points', asyncHandler(async (req, res) => {
  // ... 查询逻辑

  // 按积分降序排序,并设置rank
  rows.sort((a, b) => (b.points || 0) - (a.points || 0));

  rows.forEach((item, index) => {
    item.rank = index + 1;
  });

  res.json({ code: 200, data: rows });
}));
```

---

### 问题6.2: 缺少数据备份和恢复机制
**状态**: 项目中未发现备份脚本

**影响**:
- 数据丢失风险高
- 无法快速恢复

**修复方案**:
```javascript
// server/scripts/backup-database.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  // 创建备份目录
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 生成备份文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

  // 执行备份
  const [rows] = await connection.query('SHOW CREATE DATABASE jersey_db');
  const createDb = rows[0]['Create Database'];

  await fs.promises.writeFile(backupFile, `-- Backup created: ${new Date().toISOString()}\n${createDb};\n\n`);

  // 导出所有表
  const [tables] = await connection.query('SHOW TABLES');
  for (const table of tables) {
    const tableName = Object.values(table)[0];
    const [tableData] = await connection.query(`SELECT * FROM ${tableName}`);
    const columns = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
    const columnNames = columns.map(col => col.Field).join(', ');

    // 添加CREATE TABLE语句
    await fs.promises.appendFile(
      backupFile,
      `\nCREATE TABLE IF NOT EXISTS \`${tableName}\` (\n  ${columns.map(col => `  ${col.Field} ${col.Type}`).join(',\n')}\n);\n\n`
    );

    // 添加数据
    if (tableData.length > 0) {
      await fs.promises.appendFile(
        backupFile,
        `INSERT INTO \`${tableName}\` (${columnNames}) VALUES;\n`
      );

      for (const row of tableData) {
        const values = Object.values(row).map(val => {
          if (val === null) return 'NULL';
          return `'${String(val).replace(/'/g, "\\'")}'`;
        }).join(', ');
        await fs.promises.appendFile(backupFile, `  (${values});\n`);
      }
    }
  }

  await connection.end();
  console.log(`备份完成: ${backupFile}`);
  return backupFile;
}

backupDatabase().catch(console.error);
```

添加定时备份:
```javascript
// server/scripts/schedule-backup.js
const cron = require('node-cron');

// 每天凌晨2点备份
cron.schedule('0 2 * * *', () => {
  require('./backup-database');
});

console.log('备份任务已调度');
```

---

## 六、性能优化建议

### 问题7.1: 分页延迟加载未实现
**状态**: 分页API已存在,但前端未实现分页加载

**修复方案**:
参考问题4.1的分类榜分页实现

---

### 问题7.2: 数据库查询结果未缓存
**状态**:频繁查询同一数据(如赛事详情)无缓存

**影响**:
- 数据库压力
- 响应速度慢
- 成本高

**修复方案**:
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 缓存10分钟

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `stage:${id}`;

  // 查询缓存
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ code: 200, data: cached, fromCache: true });
  }

  // 查询数据库
  const [rows] = await pool.query('SELECT * FROM stages WHERE id = ?', [id]);

  if (rows.length === 0) {
    throw new AppError('赛段不存在', ERROR_CODE.NOT_FOUND);
  }

  const stage = rows[0];
  cache.set(cacheKey, stage); // 存入缓存

  res.json({ code: 200, data: stage, fromCache: false });
}));
```

---

### 问题7.3: 前端图片未懒加载
**位置**: 可能的图片加载优化

**修复方案**:
```wxml
<!-- 添加懒加载属性 -->
<image
  src="{{rider.photo_url}}"
  mode="aspectFill"
  lazy-load
  binderror="handleImageError"
/>
```

---

## 七、可维护性问题

### 问题8.1: 缺少日志系统
**状态**: 仅在开发环境有console.log

**影响**:
- 生产问题排查困难
- 性能分析困难
- 无法追踪用户行为

**修复方案**:
```javascript
// 安装依赖
// npm install winston morgan

const winston = require('winston');
const express = require('express');

// 创建日志配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'velo-rank-api' },
  transports: [
    // 错误日志
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // 所有日志
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// 开发环境输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Express请求日志
const morgan = require('morgan');
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

module.exports = logger;
```

在关键位置使用:
```javascript
const logger = require('../logger');

router.get('/:id', asyncHandler(async (req, res) => {
  logger.info(`获取赛段详情: ${req.params.id}`, {
    userId: req.user?.id,
    ip: req.ip
  });

  try {
    // ... 查询逻辑
  } catch (error) {
    logger.error('获取赛段详情失败', { error: error.message, stageId: req.params.id });
    throw error;
  }
}));
```

---

### 问题8.2: 构建配置和部署脚本不完整
**状态**: package.json只有start和dev命令

**修复方案**:
```json
{
  "scripts": {
    "start": "node server/app.js",
    "dev": "nodemon server/app.js",
    "build": "echo '构建完成'",
    "test": "jest --coverage",
    "lint": "eslint . --ext .js,.json",
    "lint:fix": "eslint . --ext .js,.json --fix",
    "format": "prettier --write \"**/*.{js,json,wxml,wxss}\"",
    "backup": "node server/scripts/backup-database.js",
    "backup:cron": "node server/scripts/schedule-backup.js",
    "docs": "swagger-jsdoc -d ./docs/api.js -o ./docs/api.json"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "eslint": "^8.50.0",
    "prettier": "^3.0.3"
  },
  "dependencies": {
    "node-cache": "^5.1.2",
    "node-cron": "^3.0.3"
  }
}
```

---

## 八、文档问题

### 问题9.1: 数据库文档缺失
**状态**: 未发现数据库结构文档

**影响**:
- 新开发者对接困难
- 数据模型不清晰

**修复方案**:
```sql
-- 创建 docs/schema.sql
-- ============================================
-- 正一领骑数据库结构文档
-- ============================================

-- 1. races (赛事表)
CREATE TABLE IF NOT EXISTS races (
  id VARCHAR(36) PRIMARY KEY,
  race_name VARCHAR(255) NOT NULL,
  race_name_en VARCHAR(255),
  race_code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50),
  gender ENUM('MEN', 'WOMEN') DEFAULT 'MEN',
  season INT NOT NULL,
  start_date DATE,
  end_date DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. stages (赛段表)
CREATE TABLE IF NOT EXISTS stages (
  id VARCHAR(36) PRIMARY KEY,
  race_id VARCHAR(36) NOT NULL,
  stage_number INT NOT NULL,
  stage_name VARCHAR(255),
  date DATE,
  distance_km DECIMAL(10,2),
  stage_type VARCHAR(50),
  stage_code VARCHAR(50),
  FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. riders (车手表)
CREATE TABLE IF NOT EXISTS riders (
  id VARCHAR(36) PRIMARY KEY,
  rider_name VARCHAR(255) NOT NULL,
  rider_name_zh VARCHAR(255),
  nationality VARCHAR(50),
  birth_date DATE,
  country_code CHAR(2),
  photo_url TEXT,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. teams (车队表)
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  team_name_zh VARCHAR(255),
  team_name_en VARCHAR(255),
  uci_code VARCHAR(50),
  country_code CHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. stage_results (赛段成绩表)
CREATE TABLE IF NOT EXISTS stage_results (
  id VARCHAR(36) PRIMARY KEY,
  stage_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  rank_pos INT,
  position_time TIME,
  result_status ENUM('finished', 'dnf', 'dns', 'retired') DEFAULT 'finished',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE KEY unique_stage_rider (stage_id, rider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. general_classification (总成绩榜)
CREATE TABLE IF NOT EXISTS general_classification (
  stage_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  `rank` INT NOT NULL,
  time_gap TIME,
  TIME,
  points INT DEFAULT 0,
  mountain_points INT DEFAULT 0,
  young_points INT DEFAULT 0,
  CHECK (rank > 0),
  PRIMARY KEY (stage_id, rider_id),
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. points_classification (冲刺积分榜)
CREATE TABLE IF NOT EXISTS points_classification (
  stage_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  rank INT,
  points INT NOT NULL,
  CHECK (rank > 0 OR points > 0),
  PRIMARY KEY (stage_id, rider_id),
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. mountains_classification (爬坡积分榜)
CREATE TABLE IF NOT EXISTS mountains_classification (
  stage_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  rank INT,
  points INT NOT NULL,
  CHECK (rank > 0 OR points > 0),
  PRIMARY KEY (stage_id, rider_id),
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. youth_classification (青年车手榜)
CREATE TABLE IF NOT EXISTS youth_classification (
  stage_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  rank INT NOT NULL,
  time_gap TIME,
  CHECK (rank > 0),
  PRIMARY KEY (stage_id, rider_id),
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. jerseys (领骑衫表)
CREATE TABLE IF NOT EXISTS jerseys (
  stage_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  jersey_type ENUM('pink', 'purple', 'blue', 'green') NOT NULL,
  points_or_gap TIME,
  points INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_jersey (stage_id, jersey_type),
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. user_settings (用户设置)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id VARCHAR(50) PRIMARY KEY,
  favorite_riders TEXT, -- JSON格式存储
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  theme VARCHAR(20) DEFAULT 'light',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. admin_logs (管理日志)
CREATE TABLE IF NOT EXISTS admin_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

保存到 `docs/schema.sql`,并提供访问:
```bash
mysql -u root -p < docs/schema.sql
```

---

### 问题9.2: API接口说明不完整
**状态**: 仅README中列出了基本API

**建议补充**:
在每个路由文件顶部添加JSDoc注释:
```javascript
/**
 * @fileoverview 赛事相关API
 * @description 处理赛事列表、详情等请求
 */

/**
 * GET /api/v1/races
 * @description 获取赛事列表
 * @query {number} season - 赛季年份 (可选)
 * @query {number} limit - 每页数量 (可选,默认20)
 * @query {number} offset - 偏移量 (可选,默认0)
 * @returns {Object} - { code: 200, data: [...], pagination: {...} }
 * @example
 * get('/races?season=2026&limit=20')
 */

router.get('/', asyncHandler(async (req, res) => {
  // 处理逻辑
}));
```

---

## 九、功能完整性问题

### 问题10.1: 用户系统未实现
**状态**: 只有auth.js文件引用,但未实现

**影响**:
- 无法追踪用户行为
- 无法实现关注功能
- 无个性化设置

**修复方案**:
参考问题8.1中的user_settings表设计,实现以下API:

```javascript
// server/routes/auth.js
const crypto = require('crypto');

// 用户注册
router.post('/register', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError('用户名和密码不能为空', ERROR_CODE.BAD_REQUEST);
  }

  // 检查用户名是否已存在
  const [existing] = await pool.query(
    'SELECT id FROM user_settings WHERE user_id = ?',
    [username.toLowerCase()]
  );

  if (existing.length > 0) {
    throw new AppError('用户名已存在', ERROR_CODE.CONFLICT);
  }

  // 生成token
  const token = crypto.randomUUID();

  const result = await pool.query(
    'INSERT INTO user_settings (user_id, push_notifications_enabled) VALUES (?, TRUE)',
    [username.toLowerCase()]
  );

  res.json({
    code: 200,
    message: '注册成功',
    data: {
      token,
      user_id: username.toLowerCase()
    }
  });
}));

// 用户登录
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // 查询用户
  const [users] = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = ?',
    [username.toLowerCase()]
  );

  if (users.length === 0) {
    throw new AppError('用户名或密码错误', ERROR_CODE.UNAUTHORIZED);
  }

  // 验证密码 (实际应用应该使用bcrypt加盐)
  const user = users[0];
  if (user.password !== password) {
    throw new AppError('用户名或密码错误', ERROR_CODE.UNAUTHORIZED);
  }

  // 生成并发送token
  const token = crypto.randomUUID();

  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user_id: user.user_id
    }
  });
}));

// 更新用户设置
router.put('/settings', authenticateUser, asyncHandler(async (req, res) => {
  const { user_id } = req.user;
  const { favorite_riders, push_notifications_enabled, theme } = req.body;

  const updateFields = [];
  const params = [];

  if (favorite_riders !== undefined) {
    updateFields.push('favorite_riders = ?');
    params.push(JSON.stringify(favorite_riders));
  }

  if (push_notifications_enabled !== undefined) {
    updateFields.push('push_notifications_enabled = ?');
    params.push(push_notifications_enabled);
  }

  if (theme !== undefined) {
    updateFields.push('theme = ?');
    params.push(theme);
  }

  if (updateFields.length === 0) {
    throw new AppError('没有提供可更新的设置', ERROR_CODE.BAD_REQUEST);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(user_id);

  await pool.query(
    `UPDATE user_settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
    params
  );

  res.json({
    code: 200,
    message: '设置已更新'
  });
}));
```

在app.js中实现认证中间件:
```javascript
// server/middleware/auth.js
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证信息'
    });
  }

  const token = authHeader.substring(7);

  // 验证token (这里简化,实际应该存在token表验证)
  const [users] = pool.query(
    'SELECT user_id FROM user_settings WHERE active_token = ?',
    [token]
  );

  if (users.length === 0) {
    return res.status(401).json({
      code: 401,
      message: '无效的token'
    });
  }

  req.user = {
    user_id: users[0].user_id,
    token
  };

  next();
}
```

---

## 十、建议的修复优先级

### 高优先级 (必须修复)
1. **问题1.1** - WebSocket连接未实现,影响实时更新
2. **问题1.2** - 关注功能未实现,核心功能缺失
3. **问题3.1** - SQL防注入验证
4. **问题3.2** - API限流保护
5. **问题6.1** - 排名计算不一致

### 中优先级 (建议修复)
6. **问题2.1** - 同步接口认证
7. **问题4.1** - 分类榜分页
8. **问题4.2** - 网络错误处理
9. **问题6.2** - 数据备份机制
10. **问题8.1** - 日志系统

### 低优先级 (可延后)
11. **问题5.1** - API文档
12. **问题5.2** - 单元测试
13. **问题5.3** - 环境变量统一
14. **问题7.2** - 数据库缓存
15. **问题7.3** - 图片懒加载

### 优化建议 (锦上添花)
16. **问题5.3** - 性能优化
17. **问题8.2** - 构建部署
18. **问题9.1** - 数据库文档
19. **问题9.2** - API说明
20. **问题10.1** - 用户系统

---

## 总结

当前版本正一领骑小程序已完成基础功能框架,但在以下方面需要改进:

1. **核心功能**: 实时追踪、关注功能、数据同步需要完善
2. **安全性**: 需要添加认证、授权、限流等安全措施
3. **性能**: 需要实现分页、缓存等优化
4. **可维护性**: 需要日志、文档、测试等支持
5. **数据安全**: 需要备份机制

建议按照优先级逐步修复和完善,优先解决影响功能完整性和安全性的问题。

---

**文档版本**: 1.0
**最后更新**: 2026-05-29
**维护者**: 开发团队
