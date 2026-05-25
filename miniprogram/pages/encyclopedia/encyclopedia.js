/**
 * 赛事百科页面逻辑
 * 提供自行车赛事术语解释、规则说明、领骑衫、排名体系等综合参考
 */

const { t, getLocale } = require('../../utils/i18n');

// ============================================================
// 术语数据库 — 8 大分类
// ============================================================

const termDatabase = [
  // ==================== 1. 赛事排名 ====================
  {
    id: 1,
    name: '总成绩榜 (GC)',
    english: 'General Classification (GC)',
    brief: '分站赛中最重要的排名，以所有赛段累计时间最短决定总冠军，领先者佩戴领骑衫',
    definition: '分站赛中最重要的排名，以所有赛段累计时间最短决定总冠军。总成绩领先者在全程比赛中始终佩戴领骑衫。',
    description: '核心规则：\n• 同一集团内完成赛段的车手（差距不足 3 秒）被记为相同时间。\n• 在平路赛段终点前最后 3 公里内发生的摔车或机械故障，受影响车手被记为其当时所在集团的时间——前提是须完成该赛段。\n• 时间奖励（bonification）将从车手的累计时间中扣除，以奖励积极进攻的骑行。\n• 在不赢得任何单个赛段的情况下赢得总成绩，虽然罕见，但理论上可行。\n\n对总成绩争夺者而言最关键的赛段类型是山地赛段和个人计时赛，这两类赛段最容易拉开车手之间的时间差距。',
    example: '2026 年环意，Jonas Vingegaard 在 Stage 14 山地赛段夺冠后，在 GC 上与第二名拉开 0:49 的差距。',
    tags: ['排名', 'GC', '领骑衫', '总冠军'],
    category: 'rankings'
  },
  {
    id: 2,
    name: '冲刺积分榜',
    english: 'Points Classification',
    brief: '通过赛段高名次完赛和中间冲刺点获得积分的次要竞赛，领先者佩戴特定颜色领骑衫',
    definition: '通过赛段高名次完赛和中间冲刺点获得积分的次要竞赛。积分根据赛段剖面分配权重：平路赛段积分最多（利于冲刺手），山地赛段积分较少。排名以积分总数最高为准，而非时间。',
    description: '三大环赛积分领先者穿衫对照：\n• 环法 (Tour de France)：绿衫 (Maillot Vert)\n• 环意 (Giro d\'Italia)：紫红衫 (Maglia Ciclamino)\n• 环西 (Vuelta a España)：绿衫 (Maillot Verde)\n\n积分并列时，优先比较：赛段胜利数 → 中间冲刺胜利数 → GC 排名。\n\n积分榜于 1953 年环法 50 周年之际引入，旨在奖励速度与稳定性，而不仅仅是纯耐力表现。',
    example: '环法 2026，冲刺手在平路赛段终点冲刺获得 50 分，途中冲刺点获得 20 分，总计 70 分。',
    tags: ['排名', '冲刺', '绿衫', '紫红衫', '积分'],
    category: 'rankings'
  },
  {
    id: 3,
    name: '山地积分榜 (KOM)',
    english: 'Mountains Classification (KOM)',
    brief: '根据车手在有分类山顶率先过顶所获积分排名，领先者称为"山地之王"，环法佩戴波点衫',
    definition: '山地积分榜（KOM / King of the Mountains），根据车手在有分类山顶率先过顶所获得的积分排名。积分与山顶难度成正比——爬坡越难，可获积分越多。',
    description: '爬坡分类体系（从易到难）：\n• 4 级 (Cat. 4) — 最易，积分最少\n• 3 级 (Cat. 3)\n• 2 级 (Cat. 2)\n• 1 级 (Cat. 1) — 困难，积分较多\n• HC 级 (Hors Catégorie) — 超级难度，积分最多\n\nHC 字面意为"超出分类范围"，指最艰险的山顶，如阿尔卑·迪耶兹 (Alpe d\'Huez)、旺图山 (Mont Ventoux) 及斯泰尔维奥山 (Stelvio)。',
    example: '环意 2026 Stage 3，车手第一个通过 HC 级爬坡点，获得约 20 分爬坡积分。',
    tags: ['排名', '爬坡', 'KOM', '波点衫', '蓝衫'],
    category: 'rankings'
  },
  {
    id: 4,
    name: '最佳年轻骑手榜',
    english: 'Young Rider Classification',
    brief: '限于 25 岁以下车手的次级总成绩榜，领先者佩戴白衫，被视为未来总成绩潜力的风向标',
    definition: '限于参赛当年 1 月 1 日不足 26 岁的车手参与的次级总成绩榜，采用与 GC 相同的累计时间体系。领先者佩戴白色领骑衫（环法）。',
    description: '白衫被视为杰出才华与未来潜力的象征。若某车手同时领跑 GC 和年轻骑手榜，其将佩戴黄衫，白衫顺延给下一名年轻车手。\n\n历届获奖者包括波加查 (Tadej Pogačar)、贝尔纳尔 (Egan Bernal)、施莱克 (Andy Schleck) 和乌尔里希 (Jan Ullrich) 等人。',
    example: '2026 年环意 Stage 5 后，Jan Christen（21 岁）是青年排名领先者，穿白衫。',
    tags: ['排名', '青年', '白衫', '25岁以下'],
    category: 'rankings'
  },
  {
    id: 5,
    name: '车队总成绩榜',
    english: 'Team Classification',
    brief: '通过每支车队在各赛段表现最佳的三名车手的累计时间相加计算，衡量车队整体实力',
    definition: '分站赛中的团队排名。通过每支车队在各赛段表现最佳的三名（有时为五名）车手的累计时间相加计算。',
    description: '大多数赛事不设独立的团队领骑衫，但颁奖台上会表彰领先团队。此榜旨在奖励整个赛程中各类赛段的稳定团队表现，是衡量车队整体实力的重要指标。获胜车队为赛事结束时综合总时间最短的队伍。',
    tags: ['排名', '车队', '团队'],
    category: 'rankings'
  },
  {
    id: 6,
    name: '最具斗志奖',
    english: 'Combativity Award',
    brief: '每日颁发给被裁判评定为该赛段最积极进攻、最具活力的车手，次日佩戴红色参赛号码',
    definition: '最具斗志奖（Prix de la Combativité），每日（及总决赛结束时）颁发给被裁判评定为本赛段最积极进攻、最具活力的车手。',
    description: '获奖方式包括：发起逃跑（breakaway）、多次进攻或长时间骑行在前方。获奖者次日将佩戴红色参赛号码。此奖项表彰进攻型、富有创意的骑行风格，而非单纯以成绩论英雄。',
    tags: ['奖项', '斗志', '红色号码'],
    category: 'rankings'
  },
  {
    id: 7,
    name: '综合积分榜',
    english: 'Combination Classification',
    brief: '将车手在 GC、积分榜和山地积分榜上的名次合并计算的历史排名，环法历史上曾多次停办和恢复',
    definition: '综合积分榜（Classement du Combiné），将车手在 GC、积分榜和山地积分榜上的名次合并计算。获胜者为三项综合表现最佳的车手。',
    description: '此奖项在环法历史上曾多次停办和恢复。目前主要比赛中已较少使用，但其理念——寻找"最全面的车手"——仍然是自行车运动中的重要概念。',
    tags: ['排名', '综合', '历史'],
    category: 'rankings'
  },

  // ==================== 2. 领骑衫 ====================
  {
    id: 20,
    name: '黄衫 (环法)',
    english: 'Maillot Jaune — Yellow Jersey',
    brief: '职业自行车赛中最令人垂涎的荣耀，由环法总成绩领先者全程佩戴',
    definition: '黄色领骑衫（环法），职业自行车赛中最令人垂涎的荣耀，由总成绩榜领先者全程佩戴。',
    description: '颜色灵感来自创办环法的法国报纸《L\'Auto》的黄色纸张。1919 年首次授予车手欧仁·克里斯托夫 (Eugène Christophe)。现代赞助商为法国农业信贷银行 (LCL)。\n\n若 GC 领先者同时领跑其他分类榜，由该榜第二名车手佩戴对应衫。',
    tags: ['领骑衫', '黄衫', '环法', 'GC'],
    category: 'jerseys'
  },
  {
    id: 21,
    name: '粉衫 (环意)',
    english: 'Maglia Rosa — Pink Jersey',
    brief: '环意大利自行车赛的领骑衫，由总成绩领先者佩戴，1931 年首次引入',
    definition: '粉色领骑衫（环意），环意大利自行车赛的领骑衫，由总成绩领先者佩戴。',
    description: '1931 年首次引入，粉红色取自主办赛事的意大利体育报《La Gazzetta dello Sport》的报纸颜色。与黄衫、红衫并列为职业自行车赛三大最有声望的领骑衫。',
    tags: ['领骑衫', '粉衫', '环意', 'GC'],
    category: 'jerseys'
  },
  {
    id: 22,
    name: '红衫 (环西)',
    english: 'Maillot Rojo — Red Jersey',
    brief: '环西班牙自行车赛的总成绩领先者领骑衫，现行红色设计自 2010 年起使用',
    definition: '红色领骑衫（环西），环西班牙自行车赛的总成绩领先者领骑衫。现行红色设计自 2010 年起使用。',
    description: '此前环西曾使用金色衫（1935–1976 年）及白底蓝波点衫等设计。红色被选用以体现西班牙文化的热情奔放及赛事精神。',
    tags: ['领骑衫', '红衫', '环西', 'GC'],
    category: 'jerseys'
  },
  {
    id: 23,
    name: '绿衫 (环法)',
    english: 'Maillot Vert — Green Jersey',
    brief: '授予环法积分榜领先者，俗称"冲刺手之衫"，仅次于黄衫的第二重要领骑衫',
    definition: '绿色领骑衫（环法），授予环法积分榜领先者。环法第二重要的领骑衫，仅次于黄衫。',
    description: '1953 年为庆祝环法 50 周年首次引入，绿色取自首位赞助商的品牌色。俗称"冲刺手之衫"，但全能型和爆发型骑手也会争夺。\n\n若某车手同时领跑 GC 和积分榜，其佩戴黄衫，绿衫顺延给积分榜第二名。',
    tags: ['领骑衫', '绿衫', '环法', '积分榜', '冲刺'],
    category: 'jerseys'
  },
  {
    id: 24,
    name: '紫红衫 (环意)',
    english: 'Maglia Ciclamino — Cyclamen Jersey',
    brief: '环意积分榜领骑衫，以其独特的紫红色（仙客来色）命名，现行颜色自 2017 年沿用',
    definition: '紫红色领骑衫（环意），环意大利自行车赛的积分榜领骑衫，以其独特的紫红色（仙客来色）命名。',
    description: '1966 年首次以红色衫形式引入，历经多次颜色变更，现行紫红色自 2017 年沿用至今。环意的积分体系兼顾冲刺能力与爬坡稳定性的综合表现。',
    tags: ['领骑衫', '紫红衫', '环意', '积分榜'],
    category: 'jerseys'
  },
  {
    id: 25,
    name: '波点衫 (环法)',
    english: 'Maillot à Pois — Polka-Dot Jersey',
    brief: '颁发给山地积分榜领先者（山地之王/KOM）的标志性白底红波点领骑衫，1975 年引入',
    definition: '波点衫（环法），颁发给山地积分榜领先者——山地之王（KOM）的标志性白底红波点领骑衫。',
    description: '1975 年首次引入。每个有分类山顶顶峰均可获得积分，难度越高积分越多。波点图案据说灵感来源于早期骑行人物亨利·勒莫因 (Henri Lemoine) 所穿的花点织物。',
    tags: ['领骑衫', '波点衫', '环法', 'KOM', '爬坡'],
    category: 'jerseys'
  },
  {
    id: 26,
    name: '白衫 (环法)',
    english: 'Maillot Blanc — White Jersey',
    brief: '授予总成绩榜中排名最高的年轻骑手（25 岁以下），被视为未来潜力的象征',
    definition: '白色领骑衫（环法），授予总成绩榜中排名最高的年轻骑手（25 岁以下）。',
    description: '若年轻骑手同时领跑 GC 和白衫竞争，其佩戴黄衫，白衫顺延给下一名年轻车手。\n\n白衫被视为杰出才华与未来潜力的象征——历届获奖者包括波加查 (Tadej Pogačar)、贝尔纳尔 (Egan Bernal)、施莱克 (Andy Schleck) 和乌尔里希 (Jan Ullrich) 等人。',
    tags: ['领骑衫', '白衫', '环法', '青年'],
    category: 'jerseys'
  },
  {
    id: 27,
    name: '彩虹衫',
    english: 'Rainbow Jersey (Maillot Arc-en-ciel)',
    brief: '由现任 UCI 世界冠军佩戴，是自行车运动中最有名望的非赛事特定领骑衫',
    definition: '彩虹衫，由现任 UCI 世界冠军佩戴，是自行车运动中最有名望的非赛事特定领骑衫。',
    description: '彩虹条纹代表五大洲。世界冠军在获得该荣誉后的整年内，在所有比赛中佩戴彩虹衫——但仅限于该冠军所属项目（公路赛冠军只在公路赛中佩戴，计时赛冠军只在计时赛中佩戴）。',
    tags: ['领骑衫', '彩虹衫', '世界冠军', 'UCI'],
    category: 'jerseys'
  },

  // ==================== 3. 时间与奖励体系 ====================
  {
    id: 40,
    name: '时间奖励',
    english: 'Time Bonus / Bonification',
    brief: '从车手总成绩累计时间中扣除的秒数奖励，以表彰积极进攻的骑行风格',
    definition: '时间奖励（Bonification，意大利语：Abbuono），从车手总成绩累计时间中扣除的秒数奖励。',
    description: '奖励时间主要通过三种方式获得：\n1. 赛段终点奖励：赛段前几名可获时间扣减（环法：第 1 名 -10 秒、第 2 名 -6 秒、第 3 名 -4 秒）。\n2. 中间冲刺奖励：在赛段中途指定冲刺点可获奖励秒数。\n3. 山顶奖励：部分赛事对率先翻越关键山顶的车手给予时间奖励。\n\n时间奖励最早于 1923 年在环法引入，以鼓励更具进攻性的骑行。历史上多次取消和恢复。',
    example: '环法 2026 某赛段，冠军获得 10 秒时间奖励，从总成绩累计时间中直接扣除。',
    tags: ['时间', '奖励', 'bonification', '减秒'],
    category: 'rankings'
  },
  {
    id: 41,
    name: '同组同时规则',
    english: 'Same Time Rule',
    brief: '同集团内完成赛段的车手（差距不足 3 秒）在 GC 中记为相同时间',
    definition: '同组同时规则，当车手在同一集团内完成赛段——即相互间差距不足 3 秒时——在 GC 中被记为相同时间。',
    description: '此规则防止大集团因细微战术意外而在时间上产生分化，确保时间差距仅在车手因体力或不幸遭遇被真正分开时才会扩大。\n\n这是理解分站赛动态的基本规则：在山地赛段"仅靠住集团"的车手，即使比赛段冠军晚 30 秒完成，也不损失 GC 时间。',
    tags: ['时间', '规则', '同组', 'GC'],
    category: 'rankings'
  },
  {
    id: 42,
    name: '时间限制 (OTL)',
    english: 'Time Cut / OTL (Outside Time Limit)',
    brief: '大环赛每个赛段设有最长完赛时间，超出时限的车手将被取消下一赛段参赛资格',
    definition: '大环赛中每个赛段均设有最长完赛时间，超出此时间的车手将被取消下一赛段参赛资格。',
    description: '时限通常按赛段冠军时间的百分比计算，根据赛段类型和平均赛速有所不同——通常在冠军时间基础上浮动 8% 至 20%。\n\n特殊情况下（如大规模摔车、极端天气），赛事裁判可酌情延长或豁免时限。著名案例：2011 年环法，包括卡文迪什在内的 88 名车手超时完赛后被裁判组恢复资格。',
    tags: ['时间', 'OTL', '规则', '限制'],
    category: 'rankings'
  },
  {
    id: 43,
    name: '超时 (法语)',
    english: 'Hors Délai',
    brief: '法语"超出时限"（等同于 OTL），当车手超时完赛时裁判可酌情恢复资格',
    definition: 'Hors Délai，法语"超出时间限制"（等同于 OTL）。"Délai"意为截止时间，"hors"意为超出。',
    description: '当车手超时完赛时，裁判可酌情处理——尤其是在山地赛段出现大批车手超时的情况下，若取消资格会不合理地大幅减少参赛人数，裁判可选择恢复车手资格。',
    tags: ['时间', '法语', 'OTL', '规则'],
    category: 'rankings'
  },

  // ==================== 4. 成绩代码 ====================
  {
    id: 60,
    name: 'DNF — 未完成',
    english: 'DNF (Did Not Finish)',
    brief: '已出发但未完成赛段或比赛。在分站赛中，任一赛段 DNF 即退出整场比赛',
    definition: '已出发但未完成赛段或比赛的车手在成绩中标注为 DNF（Did Not Finish）。在分站赛中，任一赛段的 DNF 意味着车手从整场比赛中退出。',
    description: '放弃原因可能是受伤、疾病、体力耗尽或团队战略（如受保护车手为保存体力备战未来比赛而选择退赛）。车手一旦进入扫把车或随队车，官员即取下其参赛号码。\n\n法语术语为 abandon。',
    tags: ['成绩代码', 'DNF', '退赛'],
    category: 'rankings'
  },
  {
    id: 61,
    name: 'DNS — 未出发',
    english: 'DNS (Did Not Start)',
    brief: '已报名参赛但未出现在起跑线的车手。分站赛中指完成上赛段但未参加下一赛段',
    definition: '已报名参赛但未出现在起跑线的车手标注为 DNS（Did Not Start）。在分站赛中，DNS 用于描述车手在两个赛段之间退出的情况。',
    description: 'DNS 与 DNF（已出发但中途退出）和 OTL（完赛但超时）概念不同。',
    tags: ['成绩代码', 'DNS', '未出发'],
    category: 'rankings'
  },
  {
    id: 62,
    name: 'DSQ — 取消资格',
    english: 'DSQ (Disqualified)',
    brief: '因违规行为被取消参赛资格，成绩作废。可追溯取消并重新分配名次',
    definition: '因违规行为（如危险冲刺、走捷径、违反禁药规定或接受非法援助）而被取消参赛资格，成绩作废。',
    description: '裁判可在赛后即时或经过审查后做出取消资格的决定。赛后确认的反兴奋剂违规可导致追溯性取消资格，其后所有名次相应上移重新分配。',
    tags: ['成绩代码', 'DSQ', '取消资格', '违规'],
    category: 'rankings'
  },
  {
    id: 63,
    name: 's.t. — 同时',
    english: 's.t. (Same Time)',
    brief: '同组完赛，GC 记为相同时间。在赛段成绩列表中标注为 s.t.',
    definition: 's.t.（Same Time），表示该车手与同组其他车手同时完成赛段，在总成绩中记为相同时间。',
    description: '适用于同一集团内完成赛段的车手——即相互间差距不足 3 秒。在赛段成绩列表中排名相同但共享同一 GC 时间。',
    tags: ['成绩代码', 's.t.', '同时', '同组'],
    category: 'rankings'
  },
  {
    id: 64,
    name: '@ — 时间差',
    english: '@ (At — Time Gap)',
    brief: '后接时间差，表示与赛段冠军或总成绩领先者的差距',
    definition: '@ (At)，在成绩列表中后接时间差，表示该车手与赛段冠军或总成绩领先者的时间差距。',
    description: '例如 "@ 0:49" 表示落后 49 秒。在 GC 成绩列表中，时间差以总成绩领先者为参照；在赛段成绩中，以赛段冠军为参照。',
    tags: ['成绩代码', '@', '时间差', '差距'],
    category: 'rankings'
  },

  // ==================== 5. 世界排名体系 ====================
  {
    id: 80,
    name: 'UCI 个人世界排名',
    english: 'UCI World Ranking (Individual)',
    brief: '由 UCI 管理的职业公路自行车手全球官方排名，采用滚动 52 周积分体系',
    definition: '由 UCI 管理的职业公路自行车手全球官方排名。采用滚动 52 周积分体系。',
    description: '核心机制：\n• 滚动 52 周体系：任何成绩的积分在获得后恰好 52 周后自动失效。\n• 每周更新：排名每周二更新，反映上周末赛事成绩。\n• 三类并行排名：个人（所有车手）、国家（各国前 8 名车手）、团队（各队前 20 名车手）。\n• 积分因赛事声望差异悬殊：赢得环法（GC）可获 1,300 分；赢得纪念碑经典赛约 500–600 分；赢得环法单个赛段约 120 分。\n\nUCI 世界排名积分决定：世锦赛各国名额、WorldTour 赛事参赛资格、奥运会参赛名额。',
    example: '环法冠军可获 1,300 UCI 积分；环意/环西冠军约 1,100 分；纪念碑经典赛冠军约 500–600 分。',
    tags: ['排名', 'UCI', '世界排名', '积分'],
    category: 'rankings'
  },
  {
    id: 81,
    name: 'UCI WorldTour 车队排名',
    english: 'UCI WorldTour Team Ranking',
    brief: '决定哪 18 支车队持有 WorldTeam 牌照的团队级排名，基于三年周期积分总和',
    definition: '决定哪 18 支车队持有 UCI WorldTeam 牌照的团队级排名，基于车队前 20 名骑手在三年周期内的积分总和计算。',
    description: '车队须在三年内保持前 18 名才能维持 WorldTeam 地位；否则将被降级至职业车队（ProTeam）级别。此体系使每场比赛、每个积分都具有重大战略价值，尤其对排名边缘的车队而言。',
    tags: ['排名', 'UCI', 'WorldTeam', '车队', '牌照'],
    category: 'rankings'
  },
  {
    id: 82,
    name: 'UCI ProSeries 排名',
    english: 'UCI ProSeries Ranking',
    brief: '用于第二级别赛事的独立排名，决定哪两支 ProTeam 获三大环赛自动外卡资格',
    definition: '用于第二级别赛事的独立排名体系，决定每赛季表现最佳的两支职业车队（ProTeam），获参加三大环赛的自动外卡邀请资格。',
    description: '这为职业车队提供了在不持有 WorldTeam 牌照的情况下参加最高级别赛事的竞争性晋升通道。',
    tags: ['排名', 'UCI', 'ProSeries', 'ProTeam', '外卡'],
    category: 'rankings'
  },

  // ==================== 6. 爬坡与赛段分类 ====================
  {
    id: 100,
    name: '山地赛段分类',
    english: 'Mountain Stage Classification',
    brief: '按主要爬坡的长度和平均坡度对赛段进行分级（Cat. 4 至 HC），决定可获得的山地积分',
    definition: '山地赛段按主要爬坡的长度和平均坡度进行分类，等级体系（4 类至 HC 类）决定可获得的山地积分数量。',
    description: '山顶终点（arrivée en altitude）意味着赛段在有分类的山顶结束，这种赛段几乎总会产生显著的总成绩时间差距。\n\n爬坡分类（从易到难）：4 级 → 3 级 → 2 级 → 1 级 → HC 级（Hors Catégorie，超级难度）。',
    tags: ['爬坡', '分类', '山地', 'KOM'],
    category: 'rankings'
  },
  {
    id: 101,
    name: '中间冲刺点',
    english: 'Intermediate Sprint',
    brief: '赛段中途指定的冲刺位置，车手在此争夺时间奖励和积分',
    definition: '中间冲刺点，赛段中途指定的冲刺位置，车手在此争夺时间奖励（用于 GC）和积分（用于积分榜）。',
    description: '也称"热点"（hot spots）或"积分冲刺"。地点提前公布，通常位于城镇中心或标志性地点。中间冲刺历史上也曾单独设有"中间冲刺积分榜"，但该独立积分榜现已取消。',
    tags: ['冲刺', '中间点', '积分', '时间奖励'],
    category: 'rankings'
  },
  {
    id: 102,
    name: '山顶终点',
    english: 'Summit Finish (Arrivée en Altitude)',
    brief: '终点设在有分类山顶顶峰的赛段，是总成绩争夺者最关键的赛段类型',
    definition: '山顶终点（法语：arrivée en altitude），终点设在有分类山顶顶峰的赛段。',
    description: '山顶终点是总成绩争夺者最关键的赛段，因为登顶过程中同组同时规则失效——车手之间可拉开数分钟的时间差距。\n\n标志性山顶终点包括：阿尔卑·迪耶兹 (Alpe d\'Huez，环法)、蒙特佐卡兰 (Monte Zoncolan，环意) 和科瓦东加湖 (Lagos de Covadonga，环西)。',
    tags: ['爬坡', '山顶终点', 'GC', '山地'],
    category: 'rankings'
  },

  // ==================== 7. 颁奖与仪式 ====================
  {
    id: 120,
    name: '颁奖台 (Podium)',
    english: 'Podium',
    brief: '赛段或总成绩的前三名车手站上的领奖台，是自行车运动最标志性的画面之一',
    definition: '赛段或总成绩的前三名车手站上的领奖台。每位车手对应不同的台面高度（冠军最高/中，亚军其次/右，季军再低/左）。',
    tags: ['颁奖', '仪式', '前三名'],
    category: 'jerseys'
  },
  {
    id: 121,
    name: '荣誉战绩 (Palmarès)',
    english: 'Palmarès',
    brief: '车手职业生涯的全部胜利与荣誉记录，是衡量车手伟大的终极标尺',
    definition: '车手职业生涯的全部胜利与荣誉记录。法文源自拉丁文 palma（棕榈枝，象征胜利）。',
    description: '车手的 Palmarès 通常包含：大环赛总冠军数、纪念碑经典赛胜利数、世界冠军头衔、赛段胜利数等。埃迪·墨克斯 (Eddy Merckx) 的 Palmarès 被认为是自行车史上最辉煌的。',
    tags: ['颁奖', '荣誉', '生涯', '纪录'],
    category: 'jerseys'
  },
  {
    id: 122,
    name: '红灯笼 (Lanterne Rouge)',
    english: 'Lanterne Rouge',
    brief: '大环赛总成绩末位车手，历史上被视为坚持精神的象征',
    definition: 'Lanterne Rouge（法语"红灯笼"），指大环赛总成绩排名最后一位的车手。',
    description: '名称来源于列车尾部悬挂的红灯信号。历史上这一称号反而能给车手带来一定的名人效应和额外收入（如参加赛后绕圈赛的出场费），因此有时会有车手故意"争夺"此位。',
    tags: ['颁奖', '末位', '红灯笼', '传统'],
    category: 'jerseys'
  },
  {
    id: 123,
    name: '参赛号码布 (Dossard)',
    english: 'Dossard',
    brief: '每名车手身上佩戴的参赛号码布，车手退赛时由官员取下',
    definition: '每名车手身上佩戴的参赛号码布。表示车手身份和所属车队。',
    description: '号码布的分配遵循特定规则：GC 卫冕冠军获得 1 号，世界冠军有特殊标记（彩虹条纹），国家冠军则带有国旗色标记。车手退赛时，官员取下其号码布，是放弃比赛的正式程序。',
    tags: ['颁奖', '号码', '仪式'],
    category: 'jerseys'
  },
  {
    id: 124,
    name: 'Tifosi — 铁杆球迷',
    english: 'Tifosi',
    brief: '意大利自行车赛沿路观赛的铁杆粉丝，尤以环意赛道侧常见，是自行车文化的灵魂',
    definition: 'Tifosi（意大利语），指沿路观赛的意大利自行车赛铁杆粉丝，尤以环意赛道侧常见。',
    description: 'Tifosi 是自行车文化中最热情的观众群体。他们在山顶摇旗呐喊、在路边写上自己支持车手的名字、甚至在关键时刻为车手推一把（虽然违规）。环意如果没有 Tifosi，就不再是真正的环意。',
    tags: ['颁奖', '粉丝', '意大利', '文化'],
    category: 'jerseys'
  },
  {
    id: 125,
    name: '赛段猎手',
    english: 'Stage Hunter',
    brief: '以赢得单个赛段为目标而非争夺总成绩的车手，通常为冲刺手或突围专家',
    definition: '赛段猎手，以赢得单个赛段为目标、而非争夺总成绩的车手。',
    description: '赛段猎手通常为冲刺手或突围专家。他们在 GC 上落后较多，因此在山地赛段可能放松节奏保存体力，专注于平路和丘陵赛段。在某些大环赛中，赛段猎手的赛段胜利数可能超过总冠军。',
    tags: ['角色', '赛段', '冲刺'],
    category: 'jerseys'
  },
  {
    id: 126,
    name: '总成绩争夺者',
    english: 'GC Contender',
    brief: '对总成绩冠军有现实争夺希望的车手，通常是车队核心保护对象',
    definition: '对总成绩冠军有现实争夺希望的车手。通常是车队的核心保护对象。',
    description: '总成绩争夺者需要全面的能力：优秀的爬坡能力（拉时间）、可靠的计时赛能力（不丢时间）、强力的车队支援（副将保护）。在当代自行车运动中，真正的 GC 争夺者通常不超过 5-8 人。',
    tags: ['角色', 'GC', '总冠军'],
    category: 'jerseys'
  },
  {
    id: 127,
    name: '副将 (Domestique)',
    english: 'Domestique',
    brief: '为队长牺牲个人成绩服务全队的车手，法语意为"仆人"，车队战术体系的核心',
    definition: '副将（Domestique，法语"仆人"之意），为队长（Team Leader）牺牲个人成绩、服务全队的车手。',
    description: '副将的主要任务包括：\n1. 带风（在前方破风，节省队长体力）\n2. 送水送食物\n3. 保护队长（防止对手进攻）\n4. 追击对手的进攻\n5. 在必要时牺牲自己帮助队长\n\n意大利语为 Gregario，法语中性表达为 Équipier（队员）。',
    tags: ['角色', '副将', '车队', '战术'],
    category: 'jerseys'
  },

  // ==================== 8. 历史荣誉 ====================
  {
    id: 140,
    name: '科皮之巅 (Cima Coppi)',
    english: 'Cima Coppi',
    brief: '环意专设奖项，颁给率先翻越当届赛事最高山口的车手，以传奇冠军 Fausto Coppi 命名',
    definition: '科皮之巅（Cima Coppi），环意大利自行车赛专设奖项，颁给率先翻越当届赛事最高山口的车手。以传奇冠军福斯托·科皮 (Fausto Coppi) 命名。',
    description: '科皮被公认为史上最伟大的意大利骑手。Cima Coppi 的具体山口每年随赛事路线变化，率先征服者被视为拥有卓越爬坡实力的标志。',
    tags: ['历史', '荣誉', '环意', '科皮'],
    category: 'jerseys'
  },
  {
    id: 141,
    name: '德格朗热-科伦坡挑战赛',
    english: 'Challenge Desgrange-Colombo (1948–1958)',
    brief: '自行车运动首个赛季积分榜体系，现代 UCI 世界排名体系的前身',
    definition: '自行车运动首个赛季积分榜体系，于 1948 年引入。以环法总监亨利·德格朗热 (Henri Desgrange) 和环意总监埃米利奥·科伦坡 (Emilio Colombo) 命名。',
    description: '涵盖当时的主要分站赛和经典赛，是现代 UCI 排名体系的前身。该体系运行至 1958 年，其后被"超级声望佩诺国际奖"取代。',
    tags: ['历史', '排名', '积分榜', '前身'],
    category: 'jerseys'
  },
  {
    id: 142,
    name: '超级声望佩诺奖',
    english: 'Super Prestige Pernod (1958–1988)',
    brief: '接替德格朗热-科伦坡的赛季积分竞赛，三十年间的车手赛季表现主要衡量标准',
    definition: '接替德格朗热-科伦坡挑战赛的赛季积分竞赛（1958–1988 年），在全年主要单日赛和分站赛中累计积分。',
    description: '三十年间是衡量车手整个赛季表现的主要标准，1989 年被 UCI 公路世界排名取代。埃迪·墨克斯 (Eddy Merckx) 以创纪录的 8 次夺冠独占鳌头。',
    tags: ['历史', '排名', '墨克斯', '佩诺'],
    category: 'jerseys'
  },

  // ==================== 9. 基础战术（集团动态 + 团队配合 + 位置管理） ====================
  {
    id: 200,
    name: '大集团 (Peloton)',
    english: 'Peloton',
    brief: '公路赛中骑行在一起的主要车手群体，前排破风消耗大，中后部跟骑可节省 20%-40% 体能',
    definition: '公路赛中骑行在一起的主要车手群体。大集团是一个复杂的整体系统：前排车手完全暴露在风阻中，疲劳累积更快；跟骑在中间或后部的车手则可节省 20% 至 40% 的体能消耗。',
    description: '车手在大集团中持续调整位置，提前预判路窄处、弯道及关键赛况节点。大集团整体速度远超任何单独骑行的车手所能维持的水平。',
    tags: ['集团', '基础', 'Peloton', '跟风'],
    category: 'tactics'
  },
  {
    id: 201,
    name: '跟风/借力 (Drafting)',
    english: 'Drafting / Slipstreaming',
    brief: '紧随前方车手进入低气压滑流区，可减少 20%-40% 的体能消耗，是公路赛最基本的战术',
    definition: '通过紧随前方车手骑行，后方车手进入低气压区（滑流区），可减少 20% 至 40% 的体能消耗。职业车手可在高速下保持仅数厘米的轮距。',
    description: '跟风的精髓在于最大化节能的同时确保骑行安全。若车手拒绝轮流领骑而只跟风，则被称为"吸轮"（wheel-sucking），带有明显的负面含义。',
    tags: ['跟风', '借力', '滑流', '基础战术'],
    category: 'tactics'
  },
  {
    id: 202,
    name: '轮流领骑队列 (Paceline)',
    english: 'Paceline / Chain Gang',
    brief: '车手轮流在前方破风领骑后退至队尾恢复，配合默契的轮换队列使整组速度远超单独骑行',
    definition: '一种有组织的骑行队形。车手轮流在前方破风领骑，完成后退至队尾在后方借力恢复。配合默契的轮换队列使整组车手的前进速度远超单独骑行。',
    description: '有单列和双列之分：双列队列中，两排车手呈环形连续轮换。也称"链式接力"（chain gang）。在计时赛车队项目中，完美的轮换队列是夺冠的关键。',
    tags: ['领骑', '队列', '轮换', '团队'],
    category: 'tactics'
  },
  {
    id: 203,
    name: '斜排借力队形 (Echelon)',
    english: 'Echelon',
    brief: '侧风条件下使用的斜线阵型，车手斜线展开借力。当道路宽度不足时大集团会分裂，极具战术决定性',
    definition: '侧风条件下使用的斜线阵型。由于风向通常并非完全正面或正后方，车手在道路上斜线展开，各自略偏向前方车手的迎风侧以最大化借力效果。',
    description: '斜排是比赛中最危险、战术意义最重大的队形之一。当道路宽度不足时，大集团会分裂为多个独立斜排小组。被迫留在后方小组的车手需在更少队友的配合下对抗侧风，处于严重不利地位。经验丰富的车队会刻意加速以制造斜排分裂。',
    tags: ['斜排', '侧风', 'Echelon', '分裂'],
    category: 'tactics'
  },
  {
    id: 210,
    name: '封堵战术 (Blocking)',
    english: 'Blocking',
    brief: '合法的团队战术：在大集团中故意放慢速度或干扰追赶节奏，帮助前方逃跑队友建立优势',
    definition: '合法的团队战术。当一名或多名队员在大集团中故意放慢速度或干扰追赶节奏，以帮助前方逃跑的队友建立更大优势。',
    description: '封堵手通过扰乱追赶队列的节奏拖慢集团速度。封堵是被认可的合法战略，但过度或危险的封堵行为可能受到赛事裁判的处罚。',
    tags: ['团队', '封堵', '防守', '战术'],
    category: 'tactics'
  },
  {
    id: 211,
    name: '跟进逃跑 (Covering a Move)',
    english: 'Covering a Move',
    brief: '加入逃跑集团不为直接求胜，而是确保己方车队有代表，同时控制比赛两端',
    definition: '加入逃跑集团的目的不是直接求胜，而是确保己方车队在逃跑组中有代表。跟进者通常避免领骑（避免破风做功），以保存体力应对集团内部的最终冲刺。',
    description: '若队友仍在大集团中，该车队便同时掌控了比赛的两端——前方有代表，后方控制节奏。',
    tags: ['团队', '跟进', '逃跑', '防守'],
    category: 'tactics'
  },
  {
    id: 212,
    name: '节奏控制骑行 (Tempo Riding)',
    english: 'Tempo Riding / Tempo Control',
    brief: '车队在大集团前方以持续高强度可控速度领骑，消耗对手、阻止危险逃跑、为主将创造机会',
    definition: '当某车队在大集团前方以持续、高强度但可控的速度领骑。用于：阻止危险逃跑成功、控制与逃跑集团的时间差、在关键爬坡或冲刺前消耗对手体力。',
    description: '"节奏列车"是比赛中标志性的一幕——同一车队的车手逐一出现在前排，以阈值强度骑行，令所有竞争者都感到吃力。',
    tags: ['团队', '节奏', '控制', '战术'],
    category: 'tactics'
  },
  {
    id: 213,
    name: '"粘手水壶" (Sticky Bottle)',
    english: 'Sticky Bottle / Bidon Collé',
    brief: '车手取水壶时故意多握持数秒，实质获得随队车牵引助力，技术上违规但常被容忍',
    definition: '一种技术上违规但常被容忍的战术。车手从随队车中取水壶时，故意多握持数秒（或随队车人员多握住数秒），实质上获得了随队车的牵引助力。',
    description: '法语称之为"粘水壶"（bidon collé）或"蜜糖水壶"（bidon au miel）。裁判通常允许 1-2 秒，超出则可能被处罚。',
    tags: ['团队', '水壶', '灰色地带', '牵引'],
    category: 'tactics'
  },
  {
    id: 220,
    name: '集团内部位置管理',
    english: 'Positioning in the Peloton',
    brief: '对骑行的位置的战略性管理，直接决定体能消耗、安全性和战术机会的获取',
    definition: '对骑行位置的战略性管理。位置直接决定体能消耗、安全性和战术机会的获取。',
    description: '核心原则：在路窄处和爬坡前保持靠前位置；在侧风路段避开危险的外侧边缘；远离后排的"手风琴效应"区域（加速幅度被放大的位置）；在关键时刻前主动提前前移但不过度消耗体能。每名车手都深知位置的价值，位置的争夺从未停止。',
    tags: ['位置', '管理', '安全', '策略'],
    category: 'tactics'
  },
  {
    id: 221,
    name: '体能管理',
    english: 'Energy Management',
    brief: '在整场比赛中合理分配体力的能力，将体能保留至决定性的爬坡、冲刺或侧风关键时刻',
    definition: '在整场比赛或赛段中合理分配体力的能力。缺乏经验的车手最常见的失误是体力消耗过早——通过过早的逃跑尝试、不必要的位置争夺或追赶不适合自己的动作。',
    description: '职业车手善于解读比赛走势，将体能保留至关键时刻：决定性的爬坡、冲刺终点，或关键的侧风斜排分裂。这是一项区分顶级车手和平庸车手的核心能力。',
    tags: ['体能', '管理', '分配', '策略'],
    category: 'tactics'
  },
  {
    id: 222,
    name: '换轮/机械故障',
    english: 'Wheel Change / Mechanical',
    brief: '比赛中爆胎或故障后，随队车或中立保障车提供备用轮组，车手需独自追赶大集团——赛中赛',
    definition: '当车手在比赛中爆胎或发生机械故障时，随队车必须穿越车队保障车队列赶来提供备用轮组或整车。中立保障车可为任何车手提供即时服务。',
    description: '发生机械故障后，车手必须独自追赶大集团——形成赛中赛。若故障发生在关键时刻（如下坡、侧风路段），可能直接葬送名次。',
    tags: ['机械', '换轮', '故障', '追赶'],
    category: 'tactics'
  },
  {
    id: 223,
    name: '比赛中立化',
    english: 'Neutralization',
    brief: '因事故、恶劣天气等原因由赛事总监临时暂停比赛，所有车手低速骑行，时间差冻结',
    definition: '由赛事总监宣布的临时暂停比赛，原因可能是事故、恶劣天气、抗议或危险路况。中立化期间，所有车手在领先裁判车辆后方以低速骑行，不允许任何竞争性动作。',
    description: '时间差在宣布中立化时刻冻结。恢复比赛后，车手按冻结前的时间差重新出发。中立化是赛事安全的最后手段。',
    tags: ['中立化', '暂停', '安全', '规则'],
    category: 'tactics'
  },
  {
    id: 224,
    name: '如厕停车惯例',
    english: 'Nature Break / Gentleman\'s Agreement',
    brief: '长赛段中非正式的绅士协议：大量车手停车如厕时，大集团默认不发起进攻',
    definition: '在长距离赛段中非正式但被广泛遵守的惯例：当大量车手停车如厕时，大集团默认不发起进攻。',
    description: '违反此不成文规定被视为极不体育道德的行为，可能在后续赛段遭到报复。赛事管理方有时会在长赛段早期非正式地安排"停战区"。',
    tags: ['惯例', '绅士协议', '如厕', '体育道德'],
    category: 'tactics'
  },

  // ==================== 10. 进攻与逃跑 ====================
  {
    id: 300,
    name: '进攻 (Attack)',
    english: 'Attack',
    brief: '突然急速加速脱离大集团或小组，旨在甩开对手、测试实力或迫使其作出反应',
    definition: '突然急速加速的动作，旨在脱离大集团或小组、拉开差距、发起逃跑、测试对手实力或迫使对手作出反应。',
    description: '平路上的进攻通常从集团侧面发起，使攻击者在穿越队列前排前已达到最高速；爬坡时则利用坡度变化点甩开对手。进攻消耗的体能远多于跟随——时机不当的进攻可能使进攻者陷入孤立并被追回。',
    tags: ['进攻', '加速', '脱离', 'Attack'],
    category: 'tactics'
  },
  {
    id: 301,
    name: '反攻 (Counterattack)',
    english: 'Counterattack / Counter',
    brief: '在对手逃跑刚被追回或追回过程中立即发起的进攻，趁对手疲惫精力涣散时给予致命一击',
    definition: '在对手的逃跑集团刚被追回、或追回过程中立即发起的进攻。此时大集团往往因追逐而疲惫、精力涣散，正是猛力加速的最佳时机。',
    description: '时机把握恰当的反攻是比赛中最有效的进攻手段之一，能在对手最脆弱时发动打击。需要车手具备敏锐的比赛阅读能力和瞬时爆发力。',
    tags: ['反攻', 'Counter', '时机', '进攻'],
    category: 'tactics'
  },
  {
    id: 302,
    name: '爆发跳 (Jump)',
    english: 'Jump',
    brief: '极短暂但猛烈的爆发性加速，通常仅持续数次踏板，在对手反应前迅速拉开差距',
    definition: '极短暂但猛烈的爆发性加速，通常仅持续数次踏板，在对手反应前迅速拉开差距。有别于持续性进攻，爆发跳依靠无氧爆发力。',
    description: '这是冲刺手和爆发型骑手在最后几公里的核心武器，也用于快速追上逃跑集团。关键在于时机和突然性——让对手措手不及。',
    tags: ['爆发', '跳', '加速', '冲刺'],
    category: 'tactics'
  },
  {
    id: 303,
    name: '踢踏发力 (Kick)',
    english: 'Kick',
    brief: '短促有力的加速，通常持续数次踏板，用于在小组或爬坡中甩开对手',
    definition: '短促而有力的加速，通常持续数次踏板，用于在小组或爬坡中甩开对手。与爆发跳相似，但通常持续时间略长。',
    description: '多用于描述爬坡中的进攻："他在最陡处再次发力，甩开了最后一名对手。"踢踏发力是对车手瞬时功率输出的最高检验。',
    tags: ['踢踏', '发力', '加速', '爬坡'],
    category: 'tactics'
  },
  {
    id: 304,
    name: '孤身出击 (Flyer)',
    english: 'Flyer / Take a Flyer',
    brief: '从大集团发起的单人进攻，高风险高回报，要求车手对自身实力极度自信',
    definition: '从大集团发起的单人进攻。车手猛力加速，试图建立足够的领先优势并独自坚持到终点。',
    description: '这是一种高风险高回报的战术，要求车手对自身实力极度自信，并具备长距离独自计时骑行的能力。成功的孤身出击往往成为比赛中最令人难忘的时刻。',
    tags: ['孤身', 'Flyer', '单人', '进攻'],
    category: 'tactics'
  },
  {
    id: 310,
    name: '逃跑集团 (Breakaway)',
    english: 'Breakaway / Échappée',
    brief: '发起进攻后在大集团前方拉开差距的领先群体，成员既是盟友又是竞争者',
    definition: '一名或多名车手发起进攻、在大集团前方拉开差距后形成的领先群体。逃跑集团成员既是盟友（共同分担破风负担以维持领先优势），又是竞争者（各自都希望最终获胜）。',
    description: '逃跑成员需要持续的战术判断：何时领骑、力度如何、是否信任同伴、何时发起最后进攻。部分逃跑为"电视逃跑"（télé échappée）——大集团故意放行小型无威胁的逃跑组以获取赞助商的电视曝光。',
    tags: ['逃跑', 'Breakaway', '领先', '集团'],
    category: 'tactics'
  },
  {
    id: 311,
    name: '追赶补位 (Bridge)',
    english: 'Bridge / Bridge the Gap',
    brief: '车手单独或小组从大集团骑向逃跑集团，必须加速够猛又不能把大集团一并带走',
    definition: '车手单独或以小组形式从大集团（或追赶组）骑向前方的逃跑集团。追赶补位需要缜密判断：必须加速够猛以弥合差距，同时又不能把整个大集团一并带走。',
    description: '关键考量：前方逃跑集团是否足够强？更强的对手是否已在其中？能否在不拖带大集团的情况下完成追赶？',
    tags: ['追赶', '补位', 'Bridge', '连接'],
    category: 'tactics'
  },
  {
    id: 312,
    name: '追赶组 (Chase Group)',
    english: 'Chase Group / Chasers',
    brief: '追赶前方逃跑集团的车手群体，内部合作复杂——需共担破风但可能有人坐车',
    definition: '追赶前方逃跑集团的车手群体。当某车队在逃跑集团中没有代表时，会派车手组成追赶组。',
    description: '追赶组的内部逻辑复杂——成员需合作共担破风，但部分人可能选择"坐车"（跟骑）以保存体力。在关键时刻，追赶组中的车手可能各自为战。',
    tags: ['追赶', 'Chase', '追回', '集团'],
    category: 'tactics'
  },
  {
    id: 313,
    name: '"追土豆" (Potato Chase)',
    english: 'En Chasse Patate (Potato Chase)',
    brief: '车手陷入进退两难的窘境：既追不上前方逃跑集团，又距大集团太远无法借力',
    definition: '法语字面意为"追着土豆跑"。形容车手陷入进退两难的窘境：既无法追上前方逃跑集团，又距大集团太远无法借力。车手拼命踩踏却几乎无法缩短与任一方的差距。',
    description: '这是比赛中令人同情的局面——车手独自对抗风阻，视频画面中往往显得既努力又徒劳。',
    tags: ['追土豆', '两难', 'French', '独骑'],
    category: 'tactics'
  },
  {
    id: 314,
    name: '"垃圾桶逃跑" (Fuga Bidone)',
    english: 'Fuga Bidone',
    brief: '一种特殊危险逃跑：初看无害被大集团忽视，实际藏有 GC 争夺者，差距不断扩大后构成威胁',
    definition: '一种意大利术语，指特殊的危险逃跑。通常在赛段早期逃出，初看无害而被大集团忽视。然而由于大集团无所作为，差距不断扩大至危险水平。',
    description: '逃跑组中往往藏有有实力的总成绩争夺者，借此大幅提升排名。这是大集团战术误判的经典案例，可能导致 GC 格局发生剧变。',
    tags: ['逃跑', 'Fuga Bidone', '意大利', '误判'],
    category: 'tactics'
  },
  {
    id: 315,
    name: '"插刀"时机',
    english: 'Sticking the Knife In',
    brief: '在对手即将崩溃、判断其已精疲力竭时发动的致命性加速，确保对手被永久甩掉',
    definition: '在对手即将崩溃、判断其已精疲力竭时发动的致命性加速。对手已无力作出反应，只能目送进攻者远去。',
    description: '时机的把握需要经验与战术智慧：过早进攻给了对手恢复的机会；恰到好处的时机则确保对手被永久甩掉。这是顶级车手区别于优秀车手的关键能力。',
    tags: ['致命', '时机', '进攻', '心理'],
    category: 'tactics'
  },
  {
    id: 316,
    name: '电视逃跑 (TV Breakaway)',
    english: 'Échappée Télé (TV Breakaway)',
    brief: '大集团故意放行的无威胁逃跑，让逃跑者在电视镜头前"展示球衣"以获取赞助商曝光',
    definition: '大集团故意放行——甚至乐见其成的逃跑，因为逃跑组成员对总成绩排名构不成威胁。大集团控制差距（通常维持在 10-15 分钟以内）。',
    description: '大环赛中每日的逃跑大多属于此类。虽是"表演性"逃跑，但对车队赞助商而言具有重要的商业价值。',
    tags: ['电视', '逃跑', '曝光', '赞助商'],
    category: 'tactics'
  },
  {
    id: 317,
    name: '查帕特定律',
    english: 'Chapatte\'s Law',
    brief: '经验法则：普通水平的逃跑被大集团追赶的速率约为每 10 公里 1 分钟',
    definition: '以前职业车手罗伯特·查帕特 (Robert Chapatte) 命名的经验法则：一组普通水平的逃跑车手被大集团追赶的速率约为每 10 公里 1 分钟。',
    description: '尽管现代数据分析根据集团规模、地形及相对实力对此进行了细化修正，查帕特定律仍是解说员和车手评估逃跑能否成功的实用心理模型。',
    tags: ['查帕特', '定律', '逃跑', '经验'],
    category: 'tactics'
  },

  // ==================== 11. 冲刺与爬坡战术 ====================
  {
    id: 400,
    name: '领骑列车 (Lead-Out Train)',
    english: 'Lead-Out Train / Sprint Train',
    brief: '冲刺手的队友在最后几公里组成单列快速队列，为其定向护送并发射至终点冲刺',
    definition: '一种有组织的冲刺战术阵型。冲刺手的队友在最后几公里组成单列快速队列，为其定向护送并发射至终点冲刺。',
    description: '列车通常在最后 5 公里内组成，每名队友轮流在前方全力领骑后退出，继任者进一步加速，而冲刺手始终受保护地骑在最后，等待释放最终冲刺速度的时机。完美此战术需要精确的时机把握和巨大的团队协作。由 HTC 车队围绕卡文迪什完善。',
    tags: ['冲刺', '列车', 'Lead-Out', '团队'],
    category: 'tactics'
  },
  {
    id: 401,
    name: '领骑助冲 (Lead-Out)',
    english: 'Lead-Out',
    brief: '领骑手在前方全力冲刺为队友破风，接近终点时侧偏让路，使队友全速冲过',
    definition: '一名车手以最快速度在前方冲刺领骑，后方队友紧跟借力，在接近终点时领骑手向侧偏让路，使队友得以全速冲过终点。',
    description: '领骑手通常为队友"燃烧自己"。拉开的时机至关重要——过早则空隙被对手填补，过晚则冲刺手因长时间跟骑而体能受损。完美的领骑助冲需要双方精确的配合。',
    tags: ['冲刺', 'Lead-Out', '领骑', '团队'],
    category: 'tactics'
  },
  {
    id: 402,
    name: '大集团冲刺 (Bunch Sprint)',
    english: 'Bunch Sprint',
    brief: '大集团整体抵达平路赛段终点时的集体冲刺，速度可超 60-70 km/h',
    definition: '当大集团整体抵达平路或微坡赛段终点时的集体冲刺。虽然涉及可能多达上百名车手，但真正争夺胜利的主要是专业冲刺手及其领骑队友。',
    description: '最后时刻速度可超过 60-70 公里/小时。最后 1 公里的位置争夺至关重要——车手在冲刺手周围争位，形成极为危险的加速浪涌。这也是比赛中最壮观的场景之一。',
    tags: ['冲刺', 'Bunch Sprint', '集团', '终点'],
    category: 'tactics'
  },
  {
    id: 403,
    name: '推车冲线 (Bike Throw)',
    english: 'Bike Throw',
    brief: '冲刺过线瞬间将车身向前推伸，可多出数厘米优势——照相判名往往由此决定胜负',
    definition: '在冲刺终点最后数厘米使用的技术动作。车手在过线瞬间向前推伸双臂、拉伸躯干，将车身推至身体前方——实际上能多出数厘米的优势。',
    description: '照相判断名次的终点冲刺（photo finish）往往由此决定胜负。推车的时机必须精确到毫秒级别——过早或过晚都会失去效果。',
    tags: ['冲刺', 'Bike Throw', '推车', '终点'],
    category: 'tactics'
  },
  {
    id: 404,
    name: '弹弓超越 (Slingshot)',
    english: 'Slingshot',
    brief: '先在对手身后借力加速积累速度，然后突然侧摆超越的冲刺战术',
    definition: '一种冲刺战术动作。车手先跟在对手身后借力加速，积累足够速度后突然侧摆超越。利用"借力-爆发"原理：节省体能同时积蓄速度，然后在决定性时刻释放。',
    description: '弹弓超越需要完美的时机和位置感，是在冲刺最后一刻改变局势的有效手段。',
    tags: ['冲刺', 'Slingshot', '超越', '战术'],
    category: 'tactics'
  },
  {
    id: 405,
    name: '红色火焰旗 (Flamme Rouge)',
    english: 'Flamme Rouge',
    brief: '悬挂于道路上方的红色三角旗，标志赛段最后 1 公里——最激烈战术阶段由此开始',
    definition: '悬挂于道路上方的红色三角旗帜，标志着赛段最后 1 公里的起点。其出现预示着大多数赛段最激烈战术阶段的开始。',
    description: '大集团骤然提速，各车队开始启动领骑列车，个人车手纷纷拼命争抢位置。这是职业自行车赛中最具标志性的符号之一，也是观众心跳加速的时刻。',
    tags: ['冲刺', 'Flamme Rouge', '红旗', '最后1公里'],
    category: 'tactics'
  },
  {
    id: 406,
    name: '照相判名 (Photo Finish)',
    english: 'Photo Finish',
    brief: '高速摄像机捕捉过线瞬间，由自行车最靠前部分决定胜负的照片判决',
    definition: '当两名或更多车手几乎同时通过终点线时，高速摄像机捕捉过线的精确瞬间。获胜者由自行车（非车手身体）通过终点线时最靠前的部分决定。',
    description: '由于现代冲刺列车的精密配合，照相判名在环法等赛事中越来越常见。有时胜负差距仅数毫米——肉眼完全无法分辨。',
    tags: ['冲刺', 'Photo Finish', '照相', '判名'],
    category: 'tactics'
  },
  {
    id: 407,
    name: '中间冲刺点 (Prime)',
    english: 'Prime / Intermediate Sprint',
    brief: '赛程中指定的冲刺积分位置，车手为争夺时间奖励、积分或现金奖品而竞争',
    definition: '赛程中指定的冲刺积分位置，车手为争夺时间奖励、积分或奖品而竞争。在分站赛中可影响总成绩排名；在绕圈赛中通常设有现金奖励。',
    description: '鸣铃提示车手即将进入中间冲刺前的最后一圈。中间冲刺不仅是积分争夺的战场，也是活跃比赛节奏、增加观赏性的重要手段。',
    tags: ['冲刺', 'Prime', '中间点', '积分'],
    category: 'tactics'
  },
  {
    id: 410,
    name: '爬坡进攻',
    english: 'Attack on the Climb',
    brief: '在山地赛段猛力加速甩开对手，常用三种策略：持续节奏消耗、反复进攻打乱、一击制胜',
    definition: '在山地赛段猛力加速以甩开对手。爬坡手通常采用三种策略之一：\n1) 持续节奏——以最大可持续功率稳步消耗对手；\n2) 反复进攻——多次加速打乱对手节奏并耗尽体力；\n3) 一击制胜——在最陡处发动一次决定性加速。',
    description: '选择取决于车手的生理特点、剩余赛程及对手状态。最顶尖的爬坡手往往三种策略都擅长，能在比赛中灵活切换。',
    tags: ['爬坡', '进攻', '策略', '山地'],
    category: 'tactics'
  },
  {
    id: 411,
    name: '紧贴车轮',
    english: 'Sitting on the Wheel',
    brief: '紧跟对手后轮借力，保持相同速度却极少消耗体能——一种实力展示和进攻前奏',
    definition: '紧跟对手后轮后方借力骑行，以最小体能消耗保持与对手相同的速度。在爬坡中"贴轮"是一种实力展示——意味着"我可以毫不费力地跟上你。"',
    description: '这通常是决定性进攻前的前奏。被对手贴着车轮骑行的心理压迫感往往会迫使领骑者加速，从而可能导致其提前"爆缸"。',
    tags: ['爬坡', '贴轮', '心理', '战术'],
    category: 'tactics'
  },
  {
    id: 412,
    name: '末尾集团/大巴 (Gruppetto)',
    english: 'Gruppetto / Autobus',
    brief: '山地赛段中冲刺手和弱爬坡手组成的合作集团，目标是在时间限制内安全完赛',
    definition: '在山地赛段，无法跟上总成绩争夺集团速度的冲刺手和爬坡较弱的车手组成末尾集团。他们共同合作，目标是在时间限制（time cut）内完成赛段。',
    description: '非官方的"大巴司机"——通常是一名经验丰富的车手——解读山地剖面图并计算超越时限所需的最低速度。成员需沟通协调、共担破风，在接近时限时必须加速。',
    tags: ['爬坡', 'Gruppetto', '大巴', '完赛'],
    category: 'tactics'
  },
  {
    id: 413,
    name: '爆缸/崩溃/撞墙',
    english: 'Blowing Up / Cracking / Bonking',
    brief: '三种不同程度的体力崩溃：爆缸（可恢复）、崩溃（持续性瓦解）、撞墙（糖原耗尽不可逆）',
    definition: '三种相关但有区别的疲惫状态：\n• 爆缸 (Blowing up)：因进入氧债而突然短暂失去维持速度的能力，相对可恢复。\n• 崩溃 (Cracking)：在持续高强度骑行或对手进攻下更严重的持续性体能瓦解。\n• 撞墙/能量耗尽 (Bonking)：糖原彻底耗尽导致体能急剧骤降，无法仅凭意志力克服，需通过补充营养恢复。',
    description: '区分三者对车手至关重要——爆缸可以通过放慢节奏恢复，但撞墙则意味着必须立即补充能量。比赛中误判这几种状态的后果可能是灾难性的。',
    tags: ['爬坡', '疲劳', '爆缸', '撞墙'],
    category: 'tactics'
  },
  {
    id: 414,
    name: '末尾集团时限战略',
    english: 'Autobus Time Cut Strategy',
    brief: '对末尾集团的战术管理，非正式的"大巴司机"计算最低速度确保全组在时限内完赛',
    definition: '对末尾集团的战术管理，目标是安全地在时间限制内完赛。非官方的"大巴司机"——通常是一名经验丰富的车手——解读山地赛段剖面图并计算超越时限所需的最低速度。',
    description: '成员需沟通协调、共担破风，在接近时限时有时必须加速。被困山地的冲刺手完全依靠这种集体智慧在大环赛中存活。对整个集团的存亡而言，大巴司机的判断至关重要。',
    tags: ['爬坡', '大巴', '时限', '战略'],
    category: 'tactics'
  },

  // ==================== 12. 赛事组织 ====================
  {
    id: 500,
    name: 'UCI — 国际自行车联盟',
    english: 'UCI (Union Cycliste Internationale)',
    brief: '全球自行车运动最高管理机构，总部位于瑞士，负责赛事分级、排名、规则制定',
    definition: '国际自行车联盟 (UCI)，全球自行车运动最高管理机构，总部位于瑞士埃格勒 (Aigle)。负责制定赛事规则、管理世界排名、分配 WorldTeam 牌照及反兴奋剂事务。',
    description: 'UCI 下设公路、场地、山地、BMX 等多个分项委员会。公路自行车世锦赛的彩虹衫即由 UCI 授予各项目世界冠军。',
    tags: ['UCI', '管理机构', '世界排名', '规则'],
    category: 'events'
  },
  {
    id: 501,
    name: 'ASO — 阿莫里体育组织',
    english: 'ASO (Amaury Sport Organisation)',
    brief: '环法、巴黎-鲁贝等顶级赛事的组织方，隶属于法国阿莫里集团',
    definition: '阿莫里体育组织 (ASO)，负责组织环法自行车赛 (Tour de France)、巴黎-鲁贝 (Paris-Roubaix)、巴黎-尼斯 (Paris-Nice)、环多菲内 (Critérium du Dauphiné) 等多项顶级赛事。',
    description: 'ASO 是职业自行车赛中最具影响力的赛事组织方，同时也是达喀尔拉力赛等非自行车赛事的组织者。',
    tags: ['ASO', '环法', '组织方', '法国'],
    category: 'events'
  },
  {
    id: 502,
    name: 'RCS Sport',
    english: 'RCS Sport',
    brief: '环意、伦巴第环游等意大利顶级赛事的组织方，隶属于 RCS 传媒集团',
    definition: 'RCS Sport，负责组织环意大利自行车赛 (Giro d\'Italia)、伦巴第环游 (Il Lombardia)、米兰-圣雷莫 (Milano-Sanremo) 等意大利顶级赛事。',
    tags: ['RCS', '环意', '组织方', '意大利'],
    category: 'events'
  },
  {
    id: 503,
    name: 'CPA — 职业车手协会',
    english: 'CPA (Cyclistes Professionnels Associés)',
    brief: '代表职业车手利益的国际组织，维护车手权益与安全',
    definition: '职业车手协会 (CPA)，代表职业车手利益的国际组织。主要职责包括：维护车手在薪资、保险、安全等方面的权益，参与赛事规则制定，代表车手与管理机构沟通。',
    tags: ['CPA', '车手', '权益', '协会'],
    category: 'events'
  },
  {
    id: 504,
    name: '运动总监 (DS)',
    english: 'Directeur Sportif (DS)',
    brief: '在随队车中通过耳机指挥比赛战术的团队运动总监，是车队的"场上教练"',
    definition: '运动总监（法语：Directeur Sportif，简称 DS），在随队车中通过耳机与车手通讯，实时指挥战术决策、下达进攻或防守指令、解读比赛走势。',
    description: 'DS 是自行车赛中最独特的角色之一——他们既是教练又是策略师，能从车队广播 (Radio Tour) 获取实时比赛信息，在瞬息万变的赛况中做出战术判断。',
    tags: ['DS', '指挥', '战术', '随队车'],
    category: 'events'
  },
  {
    id: 505,
    name: '护理员/后勤 (Soigneur)',
    english: 'Soigneur',
    brief: '负责车手护理、按摩、营养补给及后勤支持的团队工作人员，车队不可或缺的一环',
    definition: 'Soigneur（法语"护理者"），车队中负责车手护理、按摩恢复、营养补给及后勤支持的工作人员。在比赛前后为车手提供按摩恢复，在补给区传递食物。',
    tags: ['后勤', '护理', 'Soigneur', '补给'],
    category: 'events'
  },
  {
    id: 506,
    name: '赛事广播通讯 (Radio Tour)',
    english: 'Radio Tour',
    brief: '向随队车实时播报比赛信息的官方广播通讯系统——车队指挥官了解赛况的核心信息源',
    definition: '赛事广播通讯系统 (Radio Tour)，向所有随队车实时播报比赛信息的官方通讯系统。内容包括：时间差、逃跑集团组成、摔车信息、天气预警、中立化通知等。',
    description: '运动总监 (DS) 通过 Radio Tour 掌握全局赛况，再通过车队内部耳机向车手下达指令。在某些赛事中，组委会会禁用无线电以增加比赛的不确定性。',
    tags: ['通讯', '广播', 'Radio', '信息'],
    category: 'events'
  },
  {
    id: 507,
    name: '裁判/赛事官员 (Commissaire)',
    english: 'Commissaire',
    brief: 'UCI 指派的赛事裁判官员，负责执行规则、判罚违规、监督比赛公平进行',
    definition: 'Commissaire（法语"委员"），UCI 指派的赛事裁判官员。负责执行比赛规则、判罚违规行为（如危险冲刺、非法借力）、监督时间限制、在必要时宣布中立化。',
    tags: ['裁判', 'Commissaire', '规则', 'UCI'],
    category: 'events'
  },
  {
    id: 510,
    name: 'UCI WorldTour — 顶级赛事',
    english: 'UCI WorldTour',
    brief: '职业公路自行车赛最高级别赛事体系，全年多场顶级赛事，参赛须持有 WorldTeam 牌照',
    definition: 'UCI WorldTour 是职业公路自行车赛的最高级别赛事体系。整个赛季由多场顶级赛事组成，横跨欧洲、美洲、澳洲等多大洲。参赛队伍须持有 UCI 世界车队 (WorldTeam) 牌照。',
    description: 'WorldTour 赛事积分最高——环法冠军可获 1,300 UCI 积分。车手和车队在 WorldTour 赛事中的表现决定其世界排名。',
    tags: ['WorldTour', '顶级', 'UCI', '赛事分级'],
    category: 'events'
  },
  {
    id: 511,
    name: 'UCI ProSeries — 第二级别',
    english: 'UCI ProSeries',
    brief: '仅次于 WorldTour 的第二级别赛事，常作为晋升跳板，ProTeam 为主要参赛队',
    definition: 'UCI ProSeries 是仅次于 WorldTour 的第二级别赛事。赛事竞争激烈，常作为晋升 WorldTour 的跳板。UCI 职业车队 (ProTeam) 为主要参赛队，WorldTour 车队亦可参赛。',
    tags: ['ProSeries', '第二级别', 'UCI', '赛事分级'],
    category: 'events'
  },
  {
    id: 512,
    name: '洲际赛事分级 (1.1/2.1 等)',
    english: 'National & Continental Races (.1 / .2)',
    brief: 'UCI 下级赛事分级体系：数字=赛制（1单日/2分站），字母=级别（.1洲际顶级/.2洲际次级）',
    definition: 'UCI 下级赛事分级体系。数字代表赛制（1 = 单日赛，2 = 分站赛），字母代表级别（.1 = 国际/洲际顶级，.2 = 洲际次级）。',
    description: '例如 1.1 表示洲际顶级单日赛，2.2 表示洲际次级分站赛。这些赛事为洲际车队提供主要比赛平台。',
    tags: ['赛事分级', '1.1', '2.1', '洲际'],
    category: 'events'
  },
  {
    id: 520,
    name: 'UCI WorldTeam — 世界车队',
    english: 'UCI WorldTeam',
    brief: '顶级车队牌照（最多 18 支），自动获得所有 WorldTour 赛事参赛资格',
    definition: 'UCI WorldTeam（世界车队），职业公路自行车赛的顶级车队牌照，最多 18 支。持有 WorldTeam 牌照的车队自动获得所有 WorldTour 赛事参赛资格。',
    description: '车队须在三年评估期内保持前 18 名才能维持 WorldTeam 地位，否则将被降级至 ProTeam。',
    tags: ['WorldTeam', '顶级', '牌照', '车队'],
    category: 'events'
  },
  {
    id: 521,
    name: 'UCI ProTeam — 职业车队',
    english: 'UCI ProTeam',
    brief: '第二级别车队牌照（约 20+ 支），受邀参加 WorldTour 及 ProSeries 赛事',
    definition: 'UCI ProTeam（职业车队），职业公路自行车赛的第二级别车队牌照。受邀参加 WorldTour 及 ProSeries 赛事。每赛季最佳的两支 ProTeam 获得三大环赛自动外卡资格。',
    tags: ['ProTeam', '第二级别', '牌照', '车队'],
    category: 'events'
  },
  {
    id: 522,
    name: 'UCI Continental Team — 洲际车队',
    english: 'UCI Continental Team',
    brief: '第三级别车队（数量不限），主要参加国家级及洲际赛事',
    definition: 'UCI Continental Team（洲际车队），职业公路自行车赛的第三级别车队，数量不限。主要参加国家级及洲际赛事，为车队和年轻车手提供发展平台。',
    tags: ['Continental', '第三级别', '洲际', '车队'],
    category: 'events'
  },

  // ==================== 13. 赛制类型与赛事概念 ====================
  {
    id: 600,
    name: '分站赛',
    english: 'Stage Race',
    brief: '多日赛事，以各赛段累计时间计算总成绩。大环赛是最典型的分站赛',
    definition: '分站赛 (Stage Race)，包含多个赛段的多日赛事，以各赛段累计时间总和计算总成绩 (GC)。赛段类型包括平路、山地、计时赛等。',
    description: '大环赛（环法、环意、环西）是最著名的分站赛，每场约 21 个赛段、历时三周。其他知名分站赛包括环瑞士 (Tour de Suisse)、环多菲内 (Critérium du Dauphiné)、双海赛 (Tirreno-Adriatico) 等。',
    tags: ['赛制', '分站赛', '多日', 'Stage Race'],
    category: 'events'
  },
  {
    id: 601,
    name: '单日赛/经典赛',
    english: 'One-Day Race / Classic',
    brief: '单日完成的赛事。五大纪念碑经典赛（Monuments）是单日赛的最高荣誉',
    definition: '单日赛 (One-Day Race)，在单日内完成的赛事。经典赛 (Classic) 指历史悠久的著名单日赛，其中五大纪念碑经典赛（Monuments）是单日赛的最高荣誉。',
    tags: ['赛制', '单日赛', 'Classic', 'Monument'],
    category: 'events'
  },
  {
    id: 602,
    name: '个人计时赛 (ITT)',
    english: 'Individual Time Trial (ITT)',
    brief: '车手单独出发，以最短时间完成赛段。是对车手纯功率输出的终极检验',
    definition: '个人计时赛 (ITT)，车手按固定间隔单独出发，以最短完成时间决定排名。不允许跟风借力，是对车手持续功率输出和空气动力学姿势的终极检验。',
    description: 'ITT 通常距离为 10-60 公里。大环赛的 ITT 往往在总成绩上拉开关键差距。世界冠军在 ITT 中可使用特殊的计时赛车、头盔和连体服。',
    tags: ['赛制', 'ITT', '计时赛', '个人'],
    category: 'events'
  },
  {
    id: 603,
    name: '团队计时赛 (TTT)',
    english: 'Team Time Trial (TTT)',
    brief: '全队协同骑行，以指定车手（通常为第 4 或第 5 名过线者）的成绩计时',
    definition: '团队计时赛 (TTT)，全队队员协同骑行，采用轮换领骑队列 (paceline) 保持高速。成绩以指定位置的过线车手（通常为第 4 或第 5 名）计时。',
    description: 'TTT 是对车队整体实力和配合默契度的终极考验。近年来在大环赛中较少出现，但在世锦赛中仍有混合接力 TTT 项目。',
    tags: ['赛制', 'TTT', '计时赛', '团队'],
    category: 'events'
  },
  {
    id: 604,
    name: '序章赛 (Prologue)',
    english: 'Prologue',
    brief: '分站赛开幕时的短距离个人计时赛（通常 < 8km），决定第一件领骑衫归属',
    definition: '序章赛 (Prologue)，分站赛正式赛段开始前进行的短距离个人计时赛，通常不超过 8 公里。结果决定首个赛段后的领骑衫归属。',
    description: '近年来大环赛已较少设置序章赛，取而代之的是正常的第 1 赛段计时赛。但小规模分站赛仍常用序章作为开幕仪式。',
    tags: ['赛制', 'Prologue', '序章', '计时'],
    category: 'events'
  },
  {
    id: 605,
    name: '绕圈赛 (Criterium)',
    english: 'Criterium / Crit',
    brief: '在封闭短环路上多圈竞速，节奏快、观赏性强。设有中间冲刺和奖金',
    definition: '绕圈赛 (Criterium)，在封闭的短环路（通常 1-5 公里）上多圈竞速的比赛形式。节奏快、弯道多、观赏性强。通常设有中间冲刺 (prime) 和现金奖金。',
    description: '在美国和澳大利亚特别流行。大环赛后城市中常举办绕圈赛作为表演性质的赛后活动。',
    tags: ['赛制', 'Criterium', '绕圈', '短环'],
    category: 'events'
  },
  {
    id: 606,
    name: '环路赛 (Circuit Race)',
    english: 'Circuit Race',
    brief: '在较长封闭环路（10-30 km）上多圈竞赛，兼具单日赛和绕圈赛特点',
    definition: '环路赛 (Circuit Race)，在较长的封闭环路上（通常 10-30 公里）进行多圈竞赛。兼具单日赛的距离和绕圈赛的观赏性。',
    tags: ['赛制', 'Circuit', '环路', '多圈'],
    category: 'events'
  },
  {
    id: 607,
    name: '休息日 (Rest Day)',
    english: 'Rest Day',
    brief: '大环赛中的休息日（通常 2 天），让车手恢复体能、车队调整策略',
    definition: '休息日 (Rest Day)，大环赛（环法、环意、环西）中的休息日，通常安排 2 天。车手利用这段时间恢复体能、接受按摩和医疗护理。车队则进行后勤补给和战术调整。',
    tags: ['赛制', '休息日', '恢复'],
    category: 'events'
  },
  {
    id: 610,
    name: '五大纪念碑经典赛',
    english: 'The Monuments',
    brief: '历史最悠久、最负盛名的五场单日经典赛：米兰-圣雷莫、环法兰德斯、巴黎-鲁贝、列日-巴斯托涅-列日、伦巴第环游',
    definition: '五大纪念碑经典赛 (The Monuments)，职业自行车赛中最古老、最负盛名的五场单日赛：\n1. 米兰-圣雷莫 (Milano-Sanremo, 1907) — 最长经典赛 (~300km)，冲刺手的天堂\n2. 环法兰德斯 (Tour of Flanders, 1913) — 石板路+短陡坡，全能型车手的试炼\n3. 巴黎-鲁贝 (Paris-Roubaix, 1896) — "北方地狱"，著名的石板路段\n4. 列日-巴斯托涅-列日 (Liège-Bastogne-Liège, 1892) — "老妇人"，爬坡手经典\n5. 伦巴第环游 (Il Lombardia, 1905) — "落叶之赛"，山地经典',
    description: '赢得全部五场称为"大满贯" (Grand Slam)，历史上仅有三位车手完成：Eddy Merckx、Roger De Vlaeminck、Rik Van Looy。',
    tags: ['Monuments', '经典赛', '五大', '单日赛'],
    category: 'events'
  },
  {
    id: 611,
    name: '春季经典赛',
    english: 'Spring Classics',
    brief: '每年 3-4 月在欧洲举行的一系列重要单日赛，是赛季最激动人心的阶段之一',
    definition: '春季经典赛 (Spring Classics)，每年 3-4 月在欧洲举行的密集单日赛系列。包括米兰-圣雷莫、环法兰德斯、巴黎-鲁贝等。以石板路、恶劣天气和激烈竞争著称。',
    tags: ['Spring Classics', '春季', '经典赛'],
    category: 'events'
  },
  {
    id: 612,
    name: '阿登经典赛',
    english: 'Ardennes Classics',
    brief: '阿登山区丘陵单日赛三连：阿姆斯特尔黄金赛、佛莱奇·瓦隆、列日-巴斯托涅-列日',
    definition: '阿登经典赛 (Ardennes Classics)，在比利时/荷兰阿登山区举办的三场著名丘陵单日赛：阿姆斯特尔黄金赛 (Amstel Gold Race)、佛莱奇·瓦隆 (Flèche Wallonne)、列日-巴斯托涅-列日 (Liège-Bastogne-Liège)。以短陡坡 (côte) 决胜闻名。',
    tags: ['Ardennes', '阿登', '经典赛', '丘陵'],
    category: 'events'
  },
  {
    id: 613,
    name: '石板经典赛',
    english: 'Cobbled Classics',
    brief: '经过历史石板路面的经典赛，环法兰德斯和巴黎-鲁贝是其中两大代表',
    definition: '石板经典赛 (Cobbled Classics)，以历史石板路面 (pavé) 为特色的经典赛系列。环法兰德斯 (Tour of Flanders) 和巴黎-鲁贝 (Paris-Roubaix) 是两大代表。石板路段对车手技巧和器材耐用性的要求极高。',
    tags: ['Cobbled', '石板', '经典赛', 'Pavé'],
    category: 'events'
  },
  {
    id: 614,
    name: '三冠王 (Triple Crown)',
    english: 'Triple Crown',
    brief: '在同一赛季赢得环法、环意、环西三大环赛——自行车运动最伟大的年度成就',
    definition: '三冠王 (Triple Crown)，指在同一赛季赢得全部三大环赛（环法、环意、环西）。这是自行车运动中最伟大的年度成就。迄今仅有一位车手完成：Eddy Merckx（1974 年）。',
    tags: ['Triple Crown', '三冠王', '大环赛', '成就'],
    category: 'events'
  },
  {
    id: 615,
    name: '大满贯 (Grand Slam)',
    english: 'Grand Slam (Monuments)',
    brief: '职业生涯赢得全部五大纪念碑经典赛——仅三位车手达成此成就',
    definition: '大满贯 (Grand Slam)，指一名车手在职业生涯中赢得全部五大纪念碑经典赛 (Monuments)。历史上仅 Eddy Merckx、Roger De Vlaeminck、Rik Van Looy 三人完成。',
    tags: ['Grand Slam', '大满贯', 'Monuments', '成就'],
    category: 'events'
  },
  {
    id: 616,
    name: '大众骑行赛 (Sportive / Gran Fondo)',
    english: 'Sportive / Gran Fondo',
    brief: '面向大众骑手的长距离骑行赛事，强调参与和挑战而非竞争',
    definition: '大众骑行赛 (Sportive / Gran Fondo)，面向业余骑手的长距离骑行活动，强调个人挑战和参与体验而非竞技排名。路线通常借用经典赛的部分路段，如 Marmotte、L\u2019Étape du Tour 等。',
    tags: ['Sportive', 'Gran Fondo', '大众', '挑战'],
    category: 'events'
  },

  // ==================== 14. 路面地形与补给后勤 ====================
  {
    id: 700,
    name: '石板路 (Pavé)',
    english: 'Pavé',
    brief: '鹅卵石或石板路面，巴黎-鲁贝和环法兰德斯的标志性路段，以星级评定难度',
    definition: '石板路 (Pavé，法语"铺石")，鹅卵石或石板铺成的路面。在巴黎-鲁贝中，各石板路段以 1-5 星评定难度（5 星最难）。著名的 Arenberg 森林路段就是五星级石板路。',
    description: '石板路对车手的技巧、体能和器材都是巨大考验。车队通常使用特殊调校的自行车（更宽的轮胎、更低的胎压、额外的减震）。',
    tags: ['Pavé', '石板', '巴黎-鲁贝', '路段'],
    category: 'events'
  },
  {
    id: 701,
    name: '短陡坡 (Côte)',
    english: 'Côte',
    brief: '短促陡峭的爬坡路段，是阿登经典赛的决定性地形',
    definition: 'Côte（法语"坡"），短促但陡峭的爬坡路段，通常长度在 1-3 公里之间，坡度可达 10-20%。是阿登经典赛（如佛莱奇·瓦隆的 Mur de Huy）的决胜地形。',
    tags: ['Côte', '短坡', '阿登', '地形'],
    category: 'events'
  },
  {
    id: 702,
    name: '石板坡 (Berg)',
    english: 'Berg',
    brief: '佛兰德语"山丘"，指比利时经典赛中标志性的短陡石板坡',
    definition: 'Berg（佛兰德语"山丘"），比利时经典赛（尤其是环法兰德斯）中标志性的短陡石板爬坡。如著名的 Koppenberg（坡度 22% 的石板坡）和 Oude Kwaremont。',
    tags: ['Berg', '石板坡', '佛兰德', '地形'],
    category: 'events'
  },
  {
    id: 703,
    name: '"墙" (Muur)',
    english: 'Muur',
    brief: '荷兰语字面意为"墙"，指近乎垂直的短陡坡。最著名的是 Muur van Geraardsbergen',
    definition: 'Muur（荷兰语"墙"），指坡度极大、近乎垂直的短陡坡。最著名的是 Muur van Geraardsbergen（格拉尔兹贝亨之墙），曾是环法兰德斯的标志性爬坡段。',
    tags: ['Muur', '墙', '陡坡', '佛兰德'],
    category: 'events'
  },
  {
    id: 704,
    name: '石板路段星级评定 (Sector)',
    english: 'Sector (Pavé Rating)',
    brief: '巴黎-鲁贝中具名石板路段的 1-5 星难度评定体系，5 星为最艰难',
    definition: '巴黎-鲁贝的各具名石板路段以 1-5 星级评定难度：5 星最高难度（如 Arenberg 森林、Carrefour de l\'Arbre），1 星最易。星级取决于路段长度、石块不平整度和技术难度。',
    tags: ['Sector', '星级', '路段', '巴黎-鲁贝'],
    category: 'events'
  },
  {
    id: 705,
    name: '砾石路 (Gravel)',
    english: 'Gravel',
    brief: '未铺装的砾石路面，近年来在职业赛事中增加使用。Strade Bianche 是著名的砾石经典赛',
    definition: '砾石路 (Gravel)，未铺装的碎石路面。Strade Bianche（白色道路）是意大利托斯卡纳地区著名的砾石经典赛，以白色砾石路和托斯卡纳风光闻名。越来越多的职业赛事开始加入砾石路段。',
    tags: ['Gravel', '砾石', 'Strade Bianche', '路面'],
    category: 'events'
  },
  {
    id: 710,
    name: '补给袋 (Musette)',
    english: 'Musette',
    brief: '在补给区向车手传递的食物补给小袋，通常由 Soigneur 在路边递出',
    definition: 'Musette（法语"小袋"），在补给区 (Feed Zone) 由车队后勤人员 (Soigneur) 向车手传递的补给袋。内装能量胶、能量棒、小食、饮料等，供车手在中途补充能量。',
    description: '车手将 Musette 中的物品转移至骑行服口袋后即丢弃袋身。大环赛结束后，Musette 常成为车迷争相收集的纪念品。',
    tags: ['补给', 'Musette', '食物', 'Feed Zone'],
    category: 'events'
  },
  {
    id: 711,
    name: '补给区 (Feed Zone)',
    english: 'Feed Zone / Ravitaillement',
    brief: '赛道上指定的补给传递区域，通常设在长赛段中途的直道安全路段',
    definition: '补给区 (Feed Zone / Ravitaillement)，赛道上由组委会指定的补给传递区域。车队后勤人员在此向车手递送 Musette（补给袋）和水壶。补给区通常在赛段前半段的长直道上设立，以确保安全。',
    tags: ['补给', 'Feed Zone', '食物', '后勤'],
    category: 'events'
  },
  {
    id: 712,
    name: '机械故障',
    english: 'Mechanical',
    brief: '比赛中发生的自行车机械问题——爆胎、变速故障、链条脱落等，可导致关键时间损失',
    definition: '比赛中发生的自行车机械故障，包括爆胎、变速故障、链条脱落、刹车失灵等。发生机械故障的车手可获得随队车或中立保障车的支援进行修理或换车。',
    description: '如发生在关键时刻（下坡、侧风路段、终点前），机械故障可能直接导致车手失去争夺名次的机会。机械故障是比赛中最令人沮丧但不可避免的变数。',
    tags: ['机械', '故障', '换车', '爆胎'],
    category: 'events'
  },
  {
    id: 713,
    name: '中立备用支援',
    english: 'Neutralised Spare / Neutral Service',
    brief: '由赛事组织方提供的公开备用自行车或轮组服务，为所有车手平等提供紧急支援',
    definition: '中立备用支援，由赛事组织方（非任一车队）提供的公开备用服务。中立保障车（通常由 Shimano 或 SRAM 赞助）搭载备用自行车和轮组，为任何发生机械故障的车手提供即时的中立支援。',
    tags: ['中立', '支援', '备用', '机械'],
    category: 'events'
  },

  // ==================== 生理学与表现指标 (rankings) ====================
  {
    id: 800, name: '瓦特 (Watts)', english: 'Watts',
    brief: '自行车运动功率标准单位。1瓦特=1焦耳/秒。功率计测量扭矩×踏频，客观即时不受情绪影响',
    definition: '自行车运动中功率的标准计量单位。1瓦特等于每秒1焦耳的能量输出。功率计通过测量踏板的扭矩与踏频（角速度）来计算即时功率输出。与心率不同，功率数据具有即时性和客观性——1瓦特始终是1瓦特，不受温度、疲劳、咖啡因或压力影响。',
    description: '功率是现代职业自行车训练和配速的黄金标准。功率计普及后，彻底改变了自行车训练的方式。',
    tags: ['功率', '瓦特', '数据', '训练'], category: 'rankings'
  },
  {
    id: 801, name: 'FTP — 功能性阈值功率', english: 'FTP (Functional Threshold Power)',
    brief: '车手可持续维持约1小时的最大平均功率，有氧与无氧代谢边界，训练分区的核心基准',
    definition: '功能性阈值功率，车手能够在不引发疲劳的情况下持续维持约一小时的最大平均功率输出——即有氧与无氧代谢之间的边界。通常以20分钟最佳平均功率的95%来估算。',
    description: 'WorldTour职业车手的FTP通常在350–450瓦以上，对较轻车手而言相当于5–6+ W/kg。FTP是建立训练区间、计算TSS和IF等关键指标的基础。',
    tags: ['FTP', '功率', '阈值', '训练'], category: 'rankings'
  },
  {
    id: 802, name: '每公斤瓦特数 (W/kg)', english: 'Watts per Kilogram (W/kg)',
    brief: '功率体重归一化值，预测爬坡能力的核心指标。世界级GC争夺者在关键爬坡可达6–7+ W/kg',
    definition: '每公斤瓦特数，车手功率输出相对体重的归一化值，是预测爬坡能力的主要指标。体重较重的车手可能产生更高的绝对瓦数，但高W/kg的轻量车手主导山地赛段。',
    description: '优秀业余车手FTP约为4 W/kg；WorldTour总成绩争夺者在关键爬坡段通常能维持6–7+ W/kg。',
    tags: ['W/kg', '功率体重比', '爬坡', '数据'], category: 'rankings'
  },
  {
    id: 803, name: '归一化功率 (NP)', english: 'Normalized Power (NP)',
    brief: '功率输出的加权平均值，比平均功率更准确反映变强度骑行的生理代价',
    definition: '归一化功率，功率输出的加权平均值，考虑了努力强度的波动性——比简单平均功率更准确地反映变强度骑行的生理代价。NP始终等于或大于平均功率。',
    tags: ['NP', '功率', '数据', '训练'], category: 'rankings'
  },
  {
    id: 804, name: '强度系数 (IF)', english: 'Intensity Factor (IF)',
    brief: '归一化功率÷FTP，衡量骑行相对阈值强度的努力程度。大环赛山地赛段IF通常0.85–0.95',
    definition: '强度系数，归一化功率与FTP之比。IF为1.0意味着该骑行相当于一小时阈值努力。大环赛山地赛段对总成绩争夺者的IF通常为0.85–0.95。',
    tags: ['IF', '强度', '阈值', '数据'], category: 'rankings'
  },
  {
    id: 805, name: 'TSS — 训练压力评分', english: 'TSS (Training Stress Score)',
    brief: '单次骑行的总生理负荷量化值。FTP强度1小时=100 TSS。大环赛赛段通常150–300+ TSS',
    definition: '训练压力评分，以单一数字量化一次骑行对身体的总生理负荷，同时考虑骑行时长和强度。以FTP强度骑行恰好60分钟 = 100 TSS。',
    tags: ['TSS', '训练', '负荷', '数据'], category: 'rankings'
  },
  {
    id: 806, name: 'CTL — 慢性训练负荷（体能）', english: 'CTL (Chronic Training Load)',
    brief: '过去42天TSS的指数加权滚动平均，代表长期训练适应（体能水平）',
    definition: '慢性训练负荷（体能），过去约42天每日TSS的指数加权滚动平均值，代表长期训练适应——通常被解读为体能水平。WorldTour车手在高峰期CTL可达140–170。',
    tags: ['CTL', '体能', '训练', '数据'], category: 'rankings'
  },
  {
    id: 807, name: 'ATL — 急性训练负荷（疲劳）', english: 'ATL (Acute Training Load)',
    brief: '过去7天TSS的滚动平均，代表近期训练压力（疲劳）。ATL对训练的响应远快于CTL',
    definition: '急性训练负荷（疲劳），过去约7天每日TSS的指数加权滚动平均值，代表近期训练压力——通常被解读为疲劳程度。ATL对训练的响应速度远快于CTL。',
    tags: ['ATL', '疲劳', '训练', '数据'], category: 'rankings'
  },
  {
    id: 808, name: 'TSB — 训练压力平衡（状态）', english: 'TSB (Training Stress Balance)',
    brief: 'CTL-ATL，代表体能与疲劳的平衡。正TSB(+5~+15) = 状态就绪；负TSB(-20~-40) = 重度疲劳',
    definition: '训练压力平衡（状态），以CTL减去ATL计算，代表体能与疲劳之间的平衡——通常被解读为当前竞技状态或比赛准备程度。车队通过精心安排减量期来管理TSB，使车手在目标比赛时达到巅峰状态。',
    tags: ['TSB', '状态', '训练', '数据'], category: 'rankings'
  },
  {
    id: 809, name: 'VO₂max — 最大摄氧量', english: 'VO₂max',
    brief: '高强度运动时氧气消耗的最大速率(ml/kg/min)，有氧适能的黄金标准。精英车手70–85',
    definition: '最大摄氧量，高强度运动时身体消耗氧气的最大速率，以毫升/公斤/分钟为单位。被广泛视为有氧适能的黄金标准。休闲骑行者通常40–50；精英车手可达70–85 ml/kg/min。',
    description: 'VO₂max在很大程度上由遗传决定，但可通过训练得到提升。传奇车手格雷格·勒蒙德曾测出92.5 ml/kg/min的惊人数值。',
    tags: ['VO2max', '摄氧量', '有氧', '生理'], category: 'rankings'
  },
  {
    id: 810, name: '乳酸阈值 (LT)', english: 'Lactate Threshold (LT)',
    brief: '乳酸在血液中开始积累超过清除速度时的运动强度，大致对应FTP水平',
    definition: '乳酸阈值，乳酸在血液中开始以超过代谢清除速度积累时的运动强度。低于LT时乳酸可被有效代谢；超过后乳酸性酸积累逐渐加剧导致疲劳。实际应用中，LT大致对应FTP水平。',
    tags: ['乳酸', '阈值', 'LT', '生理'], category: 'rankings'
  },
  {
    id: 811, name: '踏频 (Cadence / RPM)', english: 'Cadence (RPM)',
    brief: '每分钟踏板旋转次数。职业车手偏好高踏频(90–100+ RPM)以减少肌肉负担',
    definition: '踏频，每分钟的踏板旋转次数。大多数职业公路车手偏好较高踏频（90–100+ RPM），因为可减少肌肉负担，更多依赖心肺系统出力。爬坡手通常根据坡度调整踏频。',
    tags: ['踏频', 'RPM', 'Cadence', '技巧'], category: 'rankings'
  },
  {
    id: 812, name: '心率 (HR)', english: 'Heart Rate (HR)',
    brief: '以BPM衡量心血管对运动强度的响应。滞后于功率，受热度、疲劳、水分、情绪影响',
    definition: '心率，以每分钟心跳次数（BPM）衡量，反映运动强度对心血管系统的响应。与功率不同，心率滞后于实际努力，且受热度、疲劳、水分状态和情绪影响。',
    description: '静息心率是判断恢复状态的有效指标——连续数日高于正常值可能提示过度训练或疾病。',
    tags: ['心率', 'HR', 'BPM', '生理'], category: 'rankings'
  },
  {
    id: 813, name: '功率区间 (Power Zones)', english: 'Power Zones',
    brief: '基于FTP百分比划分的7个训练区间，从Z1主动恢复到Z7神经肌肉爆发',
    definition: '基于FTP百分比划分的7个训练区间：Z1主动恢复(<55%) → Z2耐力(56–75%) → Z3节奏(76–90%) → Z4阈值(91–105%) → Z5 VO₂max(106–120%) → Z6无氧能力(121–150%) → Z7神经肌肉功率(>150%全力冲刺)。',
    tags: ['功率区间', 'Power Zones', '训练', '分区'], category: 'rankings'
  },
  {
    id: 814, name: '甜蜜点训练', english: 'Sweet Spot Training',
    brief: '以FTP的88–93%强度训练——训练投入回报最高的区间。广泛用于职业车手基础构建',
    definition: '甜蜜点训练，以约FTP的88–93%强度进行的训练——产生训练投入最大回报的区间：强度足够高以驱动有效适应，同时又足够可持续以支持频繁训练。因处于节奏训练的效率性与阈值间歇训练的强度之间的"甜蜜位置"而得名。',
    tags: ['Sweet Spot', '甜蜜点', '训练', '功率'], category: 'rankings'
  },

  // ==================== 装备与技术 (tactics) ====================
  {
    id: 900, name: '公路赛车', english: 'Road Bike',
    brief: '轻量化、弯把设计，专为铺装路面高速骑行而优化。职业车手最常用的车型',
    definition: '轻量化、弯把设计，专为铺装路面高速骑行而优化。通常使用碳纤维车架，重量在6.8kg（UCI最低重量限制）左右。',
    tags: ['车型', '公路车', '碳纤维'], category: 'tactics'
  },
  {
    id: 901, name: '计时赛专用车 (TT Bike)', english: 'Time Trial (TT) Bike',
    brief: '高度流线型设计，配备气动延伸把手和极度前倾姿势，专为个人计时赛打造',
    definition: '高度流线型、低剖面设计的专用自行车，配备气动延伸把手（aero bars），骑行姿势极度前倾以最小化迎风面积。UCI对TT车的几何尺寸有严格规定。',
    tags: ['TT', '计时赛', '气动', '车型'], category: 'tactics'
  },
  {
    id: 902, name: '气动公路车', english: 'Aero Road Bike',
    brief: '具备气动车架造型的公路车，在减重与降低风阻之间取得平衡',
    definition: '气动公路车，具备气动车架造型的公路车。相比纯爬坡车稍重但风阻更低，在多样化地形（平路+起伏）中综合效率最优。',
    tags: ['Aero', '气动', '公路车', '车型'], category: 'tactics'
  },
  {
    id: 903, name: '爬坡车', english: 'Climbing Bike',
    brief: '超轻车架，专为功率体重比优化的爬坡表现而设计',
    definition: '爬坡车/全能车，超轻车架优化功率体重比的爬坡表现。在当今气动设计普及化的背景下，现代爬坡车也融入了气动设计元素，在减重与降阻之间取得平衡。',
    tags: ['爬坡', '轻量', '车型'], category: 'tactics'
  },
  {
    id: 904, name: '砾石路车 (Gravel Bike)', english: 'Gravel Bike',
    brief: '多功能车型，适用于铺装与未铺装混合路面。近年随砾石赛事兴起而快速发展',
    definition: '砾石路车，多功能车型，适用于铺装与未铺装混合路面。相比公路车具有更宽的轮胎间隙、更舒适的几何设计。Strade Bianche等职业赛事的兴起推动了砾石车市场。',
    tags: ['Gravel', '砾石', '车型'], category: 'tactics'
  },
  {
    id: 905, name: '碳纤维', english: 'Carbon Fibre',
    brief: '职业赛车架主要材料，具有最高的强度重量比。几乎所有WorldTour车架均为碳纤维',
    definition: '碳纤维，职业赛车架主要材料。具有最高的强度重量比，同时具备可设计的各向异性（可针对不同受力方向优化纤维排布）。几乎所有WorldTour级别的车架、前叉、轮圈均使用碳纤维。',
    tags: ['碳纤维', '材料', '车架'], category: 'tactics'
  },
  {
    id: 906, name: '套件 (Groupset)', english: 'Groupset',
    brief: '变速+制动系统完整套装。三大品牌：Shimano Dura-Ace、SRAM Red、Campagnolo Super Record',
    definition: '套件，公路车变速系统和制动系统组件的完整套装。WorldTour级三大套件：Shimano Dura-Ace（日本）、SRAM Red（美国）、Campagnolo Super Record（意大利）。',
    tags: ['套件', 'Groupset', '变速', '刹车'], category: 'tactics'
  },
  {
    id: 907, name: '电子变速系统', english: 'Electronic Shifting (Di2 / eTap / EPS)',
    brief: 'Shimano Di2 / SRAM eTap / Campagnolo EPS——以精密电子伺服电机取代机械拉线变速',
    definition: '电子变速系统，分别由三大品牌推出的电子变速技术。以精密电子伺服电机取代机械拉线，实现更快、更精准的换挡。SRAM eTap 采用无线通讯技术，无需连接线缆。',
    tags: ['电子变速', 'Di2', 'eTap', '技术'], category: 'tactics'
  },
  {
    id: 908, name: '拨链器 (Derailleur)', english: 'Derailleur',
    brief: '将链条在齿轮间移动的机构。前拨（牙盘侧）+ 后拨（飞轮侧）',
    definition: '拨链器，将链条在齿轮间移动的机构。前拨链器（front derailleur）在牙盘侧切换大小盘；后拨链器（rear derailleur）在飞轮侧切换不同齿片。',
    tags: ['拨链器', 'Derailleur', '变速'], category: 'tactics'
  },
  {
    id: 909, name: '飞轮 (Cassette)', english: 'Cassette',
    brief: '后轮花鼓上的齿轮组。职业车手会根据赛段地形更换不同齿比飞轮',
    definition: '飞轮，后轮花鼓上的齿片组。职业车手会根据赛段地形更换不同飞轮：平路赛段使用齿比范围较窄的飞轮（如11-28T），山地赛段使用范围更宽的飞轮（如11-34T）。',
    tags: ['飞轮', 'Cassette', '齿轮'], category: 'tactics'
  },
  {
    id: 910, name: '牙盘 (Chainring)', english: 'Chainring',
    brief: '连接曲柄的前齿轮。大牙盘用于平路冲速，小牙盘用于爬坡',
    definition: '牙盘，连接曲柄的前齿轮。标准配置为双盘：大牙盘（如53T）用于平路和冲刺，小牙盘（如39T）用于爬坡。计时赛中常使用更大尺寸的单盘。',
    tags: ['牙盘', 'Chainring', '齿轮'], category: 'tactics'
  },
  {
    id: 911, name: '中轴 (BB)', english: 'Bottom Bracket (BB)',
    brief: '连接曲柄组与车架的轴承——动力传输的关键节点',
    definition: '中轴，连接曲柄组与车架的轴承系统。是动力从踏板传输至车架的关键节点。不同品牌采用不同的BB规格（如BB86、BB30、T47等）。',
    tags: ['中轴', 'BB', '轴承'], category: 'tactics'
  },
  {
    id: 912, name: '深剖面轮组', english: 'Deep Section Wheels',
    brief: '高气动轮圈（50–80mm深度），降低风阻但增加重量和侧风敏感性',
    definition: '深剖面轮组，具有高气动轮圈（如50–80mm深度）的轮组。在平路和计时赛中降低风阻效果显著，但在山地赛段和强侧风条件下劣势明显。',
    tags: ['轮组', '深剖面', '气动'], category: 'tactics'
  },
  {
    id: 913, name: '爬坡轮组', english: 'Climbing Wheels',
    brief: '浅剖面轻量化轮组，以轻量为优先牺牲气动性能。山地赛段的首选',
    definition: '爬坡轮组，浅剖面（25–35mm）轻量化轮组。以低重量为优先设计目标，牺牲气动性能。在长距离连续爬坡中每克重量节省都能转化为时间优势。',
    tags: ['轮组', '爬坡', '轻量'], category: 'tactics'
  },
  {
    id: 914, name: '碟轮 (Disc Wheel)', english: 'Disc Wheel',
    brief: '完全封闭的实心后轮，气动性能最强。用于计时赛，强侧风中禁用',
    definition: '碟轮，覆盖整个轮面的实心轮。气动性能最强，专用于计时赛后轮。在强侧风条件下出于安全考虑禁止使用（操控性急剧下降）。',
    tags: ['轮组', '碟轮', 'TT'], category: 'tactics'
  },
  {
    id: 915, name: '管胎', english: 'Tubular Tyre',
    brief: '内胎与外胎缝合为一体并粘附于轮圈的轮胎。职业车手首选，滚动阻力低',
    definition: '管胎，内胎缝入外胎内并整体粘附于轮圈的轮胎。职业车手青睐管胎因为：低滚动阻力、爆胎后仍可慢速骑行一段距离、爆胎"手感"好（可提前感知）。代价是更换麻烦、成本高。',
    tags: ['轮胎', '管胎', '滚动阻力'], category: 'tactics'
  },
  {
    id: 916, name: '免内胎 (Tubeless)', english: 'Tubeless Tyre',
    brief: '无内胎直接密封于轮圈的轮胎，使用密封液自动修复小刺孔。正在逐渐取代管胎',
    definition: '免内胎，无内胎直接密封于轮圈的轮胎系统。使用密封液自动修复小刺孔。相比管胎安装更方便，滚动阻力更低。近年来在职业车队中逐渐普及。',
    tags: ['轮胎', 'Tubeless', '密封液'], category: 'tactics'
  },
  {
    id: 917, name: '滚动阻力', english: 'Rolling Resistance',
    brief: '轮胎在路面上变形所损耗的能量。越低则速度效率越高',
    definition: '滚动阻力，轮胎在路面上变形所损耗的能量。轮胎气压、宽度、胎面材料和路面状况共同决定滚动阻力。越低则同等功率下速度越快。',
    tags: ['滚动阻力', '轮胎', '效率'], category: 'tactics'
  },
  {
    id: 918, name: 'CdA — 风阻系数×迎风面积', english: 'CdA (Coefficient of Drag × Area)',
    brief: '车手与车辆系统的核心空气动力学参数。CdA越低 = 风阻越小 = 同等功率速度越快',
    definition: 'CdA（风阻系数×迎风面积），车手与车辆系统的主要空气动力学参数。CdA越低则风阻越小、同等功率下速度越快。职业TT车手通过优化姿势、头盔、连体服和设备可将CdA降至0.18以下。',
    tags: ['CdA', '风阻', '空气动力学'], category: 'tactics'
  },
  {
    id: 919, name: '风洞测试', english: 'Wind Tunnel Testing',
    brief: '在受控气流环境中测量并优化车手风阻的测试。所有WorldTour车队均采用',
    definition: '风洞测试，在受控气流环境中测量并优化车手风阻的测试方法。所有WorldTour车队均会在赛季前和赛季中进行风洞测试，优化TT姿势、头盔选择和服装配置。',
    tags: ['风洞', '测试', '空气动力学'], category: 'tactics'
  },
  {
    id: 920, name: '气动头盔', english: 'Aero Helmet',
    brief: '流线型延伸设计的头盔，降低风阻。TT和冲刺阶段专用',
    definition: '气动头盔，流线型延伸设计、表面光滑的头盔。计时赛中使用的TT盔具有最长的尾翼（符合UCI规定范围内），一般公路赛使用较短尾翼的气动公路盔。',
    tags: ['头盔', '气动', 'TT'], category: 'tactics'
  },
  {
    id: 921, name: '连体骑行服 (Skin Suit)', english: 'Skin Suit',
    brief: '一体式紧身莱卡服，相比分体式骑行服显著降低风阻。计时赛必备',
    definition: '连体骑行服，一体式紧身莱卡骑行服。消除上衣与短裤之间的间隙和褶皱，显著降低风阻。计时赛中所有车手均穿着皮肤衣。',
    tags: ['Skin Suit', '连体服', '气动'], category: 'tactics'
  },
  {
    id: 922, name: '边际收益', english: 'Marginal Gains',
    brief: '在装备、营养、技术上积累多项微小改进以实现显著整体优势的理念。由天空车队推广',
    definition: '边际收益（Marginal Gains），通过在装备、营养、技术、睡眠、恢复等各方面积累多项微小改进，从而实现显著整体性能优势的理念。由天空车队（现Ineos Grenadiers）的戴夫·布雷斯福德爵士推广普及。',
    tags: ['Marginal Gains', '边际收益', '优化'], category: 'tactics'
  },

  // ==================== 团队运营与赛事后勤 (events) ====================
  {
    id: 1000, name: '车队机械师', english: 'Team Mechanic',
    brief: '负责车队自行车的维护、准备和修理。赛段之间夜间工作，比赛中数秒换轮',
    definition: '车队机械师，负责队内自行车的维护、准备和修理。赛段之间在夜间工作清洗、调校、重建车辆。比赛中必须能在数秒内完成换轮。WorldTour机械师为每名车手管理10–12辆不同配置的自行车。',
    tags: ['机械师', '维护', '后勤'], category: 'events'
  },
  {
    id: 1001, name: '随队医生', english: 'Team Doctor',
    brief: '负责车手健康和医疗保障：处理伤情、监测血液指标、确保反兴奋剂合规',
    definition: '随队医生，负责车手的健康和医疗保障。职责包括：处理比赛伤情、管理疾病状态、监测血液指标和恢复标志物、确保遵守反兴奋剂规定。需在摔车后与车手协商是否继续参赛。',
    tags: ['医生', '医疗', '健康'], category: 'events'
  },
  {
    id: 1002, name: '运动科学家/教练', english: 'Sports Scientist / Coach',
    brief: '基于功率、心率、VO₂max等数据设计和管理训练计划。现代车队核心角色',
    definition: '运动科学家/教练，基于生理数据（功率、心率、最大摄氧量、乳酸值）设计和管理训练计划。现代车队聘用全职运动科学家，全年监测车手体能、规划周期化训练、分析比赛数据。数据科学深度整合是过去二十年自行车训练最具决定性意义的发展。',
    tags: ['科学家', '教练', '数据', '训练'], category: 'events'
  },
  {
    id: 1003, name: '赛前探路员', english: 'Avant-Coureur / Recon Rider',
    brief: '提前约1小时沿赛程路线侦察路面、天气和危险弯道，向DS实时汇报',
    definition: '赛前探路员（法语：Avant-Coureur），在赛段当天提前约一小时沿赛程路线行进的团队工作人员或专职车手。职责是侦察路面状况、汇报障碍物、天气和危险弯道信息，并将关键信息实时传递给随队车中的运动总监。',
    tags: ['探路', '侦察', '安全'], category: 'events'
  },
  {
    id: 1004, name: '团队巴士', english: 'Team Bus',
    brief: '车队移动指挥部——提供赛段前后更衣、装备存储和医疗服务',
    definition: '团队巴士，车队的移动指挥中心。提供赛段前后的更衣设施、自行车和装备存储、随队医生诊疗区域，以及赛前战术会议的私密空间。每支WorldTour车队都配备了定制豪华大巴。',
    tags: ['巴士', '移动基地', '后勤'], category: 'events'
  },
  {
    id: 1005, name: '随队车', english: 'Team Car',
    brief: '载有DS、机械师、备用车辆、轮组、食品和饮水的随队车辆，在车队中跟随比赛',
    definition: '随队车，载有运动总监(DS)、机械师、备用自行车和轮组、食品和饮水的车辆，在保障车队中按排位顺序跟随比赛。DS通过车队广播(Radio Tour)和内部对讲机指挥战术。',
    tags: ['随队车', 'DS', '后勤'], category: 'events'
  },
  {
    id: 1006, name: '水壶 (Bidon)', english: 'Bidon',
    brief: '法语"水壶"，放置于车架水壶架中。赞助商印制品牌标识，车迷常收集留念',
    definition: 'Bidon（法语"水壶"），放置于车架水壶架中。赞助商通常在水壶上印制品牌标识，沿途观众常收集车手丢弃的水壶作为纪念品。在大环赛中，每天可消耗数千个水壶。',
    tags: ['水壶', 'Bidon', '补给'], category: 'events'
  },
  {
    id: 1007, name: '扫把车 (Voiture Balai)', english: 'Broom Wagon (Voiture Balai)',
    brief: '跟随最后一名车手的车辆，随时接收退赛或无法继续的车手。历史上挂有真扫帚',
    definition: '扫把车（法语：Voiture Balai），跟随比赛最后一名车手行驶的车辆，随时准备接收退赛或无法继续的车手。历史上车辆上曾真实挂有一把扫帚作为象征——"扫除"落在最后的车手。',
    tags: ['扫把车', '退赛', '后勤'], category: 'events'
  },
  {
    id: 1008, name: '见习车手 (Stagiaire)', english: 'Stagiaire',
    brief: '赛季后半段(8–10月)获得与职业车队同场骑行机会的业余/发展型车手',
    definition: '见习车手（法语：Stagiaire），在赛季后半段（8–10月）获得与职业车队同场骑行机会的业余或发展型车手，以积累职业经验，为获得正式合同做准备。',
    tags: ['Stagiaire', '见习', '发展'], category: 'events'
  },
  {
    id: 1010, name: '赛程路线 (Parcours)', english: 'Parcours',
    brief: '法语"路线"——赛段或比赛的具体线路设计，车队提前数月深入研究',
    definition: 'Parcours（法语"路线"），指赛段或比赛的具体线路设计，包括地形、爬坡类别、终点设置。赛程路线提前数月公布，各车队的运动总监和教练会对其进行反复研究，制定详细战术方案。',
    tags: ['Parcours', '路线', '设计'], category: 'events'
  },
  {
    id: 1011, name: '大出发 (Grand Départ)', english: 'Grand Départ',
    brief: '大环赛的官方开幕赛段和出发仪式。各城市和地区竞相申办举办权',
    definition: '大出发（法语：Grand Départ），大环赛的官方开幕赛段和出发仪式。各城市和地区竞相申办大出发举办权——这是一项具有重大旅游和经济影响力的活动。环法历史上曾在英国、荷兰、德国、丹麦等国举办大出发。',
    tags: ['Grand Départ', '出发', '开幕'], category: 'events'
  },
  {
    id: 1012, name: '女王赛段 (Queen Stage)', english: 'Queen Stage',
    brief: '大环赛中难度最大、最具挑战性的赛段——通常最长或山顶最密集，往往决定GC走势',
    definition: '女王赛段（Queen Stage），大环赛中难度最大、最具挑战性的赛段。通常是最长或山顶最密集的赛段（多个HC/1级山顶），往往对总成绩产生决定性影响。',
    tags: ['Queen Stage', '女王赛段', '决定性'], category: 'events'
  },
  {
    id: 1013, name: '转移赛段', english: 'Transfer Stage',
    brief: '主要起地理位置转移作用的赛段，通常平坦、战略意义相对较低',
    definition: '转移赛段，主要功能为将比赛从当前区域移动到下一个地理区域的赛段。通常较为平坦，被认为相对"安静"——除非出现侧风分裂（echelons）等意外情况。',
    tags: ['转移', '过渡', '赛段类型'], category: 'events'
  },
  {
    id: 1014, name: '赛事总监', english: 'Race Director',
    brief: '比赛的总体组织者和运营负责人，负责路线设计、安全规划和比赛公正性',
    definition: '赛事总监，比赛的总体组织者和运营负责人。负责路线设计、安全规划、后勤管理和比赛公正性。如环法总监克里斯蒂安·普鲁多姆(Christian Prudhomme)是最广为人知的赛事总监。',
    tags: ['总监', '组织', '管理'], category: 'events'
  },
  {
    id: 1015, name: '裁判委员会 (Race Jury)', english: 'Race Jury',
    brief: '就纪律事务、比赛中立化和时限申诉做出集体裁决的UCI裁判组',
    definition: '裁判委员会（Race Jury），由多名UCI赛事裁判(Commissaire)组成的裁决小组。就纪律违规、时间惩罚、降名处罚、比赛中立化以及时限申诉等做出集体裁决。',
    tags: ['裁判', 'Jury', '裁决'], category: 'events'
  },
  {
    id: 1016, name: '赛事摩托车 (Moto)', english: 'Moto / Lead Motorbike',
    brief: '比赛前后行驶的摩托车，载有摄像师、官员、医生和比赛信息牌',
    definition: '赛事摩托车，在比赛前方和后方行驶的专用摩托车。搭载电视摄像师、UCI官员、赛事医生和实时时间差距信息牌。车手可以通过看摩托车上的信息牌了解与前方逃跑集团或后方追赶组的差距。',
    tags: ['Moto', '摩托车', '信息'], category: 'events'
  },
  {
    id: 1017, name: '车手签到', english: 'Sign-on (La Présentation)',
    brief: '赛段前在颁奖台正式签到的仪式——车迷可近距离接触车手英雄',
    definition: '车手签到（法语：La Présentation），赛段前在颁奖台正式签到的公开仪式。是车迷近距离接触车手、拍照签名的机会。所有参赛车手必须完成签到，否则将被取消该赛段资格。',
    tags: ['签到', '仪式', '车迷'], category: 'events'
  },
  {
    id: 1018, name: '中立出发 (Départ Fictif)', english: 'Départ Fictif / Neutralized Start',
    brief: '赛段正式开始前的游行路段——发令旗落下前，车手缓慢驶过出发城镇',
    definition: '中立出发/虚假出发（法语：Départ Fictif），赛段正式开始前的中立游行路段。车手以缓慢速度驶过出发城镇，在发令旗落下（Départ Réel/真实出发）前不允许任何竞争性骑行。提供了车手热身和观众近距离观赏的时段。',
    tags: ['Départ Fictif', '出发', '中立'], category: 'events'
  },
  {
    id: 1019, name: '宣传车队 (Caravane)', english: 'Caravan (Caravane Publicitaire)',
    brief: '比赛前方行驶的彩色赞助商车队，向路边观众抛洒宣传礼品。环法标志性传统',
    definition: '宣传车队（法语：Caravane Publicitaire），在比赛前方行驶的彩色赞助商车队，向路边观众抛洒宣传礼品。环法宣传车队有数百辆花车、分发数百万份免费礼品，是深受观众喜爱的百年传统。',
    tags: ['Caravan', '宣传', '赞助商', '传统'], category: 'events'
  },

  // ==================== 反兴奋剂与诚信 (jerseys) ====================
  {
    id: 1100, name: 'UCI 反兴奋剂规则', english: 'UCI Anti-Doping Rules',
    brief: '与WADA世界反兴奋剂守则一致的职业自行车禁用物质和方法规定',
    definition: 'UCI反兴奋剂规则，与世界反兴奋剂机构(WADA)世界反兴奋剂守则一致的职业自行车运动禁用物质和方法规定。所有职业车手必须遵守，违反者面临禁赛、取消成绩等处罚。',
    tags: ['反兴奋剂', 'UCI', '规则'], category: 'jerseys'
  },
  {
    id: 1101, name: 'TUE — 治疗性用药豁免', english: 'TUE (Therapeutic Use Exemption)',
    brief: '允许车手因合法医疗原因使用本应禁用物质的豁免许可，由UCI医疗委员会审批',
    definition: '治疗性用药豁免(TUE)，允许车手因合法医疗原因使用本应被禁用物质的豁免许可。由UCI医疗委员会进行严格的个案审批，需证明无替代疗法且不影响运动表现。',
    tags: ['TUE', '豁免', '医疗', '反兴奋剂'], category: 'jerseys'
  },
  {
    id: 1102, name: '生物护照', english: 'Bio Passport',
    brief: '车手血液指标的纵向记录，通过识别异常变化间接检测兴奋剂，无需捕获特定物质',
    definition: '生物护照（Athlete Biological Passport），车手血液指标的纵向长期记录。通过识别随时间出现的异常变化来间接检测兴奋剂使用，无需捕获特定禁用物质。是世界反兴奋剂体系中最重要的技术创新之一。',
    tags: ['生物护照', '反兴奋剂', '检测'], category: 'jerseys'
  },
  {
    id: 1103, name: 'WADA — 世界反兴奋剂机构', english: 'WADA (World Anti-Doping Agency)',
    brief: '制定全球反兴奋剂标准并每年更新《禁用清单》的国际独立机构',
    definition: '世界反兴奋剂机构(WADA)，制定全球反兴奋剂标准并每年更新《禁用清单》的国际独立机构。UCI反兴奋剂规则以WADA守则为基础，所有职业自行车赛事的兴奋剂检测均遵循WADA标准。',
    tags: ['WADA', '反兴奋剂', '国际'], category: 'jerseys'
  },
  {
    id: 1104, name: '兴奋剂检测', english: 'Doping Control',
    brief: '收集并检测车手尿液/血液样本以检测禁用物质的程序，赛内和赛外均可进行',
    definition: '兴奋剂检测，收集并检测车手尿液/血液样本以检测禁用物质的程序。赛内检测在比赛现场进行；赛外检测可在任何时间、任何地点进行——车手必须随时报告自己的行踪。',
    tags: ['检测', '兴奋剂', '样本'], category: 'jerseys'
  },
  {
    id: 1105, name: '追溯性取消资格', english: 'Retroactive Disqualification',
    brief: '赛后确认违规时追溯取消成绩，包括通过重新检测保存样本。其后所有名次上移',
    definition: '追溯性取消资格，在赛后确认违反兴奋剂规定时追溯性地取消成绩，包括通过重新检测保存的赛时样本（可保存10年）。被取消成绩的车手其后所有名次相应上移重新分配。',
    tags: ['追溯', '取消资格', '反兴奋剂'], category: 'jerseys'
  }
];

