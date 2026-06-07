# 技术方案：领骑（Jersey）小程序

**版本**：v1.0  
**日期**：2026-05-14  
**状态**：初稿  
**对应PRD**：`cycling-results-app-prd.md`

---

## 一、架构总览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        微信小程序端                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 赛事列表  │  │ 赛段成绩  │  │ 领骑衫   │  │ 搜索     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/WSS
┌───────────────────────────▼─────────────────────────────────┐
│                         API 网关层                          │
│              Nginx（反向代理 / 负载均衡 / 静态缓存）          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                        后端服务层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 赛事API  │  │ 成绩API  │  │ 车手API  │  │ 搜索API  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 数据同步  │  │ 数据校验  │  │ 权限管理  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                        数据层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │PostgreSQL│  │  Redis   │  │  对象存储 │                 │
│  │(主数据库) │  │(热点缓存) │  │(图片/附件)│                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Webhook / Cron
┌───────────────────────────┴─────────────────────────────────┐
│                        数据采集层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │UCI API   │  │大环赛API  │  │人工录入  │                 │
│  │(官方数据) │  │(计时商)  │  │(后台管理) │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术选型

| 层级 | 技术选型 | 选型理由 |
|-----|---------|---------|
| 前端 | 微信小程序原生开发 | 平台原生性能最好，API最全，用户无需额外安装 |
| 后端 | Node.js + Express | 轻量、单文件即可跑，TypeScript可选，一个人开发足够 |
| 数据库 | MySQL 8.0 | 普及率高、便宜、生态成熟，一个人运维无压力 |
| 缓存 | 无（v1.0暂不需要） | 初期流量小，DB直接扛，省成本 |
| 对象存储 | 免费CDN / GitHub Pages | 图片不多的话直接用免费方案，零成本 |
| 数据同步 | node-cron + 简单脚本 | 不用消息队列，cron定时跑足够，简单可控 |
| 部署 | 最便宜VPS（如腾讯云轻量/阿里云ECS） | 一个人运维，成本最低约50-100元/月 |

---

## 二、数据库设计

### 2.1 核心表结构

#### races（赛事主表）

```sql
CREATE TABLE races (
    id              CHAR(36) PRIMARY KEY,          -- UUID存为字符串
    race_name       VARCHAR(200) NOT NULL,
    race_name_en    VARCHAR(200),
    race_code       VARCHAR(50) UNIQUE NOT NULL,  -- 如 "giro-ditalia-2026"
    category        VARCHAR(20) NOT NULL,          -- UCI_WORLD_TOUR / GRAND_TOUR / WORLD_CHAMPIONSHIPS
    gender          VARCHAR(10) NOT NULL,          -- MEN / WOMEN
    season          INT NOT NULL,
    country         VARCHAR(100),
    start_date      DATE,
    end_date        DATE,
    total_stages    INT,
    total_distance  DECIMAL(8,1),
    logo_url        VARCHAR(500),
    official_url    VARCHAR(500),
    is_active       BOOLEAN DEFAULT true,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_races_category (category, gender, season),
    INDEX idx_races_active (is_active)
);
```

#### stages（赛段表）

```sql
CREATE TABLE stages (
    id              CHAR(36) PRIMARY KEY,          -- UUID
    race_id         CHAR(36) NOT NULL,              -- 关联races.id
    stage_number    INT NOT NULL,
    stage_name      VARCHAR(200),                   -- "Praia a Mare → Potenza"
    stage_type      VARCHAR(50),                    -- FLAT / HILLS / MOUNTAIN / TT / PROLOGUE
    date            DATE NOT NULL,
    start_time      TIME,
    distance_km     DECIMAL(5,1),
    elevation_m     INT,                             -- 累计爬升
    start_city      VARCHAR(100),
    finish_city     VARCHAR(100),
    weather_summary VARCHAR(200),
    stage_code      VARCHAR(100) UNIQUE NOT NULL,   -- "giro-2026-stage-005"
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_race_stage (race_id, stage_number),
    INDEX idx_stages_race (race_id, stage_number)
);
```

#### stage_results（赛段成绩表）

