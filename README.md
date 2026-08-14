# 正一领骑

面向自行车运动爱好者的赛事成绩查询工具，专注 UCI 世界巡回赛及顶级赛事。

## 当前版本

当前代码口径为 v2.0.0，发布范围以 `docs/V2.0.0_RELEASE_SCOPE.md` 和 `docs/CURRENT_VERSION_FEATURES.md` 为准。

v2.0.0 聚焦“赛事成绩追踪”主线：赛事首页、赛事搜索、赛程日历、赛事详情、赛段成绩、GC/冲刺/爬坡/青年/车队榜、车手详情、车队详情、赛事归档、推送设置和中文化体验。

管理员同步页、管理后台和数据导入脚本属于内部运营支撑，不作为对外用户功能宣传。

## 技术栈

- 前端：微信小程序原生开发
- 后端：Node.js + Express
- 数据库：MySQL 8.0 / TiDB Cloud
- 部署：Fly.io / Docker
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

确保 MySQL 服务已启动，然后运行：

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

服务启动后访问 http://localhost:3390/health 验证。

## 项目结构

```text
velo-rank/
├── server/                 # 后端服务
│   ├── app.js              # Express/HTTP/WebSocket 入口
│   ├── websocket.js        # 实时成绩 WebSocket
│   ├── config/             # 环境、数据库、安全配置
│   ├── middleware/         # 认证、日志、错误处理、响应格式化
│   ├── routes/             # API 路由
│   │   ├── auth.js         # 微信登录、登出、账号删除
│   │   ├── races.js        # 赛事、日历、GC、分类榜
│   │   ├── stages.js       # 赛段、成绩、领骑衫
│   │   ├── riders.js       # 车手
│   │   ├── teams.js        # 车队
│   │   ├── search.js       # 车手/车队/赛事搜索
│   │   ├── realtime.js     # 实时成绩 HTTP 降级接口
│   │   ├── push.js         # 推送设置与发送
│   │   ├── favorites.js    # 关注能力后端
│   │   ├── sync.js         # 内部同步任务
│   │   └── admin.js        # 内部管理接口
│   ├── services/           # 业务服务
│   └── scripts/            # 初始化、备份、同步、导入脚本
├── miniprogram/            # 微信小程序
├── docs/                   # 当前文档与历史归档
├── scripts/                # 项目验证脚本
├── database/               # 数据库脚本
├── package.json
└── README.md
```

## API 接口

| 接口 | 方法 | 说明 |
|-----|------|------|
| `/health` | GET | 服务健康检查 |
| `/api/v1/health` | GET | API 健康检查 |
| `/api/v1/auth/*` | 多种 | 微信登录、登出、账号删除 |
| `/api/v1/races` | GET | 赛事列表 |
| `/api/v1/races/:id` | GET | 赛事详情 |
| `/api/v1/races/calendar` | GET | 赛事日历 |
| `/api/v1/races/:id/stages` | GET | 赛段列表 |
| `/api/v1/races/:id/gc` | GET | 总成绩榜 |
| `/api/v1/races/:id/points` | GET | 冲刺积分榜 |
| `/api/v1/races/:id/kom` | GET | 爬坡积分榜 |
| `/api/v1/races/:id/youth` | GET | 青年榜 |
| `/api/v1/races/:id/teams` | GET | 车队成绩榜 |
| `/api/v1/stages/:id/results` | GET | 赛段成绩 |
| `/api/v1/stages/:id/jerseys` | GET | 领骑衫信息 |
| `/api/v1/riders` | GET | 车手列表 |
| `/api/v1/riders/:id` | GET | 车手详情 |
| `/api/v1/teams` | GET | 车队列表 |
| `/api/v1/teams/:id` | GET | 车队详情 |
| `/api/v1/search/*` | GET | 车手、车队、赛事搜索 |
| `/api/v1/realtime/*` | GET | 实时成绩 HTTP 接口 |
| `/ws/realtime` | WS | 实时成绩 WebSocket |
| `/api/v1/push/*` | 多种 | 推送设置、订阅、历史、测试推送 |
| `/api/v1/favorites/*` | 多种 | 关注车手后端能力 |
| `/api/v1/sync/*` | 多种 | 内部数据同步 |
| `/api/v1/admin/*` | 多种 | 内部管理接口 |

## 文档状态

当前口径文档：

- `docs/V2.0.0_RELEASE_SCOPE.md`：v2.0.0 发布范围
- `docs/CURRENT_VERSION_FEATURES.md`：当前版本功能整理
- `docs/V2.0.0_REVIEW_P0_CHECKLIST.md`：v2.0.0 审核前 P0 验证清单
- `docs/V2.1_VISUALIZATION_PLAN.md`：v2.1 数据可视化候选规划

历史归档文档：

- `docs/PRD_GAP_ANALYSIS.md`：v1 开发阶段差距分析，部分 TODO 已过期
- `docs/小程序功能点与BUG记录.md`：v1/v1.1 阶段记录，不能作为 v2 当前清单
- `temp/BUG_REPORT.md`：早期 BUG 汇总，WebSocket、sync、环境切换等条目已被 v2 实现覆盖
- `docs/OPTIMIZATION_*`、`docs/CLEANUP_*`：v1 优化/清理过程文档，仅供追溯

## v2.0.0 当前待办

- 配置微信订阅消息模板 ID 后，推送订阅才能真实送达手机通知。
- 提交微信审核前，使用体验版跑通首页 → 赛事详情 → 赛段成绩 → 分类榜 → 搜索 → 日历 → 归档 → 推送设置主路径。

## License

MIT
