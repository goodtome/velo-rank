/**
 * 领骑衫配置模块
 * 集中管理所有赛事的领骑衫类型、颜色、中文名
 * 
 * 支持的赛事：
 * - 环意 (Giro d'Italia): 粉衫/紫衫/蓝衫/白衫
 * - 环法 (Tour de France): 黄衫/绿衫/圆点衫/白衫
 * - 环西 (Vuelta a España): 红衫/绿衫/圆点衫/白衫
 */

// ============================================================
// 领骑衫类型定义（所有赛事通用）
// ============================================================

const JERSEY_CONFIG = {
  // --- 环意领骑衫 ---
  pink:        { nameZh: '粉衫',   sub: 'GC总成绩',    emoji: '🩷', gradient: ['#ff69b4', '#ff1493'], race: 'giro' },
  PINK:        { nameZh: '粉衫',   sub: 'GC总成绩',    emoji: '🩷', gradient: ['#ff69b4', '#ff1493'], race: 'giro' },
  purple:      { nameZh: '紫衫',   sub: '冲刺积分',    emoji: '🟣', gradient: ['#9b59b6', '#8e44ad'], race: 'giro' },
  PURPLE:      { nameZh: '紫衫',   sub: '冲刺积分',    emoji: '🟣', gradient: ['#9b59b6', '#8e44ad'], race: 'giro' },
  BLUE_SPRINT: { nameZh: '蓝衫',   sub: '冲刺积分',    emoji: '🔵', gradient: ['#3498db', '#2980b9'], race: 'giro' },
  blue:        { nameZh: '蓝衫',   sub: '爬坡积分',    emoji: '🔵', gradient: ['#3498db', '#2980b9'], race: 'giro' },
  BLUE:        { nameZh: '蓝衫',   sub: '爬坡积分',    emoji: '🔵', gradient: ['#3498db', '#2980b9'], race: 'giro' },

  // --- 环法令骑衫 ---
  yellow:      { nameZh: '黄衫',   sub: 'GC总成绩',    emoji: '🟡', gradient: ['#FFD700', '#FFC107'], race: 'tdf' },
  YELLOW:      { nameZh: '黄衫',   sub: 'GC总成绩',    emoji: '🟡', gradient: ['#FFD700', '#FFC107'], race: 'tdf' },
  green:       { nameZh: '绿衫',   sub: '冲刺积分',    emoji: '🟢', gradient: ['#4CAF50', '#2E7D32'], race: 'tdf' },
  GREEN:       { nameZh: '绿衫',   sub: '冲刺积分',    emoji: '🟢', gradient: ['#4CAF50', '#2E7D32'], race: 'tdf' },
  polka_dot:   { nameZh: '圆点衫', sub: '爬坡积分',    emoji: '🔴', gradient: ['#e74c3c', '#c0392b'], race: 'tdf' },
  POLKA_DOT:   { nameZh: '圆点衫', sub: '爬坡积分',    emoji: '🔴', gradient: ['#e74c3c', '#c0392b'], race: 'tdf' },
  POLKADOT:    { nameZh: '圆点衫', sub: '爬坡积分',    emoji: '🔴', gradient: ['#e74c3c', '#c0392b'], race: 'tdf' },

  // --- 环西领骑衫 ---
  red:         { nameZh: '红衫',   sub: 'GC总成绩',    emoji: '🔴', gradient: ['#e74c3c', '#c0392b'], race: 'vuelta' },
  RED:         { nameZh: '红衫',   sub: 'GC总成绩',    emoji: '🔴', gradient: ['#e74c3c', '#c0392b'], race: 'vuelta' },

  // --- 通用（白衫在三大环赛中都是青年车手） ---
  white:        { nameZh: '白衫',   sub: '青年车手',    emoji: '⚪', gradient: ['#ecf0f1', '#bdc3c7'], race: 'all' },
  WHITE:        { nameZh: '白衫',   sub: '青年车手',    emoji: '⚪', gradient: ['#ecf0f1', '#bdc3c7'], race: 'all' },
  WHITE_YOUTH:  { nameZh: '白衫',   sub: '青年车手',    emoji: '⚪', gradient: ['#ecf0f1', '#bdc3c7'], race: 'all' },
};

// ============================================================
// 按赛事分类的配置
// ============================================================