```sql
CREATE TABLE stage_results (
    id              CHAR(36) PRIMARY KEY,           -- UUID
    stage_id        CHAR(36) NOT NULL,               -- 关联stages.id
    `rank`          INT NOT NULL,                    -- MySQL关键字需加反引号
    rider_id        CHAR(36) NOT NULL,               -- 关联riders.id
    team_id         CHAR(36) NOT NULL,               -- 关联teams.id
    nationality     VARCHAR(3) NOT NULL,
    time_gap        VARCHAR(50),                     -- 显示格式 "3:21:08" / "+15"
    is_same_time    BOOLEAN DEFAULT false,           -- s.t. 是否同组
    sprint_points   INT DEFAULT 0,                    -- 冲刺积分
    mountain_points INT DEFAULT 0,                    -- 爬坡积分
    youth_eligible  BOOLEAN DEFAULT false,            -- 是否符合青年车手条件
    jersey_earned   JSON,                            -- 获得的领骑衫类型 ["rosa", "ciclamino"]
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_stage_rank (stage_id, `rank`),
    INDEX idx_results_stage (stage_id, `rank`),
    INDEX idx_results_rider (rider_id)
);
```

#### jerseys（领骑衫持有表）

```sql
CREATE TABLE jerseys (
    id              CHAR(36) PRIMARY KEY,            -- UUID
    stage_id        CHAR(36) NOT NULL,                -- 关联stages.id
    jersey_type     VARCHAR(30) NOT NULL,              -- rosa / ciclamino / azzurra / bianca / green / yellow / polka_dot / white / rainbow
    rider_id        CHAR(36) NOT NULL,                 -- 关联riders.id
    team_id         CHAR(36) NOT NULL,                 -- 关联teams.id
    time_gap        VARCHAR(50),                       -- 与领先者差距 "+15" / "+1:23"
    points          INT,                               -- 积分（适用于积分类领骑衫）
    jersey_image    VARCHAR(500),                      -- 领骑衫图片URL
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_stage_jersey (stage_id, jersey_type),
    INDEX idx_jerseys_stage (stage_id, jersey_type)
);
```

#### riders（车手表）

```sql
CREATE TABLE riders (
    id              CHAR(36) PRIMARY KEY,             -- UUID
    uci_id          VARCHAR(20) UNIQUE,                -- UCI官方ID
    rider_name      VARCHAR(100) NOT NULL,
    rider_name_zh   VARCHAR(100),                      -- 中文译名
    nationality     VARCHAR(3) NOT NULL,
    birth_date      DATE,
    height_cm       INT,
    weight_kg       DECIMAL(4,1),
    is_retired      BOOLEAN DEFAULT false,
    photo_url       VARCHAR(500),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_riders_nationality (nationality)
);
```

#### teams（车队表）

```sql
CREATE TABLE teams (
    id              CHAR(36) PRIMARY KEY,             -- UUID
    uci_code        VARCHAR(10) UNIQUE,                -- "SOQ", "UAD"
    team_name       VARCHAR(200) NOT NULL,
    team_name_zh    VARCHAR(200),
    team_name_en    VARCHAR(200),
    category        VARCHAR(50),                       -- UCI_WORLD_TEAM / PRO_TEAM
    country        VARCHAR(100),
    logo_url        VARCHAR(500),
    bike_brand      VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### general_classification（总成绩榜GC）

```sql
CREATE TABLE general_classification (
    id              CHAR(36) PRIMARY KEY,             -- UUID
    stage_id        CHAR(36) NOT NULL,                 -- 关联stages.id
    `rank`          INT NOT NULL,                      -- MySQL关键字需加反引号
    rider_id        CHAR(36) NOT NULL,                  -- 关联riders.id
    team_id         CHAR(36) NOT NULL,                  -- 关联teams.id
    nationality     VARCHAR(3) NOT NULL,
    total_time      VARCHAR(50),                       -- "36:21:45"
    time_gap        VARCHAR(50),                       -- "+15" / "+1:23"
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gc_stage_rank (stage_id, `rank`),
    INDEX idx_gc_stage (stage_id, `rank`)
);
```

#### team_classification（车队成绩榜）

```sql
CREATE TABLE team_classification (
    id              CHAR(36) PRIMARY KEY,
    stage_id        CHAR(36) NOT NULL,
    `rank`          INT NOT NULL,
    team_id         CHAR(36) NOT NULL,
    total_time      VARCHAR(50),
    time_gap        VARCHAR(50),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_team_stage_rank (stage_id, `rank`),
    INDEX idx_team_stage (stage_id, `rank`)
);
```

### 2.2 数据类型映射

| 字段 | MySQL类型 | 理由 |
|-----|----------|------|
| UUID主键 | CHAR(36) | 兼容UUID格式，索引效率比BINARY(16)稍低但开发方便 |
| 时间差 | VARCHAR(50) | 直接用字符串存储，展示和比较都够用 |
| JSON字段 | JSON | 存储领骑衫类型等半结构化数据，MySQL 8.0支持JSON索引 |
| 图片URL | VARCHAR(500) | 兼容CDN链接 |
| 时间戳 | DATETIME | 足够用，不需要时区转换就存本地时间 |

---

## 三、后端 API 设计

### 3.1 RESTful API 规范

```
基础路径：/api/v1
认证方式：JWT Token（后台管理用）
限流策略：普通用户 60 req/min，认证用户 300 req/min
```

### 3.2 核心接口清单

#### 赛事相关

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/races` | 赛事列表（支持分页、筛选） |
| GET | `/races/:id` | 赛事详情 |
| GET | `/races/:id/stages` | 赛事赛段列表 |
| GET | `/races/:id/gc` | 赛事总成绩榜 |

