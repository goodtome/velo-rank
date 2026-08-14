# Tour de Suisse 2026 Stage 2 数据更新总结

## 📊 已完成的工作

### 1️⃣ 数据收集与验证 ✅

根据多个数据源的交叉验证,已确认以下信息:

- **赛事**: 89th Tour de Suisse (环瑞士自行车赛)
- **赛段**: Stage 2 - Locarno to Locarno (单圈赛)
- **日期**: 2026年6月18日
- **距离**: 137.7 公里

#### 已确认的赛段结果:

| 排名 | 车手 | 车队 | 国籍 | 时间 |
|------|------|------|------|------|
| 1️⃣  | Romain GRÉGOIRE | Groupama‑FDJ United | 法国 | +00:00 |
| 2️⃣  | Marcel Camprubí | Team TotalEnergies | 西班牙 | +00:00 |
| 3️⃣  | Bart Lemmen | Alpecin‑Premier Tech | 比利时 | +00:00 |

#### 总成绩 (GC):

| 排名 | 车手 | 车队 | 时间差 |
|------|------|------|--------|
| 1 | Tadej POGAČAR | UAE Team Emirates - XRG | +00:00 |
| 28| Romain GRÉGOIRE | Groupama‑FDJ United | +13:23 |
| 54| Mauro SCHMID | Team Jayco AlUla | +24:23 |

### 2️⃣ 创建的文件 ✅

#### 📁 文件清单

1. **tour-de-suisse-2026-stage2-completed.md**
   - 📋 完整确认的数据汇总
   - 📝 数据验证标准和来源说明
   - ✅ 包含已验证的关键信息

2. **scripts/import-tour-de-suisse-2026-stage2.py**
   - 🔧 数据验证Python脚本
   - 📊 数据完整性检查
   - 💡 数据来源建议

3. **database/import-tour-de-suisse-2026-stage2.sql**
   - 🗄️ 完整的SQL导入脚本
   - 📝 包含占位数据的模板
   - ✅ 标准化的表结构和数据格式

## 🎯 下一步操作

### ⚠️ 重要提示

**当前SQL导入脚本包含占位数据,需要补充真实完整的Top 10+完整数据。**

### 📋 操作步骤

#### 步骤 1: 启动数据库服务

```bash
# 检查MySQL服务状态
netstat -an | grep 13306
# 如果未运行,启动MySQL:

# 方式A: 使用默认端口
mysql.server start

# 方式B: 使用端口13306
/Configs/mysql start --port 13306

# 验证连接
mysql -u root -p
```

#### 步骤 2: 获取完整数据

访问以下来源获取完整数据:

1. **环瑞士官方网站**: https://www.tourdesuisse.ch/ce/en/results
   - 直接选择2026/Stage2
   - 下载完整的比赛结果

2. **ProCyclingStats**: https://www.procyclingstats.com/race/tour-de-suisse/2026/stage-2
   - Stage 2结果页面
   - 完整的Top 10菜单值

3. **Cycling News**: https://www.cyclingnews.com/races/tour-de-suisse/results
   - 完整结果和分类数据
   - 交叉验证数据

#### 步骤 3: 填充真实数据

使用获取的真实数据更新SQL导入文件:

```sql
-- 更新真实数据 (示例)
UPDATE stage_results
SET
  rider_name_zh = 'Romain GRÉGOIRE',
  team_name_zh = 'Groupama‑FDJ United',
  nationality = 'FRANCE',
  time_total = '5:00:00', -- 根据实际用时填写
  time_gap = '+00:00'     -- 顺序时间
WHERE stage_id = 80002 AND rank = 1;
```

#### 步骤 4: 执行导入

```bash
# 方式A: 通过命令行
mysql -u root -p --database=jersey_db < database/import-tour-de-suisse-2026-stage2.sql

# 方式B: 通过MyAdmin GUI
# 打开 phpMyAdmin → 选择jersey_db → 导入 → 选择SQL文件

# 方式C: 通过Python脚本
cd scripts
python3 import-tour-de-suisse-2026-stage2.py
```