const RACE_JERSEY_MAP = {
  // 环意: 粉衫(GC) + 紫衫(冲刺) + 蓝衫(爬坡) + 白衫(青年)
  giro: {
    gc:        { type: 'pink',   classification: null },
    points:    { type: 'purple', classification: 'points' },
    mountains: { type: 'blue',   classification: 'mountains' },
    youth:     { type: 'white',  classification: 'youth' }
  },
  // 环法: 黄衫(GC) + 绿衫(冲刺) + 圆点衫(爬坡) + 白衫(青年)
  tdf: {
    gc:        { type: 'yellow',    classification: null },
    points:    { type: 'green',     classification: 'points' },
    mountains: { type: 'polka_dot', classification: 'mountains' },
    youth:     { type: 'white',     classification: 'youth' }
  },
  // 环西: 红衫(GC) + 绿衫(冲刺) + 圆点衫(爬坡) + 白衫(青年)
  vuelta: {
    gc:        { type: 'red',   classification: null },
    points:    { type: 'green', classification: 'points' },
    mountains: { type: 'polka_dot', classification: 'mountains' },
    youth:     { type: 'white', classification: 'youth' }
  }
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取领骑衫中文名称（含副标题）
 * 例如: "黄衫 GC" / "圆点衫 爬坡"
 * 
 * @param {string} type - jersey_type 字段值（如 'yellow', 'PINK', 'polka_dot'）
 * @returns {string} 中文名称
 */
function jerseyTypeName(type) {
  if (!type) return type || '';
  const config = JERSEY_CONFIG[type] || JERSEY_CONFIG[type.toLowerCase()];
  if (!config) return type;
  return `${config.nameZh} ${config.sub}`;
}

/**
 * 获取领骑衫简短中文名（不含副标题）
 * 例如: "黄衫" / "圆点衫"
 * 
 * @param {string} type - jersey_type 字段值
 * @returns {string} 简短中文名
 */
function jerseyNameShort(type) {
  if (!type) return '';
  const config = JERSEY_CONFIG[type] || JERSEY_CONFIG[type.toLowerCase()];
  return config ? config.nameZh : type;
}

/**
 * 获取领骑衫 emoji
 * 
 * @param {string} type - jersey_type 字段值
 * @returns {string} emoji
 */
function jerseyEmoji(type) {
  if (!type) return '🎽';
  const config = JERSEY_CONFIG[type] || JERSEY_CONFIG[type.toLowerCase()];
  return config ? config.emoji : '🎽';
}

/**
 * 根据 race_code 推断赛事类型
 * 
 * @param {string} raceCode - 如 'giro-ditalia-2026', 'tour-de-france-2026'
 * @returns {string} 'giro' | 'tdf' | 'vuelta' | 'unknown'
 */
function detectRaceType(raceCode) {
  if (!raceCode) return 'unknown';
  const code = raceCode.toLowerCase();
  if (code.includes('giro') || code.includes('italia')) return 'giro';
  if (code.includes('tour-de-france') || code.includes('tdf')) return 'tdf';
  if (code.includes('vuelta') || code.includes('españa') || code.includes('espana')) return 'vuelta';
  return 'unknown';
}

/**
 * 获取分类榜页面的显示配置
 * 
 * @param {string} classificationType - 'points' | 'mountains' | 'youth'
 * @param {string} raceType - 'giro' | 'tdf' | 'vuelta' | 'unknown'
 * @returns {Object} { typeName, typeSub, typeIcon, headerClass }
 */
function getClassificationConfig(classificationType, raceType) {
  const raceKey = (raceType && RACE_JERSEY_MAP[raceType]) ? raceType : 'giro';
  const jerseyInfo = RACE_JERSEY_MAP[raceKey]?.[classificationType];
  const jerseyType = jerseyInfo?.type || classificationType;
  const config = JERSEY_CONFIG[jerseyType] || JERSEY_CONFIG[jerseyType.toLowerCase()];

  if (config) {
    return {
      typeName: `${config.nameZh}${config.sub}`,
      typeSub: classificationType.charAt(0).toUpperCase() + classificationType.slice(1) + ' Classification',
      typeIcon: config.emoji,
      headerClass: `class-${classificationType} class-race-${raceKey}`
    };
  }

  // fallback
  const defaults = {
    points:    { typeName: '冲刺积分榜', typeSub: 'Points Classification', typeIcon: '🟣' },
    mountains: { typeName: '爬坡积分榜', typeSub: 'Mountains Classification', typeIcon: '🔵' },
    youth:     { typeName: '青年车手榜', typeSub: 'Youth Classification', typeIcon: '⚪' }
  };
  return { ...defaults[classificationType], headerClass: `class-${classificationType}` };
}


module.exports = {
  JERSEY_CONFIG,
  RACE_JERSEY_MAP,
  jerseyTypeName,
  jerseyNameShort,
  jerseyEmoji,
  detectRaceType,
  getClassificationConfig
};
