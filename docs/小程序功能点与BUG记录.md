# 「领骑/Jersey」小程序开发功能点与BUG记录

> 历史归档：本文档记录 v1/v1.1 阶段开发状态，不能作为 v2 当前待办清单。v2 当前口径请以 `docs/V2.0.0_RELEASE_SCOPE.md` 和 `docs/CURRENT_VERSION_FEATURES.md` 为准。

> 更新时间：2026-05-28
> 项目：自行车比赛成绩查询小程序
> 技术栈：微信小程序 + Node.js/Express + MySQL + Python 爬虫

---

## 一、项目概述

| 项目信息 | 详情 |
|---------|------|
| 产品名称 | 领骑 / Jersey |
| 当前版本 | V1.0（已完成），V1.1（进行中） |
| 技术架构 | 微信小程序前端 + Node.js/Express 服务端 + MySQL 8.0 |
| 数据源 | ProCyclingStats.com 爬取 |
| 部署环境 | 生产：Fly.io + TiDB Cloud；开发：本地 Node.js + MySQL |
| 开发周期 | 6-8周（单人开发） |

---

## 二、功能开发记录

### Week 4（2026-05-19）：管理后台开发完成

#### 关键实现
- **赛事/赛段 CRUD**：POST/PUT/DELETE 全部正常，动态 SQL 更新，级联删除，UUID 主键
- **管理后台 HTML**：系统状态 + 数据库统计、赛事/赛段 CRUD 表单、领骑衫管理（赛事→赛段联动）、成绩录入（单条添加 + 批量保存）、中文名称管理、数据校验、导入脚本生成器

#### 技术踩坑
| 问题 | 解决方案 |
|------|---------|
| UUID 主键不能用 parseInt() | MySQL 会报 "Truncated incorrect DOUBLE value"，需保持 UUID 字符串格式 |
| 动态 SQL 更新逗号遗漏 | 用 `updates.join(', ')` 拼接 SET 子句 |
| stage_code 是 NOT NULL+UNIQUE | POST stages 时必须传值，自动生成 `{race_code}-s{stage_number}` |
| constants.js 类别值不匹配 | ALLOWED_CATEGORIES 用 'Grand Tour'（有空格），不是 'GRAND_TOUR' |

---

### Week 5（2026-05-19）：小程序首页 + 赛事页开发完成

#### 关键实现
- **首页 Hero 卡片**：深色渐变背景 + 领骑衫四宫格 + LIVE 脉冲动画
- **赛事详情页**：领骑衫展示 + 赛段类型标签（Flat 绿/Hills 橙/Mountain 红）+ GC 入口
- **赛段成绩页**：前三名金银铜高亮（🥇🥈🥉 + 渐变背景）
- **新增 4 个服务端 API**：`/races/active`, `/recent`, `/upcoming`, `/latest-jerseys`

#### 技术踩坑
| 问题 | 解决方案 |
|------|---------|
| 领骑衫 API 格式前端无法遍历 | 原来返回对象 `{}` → 改为数组 `[]` |
| stages results limit 参数判断错误 | `isNaN(parseInt(limit))` 恒为 false → 先 parse 再 isNaN |
| VALIDATION.MAX_LIMIT 不存在 | MAX_LIMIT 在 PAGINATION 里 → 引用 PAGINATION.MAX_LIMIT |
| latest-jerseys 查空 | 最新赛段 Stage 5 无领骑衫 → 改查"最新有领骑衫数据的赛段" |
| PUT/POST races 未处理 race_name_zh | 补充 13 字段处理 |

#### 数据补充
- 环意日期：2026-05-09 至 2026-05-31，21 赛段
- Test Race 改为 Tour de France 2025（近期完赛展示用）

---

### Week 7（2026-05-19）：推送通知 + 赛事日历开发完成

#### 关键实现
- **赛事日历 API**：`GET /races/calendar?year=&month=`，赛事期间全覆盖标记，状态计算（ongoing/upcoming/finished）
- **推送路由重构**：openid 替代 JWT，9 个 API 端点，本地存储优先 + 服务端同步
- **推送表迁移**：`user_push_settings`/`openid`、`user_push_subscriptions`、`push_history`
- **日历页升级**：赛事类型颜色、图例、倒计时、加载动画
- **推送设置页**：去掉 JWT 依赖、统一 request 封装、同步状态指示
- **个人中心**：新增日历和推送设置入口

