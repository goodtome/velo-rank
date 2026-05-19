/**
 * 字符串格式化工具
 * 用于处理车手/车队名称显示格式
 */

/**
 * 将全大写或混合格式的名字转为首字母大写格式
 * 例如: "Andrea RACCAGNI NOVIERO" → "Andrea Raccagni Noviero"
 * @param {string} name - 原始名字
 * @returns {string} 格式化后的名字
 */
function toTitleCase(name) {
  if (!name || typeof name !== 'string') return name;

  return name
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * 格式化车手显示名称
 * 返回 {zh: 中文名, en: 格式化后的英文名}
 * @param {Object} rider - 车手对象
 * @returns {Object} {zh, en}
 */
function formatRiderName(rider) {
  if (!rider) return { zh: '', en: '' };

  const zh = rider.rider_name_zh || '';
  const en = toTitleCase(rider.rider_name || '');

  return { zh, en };
}

/**
 * 格式化车队显示名称
 * @param {Object} team - 车队对象
 * @returns {Object} {zh, en}
 */
function formatTeamName(team) {
  if (!team) return { zh: '', en: '' };

  const zh = team.team_name_zh || '';
  const en = toTitleCase(team.team_name || '');

  return { zh, en };
}

/**
 * 格式化赛事名称
 * @param {Object} race - 赛事对象
 * @returns {Object} {zh, en}
 */
function formatRaceName(race) {
  if (!race) return { zh: '', en: '' };

  const zh = race.race_name_zh || '';
  const en = toTitleCase(race.race_name || '');

  return { zh, en };
}

module.exports = {
  toTitleCase,
  formatRiderName,
  formatTeamName,
  formatRaceName
};
