/**
 * 国家代码映射表
 * 将3字母国家代码映射为中文国家名
 * 覆盖自行车赛事主要参与国家
 */

const COUNTRY_MAP = {
  // 欧洲主要国家
  'ALB': '阿尔巴尼亚',
  'AUT': '奥地利',
  'BEL': '比利时',
  'BIH': '波黑',
  'BLR': '白俄罗斯',
  'BUL': '保加利亚',
  'CRO': '克罗地亚',
  'CZE': '捷克',
  'DEN': '丹麦',
  'ESP': '西班牙',
  'EST': '爱沙尼亚',
  'FIN': '芬兰',
  'FRA': '法国',
  'GBR': '英国',
  'GER': '德国',
  'GRE': '希腊',
  'HUN': '匈牙利',
  'IRL': '爱尔兰',
  'ISL': '冰岛',
  'ITA': '意大利',
  'LAT': '拉脱维亚',
  'LIE': '列支敦士登',
  'LTU': '立陶宛',
  'LUX': '卢森堡',
  'MLT': '马耳他',
  'MNE': '黑山',
  'NED': '荷兰',
  'NOR': '挪威',
  'POL': '波兰',
  'POR': '葡萄牙',
  'ROU': '罗马尼亚',
  'RUS': '俄罗斯',
  'SRB': '塞尔维亚',
  'SLO': '斯洛文尼亚',
  'SVK': '斯洛伐克',
  'SUI': '瑞士',
  'SWE': '瑞典',
  'TUR': '土耳其',
  'UKR': '乌克兰',

  // 美洲
  'ARG': '阿根廷',
  'BRA': '巴西',
  'CAN': '加拿大',
  'CHI': '智利',
  'COL': '哥伦比亚',
  'CRC': '哥斯达黎加',
  'ECU': '厄瓜多尔',
  'MEX': '墨西哥',
  'PAN': '巴拿马',
  'USA': '美国',
  'VEN': '委内瑞拉',

  // 亚洲
  'AFG': '阿富汗',
  'CHN': '中国',
  'HKG': '中国香港',
  'INA': '印度尼西亚',
  'IND': '印度',
  'IRI': '伊朗',
  'JPN': '日本',
  'KAZ': '哈萨克斯坦',
  'KOR': '韩国',
  'KGZ': '吉尔吉斯斯坦',
  'LIB': '黎巴嫩',
  'MAS': '马来西亚',
  'MGL': '蒙古',
  'NEP': '尼泊尔',
  'PAK': '巴基斯坦',
  'PHI': '菲律宾',
  'QAT': '卡塔尔',
  'SIN': '新加坡',
  'SRI': '斯里兰卡',
  'SYR': '叙利亚',
  'TPE': '中国台湾',
  'THA': '泰国',
  'TKM': '土库曼斯坦',
  'UAE': '阿联酋',
  'UZB': '乌兹别克斯坦',
  'VIE': '越南',

  // 大洋洲
  'AUS': '澳大利亚',
  'NZL': '新西兰',

  // 非洲
  'ALG': '阿尔及利亚',
  'ERI': '厄立特里亚',
  'ETH': '埃塞俄比亚',
  'MAR': '摩洛哥',
  'NAM': '纳米比亚',
  'RSA': '南非',
  'TUN': '突尼斯',
  'UGA': '乌干达',

  // 特殊代码
  'UNK': '未知',
  'N/A': '未知',
  '': '未知',
};

/**
 * 获取国家中文名
 * @param {string} code - 3字母国家代码
 * @returns {string} 中文国家名，未知返回原始代码
 */
function getCountryName(code) {
  if (!code) return '未知';
  const upperCode = String(code).toUpperCase().trim();
  return COUNTRY_MAP[upperCode] || upperCode;
}

/**
 * 获取国家中文名（带国旗emoji）
 * @param {string} code - 3字母国家代码
 * @returns {string} 国旗emoji + 中文国家名
 */
function getCountryNameWithFlag(code) {
  const name = getCountryName(code);
  // 注意：国旗emoji需要根据两个字母代码生成，这里简单返回中文名
  return name;
}

module.exports = {
  COUNTRY_MAP,
  getCountryName,
  getCountryNameWithFlag
};
