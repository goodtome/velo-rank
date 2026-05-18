# 手动数据收集指南

## 概述

由于 procyclingstats.com 有严格的 Cloudflare 保护，目前无法自动爬取。本指南提供手动收集数据的方法。

## 数据收集步骤

### 1. 访问 PCS 网站

在浏览器中访问以下 URL（需手动登录或通过 Cloudflare 验证）：

```
https://www.procyclingstats.com/race/giro-ditalia-2026/stage-5/result
```

### 2. 收集赛段成绩数据

**目标页面格式：**

| Rank | Rider | Team | Time |
|------|-------|------|------|
| 1 | Tadej Pogačar | UAE Team Emirates | 4h 35' 12" |
| 2 | Richard Carapaz | EF Education-EasyPost | + 0" |
| 3 | ... | ... | ... |

**复制方法：**
- 选中表格内容 → 复制 → 粘贴到文本编辑器
- 或使用浏览器开发者工具查看 HTML 源码

### 3. 数据格式

将数据整理为以下 JSON 格式：

```json
[
  { "rank": 1, "rider_name": "Tadej Pogačar", "team_name": "UAE Team Emirates", "time_gap": "4h 35' 12\"" },
  { "rank": 2, "rider_name": "Richard Carapaz", "team_name": "EF Education-EasyPost", "time_gap": "+ 0\"" }
]
```

### 4. 填入导入脚本

将整理好的数据填入 `server/scripts/manual-data-import.js` 中的：

```javascript
const STAGE_RESULTS_DATA = [
  { rank: 1, rider_name: 'Tadej Pogačar', team_name: 'UAE Team Emirates', time_gap: "4h 35' 12\"" },
  { rank: 2, rider_name: 'Richard Carapaz', team_name: 'EF Education-EasyPost', time_gap: '+ 0"' },
  // ... 更多成绩
];
```

### 5. 运行导入

```bash
node server/scripts/manual-data-import.js
```

## 数据表结构

### races（赛事主表）
- race_code: 赛事代码，如 `giro-ditalia-2026`
- race_name: 赛事名称
- category: 赛事级别（GRAND_TOUR / WORLD_TOUR / etc.）
- season: 年份

### stages（赛段表）
- stage_number: 赛段编号
- stage_name: 赛段名称
- date: 比赛日期
- distance_km: 距离（公里）
- stage_type: 赛段类型（Flat / Hilly / Mountain / ITT / TTM）

### stage_results（赛段成绩表）
- rank: 排名
- rider_id: 车手ID（自动关联）
- team_id: 车队ID（自动关联）
- time_gap: 时间差
- sprint_points: 冲刺积分
- mountain_points: 爬坡积分

### jerseys（领骑衫表）
- jersey_type: 领骑衫类型（pink / purple / blue / white）
- rider_id: 车手ID
- team_id: 车队ID

### riders（车手表）
- rider_name: 车手姓名
- nationality: 国籍代码（3字母）
- uci_id: UCI ID

### teams（车队表）
- team_name: 车队名称
- uci_code: UCI代码

## 当前状态

- ✅ 数据库已创建
- ✅ 表结构已初始化
- ⏳ 等待手动数据收集