#### 技术踩坑
| 问题 | 解决方案 |
|------|---------|
| UTC 时区问题 | MySQL datetime 带 UTC 偏移 → 统一转为纯日期字符串比较 |
| Express 路由顺序错误 | `/calendar` 必须在 `/:id` 之前定义 |
| category 值不匹配 | 数据库存 `GRAND_TOUR`（大写下划线），前端映射需对齐 |
| 推送表 user_id→openid | v1.0 不依赖 users 表，用 openid 做简单标识 |

---

### Week 8（2026-05-23）：部署验证

#### 环境状态
- **本地环境**：Node.js :3000 + MySQL :13306 正常运行
- **生产环境**：fly.io (`velo-rank-api.fly.dev`)，HTTPS 强制，Docker 部署 (Node 22 Alpine)
- **数据库**：生产用 TiDB Cloud (`gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000`)
- **小程序 AppID**：`wx95718854a33556dd`

#### 验证通过率：96.2% (25/26)

#### 待解决问题
| 优先级 | 问题 | 说明 |
|--------|------|------|
| 🔴 高 | 微信公众平台需添加域名 | 需添加 `velo-rank-api.fly.dev` 为 request 合法域名 |
| 🟡 中 | 青年榜 API 无数据 | 表有数据，JOIN 逻辑待查 |
| 🟡 中 | 积分榜/爬坡榜需去重 | 需要使用 DISTINCT |
| 🟡 中 | live-news 路由未实现 | 待开发 |
| 🟢 低 | 小程序 `CURRENT_ENV` 配置 | 目前为 `development`，上线前需切为 `production` |

---

## 三、BUG 修复记录

### 测试阶段发现的 BUG（2026-05-15）

#### 服务端 API 测试
共测试 17 个端点，全部正常（含 4 个修复）。

#### 小程序端测试
6 个页面，5 个正常，1 个有问题（team-detail）。

#### 已修复的 4 个 Bug

| # | 文件 | Bug 描述 | 修复方案 |
|---|------|----------|----------|
| 1 | `miniprogram/pages/search/search.js` | 路径重复（path 已含 `/api/v1`，再拼 baseUrl 导致双重路径） | 移除 baseUrl 中的 `/api/v1` 前缀 |
| 2 | `server/routes/search.js` | 搜索返回格式不匹配（小程序期望 `{riders:[],teams:[]}`，服务端返回 `[]`） | 修改服务端返回格式，包装为 `{riders: [], teams: []}` |
| 3 | `server/routes/riders.js` | 缺少列表端点 `GET /`（只有 `GET /:id`） | 添加 `GET /` 路由处理车手列表请求 |
| 4 | `server/routes/teams.js` | 缺少列表端点 `GET /`（只有 `GET /:id`） | 添加 `GET /` 路由处理车队列表请求 |

#### 待修复问题

| # | 文件/模块 | 问题描述 | 状态 |
|---|-----------|----------|------|
| 1 | `miniprogram/pages/team-detail/team-detail.js` | 期望服务端返回 `riders` 数组，但 `GET /api/v1/teams/:id` 未实现 | 待修复 |
| 2 | `server/models/race.js` | `races` 表 `start_date`/`end_date` 为 null，首页无法区分进行中/即将开始 | 待修复 |
| 3 | `miniprogram/utils/config.js` | `baseUrl` 写死为 localhost，真机调试需改 IP | 待修复 |

---

## 四、数据采集与入库踩坑记录

### Stage 14 数据入库（2026-05-25）

#### 踩坑记录
| # | 问题 | 解决方案 |
|---|------|----------|
| 1 | riders 表 nationality NOT NULL 约束 | 创建新车手必须提供 nationality 值（默认 "UN"） |
| 2 | `fetch_pcs_stage.py` 中 `parse_rider_cell` 的 nationality 提取有 bug | `class="flag dk"` 被 BeautifulSoup 存为 `['flag','dk']`，原代码取 `[0]`（永远是 'flag'）导致国籍始终为空。已修复为取非 'flag' 的 class 并 `.upper()` |

### Stage 16 数据入库 + 全分类数据导入（2026-05-27）

#### 踩坑记录
| # | 问题 | 解决方案 |
|---|------|----------|
| 1 | `fetch_pcs_stage.py` 的 `extract_classification` 函数解析 GC 表失败 | 硬编码 td[7] 导致 9 列表格解析错误 → 已修复为根据 `len(tds)` 动态确定列索引 |
| 2 | GC 表时间差位置错误 | 时间差在 `td[12]`（非 td[2]），总时间在 `td[11]` |
| 3 | `general_classification` 表 `id` 字段无默认值 | INSERT 时必须提供 UUID |
| 4 | `nationality` 字段 NOT NULL | 导入时必须提供值（默认 `"UN"`） |
| 5 | KOM/Points/Youth 表结构差异 | `mountains_classification`/`points_classification`/`youth_classification` 表**没有 `team_id` 字段**，`import_all_classifications.py` 已移除相关代码 |
| 6 | 字段用途不明确 | KOM/Points 表使用 `points` 字段存储积分，Youth 表使用 `time` + `time_gap` 字段存储时间 |

