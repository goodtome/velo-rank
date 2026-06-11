const STAGE_TYPE_CONFIG = {
  flat: {
    label: '平路',
    fullLabel: '平路赛段',
    weight: 0,
    color: 'green',
    terrainHeavy: false,
    order: 10
  },
  hills: {
    label: '丘陵',
    fullLabel: '丘陵赛段',
    weight: 6,
    color: 'orange',
    terrainHeavy: true,
    order: 20
  },
  mountain: {
    label: '山地',
    fullLabel: '山地赛段',
    weight: 12,
    color: 'red',
    terrainHeavy: true,
    order: 30
  },
  itt: {
    label: '个人计时',
    fullLabel: '个人计时赛',
    weight: 4,
    color: 'purple',
    terrainHeavy: false,
    order: 40
  },
  ttt: {
    label: '团队计时',
    fullLabel: '团队计时赛',
    weight: 5,
    color: 'blue',
    terrainHeavy: false,
    order: 50
  },
  prologue: {
    label: '序章',
    fullLabel: '序章赛',
    weight: 3,
    color: 'purple',
    terrainHeavy: false,
    order: 5
  },
  stage: {
    label: '普通赛段',
    fullLabel: '普通赛段',
    weight: 2,
    color: 'green',
    terrainHeavy: false,
    order: 60
  },
  unknown: {
    label: '未知',
    fullLabel: '未知赛段',
    weight: 2,
    color: 'green',
    terrainHeavy: false,
    order: 999
  }
};

const STAGE_TYPE_ALIASES = {
  flat: 'flat',
  flats: 'flat',
  sprinter: 'flat',
  sprint: 'flat',
  plain: 'flat',
  平路: 'flat',

  hill: 'hills',
  hills: 'hills',
  hilly: 'hills',
  mediummountain: 'hills',
  medium_mountain: 'hills',
  rolling: 'hills',
  丘陵: 'hills',

  mountain: 'mountain',
  mountains: 'mountain',
  mountainous: 'mountain',
  highmountain: 'mountain',
  high_mountain: 'mountain',
  山地: 'mountain',

  itt: 'itt',
  individualtimetrial: 'itt',
  individual_time_trial: 'itt',
  timetrial: 'itt',
  time_trial: 'itt',
  tt: 'itt',
  个人计时: 'itt',

  ttt: 'ttt',
  teamtimetrial: 'ttt',
  team_time_trial: 'ttt',
  团队计时: 'ttt',
  团体计时: 'ttt',

  prologue: 'prologue',
  prolog: 'prologue',
  序章: 'prologue',

  stage: 'stage',
  roadstage: 'stage',
  road_stage: 'stage',
  normalstage: 'stage',
  normal_stage: 'stage',
  普通赛段: 'stage'
};

function normalizeStageType(type) {
  const raw = String(type || '').trim();
  if (!raw) return 'unknown';

  const compact = raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const noSeparator = compact.replace(/_/g, '');

  return STAGE_TYPE_ALIASES[compact] || STAGE_TYPE_ALIASES[noSeparator] || 'unknown';
}

function getStageTypeConfig(type) {
  return STAGE_TYPE_CONFIG[normalizeStageType(type)] || STAGE_TYPE_CONFIG.unknown;
}

function stageTypeName(type) {
  return getStageTypeConfig(type).label;
}

function stageTypeFullName(type) {
  return getStageTypeConfig(type).fullLabel;
}

function stageTypeWeight(type) {
  return getStageTypeConfig(type).weight;
}

function stageTypeColor(type) {
  return getStageTypeConfig(type).color;
}

function isTerrainHeavyStageType(type) {
  return getStageTypeConfig(type).terrainHeavy;
}

function compareStageTypes(a, b) {
  const aConfig = getStageTypeConfig(a);
  const bConfig = getStageTypeConfig(b);
  if (aConfig.order !== bConfig.order) return aConfig.order - bConfig.order;
  return String(a || '').localeCompare(String(b || ''));
}

module.exports = {
  normalizeStageType,
  stageTypeName,
  stageTypeFullName,
  stageTypeWeight,
  stageTypeColor,
  isTerrainHeavyStageType,
  compareStageTypes
};
