# 领骑 / Jersey

面向自行车运动爱好者的赛事成绩查询工具，专注UCI世界巡回赛及顶级赛事。

## 技术栈

- 前端：微信小程序原生开发
- 后端：Node.js + Express
- 数据库：MySQL 8.0
- 数据源：ProCyclingStats.com

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp server/config/.env.example server/config/.env
# 编辑 .env 文件，填入你的数据库密码
```

### 3. 初始化数据库

确保MySQL服务已启动，然后运行：

```bash
npm run init-db
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务启动后访问 http://localhost:3000/health 验证

## 项目结构

```
cycling_new/
├── server/                 # 后端服务
│   ├── app.js             # 主入口
│   ├── config/            # 配置文件
│   │   ├── database.js    # 数据库配置
│   │   ├── db-pool.js     # 连接池
│   │   └── .env.example   # 环境变量模板
│   ├── routes/            # API路由
│   │   ├── races.js       # 赛事接口
│   │   ├── stages.js      # 赛段/成绩接口
│   │   ├── riders.js      # 车手接口
│   │   ├── teams.js       # 车队接口
│   │   ├── search.js      # 搜索接口
│   │   └── sync.js        # 数据同步接口
│   ├── models/            # 数据模型（待开发）
│   ├── middleware/        # 中间件（待开发）
│   └── scripts/           # 工具脚本
│       └── init-db.js     # 数据库初始化
├── miniprogram/           # 微信小程序（待开发）
├── docs/                  # 文档
│   ├── PRD.md            # 产品需求文档
│   └── TECH_SPEC.md      # 技术方案文档
├── package.json
└── README.md
```

## API接口

| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/v1/races` | GET | 赛事列表 |
| `/api/v1/races/:id` | GET | 赛事详情 |
| `/api/v1/races/:id/stages` | GET | 赛段列表 |
| `/api/v1/races/:id/gc` | GET | 总成绩榜 |
| `/api/v1/stages/:id` | GET | 赛段详情 |
| `/api/v1/stages/:id/results` | GET | 赛段成绩 |
| `/api/v1/stages/:id/jerseys` | GET | 领骑衫信息 |
| `/api/v1/riders/:id` | GET | 车手详情 |
| `/api/v1/teams/:id` | GET | 车队详情 |
| `/api/v1/search/riders` | GET | 搜索车手 |
| `/api/v1/search/teams` | GET | 搜索车队 |

## 开发计划

- [x] Week 1: 项目骨架 + 数据库设计
- [ ] Week 2: PCS爬虫脚本
- [ ] Week 3: 赛事/成绩API完善
- [ ] Week 4: 管理后台
- [ ] Week 5: 小程序首页+赛事页
- [ ] Week 6: 小程序成绩页+搜索
- [ ] Week 7: 数据自动化同步
- [ ] Week 8: 测试+提交审核

## License

MIT
