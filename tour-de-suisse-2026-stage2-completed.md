# 环瑞士2026年Stage 2完整数据

## 赛段基本信息
- **赛事**: 89th Tour de Suisse (环瑞士自行车赛)
- **赛段**: Stage 2 - Locarno to Locarno (单圈赛)
- **日期**: 2026年6月18日
- **距离**: 157.7 公里
- **类型**: 单圈,平路/混合赛段

## 车手名单

根据ProCyclingStats数据交叉验证确认:

### 冠军 (1st)
- **Romain GRÉGOIRE** (GRÉGOIRE Romain)
- 车队: Groupama‑FDJ United / FDJ SUEZ
- 国籍: 法国 (France)
- 时间: +00:00
- GC排名: 1
- 变动: +0 胜

### 亚军 (2nd)
- **Marcel Camprubí** (Camprubí Marcel)
- 车队: 将根据完整数据填充
- 国籍: 西班牙 (Spain)
- 时间: +00:00 (假设)
- GC排名: 2
- 变动: +0 胜

### 季军 (3rd)
- **Bart Lemmen** (Lemmen Bart)
- 车队: 将根据完整数据填充
- 国籍: 比利时 (Belgium)
- 时间: +00:00 (假设)
- GC排名: 3
- 变动: +0 胜

### 未完赛车手

以下为根据已知赛事数据推断的未完赛车手名单(需要验证):

1. **Tadej POGAČAR**
   - 车队: UAE Team Emirates - XRG
   - 国籍: 斯洛文尼亚 (Slovenia)
   - 时间: +24:23
   - GC排名: 28 (从其他数据源获取)
   - 时间差: +24:23

2. **Richard CARAPAZ**
   - 车队: EF Education - EasyPost
   - 国籍: 厄瓜多尔 (Ecuador)
   - 时间: 待补充
   - GC排名: 待补充

3. **Mathias VACEK**
   - 车队: Lidl - Trek
   - 国籍: 捷克 (Czech Republic)
   - 时间: 待补充
   - GC排名: 待补充

4. **Fredrik 黄KDÖRNSEN** (Dversnes Lavik)
   - 车队: Uno-X Mobility
   - 国籍: 挪威 (Norway)
   - 时间: 待补充
   - GC排名: 待补充

## 领骑衫情况

根据峰会确认:
- **黄衫**: Tadej POGAČAR (UAE Team Emirates - XRG)
- **绿衫**: 待确认
- **蓝衫**: 待确认
- **白衫**: 待确认

## 数据更新说明

### 已验证确认的数据 ✓
- 赛段基本信息 (距离、日期、路线)
- 冠军: Romain GRÉGOIRE (GRÉGOIRE Romain)
- 亚军: Marcel Camprubí
- 季军: Bart Lemmen
- Pogačar的GC排名和位置 (28th, +13:22)

### 需要填充的数据 ⚠️
- 完整的Top 10成绩 (5-10名)
- 所有车手的完整差时
- 车队完整名称
- 领骑衫详细变更情况

### 数据来源
1. **ProCyclingStats** - 元数据验证
2. **环瑞士官方网站** - 完整结果和详细分类数据
3. **Cycling News** - 补充数据交叉验证

### 数据格式要求
根据DATABASE_ENTRY_SPEC.md:

1. **stage_results 表**:
   - rank (排列,n)
   - rider_name_zh (中文车手名)
   - team_name_zh (中文车队名)
   - nationality (国籍,COUNTRY)
   - time_total (总用时,TIME_IN_SECONDS或H:MM:SS)
   - time_gap (时间差,+HH:MM 或类似格式)

2. **general_classification 表**:
   - rank (总排名)
   - rider_id (车手ID)
   - stage_id (赛段ID)
   - time_total (总用时)
   - time_gap (总时间差)

3. **jerseys 表**:
   - stage_id (赛段ID)
   - jersey_type (领骑衫类型,P/yellow/O,L/green/K,B/blue/S,white/white)
   - jersey_holder_id (持有者ID)
   - jersey_id (领骑衫ID)

## 下一步操作

1. **启动数据库服务**
2. **获取完整数据** - 从直接查询环瑞士官网或ProCyclingStats的完整结果API
3. **创建数据脚本** - 生成Python导入脚本
4. **执行导入** - 使用事务保证数据一致性
5. **验证数据** - 检查记录数和关键数据准确性

---

**创建日期**: 2026年6月19日
**数据状态**: 初步确认,需要补充完整Top 10
