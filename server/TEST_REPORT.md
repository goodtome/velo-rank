# 领骑/Jersey - 服务端 & 小程序端功能测试报告

**测试时间**: 2026-05-15  
**测试范围**: 服务端 API + 小程序端页面逻辑

---

## 一、服务端 API 测试结果

| 端点 | 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|------|
| 健康检查 | GET | `/health` | ✅ 正常 | 返回 `{status: "ok", timestamp: "..."}` |
| 赛事列表 | GET | `/api/v1/races` | ✅ 正常 | 支持 category/gender/season 过滤 |
| 赛事统计 | GET | `/api/v1/races/stats/overview` | ✅ 正常 | 返回各表计数 |
| 赛事详情 | GET | `/api/v1/races/:id` | ✅ 正常 | id 为 UUID 格式 |
| 赛段列表 | GET | `/api/v1/races/:id/stages` | ✅ 正常 | 按 stage_number 排序 |
| GC总成绩 | GET | `/api/v1/races/:id/gc` | ✅ 正常 | 取最新赛段GC数据 |
| 赛段详情 | GET | `/api/v1/stages/:id` | ✅ 正常 | 关联赛事名称 |
| 赛段成绩 | GET | `/api/v1/stages/:id/results` | ✅ 正常 | 支持 limit 参数 |
| 领骑衫 | GET | `/api/v1/stages/:id/jerseys` | ✅ 正常 | 关联车手/车队信息 |
| 车手列表 | GET | `/api/v1/riders` | ✅ 正常(已修复) | 新增端点，支持 q/limit/offset |
| 车手详情 | GET | `/api/v1/riders/:id` | ✅ 正常 | 附带最近车队信息 |
| 车队列表 | GET | `/api/v1/teams` | ✅ 正常(已修复) | 新增端点，支持 q/limit/offset |
| 车队详情 | GET | `/api/v1/teams/:id` | ✅ 正常 | |
| 搜索车手 | GET | `/api/v1/search/riders?q=xxx` | ✅ 正常(已修复) | 返回 `{riders: [...]}` 格式 |
| 搜索车队 | GET | `/api/v1/search/teams?q=xxx` | ✅ 正常(已修复) | 返回 `{teams: [...]}` 格式 |
| 同步状态 | GET | `/api/v1/sync/status` | ✅ 正常 | |
| 管理-SQL生成 | POST | `/api/v1/admin/generate-sql` | ✅ 正常 | |
| 管理-直接导入 | POST | `/api/v1/admin/import-stage` | ✅ 正常 | |
| 管理-中文名 | PUT | `/api/v1/admin/rider/:id/chinese-name` | ✅ 正常 | |
| 管理-翻译统计 | GET | `/api/v1/admin/translation-stats` | ✅ 正常 | |

---

## 二、小程序端测试结果

| 页面 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 首页 | `pages/index/index` | ✅ 正常(已修复) | 调用 `/races?season=2026` |
| 搜索页 | `pages/search/search` | ✅ 正常(已修复) | 路径重复Bug已修复 |
| 赛事详情 | `pages/race-detail/race-detail` | ✅ 正常 | 加载赛事+赛段列表 |
| 赛段成绩 | `pages/stage-results/stage-results` | ✅ 正常 | 支持 stage/gc 两种模式 |
| 车手详情 | `pages/rider-detail/rider-detail` | ✅ 正常 | |
| 车队详情 | `pages/team-detail/team-detail` | ⚠️ 有问题 | 见下方说明 |
| 我的 | `pages/profile/profile` | ✅ 正常 | 静态页面 |

### ⚠️ 车队详情页问题

`team-detail.js` 中调用 `/api/v1/teams/:id` 后，期望返回数据中包含 `riders` 数组：

```js
// team-detail.js 第33行
riders: res.data.data.riders || [],
```

但服务端 `GET /api/v1/teams/:id` 只返回车队基本信息，**不会返回该车队的车手列表**。这是一个**前后端契约不一致**的问题，需要后续修复（服务端需在返回中添加车手列表，或小程序端自行请求）。

---

## 三、已修复的 Bug

### Bug #1 - 小程序搜索页路径重复
**文件**: `miniprogram/pages/search/search.js`  
**问题**: `path` 已含 `/api/v1`，再拼 `baseUrl` 导致路径变成 `/api/v1/api/v1/search/riders`  
**修复**: 将路径改为 `/search/riders` 和 `/search/teams`

### Bug #2 - 服务端搜索返回格式不匹配
**文件**: `server/routes/search.js`  
**问题**: 服务端返回 `{data: rows}`，但小程序期望 `{data: {riders: rows}}`  
**修复**: 搜索端点返回格式改为 `{data: {riders: rows}}` 和 `{data: {teams: rows}}`

### Bug #3 - 车手列表端点缺失
**文件**: `server/routes/riders.js`  
**问题**: 只有 `GET /:id`，`GET /api/v1/riders` 返回 404  
**修复**: 添加 `GET /` 列表端点，支持 `q/limit/offset` 参数

### Bug #4 - 车队列表端点缺失
**文件**: `server/routes/teams.js`  
**问题**: 只有 `GET /:id`，`GET /api/v1/teams` 返回 404  
**修复**: 添加 `GET /` 列表端点，支持 `q/limit/offset` 参数

---

## 四、待修复问题（后续）

1. **车队详情页无车手列表**: `team-detail.js` 期望服务端返回 `riders` 数组，但服务端未实现。需要在 `GET /api/v1/teams/:id` 中添加车手列表查询，或让小程序端单独请求。

2. **赛事日期为空**: `races` 表中 `start_date`/`end_date` 为 null，导致首页无法正确区分"进行中"和"即将开始"的赛事。需要补充数据。

3. **中文名缺失**: 大量车手/车队/赛事缺少中文名，管理后台已提供批量更新接口，需配合翻译工作流使用。

4. **小程序 `baseUrl` 配置**: `app.js` 中 `baseUrl` 写死为 `http://localhost:3000/api/v1`，真机调试时需要改为服务器 IP。

---

## 五、数据库当前状态

| 表 | 记录数 |
|----|--------|
| races | 1 |
| stages | 5 |
| riders | 452 |
| teams | 50 |
| stage_results | 726 |
| jerseys | 9 |
| general_classification | 170 |

*数据来源: `GET /api/v1/races/stats/overview`*