// ============================================================
// Page 逻辑
// ============================================================

Page({
  data: {
    terms: [],
    filteredTerms: [],
    activeCategory: 'all',
    searchKey: '',
    showDetail: false,
    currentTerm: null
  },
  
  onLoad() {
    this.initI18n();
    this.setData({
      terms: termDatabase,
      filteredTerms: termDatabase
    });
  },

  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({ t: this.t });
  },
  
  onSearchInput(e) {
    this.setData({ searchKey: e.detail.value });
    this.filterTerms();
  },
  
  onSearch() {
    this.filterTerms();
  },
  
  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: category });
    this.filterTerms();
  },
  
  filterTerms() {
    const { terms, activeCategory, searchKey } = this.data;
    let filtered = terms;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(term => term.category === activeCategory);
    }
    
    if (searchKey.trim()) {
      const key = searchKey.toLowerCase().trim();
      filtered = filtered.filter(term => 
        term.name.toLowerCase().includes(key) ||
        term.english.toLowerCase().includes(key) ||
        term.brief.toLowerCase().includes(key) ||
        (term.tags && term.tags.some(tag => tag.toLowerCase().includes(key)))
      );
    }
    
    this.setData({ filteredTerms: filtered });
  },
  
  showTermDetail(e) {
    const termId = e.currentTarget.dataset.id;
    const term = this.data.terms.find(t => t.id === termId);
    if (term) {
      this.setData({ showDetail: true, currentTerm: term });
    }
  },
  
  hideTermDetail() {
    this.setData({ showDetail: false });
  },
  
  preventBubble() {},
  
  showRelatedTerm(e) {
    const termName = e.currentTarget.dataset.term;
    const term = this.data.terms.find(t => t.name === termName);
    if (term) {
      this.setData({ currentTerm: term });
    }
  },
  
  onShareAppMessage() {
    return {
      title: this.t('encyclopediaTitle'),
      path: '/pages/encyclopedia/encyclopedia'
    };
  },

  onShareTimeline() {
    return {
      title: this.t('encyclopediaTitle')
    };
  }
});