#### 赛段成绩

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/stages/:id` | 赛段详情 |
| GET | `/stages/:id/results` | 赛段成绩（前N名） |
| GET | `/stages/:id/jerseys` | 领骑衫持有者 |
| GET | `/stages/:id/team-classification` | 车队成绩排名 |
| GET | `/stages/:id/general-classification` | 总成绩排名 |
| GET | `/stages/:id/points` | 冲刺积分排名 |
| GET | `/stages/:id/mountains` | 爬坡积分排名 |
| GET | `/stages/:id/youth` | 青年车手排名 |

#### 搜索

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/search/races` | 搜索赛事 |
| GET | `/search/riders` | 搜索车手 |
| GET | `/search/teams` | 搜索车队 |

#### 数据同步（内部接口）

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/sync/races/:id` | 手动触发赛事数据同步 |
| GET | `/sync/status` | 查看同步状态 |

### 3.3 核心接口示例

#### GET /api/v1/stages/:id/results

**请求参数：**

```json
{
    "limit": 20,      // 返回前N名，默认20
    "offset": 0
}
```

**响应结构：**

```json
{
    "code": 200,
    "data": {
        "stage": {
            "id": "uuid",
            "stage_number": 5,
            "stage_name": "Praia a Mare → Potenza",
            "date": "2026-05-13",
            "distance_km": 203,
            "elevation_m": 3200,
            "stage_type": "MOUNTAIN"
        },
        "results": [
            {
                "rank": 1,
                "rider": {
                    "id": "uuid",
                    "name": "Paul Magnier",
                    "name_zh": "保罗·马涅",
                    "nationality": "FRA",
                    "photo": "https://..."
                },
                "team": {
                    "id": "uuid",
                    "code": "SOQ",
                    "name": "Soudal Quick-Step"
                },
                "time": "3:21:08",
                "time_gap": "",
                "sprint_points": 50,
                "mountain_points": 0,
                "is_same_time": false
            }
        ],
        "jerseys": [
            {
                "type": "rosa",
                "type_name": "粉衫",
                "rider": { "name": "Tadej Pogacar", "nationality": "SLO", ... },
                "team": { "code": "UAD" },
                "time_gap": "+15",
                "image": "https://..."
            }
        ]
    }
}
```

---

## 四、数据采集方案

### 4.1 数据源优先级

```
一级数据源（主）：ProCyclingStats.com
    └── 结构化页面抓取（赛段成绩、GC、领骑衫等）
    └── 覆盖UCI WorldTour、三大环赛、世锦赛，数据最全

二级数据源（补）：赛事官方网站
    ├── Cyclingnews.com（新闻验证）
    └── 各赛事官网（图片/天气等补充信息）

三级数据源（兜底）：人工录入
    └── 管理后台手动录入 + 审核
```

**为什么PCS为主**：一个人开发的情况下，PCS页面结构相对稳定，数据维度全（成绩/GC/领骑衫/车手/车队都有），不需要申请API密钥，爬取成本最低。UCI官方API需要企业认证，门槛太高。

### 4.2 数据同步流程

```
比赛结束
    │
    ▼
Webhook触发 / Cron定时检测
    │
    ▼
拉取官方成绩数据
    │
    ▼
数据校验（排名连续性、时间逻辑、车手存在性）
    │
    ▼
数据写入数据库（事务保证原子性）
    │
    ▼
更新Redis缓存
    │
    ▼
