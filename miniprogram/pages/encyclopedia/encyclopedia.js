/**
 * 赛事百科页面逻辑
 * 提供自行车赛事术语解释、规则说明
 */

const { t, getLocale } = require('../../utils/i18n');

// 术语数据库
const termDatabase = [
  {
    id: 1,
    name: '总成绩',
    english: 'General Classification (GC)',
    brief: '赛段累计时间总和的排名，领骑衫持有者即为GC领先者',
    definition: 'General Classification（简称GC）是指多日赛中，车手在各赛段完赛时间的累计总和排名。',
    description: '在公路自行车赛（尤其是大环赛如环法、环意、环西）中，GC排名是最重要的排名。车手在每个赛段的完赛时间会累加，总时间最少的车手将穿上领骑衫（环法为黄衫，环意为粉衫，环西为红衫）。GC领先者通常是全场最全面的车手，需要具备出色的计时赛能力和爬坡能力。',
    example: '2026年环意第5赛段后，Ciccone Giulio（Lidl - Trek） wearing pink jersey，他的累计时间在所有车手中最少。',
    tags: ['排名', 'GC', '领骑衫'],
    category: 'ranking',
    relatedTerms: ['冲刺积分', '爬坡积分', '青年排名', '领骑衫']
  },
  {
    id: 2,
    name: '冲刺积分',
    english: 'Points Classification',
    brief: '平路赛段终点冲刺获得的积分，领先者穿绿衫（环法）或紫衫（环意）',
    definition: '冲刺积分（Points Classification）是根据车手在赛段终点和途中冲刺点获得的积分排名。',
    description: '冲刺积分排名奖励冲刺型车手。在环法中，领先者穿绿衫；在环意中，领先者穿紫（红）衫；在环西中，领先者穿绿衫。积分通常在平路赛段终点分配最多，途中冲刺点也会分配少量积分。冲刺积分领先者通常是爆发力强、终点冲刺快的"冲刺手"。',
    example: '环法2026第5赛段，冲刺手在终点冲刺获得50分，途中冲刺点获得20分，总计70分。',
    tags: ['排名', '冲刺', '绿衫', '紫衫'],
    category: 'ranking',
    relatedTerms: ['总成绩', '爬坡积分', '冲刺手']
  },
  {
    id: 3,
    name: '爬坡积分',
    english: 'Mountains Classification',
    brief: '爬坡路段按难度获得的积分，领先者穿圆点衫（环法）或蓝衫（环意）',
    definition: '爬坡积分（Mountains Classification）是根据车手在爬坡点（HC级、1级、2级、3级、4级）获得的积分排名。',
    description: '爬坡积分排名奖励爬坡型车手。在环法中，领先者穿圆点衫（俗称"爬坡王"）；在环意中，领先者穿蓝衫。爬坡点按难度分级：HC级（最高难度）积分最多，4级（最低难度）积分最少。爬坡积分领先者通常是体重轻、功率体重比高的"爬坡手"。',
    example: '环意2026第3赛段，车手第一个通过HC级爬坡点，获得20分爬坡积分。',
    tags: ['排名', '爬坡', '圆点衫', '蓝衫'],
    category: 'ranking',
    relatedTerms: ['总成绩', '冲刺积分', '爬坡手']
  },
  {
    id: 4,
    name: '青年排名',
    english: 'Youth Classification',
    brief: '25岁以下车手的GC排名，领先者穿白衫',
    definition: '青年排名（Youth Classification）是指25岁以下车手的GC（总成绩）排名。',
    description: '青年排名奖励有潜力的年轻车手。在三大环赛中，青年排名领先者穿白衫。这个排名只计算1999年1月1日以后出生的车手（以2024年为例，年龄≤25岁）。青年排名领先者通常是未来的GC竞争者，这个排名可以反映年轻车手的潜力。',
    example: '2026年环意第5赛段后，Jan CHRISTEN（UAE Team Emirates - XRG，21岁）是青年排名领先者，穿白衫。',
    tags: ['排名', '青年', '白衫', '25岁以下'],
    category: 'ranking',
    relatedTerms: ['总成绩', 'GC', '白衫']
  },
  {
    id: 5,
    name: '突围',
    english: 'Breakaway',
    brief: '指脱离主集团的骑行策略，通常为小规模车手群体',
    definition: '突围（Breakaway）是指部分车手从主集团（Peloton）中加速脱离，形成前方小集团的策略。',
    description: '突围是公路自行车赛的常见战术。车手们会试图脱离主集团，争取在赛段终点前保持领先，获得赛段冠军。突围通常需要消耗大量体力，因为小集团要对抗整个主集团的风阻。突围成功率取决于剩余距离、车手数量、主集团意愿等因素。如果突围集团中有GC竞争者，主集团会全力追击。',
    example: '环意2026第4赛段，5名车手在比赛进行到50公里时突围，最多领先主集团3分30秒，但最终被追回。',
    tags: ['战术', '进攻', '突围'],
    category: 'tactic',
    relatedTerms: ['主集团', '追击', '赛段冠军']
  },
  {
    id: 6,
    name: '副将',
    english: 'Domestique',
    brief: '指为队长服务的车手，负责带风、送水、保护队长等任务',
    definition: '副将（Domestique，法语"仆人"的意思）是指为队长（Team Leader）服务的车手。',
    description: '副将是车队战术体系中的重要角色。他们的主要任务包括：1) 带风（在前方破风，节省队长体力）；2) 送水送食物；3) 保护队长（防止对手进攻）；4) 追击对手的进攻；5) 在必要时牺牲自己帮助队长。副将通常不具备争夺GC或赛段冠军的实力，但他们是车队成功的关键。',
    example: '2026年环意，UAE Team Emirates车队的副将们全力保护队长，在爬坡路段为他带风，确保他节省体力。',
    tags: ['战术', '车队', '副将', '队长'],
    category: 'tactic',
    relatedTerms: ['车队', '队长', '带风']
  },
  {
    id: 7,
    name: '主集团',
    english: 'Peloton',
    brief: '指比赛中的大部队，大部分车手都在其中',
    definition: '主集团（Peloton，法语"小盘子"的意思）是指比赛中大部分车手组成的大部队。',
    description: '主集团是公路自行车赛的主要形态。由于空气阻力的影响，在主集团中骑行可以节省约30-40%的体力。因此，大多数车手会选择留在主集团中，只有在特定战术目的（如突围、进攻）时才会脱离。主集团的速度由车队或比赛指挥控制。如果前方有突围集团，主集团会协调追击。',
    example: '环意2026第2赛段，主集团有约150名车手，他们协调速度，控制突围集团的时间差。',
    tags: ['战术', '主集团', '风阻'],
    category: 'tactic',
    relatedTerms: ['突围', '带风', '空气阻力']
  },
  {
    id: 8,
    name: '带风',
    english: 'Drafting / Pulling',
    brief: '在前方骑行，为后方车手减少风阻',
    definition: '带风（Drafting）是指车手在前方骑行，为后方车手减少空气阻力的行为。',
    description: '带风是公路自行车赛中的团队协作。由于空气阻力在高速骑行中占主要阻力（约80-90%），在前方骑行的车手会消耗更多体力，而在后方跟随的车手可以节省30-40%的体力。因此，车队会让副将轮流带风，保护队长。在计时赛中，车手没有队友帮助，必须全程自己带风，因此体力消耗更大。',
    example: 'UAE Team Emirates车队的副将们在平坦路段为队长带风，他们轮流在前方骑行，每人带风几分钟然后退到后方休息。',
    tags: ['战术', '团队', '风阻', '副将'],
    category: 'tactic',
    relatedTerms: ['副将', '主集团', '空气阻力']
  },
  {
    id: 9,
    name: '赛段',
    english: 'Stage',
    brief: '多日赛中的单个比赛日，大环赛通常有21个赛段',
    definition: '赛段（Stage）是指多日赛（如大环赛）中的单个比赛日。',
    description: '大环赛（环法、环意、环西）通常有21个赛段，分布在23天内（包含2个休息日）。赛段类型包括：平路赛段（适合冲刺手）、丘陵赛段（适合全能型车手）、山地赛段（适合爬坡手）、计时赛（个人或团队）、休息日。每个赛段都有独立的赛段冠军，但GC排名是根据所有赛段的累计时间。',
    example: '2026年环意有21个赛段，包括7个平路赛段、6个丘陵赛段、6个山地赛段、2个计时赛。',
    tags: ['赛事', '赛段', '多日赛'],
    category: 'rule',
    relatedTerms: ['总成绩', '大环赛', '休息日']
  },
  {
    id: 10,
    name: '大环赛',
    english: 'Grand Tour',
    brief: '指环法、环意、环西三大顶级公路自行车赛',
    definition: '大环赛（Grand Tour）是指公路自行车赛中最重要、最负盛名的三场比赛：环法（Tour de France）、环意（Giro d\u0027Italia）、环西（Vuelta a España）。',
    description: '大环赛是公路自行车赛的皇冠明珠。它们通常持续3周（23天，含2个休息日），总长度约3000-3500公里。大环赛吸引世界顶级车手参加，是自行车运动的巅峰赛事。每场大环赛都有丰富的历史：环法始于1903年，环意始于1909年，环西始于1935年。赢下大环赛是车手的终极梦想。',
    example: '2026年，中国车手计成成为首位参加大环赛的中国车手，他在环意中担任副将角色。',
    tags: ['赛事', '大环赛', '环法', '环意', '环西'],
    category: 'rule',
    relatedTerms: ['赛段', '总成绩', '领骑衫']
  }
];

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

  /**
   * 初始化i18n
   */
  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    this.setData({
      t: this.t
    });
  },
  
  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKey: e.detail.value
    });
    this.filterTerms();
  },
  
  // 执行搜索
  onSearch() {
    this.filterTerms();
  },
  
  // 切换分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      activeCategory: category
    });
    this.filterTerms();
  },
  
  // 筛选术语
  filterTerms() {
    const { terms, activeCategory, searchKey } = this.data;
    let filtered = terms;
    
    // 按分类筛选
    if (activeCategory !== 'all') {
      filtered = filtered.filter(term => term.category === activeCategory);
    }
    
    // 按搜索关键词筛选
    if (searchKey.trim()) {
      const key = searchKey.toLowerCase().trim();
      filtered = filtered.filter(term => 
        term.name.toLowerCase().includes(key) ||
        term.english.toLowerCase().includes(key) ||
        term.brief.toLowerCase().includes(key) ||
        term.tags.some(tag => tag.toLowerCase().includes(key))
      );
    }
    
    this.setData({
      filteredTerms: filtered
    });
  },
  
  // 显示术语详情
  showTermDetail(e) {
    const termId = e.currentTarget.dataset.id;
    const term = this.data.terms.find(t => t.id === termId);
    
    if (term) {
      this.setData({
        showDetail: true,
        currentTerm: term
      });
    }
  },
  
  // 隐藏术语详情
  hideTermDetail() {
    this.setData({
      showDetail: false
    });
  },
  
  // 阻止冒泡
  preventBubble() {
    // 阻止事件冒泡
  },
  
  // 显示相关术语
  showRelatedTerm(e) {
    const termName = e.currentTarget.dataset.term;
    const term = this.data.terms.find(t => t.name === termName);
    
    if (term) {
      this.setData({
        currentTerm: term
      });
    }
  },
  
  // 分享
  onShareAppMessage() {
    return {
      title: this.t('encyclopediaTitle'),
      path: '/pages/encyclopedia/encyclopedia'
    };
  }
});