---

## 五、数据库统计（2026-05-27 更新）

| 表名 | 记录数 | 说明 |
|------|--------|------|
| races | 2 条 | 赛事 |
| stages | 6 条 | 赛段 |
| riders | 600+ 条 | 车手 |
| teams | 50+ 条 | 车队 |
| stage_results | 883 条 | 赛段成绩 |
| jerseys | 13 条 | 领骑衫 |
| general_classification | 170 条 | 总成绩 |

### 翻译覆盖率
- 车队：56%
- 车手：4.13%
- 赛段：80%
- 赛事：50%

---

## 六、技术方案决策记录

### 架构决策
- **架构**：微信小程序 + Node.js/Express + MySQL 8.0（极简版）
- **数据源**：ProCyclingStats.com 爬取为主（一个人开发，成本最低）
- **部署**：腾讯云轻量服务器 2核2G（约50元/月）
- **开发周期**：一个人开发，6-8周上线
- **月成本**：约60元/月（服务器50元 + 域名摊薄）
- **缓存**：v1.0 不用 Redis，直接 DB 扛
- **管理后台**：简单 HTML 页面，不用框架

### 用户登录方案（2026-05-25）
采用 UUID Token 方案（无需 JWT 等新依赖）：
1. 微信 `wx.login()` → 获取 code
2. 服务端调用 `code2Session` 获取 openid
3. 生成 UUID token 存入 `user_tokens` 表
4. `authMiddleware` 验证 Bearer token
5. 注入 `req.openid`
6. push 路由保护，其他公开路由不受影响

### 数据采集技术细节
- **PCS Cloudflare 绕过**：curl + User-Agent（服务器端 Cloudflare 不严格检查）
- **HTML 解析**：jsdom（Node.js）
- **表格结构**：Rnk|GC|Timelag|BIB|H2H|Specialty|Age|Rider|Team|UCI|Pnt|Time
- **关键字段位置**：Rank(0), GC(1), Timelag(2), BIB(3), Rider(7), Team(8), Time(12)
- **Time 列特殊处理**：`<font>5:07:51</font><span class="hide">5:07:51</span>`，需取 font 内文本避免重复
- **SQL 保留字**：`rank` 是 MySQL 保留字，必须用反引号 `` `rank` `` 包裹

---

## 七、PRD 核心策略

### 赛事覆盖策略
- **女子赛事**：UCI 女子世界巡回赛纳入，与男子赛事同等优先级
- **赛事覆盖策略**：优先做大比赛——v1.0 聚焦 UCI 男子+女子 WorldTour、三大环赛（环法/环意/环西）、UCI 公路世锦赛；国家级赛事延后至 v1.1
- **产品名称**：「领骑 / Jersey」
- **数据结构标准**：前三名 + 粉/紫/蓝/白领骑衫（与 cycling-article-workflow 对齐）
- **数据更新时效**：比赛结束后 1 小时内完成数据录入

---

## 八、后续开发计划

### V1.1 迭代需求
- 国家级赛事数据接入
- 青年榜 API 修复
- 积分榜/爬坡榜去重
- live-news 路由实现
- 翻译覆盖率提升（目标：车手 >50%）

### 技术债务
- [ ] 修复 `team-detail.js` 缺少 riders 数组问题
- [ ] 补充 `races` 表 `start_date`/`end_date` 数据
- [ ] 配置化 `baseUrl`（环境切换）
- [ ] 生产环境配置切换（`CURRENT_ENV = production`）

---

## 附录：相关文档

| 文档 | 路径 |
|------|------|
| PRD 文档 | `D:\codes\cycling_new\cycling-results-app-prd.md` |
| 技术方案 | `D:\codes\cycling_new\cycling-results-app-tech-spec.md` |
| 测试报告 | `D:/codes/cycling_new/server/TEST_REPORT.md` |
| MySQL 密码配置指南 | `D:\codes\cycling_new\docs\MYSQL_PASSWORD_SETUP.md` |
| 文章工作流技能 | `~/.workbuddy/skills/cycling-article-workflow/` |

---

*本文档由 WorkBuddy AI 自动生成，基于项目 MEMORY.md 整理*