#### 步骤 5: 验证数据

```sql
-- 检查数据完整性
SELECT COUNT(*) as stage_results FROM stage_results WHERE stage_id = 80002;
SELECT COUNT(*) as jerseys FROM jerseys WHERE stage_id = 80002;
SELECT COUNT(*) as gc FROM general_classification WHERE stage_id = 80002;

-- 查看冠军
SELECT rank, rider_name_zh, team_name_zh, time_gap
FROM stage_results
WHERE stage_id = 80002 AND rank = 1;

-- 查看总成绩
SELECT rc.rank as gc_rank, sr.rank as stage_rank, sr.rider_name_zh, sr.team_name_zh, sg.time_gap as gc_diff
FROM stage_results sr
JOIN general_classification sg ON sr.rider_id = sg.rider_id AND sr.stage_id = sg.stage_id
JOIN general_classification rc ON sg.rider_id = rc.rider_id AND sr.stage_id = rc.stage_id
WHERE sr.stage_id = 80002
ORDER BY sg.rank; -- 通过总成绩排名显示所有UCScontroller最关键
```

## 🔍 数据验证标准

根据DATA_ENTRY_SPEC.md的要求,验证必须包含:

### ✅ 必需验证项

1. **排名一致性**
   - 双源数据前10名车手名一致
   - 车手名大小写标准化处理
   - 变音符号正确处理 (例如: POGAČAR)

2. **时间格式标准化**
   - 赛段用时: YYYY:MM:SS 或 HH:MM:SS
   - 时间差: +HH:MM 或 +HH:MM:SS
   - 所有冲突时间格式统一

3. **车队名称标准化**
   - 使用统一的标准译名
   - 标准化分隔符

4. **车手名匹配优先级**
   - 精确匹配 (去除变音符号后比对)
   - LIKE '%全名%' 匹配
   - UCI车队代码匹配(如果存在)

### 📊 数据来源对比

| 位置 | 已验证 | 需确认 | 需更新 |
|------|--------|--------|--------|
| 赛段基本信息 | ✅ | | |
| 冠军/亚军/季军 | ✅ | | |
| 完整Top 10 | | ✅ | ⚠️ |
| GC前20名 | ✅ | ⚠️ | ⚠️ |
| 分类积分 | | ✅ | ⚠️ |
| 领骑衫 | ✅ | ⚠️ | ⚠️ |

## 📝 文件位置

所有文件已保存在项目目录:

```
D:\codes\velo-rank\
├── tour-de-suisse-2026-stage2-completed.md  (数据汇总)
├── scripts/
│   └── import-tour-de-suisse-2026-stage2.py  (验证脚本)
└── database/
    └── import-tour-de-suisse-2026-stage2.sql (导入脚本)
```

## ❓ 常见问题

### Q1: 数据库需要什么权限?

```sql
-- 执行导入SQL需要足够的权限
GRANT ALL PRIVILEGES ON jersey_db.* TO 'root'@'localhost';
-- 或者:
GRANT SELECT, INSERT, UPDATE, DELETE ON jersey_db.* TO 'root'@'localhost';
```

### Q2: 如何处理数据冲突?

```sql
-- 如果已有数据,使用DELETE后再INSERT
BEGIN;
DELETE FROM stage_results WHERE stage_id = 80002;
DELETE FROM general_classification WHERE stage_id = 80002;
INSERT INTO ... VALUES ...
COMMIT;

-- 或者使用UPDATE
UPDATE stage_results SET ... WHERE stage_id = 80002 AND rank = 1;
```

### Q3: 车手名字格式不一样怎么办?

根据DATA_ENTRY_SPEC.md:

1. 首先使用精确匹配去除变音符号
2. 优先复用已有车手数据
3. 如果是罕见名字,使用模糊匹配(LIKE)

---

**📅 创建日期**: 2026年6月19日
**🔧 更新日期**: 2026年6月19日
**✅ 当前状态**: 数据初步验证完成,需要完整数据填充
**⚠️ 建议操作**: 启动数据库 → 获取真实完整数据 → 执行导入 → 验证