推送到小程序客户端
```

### 4.3 数据校验规则

| 校验项 | 规则 | 失败处理 |
|-------|------|---------|
| 排名连续性 | 1,2,3,4...不能跳号 | 记录告警，人工审核 |
| 时间差逻辑 | 后一名时间 >= 前一名 | 记录告警，人工审核 |
| 车手存在性 | rider_id必须在riders表 | 自动创建新车手记录 |
| 重复数据 | 同一赛段同一排名不能重复 | 直接覆盖更新 |
| 领骑衫逻辑 | 领骑衫持有者必须在该赛段完赛 | 记录告警，人工审核 |

### 4.4 历史数据迁移

- 迁移范围：近3年UCI WorldTour + 三大环赛
- 数据源：ProCyclingStats.com 结构化数据抓取
- 验证方式：与官方PDF成绩单交叉核对
- 优先级：2026赛季 > 2025赛季 > 2024赛季

---

## 五、前端设计

### 5.1 页面结构

```
领骑
├── 🏠 首页（赛事日历）
│   ├── 进行中赛事（置顶高亮）
│   ├── 近期赛事列表
│   └── 赛季选择器
│
├── 🔍 搜索页
│   ├── 赛事搜索
│   ├── 车手搜索
│   └── 车队搜索
│
├── 🏆 赛事详情
│   ├── 赛事基本信息（Logo/赛段数/距离）
│   ├── 赛段列表
│   ├── 总成绩榜（GC）
│   └── 领骑衫汇总
│
├── 📊 赛段成绩
│   ├── 赛段标题/类型/距离/天气
│   ├── 🏆 前三名卡片（突出展示）
│   ├── 领骑衫快报
│   ├── 成绩列表（可滚动）
│   └── GC排名变化（与上一赛段对比）
│
└── 👤 我的
    ├── 关注的赛事
    ├── 关注的车手/车队
    └── 设置（语言/单位）
```

### 5.2 核心页面原型

#### 赛段成绩页（核心页面）

```
┌──────────────────────────────────────────┐
│  ←  Giro d'Italia 2026 - Stage 5    ⚙️  │
│  Praia a Mare → Potenza | 203km  🏔️     │
├──────────────────────────────────────────┤
│  🏆 前三名                                │
│  ┌────────────────────────────────────┐ │
│  │ 🥇 Paul Magnier (FRA) 🟢 SOQ       │ │
│  │    Soudal Quick-Step   3:21:08     │ │
│  │                                      │ │
│  │ 🥈 Tadej Pogacar (SLO) 🟢 UAD      │ │
│  │    UAE Team Emirates    +0:00:15   │ │
│  │                                      │ │
│  │ 🥉 Romain Bardet (FRA) 🔵 DFP      │ │
│  │    Team DSM Firmenich  +0:01:23   │ │
│  └────────────────────────────────────┘ │
│                                          │
│  🎨 领骑衫（本赛段）                      │
│  🔴 粉衫: Tadej Pogacar (UAD)           │
│  🟣 紫衫: Jonathan Milan (LTK)          │
│  🔵 蓝衫: Tadej Pogacar (UAD)           │
│  ⚪ 白衫: Antonio Tiberi (TBV)          │
│                                          │
│  排名  车手         国籍  车队  成绩      │
│  ─────────────────────────────────────  │
│  1️⃣   Paul Magnier   FRA  SOQ  3:21:08 │
│  2️⃣   Tadej Pogacar  SLO  UAD  +15"   │
│  3️⃣   Romain Bardet  FRA  DFP  +1:23"  │
│  4️⃣   Geraint Thomas GBR  IGD  +1:45"  │
│  ...                                    │
└──────────────────────────────────────────┘
```

### 5.3 关键技术点

| 技术点 | 实现方案 |
|-------|---------|
| 图片懒加载 | `wx:lazy-load` + 云存储CDN |
| 列表滚动优化 | 分页加载（20条/页）+ 虚拟列表 |
| 离线缓存 | `wx.setStorageSync` 缓存最近查看的赛段 |
| 骨架屏 | 数据加载时展示骨架屏 |
| 下拉刷新 | `onPullDownRefresh` 拉取最新成绩 |
| 分享功能 | 生成赛事成绩海报图分享到朋友圈 |
| 主题 | 默认深色模式（夜间观赛友好），支持浅色切换 |

---

## 六、数据管理后台

### 6.1 功能模块

```
管理后台（Web端，管理账号专用）
├── 赛事管理
│   ├── 赛事CRUD
│   ├── 赛段CRUD
│   └── 赛事发布/下架
│
├── 成绩管理
│   ├── 赛段成绩录入
│   ├── 领骑衫管理
│   ├── GC成绩录入
│   └── 数据审核
│
├── 车手/车队管理
│   ├── 车手信息维护
│   └── 车队信息维护
│
└── 数据同步
    ├── 手动触发同步
    ├── 同步日志查看
    └── 数据校验报告
