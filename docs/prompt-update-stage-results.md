# 赛段成绩更新提示词

## 使用方式

将 `{RACE_NAME}`, `{DATE}` 等占位符替换为实际值后发送。

---

更新 {RACE_NAME_ZH}（{RACE_NAME_EN}）{DATE} 第 {STAGE_NUMBER} 赛段的比赛成绩到本地 MySQL 数据库中。

## 要求

### 1. 数据来源与交叉验证
- 从至少两个独立数据源获取赛段成绩，优先使用：
  - 赛事官方网站（如有公开 API 或 HTML 页面）
  - ProCyclingStats.com（需绕过 Cloudflare，使用 agent-browser 或直接 curl + User-Agent）
  - cyclingnews.com、Eurosport、TotalVelo、FirstCycling、bikeraceinfo.com
- 双源数据必须交叉验证：**前 10 名车手名、车队名、成绩/时间差必须一致**。如有不一致，优先采用官方数据源，并标注差异。

### 2. 数据内容
需要获取以下完整数据（所有完赛车手）：
- **赛段成绩 (stage_results)**：排名、车手名、车队名、国籍、用时/时间差
- **总成绩 (general_classification)**：排名、车手名、车队名、总用时、时间差（如有多日赛）
- **冲刺积分 (points_classification)**：排名、车手名、积分
- **爬坡积分 (mountains_classification)**：排名、车手名、积分
- **最佳年轻车手 (youth_classification)**：排名、车手名、用时、时间差
- **领骑衫 (jerseys)**：各色领骑衫持有者（黄/绿/蓝/白等）
- **车队排名 (team_classification)**：排名、车队名、总用时、时间差（如有）

### 3. 车手和车队数据匹配
- **优先复用数据库中已有数据**：通过车手名（含变音符号处理 `stripDiacritics`）、车队名精确匹配
- **匹配策略**（按优先级）：
  1. 车手名精确匹配（去除变音符号、统一大小写）
  2. `rider_name` 模糊匹配（`LIKE '%全名%'`）
  3. 车队名精确匹配 → 关键词匹配（取前 2-3 个有意义的词）
  4. UCI 车队代码匹配
- **名称冲突处理**：
  - 同一姓氏不同车手（如 Valentin PARET PEINTRE vs Aurélien PARET PEINTRE）：**不要只用姓做 LIKE 匹配**，必须用全名
  - 车队名可能有多版本（如 `Alpecin – Premier Tech` vs `Alpecin-Premier Tech`）：统一标准化后匹配

### 4. 数据导入
- 导入前先 `DELETE` 该赛段的已有数据（`stage_results`, `general_classification`, `points_classification`, `mountains_classification`, `youth_classification`, `team_classification`, `jerseys`）
- 使用事务保证数据一致性（`BEGIN` → 全部导入 → `COMMIT` / 失败 `ROLLBACK`）
- `stage_results.nationality` 字段 NOT NULL，必须提供值（默认 `'UNK'`）
- `general_classification` 有 `(stage_id, rider_id)` 唯一约束，确保不同车手不会匹配到同一个 `rider_id`
- `jerseys` 表可能也有 `(stage_id, jersey_type)` 唯一约束
- `rank` 是 MySQL 保留字，必须用反引号 `` `rank` `` 包裹
- 时间格式标准化：`4h 06' 34''` → `4:06:34`，gap 格式 `+ 00h 00' 06''` → `+00:06`

### 5. 特殊赛事类型处理
- **单日赛**：只有 `stage_results`，无 GC/Points/KOM/Youth
- **多日赛**：需导入所有分类 + 领骑衫
- **女子赛事**：数据结构相同，车队分类为 `Women-WorldTour`
- **国家队车手**：创建 `{Country} (National)` 占位车队

### 6. 数据验证
导入完成后，在数据库中验证记录数是否与数据源一致：
```sql
SELECT COUNT(*) FROM stage_results sr 
JOIN stages s ON s.id = sr.stage_id 
WHERE s.stage_code = '{STAGE_CODE}';
```

### 7. 输出要求
- 赛段冠军、Top 10 成绩
- 领骑衫变更情况（如有）
- 导入数据量统计
- 数据源交叉验证结果
- 数据库验证记录数

---

## 示例

```
更新环多菲内2026年6月12日第6赛段的比赛成绩到本地MySQL数据库中。
```