```

### 6.2 成绩录入界面

```
┌─────────────────────────────────────────────┐
│ 录入赛段成绩 - Giro 2026 Stage 5            │
├─────────────────────────────────────────────┤
│ 排名  姓名          车队    国籍  时间   │
│ [ 1 ] [Paul Magnier] [SOQ]  [FRA]  [3:21:08]│
│ [ 2 ] [T. Pogacar ]  [UAD]  [SLO]  [+15"  ]│
│ [ 3 ] [R. Bardet  ]  [DFP]  [FRA]  [+1:23"]│
│ [ + ] [   新增行   ]                        │
│                                              │
│ 领骑衫授予：                                  │
│ 🔴 粉衫： [Tadej Pogacar] [UAD]             │
│ 🟣 紫衫： [Jonathan Milan] [LTK]            │
│ 🔵 蓝衫： [Tadej Pogacar] [UAD]             │
│ ⚪ 白衫： [Antonio Tiberi] [TBV]            │
│                                              │
│          [保存草稿]  [校验并发布]            │
└─────────────────────────────────────────────┘
```

---

## 七、部署方案

### 7.1 部署架构

```
微信小程序
    │
    ▼
Nginx（反向代理 + 静态资源）
    │
    ▼
Node.js（Express + 定时爬取脚本）
    │
    ▼
MySQL 8.0
（无Redis缓存，v1.0流量小直接扛）
```

**极简原则**：一个人开发，不搞复杂架构，能跑就行。

### 7.2 部署方式选择

| 方案 | 月成本 | 运维难度 | 推荐场景 |
|-----|--------|---------|---------|
| 最便宜VPS（腾讯云轻量/阿里云ECS 2核2G） | **~50-80元/月** | 低 | **✅ 推荐**：一个人开发，成本最低 |
| 腾讯云云开发 | ~100-200元/月 | 极低 | 不想碰服务器的话选这个 |
| Docker + K8s | ~200元+/月 | 高 | 不推荐一个人搞 |

**推荐方案**：腾讯云轻量应用服务器 2核2G4M + MySQL云数据库（或直接装本地）
- 服务器约50元/月
- MySQL可以用服务器本地装，省掉云数据库费用
- 数据同步脚本用crontab跑，不用额外服务

### 7.3 环境配置

```
生产环境：prod（正式域名 + HTTPS）
预发环境：staging（测试用，数据每日同步一次）
开发环境：dev（本地开发）
```

---

## 八、开发计划

### 一个人开发，6-8周上线

| 时间 | 任务 | 产出 |
|-----|------|------|
| Week 1 | MySQL数据库搭建 + Express后端框架 | 能跑起来的后端服务 |
| Week 2 | PCS爬虫脚本（赛事/赛段/成绩/领骑衫） | 爬取的原始数据入库 |
| Week 3 | 赛事API + 赛段成绩API | 小程序能拉到数据 |
| Week 4 | 管理后台（Web页面，录入/审核成绩） | 能手动修正数据 |
| Week 5 | 小程序首页 + 赛事列表 + 赛段成绩页 | 核心页面可用 |
| Week 6 | 搜索 + 车手/车队页面 + 样式打磨 | 功能完整 |
| Week 7 | 数据同步自动化 + 历史数据迁移 | 数据自动更新 |
| Week 8 | 测试 + Bug修复 + 提交审核 | 提交微信审核 |

**一个人开发的极简原则**：
- 不做复杂架构，能跑就行
- 管理后台用最简单的HTML页面 + 接口，不用Vue/React
- 图片托管用免费方案（GitHub Pages / 对象存储免费额度）
- 数据同步用crontab，不用消息队列

---

## 九、数据采集技术细节

### 9.1 ProCyclingStats.com 爬取策略

PCS（ProCyclingStats.com）是自行车赛事数据最全的网站之一，覆盖UCI WorldTour、三大环赛、世锦赛等几乎所有赛事。

**核心爬取页面**：

| 页面 | URL模板 | 数据内容 |
|-----|---------|---------|
| 赛事列表 | `https://www.procyclingstats.com/races.php?year=2026` | 赛季所有赛事 |
| 赛段列表 | `https://www.procyclingstats.com/race/giro-ditalia/2026/stage-5` | 单赛段基本信息 |
| 赛段成绩 | `https://www.procyclingstats.com/race/giro-ditalia/2026/stage-5/result` | 完赛车手成绩 |
| GC总成绩 | `https://www.procyclingstats.com/race/giro-ditalia/2026/result-general` | 总成绩排名 |
| 领骑衫 | `https://www.procyclingstats.com/race/giro-ditalia/2026/leaderboard` | 各分类领骑衫 |
| 车手信息 | `https://www.procyclingstats.com/rider/[name]/[year]` | 车手详细资料 |

**爬取技术栈**：
- **Cheerio**：静态页面抓取（PCS大部分内容静态渲染）
- **Playwright**：动态渲染页面备用（如遇到JS加载的内容）
- **node-fetch / axios**：HTTP请求

**反爬策略**：
- User-Agent轮换（每10次请求换一次）
- 请求间隔30-60秒（礼貌爬取）
- 失败自动重试3次，间隔递增
- 夜间低峰期批量爬取（凌晨2-4点）

### 9.2 大环赛计时商数据（备用）

| 赛事 | 计时商 | 数据获取方式 |
|-----|-------|------------|
| 环意 | Tissot Timing | 官网实时页面，PCS覆盖不到时用 |
| 环法 | Tissot Timing | 同上 |
| 环西 | CronoWeb / Tissot | 同上 |

### 9.3 备用爬取策略

```
PCS主数据源
    │
    ├── 成功 → 数据入库
    │
    └── 失败 → 赛事官网/权威媒体 → 手动录入
```

**注意事项**：
- 遵守 robots.txt
- 设置合理的爬取间隔（至少30秒/次）
- 做好反爬应对（User-Agent轮换、代理）

---

## 十、数据同步策略

### 10.1 实时同步（比赛进行中）

```
比赛进行时：每5分钟同步一次成绩
    └── PCS页面爬取 + 入库
```

### 10.2 赛后同步（比赛结束后1小时内）

```
比赛结束 → 等待30分钟（官方确认成绩）→ PCS爬取最终成绩 → 数据校验 → 发布
```

### 10.3 定时同步（日常维护）

```
非比赛日：每日凌晨2点同步一次所有赛事状态
    └── 检测新赛事、更新赛段信息、同步车手/车队数据
```

---

## 十一、成本估算

### 初期成本（v1.0上线前）

| 项目 | 月成本 | 说明 |
|-----|--------|------|
| 云服务器（2核2G） | ~50元/月 | 腾讯云轻量/阿里云ECS |
| 域名 | ~70元/年 | .com域名 |
| SSL证书 | 免费 | Let's Encrypt |
| 对象存储 | 免费 | 初期图片少，用免费额度 |
| **合计** | **~60元/月** | 一年总成本约700元 |

### 流量压力预估

- v1.0预期用户：100-500人
- 单次请求：< 50KB
- 月流量：< 10GB
- 2核2G足够扛，不用升级

---

## 十二、监控与告警

### 11.1 关键监控指标

| 指标 | 告警阈值 | 说明 |
|-----|---------|------|
| API响应时间 | > 500ms | P95延迟 |
| 数据库连接数 | > 80%上限 | 连接池告警 |
| 同步任务失败率 | > 10% | 数据同步异常 |
| 数据更新延迟 | > 1小时 | 赛事成绩未及时更新 |
| 接口错误率 | > 5% | 500/502/503错误 |

### 11.2 告警渠道

- 企业微信机器人
- 邮件通知
- 短信（核心赛事数据异常时）

---

## 十三、安全设计

| 安全项 | 方案 |
|-------|------|
| API限流 | 简单令牌桶，普通用户60次/分钟 |
| 数据加密 | 传输层HTTPS，静态数据不用额外加密（非敏感数据） |
| 数据库访问 | 本地localhost，不对外暴露端口 |
| 密钥管理 | 环境变量，不硬编码 |
| 数据备份 | 每周自动备份到本地，关键节点手动备份 |

---

*本技术方案为v1.0初稿（一个人开发极简版），将在开发过程中持续迭代。*
