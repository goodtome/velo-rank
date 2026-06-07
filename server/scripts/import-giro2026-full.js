#!/usr/bin/env node
/**
 * 环意 2026 全量数据导入脚本
 * 
 * 从缓存的 PCS HTML 文件中解析并导入所有数据：
 * - 赛事记录 (races)
 * - 21 个赛段 (stages)
 * - 所有车手 (riders)
 * - 所有车队 (teams)
 * - 赛段成绩 (stage_results)
 * - GC 总成绩 (general_classification)
 * - 冲刺积分 (points_classification)
 * - 爬坡积分 (mountains_classification)
 * - 青年排名 (youth_classification)
 * - 车队排名 (team_classification)
 * - 领骑衫 (jerseys)
 * 
 * 使用方式：
 *   cd D:\codes\velo-rank
 *   node server/scripts/import-giro2026-full.js
 */

const mysql = require('mysql2/promise');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const dbConfig = require('../config/database');

// ============================================================
// 环意 2026 赛事配置
// ============================================================

const RACE = {
  race_name: '环意自行车赛 2026',
  race_name_en: 'Giro d\'Italia 2026',
  race_code: 'giro-ditalia-2026',
  category: 'GRAND_TOUR',
  gender: 'MEN',
  season: 2026,
  country: 'Italy',
  start_date: '2026-05-08',
  end_date: '2026-05-31',
  total_stages: 21,
  total_distance: 3459.0,
  official_url: 'https://www.giroditalia.it'
};

const STAGES = [
  { number: 1,  date: '2026-05-08', start: 'Nessebar',            finish: 'Burgas',               km: 147,  type: 'FLAT',       name_zh: '内塞伯尔 → 布尔加斯' },
  { number: 2,  date: '2026-05-09', start: 'Burgas',              finish: 'Veliko Tarnovo',       km: 221,  type: 'HILLS',      name_zh: '布尔加斯 → 大特尔诺沃' },
  { number: 3,  date: '2026-05-10', start: 'Plovdiv',             finish: 'Sofia',                km: 175,  type: 'FLAT',       name_zh: '普罗夫迪夫 → 索非亚' },
  // 5/11 休息日 + 转场（保加利亚 → 意大利）
  { number: 4,  date: '2026-05-12', start: 'Catanzaro',           finish: 'Cosenza',              km: 138,  type: 'FLAT',       name_zh: '卡坦扎罗 → 科森扎' },
  { number: 5,  date: '2026-05-13', start: 'Praia a Mare',        finish: 'Potenza',              km: 203,  type: 'HILLS',      name_zh: '普拉亚阿马雷 → 波坦察' },
  { number: 6,  date: '2026-05-14', start: 'Paestum',             finish: 'Naples',               km: 142,  type: 'FLAT',       name_zh: '帕埃斯图姆 → 那不勒斯' },
  { number: 7,  date: '2026-05-15', start: 'Formia',              finish: 'Blockhaus',            km: 244,  type: 'MOUNTAIN',   name_zh: '福尔米亚 → 布洛克豪斯' },
  { number: 8,  date: '2026-05-16', start: 'Chieti',              finish: 'Fermo',                km: 156,  type: 'HILLS',      name_zh: '基耶蒂 → 费尔莫' },
  { number: 9,  date: '2026-05-17', start: 'Cervia',              finish: 'Corno alle Scale',     km: 184,  type: 'MOUNTAIN',   name_zh: '切尔维亚 → 科尔诺阿莱斯卡莱' },
  // 5/18 休息日
  { number: 10, date: '2026-05-19', start: 'Viareggio',           finish: 'Massa',                km: 42,   type: 'ITT',        name_zh: '维亚雷焦 → 马萨（个人计时）' },
  { number: 11, date: '2026-05-20', start: 'Porcari',             finish: 'Chiavari',             km: 195,  type: 'HILLS',      name_zh: '波尔卡里 → 基亚瓦里' },
  { number: 12, date: '2026-05-21', start: 'Imperia',             finish: 'Novi Ligure',          km: 175,  type: 'FLAT',       name_zh: '因佩里亚 → 诺维利古雷' },
  { number: 13, date: '2026-05-22', start: 'Alessandria',         finish: 'Verbania',             km: 189,  type: 'HILLS',      name_zh: '亚历山德里亚 → 韦尔巴尼亚' },
  { number: 14, date: '2026-05-23', start: 'Aosta',               finish: 'Pila',                 km: 133,  type: 'MOUNTAIN',   name_zh: '奥斯塔 → 皮拉' },
  // 5/24 照常比赛，5/25 休息日
  { number: 15, date: '2026-05-24', start: 'Voghera',             finish: 'Milan',                km: 157,  type: 'FLAT',       name_zh: '沃盖拉 → 米兰' },
  { number: 16, date: '2026-05-26', start: 'Bellinzona',          finish: 'Carì',                 km: 113,  type: 'MOUNTAIN',   name_zh: '贝林佐纳 → 卡里' },
  { number: 17, date: '2026-05-27', start: 'Cassano d\'Adda',     finish: 'Andalo',               km: 202,  type: 'MOUNTAIN',   name_zh: '阿达河畔卡萨诺 → 安达洛' },
  { number: 18, date: '2026-05-28', start: 'Fai della Paganella', finish: 'Pieve di Soligo',      km: 171,  type: 'FLAT',       name_zh: '法伊德拉帕加内拉 → 皮耶韦迪索利戈' },
  { number: 19, date: '2026-05-29', start: 'Feltre',              finish: 'Alleghe',              km: 151,  type: 'MOUNTAIN',   name_zh: '费尔特雷 → 阿莱盖（皇后赛段）' },
  { number: 20, date: '2026-05-30', start: 'Gemona del Friuli',   finish: 'Piancavallo',          km: 200,  type: 'MOUNTAIN',   name_zh: '杰莫纳德尔弗留利 → 皮安卡瓦洛' },
  { number: 21, date: '2026-05-31', start: 'Rome',                finish: 'Rome',                 km: 131,  type: 'FLAT',       name_zh: '罗马 → 罗马' }
];

// 环意领骑衫类型
const JERSEY_TYPES = {
  PINK:   { name_zh: '粉衫（总成绩）',   classification: 'gc' },
  PURPLE: { name_zh: '紫衫（冲刺积分）', classification: 'points' },
  BLUE:   { name_zh: '蓝衫（爬坡积分）', classification: 'mountains' },
  WHITE:  { name_zh: '白衫（青年排名）', classification: 'youth' }
};

// HTML 文件目录
const HTML_DIR = path.join(__dirname, 'pcs_html');

// ============================================================
// HTML 解析工具
// ============================================================

/**
 * 修复 PCS 时间解析问题
 * 
 * 处理以下 PCS HTML 解析异常：
 *   - 时间重复: "3:21:083:21:08" → "3:21:08"
 *   - 带空格重复: "27:01:39 27:01:39" → "27:01:39"
 *   - * 前缀标记: "*0:570:57" → "0:57"
 *   - ,, 代替 + 号: ",,0:57" → "+0:57", ",," → "+0:00"
 *   - *,, 组合: "*,,0:57" → "+0:57"
 */
function fixDuplicatedTime(str) {
  if (!str) return null;
  str = str.trim();
  if (!str || str === '..' || str === '-' || str === 'DNF' || str === 'DNS' || str === 'OTL' || str === 'DSQ') return str;

  // 1. Strip * prefix (PCS HTML visual marker, not real data)
  if (str.startsWith('*')) str = str.slice(1);

  // 2. Fix ",," → "+": ",,X:XX" → "+X:XX", ",," → "+0:00"
  if (str.startsWith(',,')) {
    const rest = str.slice(2);
    return '+' + (rest || '0:00');
  }

  // 3. Detect duplication (even length, first half == second half): "3:21:083:21:08" → "3:21:08"
  if (str.length > 2 && str.length % 2 === 0) {
    const half = str.length / 2;
    if (str.substring(0, half) === str.substring(half)) {
      return str.substring(0, half);
    }
  }

  // 4. Detect duplication with space: "27:01:39 27:01:39" → "27:01:39"
  const spaceMatch = str.match(/^(.+?)\s+\1$/);
  if (spaceMatch) return spaceMatch[1];

  return str;
}

/**
 * 规范化 time_gap 值：确保非特殊状态的时间差有 + 前缀
 * "0:57" → "+0:57", "+0:57" → "+0:57", "DNF" → "DNF"
 */
function normalizeTimeGap(val) {
  if (!val) return val;
  if (['DNF', 'DNS', 'OTL', 'DSQ', 's.t.'].includes(val)) return val;
  if (val.startsWith('+')) return val;
  return '+' + val;
}

/**
 * 从 td cell 中提取车手信息（名字 + slug）
 * PCS 格式：<td><a href="rider/paul-magnier">Magnier Paul</a>Soudal Quick-Step</td>
 */
function extractRiderInfo($cell) {
  const link = $cell.find('a[href^="rider/"]').first();
  if (!link.length) return null;

  const slug = link.attr('href').replace('rider/', '');
  const name = link.text().trim();
  if (!name) return null;

  // 转换 "Magnier Paul" → "Paul Magnier" (PCS 是 Last First 格式)
  const parts = name.split(' ');
  const displayName = parts.length >= 2
    ? parts.slice(1).join(' ') + ' ' + parts[0]
    : name;

  return { name: displayName, slug, nameRaw: name };
}

/**
 * 从 td cell 中提取车队信息
 */
function extractTeamInfo($cell) {
  const link = $cell.find('a[href^="team/"]').first();
  if (!link.length) return null;

  const slug = link.attr('href').replace('team/', '').replace(/-20\d{2}$/, '');
  const name = link.text().trim();
  return { name, slug };
}

/**
 * 识别表格类型（兼容有/无 Prev/▼▲ 列的两种格式）
 */
function identifyTableType($, $table) {
  const headers = [];
  $table.find('tr').first().find('th, td').each((_, cell) => {
    headers.push($(cell).text().trim());
  });
  const headerStr = headers.join('|');
  const rowCount = $table.find('tr').length;
  const hasPrev = headers.includes('Prev') || headers.includes('▼▲');

  // Stage results: 有 GC + UCI + Pnt 列，列数 >= 12
  if (headerStr.includes('GC') && headerStr.includes('UCI') && headerStr.includes('Pnt')) {
    if (rowCount <= 2) return 'skip'; // 只有表头，无数据
    return 'stage_results';
  }

  // GC: 有 UCI + Time won/lost，无 Pnt，无 Class，行数 >= 50
  if (headerStr.includes('UCI') && headerStr.includes('Time won/lost') && !headerStr.includes('Pnt') && !headerStr.includes('Class')) {
    if (rowCount <= 2) return 'skip';
    if (hasPrev) return 'gc_dup'; // 有 Prev 列的版本，跳过（保留无 Prev 的版本）
    return 'gc';
  }

  // Youth: 无 UCI，有 Time won/lost，无 Pnt，无 Class，行数 10-60
  if (!headerStr.includes('UCI') && headerStr.includes('Time won/lost') && !headerStr.includes('Pnt') && !headerStr.includes('Class')) {
    if (rowCount <= 2) return 'skip';
    if (rowCount >= 10 && rowCount <= 60) {
      if (hasPrev) return 'youth_dup';
      return 'youth';
    }
    // 行数多的可能是 GC（无 UCI 列的变体）
    if (rowCount >= 50) {
      if (hasPrev) return 'gc_dup';
      return 'gc';
    }
    return 'skip';
  }

  // Points: 有 Pnt + Today，无 Bonis（不论有无 Prev 列，取最大的表格）
  if (headerStr.includes('Pnt') && headerStr.includes('Today') && !headerStr.includes('Bonis')) {
    if (rowCount >= 10) return 'points';
    return 'mountains_alt'; // 小表格可能是中间冲刺
  }

  // Mountains: 有 Pnt + Bonis，行数 >= 4
  if (headerStr.includes('Pnt') && headerStr.includes('Bonis')) {
    if (rowCount <= 2) return 'skip';
    return 'mountains';
  }

  // Team classification: 有 Class + Time won/lost
  if (headerStr.includes('Class') && headerStr.includes('Time won/lost')) {
    if (rowCount <= 2) return 'skip';
    if (hasPrev) return 'team_dup';
    return 'team_classification';
  }

  return 'unknown';
}

/**
 * 解析一个表格的所有数据行
 */
function parseTableRows($, $table) {
  const rows = [];
  $table.find('tr').slice(1).each((_, tr) => {
    const cells = [];
    $(tr).find('td').each((__, td) => {
      cells.push($(td));
    });
    if (cells.length > 0) rows.push(cells);
  });
  return rows;
}

// ============================================================
// 数据库操作
// ============================================================

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig.development);
    console.log('🚴 环意 2026 全量数据导入');
    console.log('='.repeat(60));

    // 车手和车队缓存（name → id）
    const riderMap = new Map(); // slug → id
    const teamMap = new Map();  // slug → id

    // -------- 1. 创建赛事 --------
    console.log('\n📋 步骤 1: 创建赛事记录...');
    let [existingRaces] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE.race_code]);
    let raceId;
    if (existingRaces.length > 0) {
      raceId = existingRaces[0].id;
      await conn.query(`UPDATE races SET race_name=?, race_name_en=?, race_name_zh=?, category=?, gender=?, season=?, country=?, start_date=?, end_date=?, total_stages=?, total_distance=?, official_url=? WHERE id=?`, [
        RACE.race_name, RACE.race_name_en, '环意自行车赛', RACE.category, RACE.gender, RACE.season, RACE.country, RACE.start_date, RACE.end_date, RACE.total_stages, RACE.total_distance, RACE.official_url, raceId
      ]);
      console.log(`  ✅ 赛事已更新: ${RACE.race_name_en} (${raceId})`);
    } else {
      raceId = uuidv4();
      await conn.query(`INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, gender, season, country, start_date, end_date, total_stages, total_distance, official_url, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,true)`, [
        raceId, RACE.race_name, RACE.race_name_en, '环意自行车赛', RACE.race_code, RACE.category, RACE.gender, RACE.season, RACE.country, RACE.start_date, RACE.end_date, RACE.total_stages, RACE.total_distance, RACE.official_url
      ]);
      console.log(`  ✅ 赛事已创建: ${RACE.race_name_en} (${raceId})`);
    }

    // -------- 2. 创建赛段 --------
    console.log('\n📋 步骤 2: 创建赛段记录...');
    const stageIdMap = {}; // stageNumber → stageId

    for (const stage of STAGES) {
      const stageCode = `giro-ditalia-2026-s${String(stage.number).padStart(2, '0')}`;
      const stageName = `${stage.start} → ${stage.finish}`;

      const [existing] = await conn.query('SELECT id FROM stages WHERE race_id = ? AND stage_number = ?', [raceId, stage.number]);
      let stageId;
      if (existing.length > 0) {
        stageId = existing[0].id;
        await conn.query(`UPDATE stages SET stage_name=?, stage_name_zh=?, stage_type=?, date=?, distance_km=?, start_city=?, finish_city=? WHERE id=?`, [
          stageName, stage.name_zh, stage.type, stage.date, stage.km, stage.start, stage.finish, stageId
        ]);
      } else {
        stageId = uuidv4();
        await conn.query(`INSERT INTO stages (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date, distance_km, start_city, finish_city, stage_code) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
          stageId, raceId, stage.number, stageName, stage.name_zh, stage.type, stage.date, stage.km, stage.start, stage.finish, stageCode
        ]);
      }
      stageIdMap[stage.number] = stageId;
    }
    console.log(`  ✅ 21 个赛段已创建`);

    // -------- 3. 解析 HTML 并导入数据 --------
    console.log('\n📋 步骤 3: 解析 PCS HTML 并导入数据...');

    let totalResults = 0, totalGC = 0, totalPoints = 0, totalMountains = 0;
    let totalYouth = 0, totalTeamClass = 0, totalJerseys = 0;

    for (let stageNum = 1; stageNum <= 21; stageNum++) {
      const htmlFile = path.join(HTML_DIR, `giro_s${stageNum}.html`);
      if (!fs.existsSync(htmlFile)) {
        console.log(`  ⚠️ Stage ${stageNum}: HTML 文件不存在，跳过`);
        continue;
      }

      const stageId = stageIdMap[stageNum];
      const html = fs.readFileSync(htmlFile, 'utf8');
      const $ = cheerio.load(html);

      console.log(`\n  --- Stage ${stageNum} ---`);

      // 识别所有表格
      const tableData = [];
      $('table').each((tableIdx, table) => {
        const $table = $(table);
        const type = identifyTableType($, $table);
        if (type !== 'unknown' && type !== 'skip' && !type.endsWith('_dup')) {
          tableData.push({ $table, type, tableIdx });
        }
      });

      // 如果有多个 mountains 表格，取行数最多的
      const mountainsTables = tableData.filter(t => t.type === 'mountains');
      if (mountainsTables.length > 1) {
        let best = mountainsTables[0];
        for (const mt of mountainsTables) {
          if (mt.$table.find('tr').length > best.$table.find('tr').length) best = mt;
        }
        // 标记其他 mountains 为 mountains_alt（忽略）
        for (const mt of mountainsTables) {
          if (mt !== best) mt.type = 'mountains_alt_skip';
        }
      }

      // 如果有多个 points 表格，取行数最多的（兼容有/无 Prev 列）
      const pointsTables = tableData.filter(t => t.type === 'points');
      if (pointsTables.length > 1) {
        let best = pointsTables[0];
        for (const pt of pointsTables) {
          if (pt.$table.find('tr').length > best.$table.find('tr').length) best = pt;
        }
        for (const pt of pointsTables) {
          if (pt !== best) pt.type = 'points_alt_skip';
        }
      }

      for (const td of tableData) {
        if (td.type === 'mountains_alt_skip' || td.type === 'points_alt_skip') continue;

        const rows = parseTableRows($, td.$table);

        // ---- Stage Results (+ extract GC from same table) ----
        if (td.type === 'stage_results') {
          await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
          await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);
          let countResults = 0, countGC = 0;

          // 先获取表头，找到 GC 列和 Time 列的位置
          const headerCells = [];
          td.$table.find('tr').first().find('th, td').each((_, cell) => {
            headerCells.push($(cell).text().trim());
          });
          const gcColIdx = headerCells.indexOf('GC');
          const timelagColIdx = headerCells.indexOf('Timelag');
          const timeColIdx = headerCells.length - 1; // Time 是最后一列

          for (const cells of rows) {
            if (cells.length < 10) continue;
            const stageRank = parseInt(cells[0].text().trim());
            if (isNaN(stageRank)) continue;

            // 动态查找车手和车队列
            let rider = null, team = null, riderIdx = -1, teamIdx = -1;
            for (let ci = 0; ci < cells.length; ci++) {
              if (!rider) {
                const r = extractRiderInfo(cells[ci]);
                if (r) { rider = r; riderIdx = ci; }
              }
              if (!team && ci > (riderIdx > 0 ? riderIdx - 1 : 0)) {
                const t = extractTeamInfo(cells[ci]);
                if (t) { team = t; teamIdx = ci; }
              }
            }
            if (!rider || !team) continue;

            // 时间差：最后一列（规范化为 +X:XX 格式）
            const timeGap = normalizeTimeGap(fixDuplicatedTime(cells[cells.length - 1].text())) || null;

            // 国籍
            let natCode = '';
            for (let ci = 0; ci < cells.length; ci++) {
              const flagClass = cells[ci].find('span.flag, span[class*="flag"]').attr('class') || '';
              const natMatch = flagClass.match(/flag\s+(\w{2})/i) || flagClass.match(/fi\s+(\w{2})/i);
              if (natMatch) { natCode = natMatch[1].toUpperCase(); break; }
            }

            const riderId = await ensureRider(conn, riderMap, rider);
            const teamId = await ensureTeam(conn, teamMap, team);

            // 1. 导入赛段成绩
            await conn.query(
              `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap) 
               VALUES (?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id), time_gap=VALUES(time_gap)`,
              [uuidv4(), stageId, stageRank, riderId, teamId, natCode, timeGap]
            );
            countResults++;

            // 2. 从同一行提取 GC 数据
            if (gcColIdx >= 0 && gcColIdx < cells.length) {
              const gcRank = parseInt(cells[gcColIdx].text().trim());
              if (!isNaN(gcRank) && gcRank > 0) {
                const gcTimeGap = (timelagColIdx >= 0 && timelagColIdx < cells.length)
                  ? fixDuplicatedTime(cells[timelagColIdx].text()) || null
                  : null;
                const totalTime = (timeColIdx >= 0 && timeColIdx < cells.length)
                  ? fixDuplicatedTime(cells[timeColIdx].text()) || null
                  : null;

                await conn.query(
                  `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap) 
                   VALUES (?,?,?,?,?,?,?,?)
                   ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id), total_time=VALUES(total_time), time_gap=VALUES(time_gap)`,
                  [uuidv4(), stageId, gcRank, riderId, teamId, natCode, totalTime, gcTimeGap]
                );
                countGC++;
              }
            }
          }
          totalResults += countResults;
          totalGC += countGC;

          // 生成粉衫
          if (countGC > 0) {
            const gcFirst = await conn.query(
              'SELECT gc.rider_id, gc.team_id FROM general_classification gc WHERE gc.stage_id = ? AND gc.`rank` = 1', [stageId]
            );
            if (gcFirst[0].length > 0) {
              await upsertJersey(conn, stageId, 'PINK', gcFirst[0][0].rider_id, gcFirst[0][0].team_id);
              totalJerseys++;
            }
          }

          console.log(`    成绩: ${countResults} 条, GC: ${countGC} 条`);
        }

        // ---- Points Classification ----
        else if (td.type === 'points') {
          await conn.query('DELETE FROM points_classification WHERE stage_id = ?', [stageId]);
          let count = 0;
          for (const cells of rows) {
            if (cells.length < 8) continue;
            const rank = parseInt(cells[0].text().trim());
            if (isNaN(rank)) continue;

            let rider = null, team = null;
            for (const cell of cells) {
              const r = extractRiderInfo(cell);
              if (r && !rider) rider = r;
              const t = extractTeamInfo(cell);
              if (t && !team) team = t;
            }
            if (!rider) continue;

            // 积分在最后两列（Pnt + Today），取 Pnt 列（倒数第二）
            const ptsText = cells[cells.length - 2].text().trim();
            const points = parseInt(ptsText) || 0;

            const riderId = await ensureRider(conn, riderMap, rider);

            await conn.query(
              `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type) 
               VALUES (?,?,?,?,?)
               ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
              [stageId, riderId, rank, points, 'PURPLE']
            );
            count++;
          }
          totalPoints += count;

          // 生成紫衫
          if (count > 0) {
            const ptsFirst = await conn.query(
              'SELECT rider_id FROM points_classification WHERE stage_id = ? AND `rank` = 1', [stageId]
            );
            if (ptsFirst[0].length > 0) {
              // 需要 team_id
              const riderId = ptsFirst[0][0].rider_id;
              const teamRes = await conn.query(
                'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [riderId, stageId]
              );
              const teamId = teamRes[0].length > 0 ? teamRes[0][0].team_id : riderId;
              await upsertJersey(conn, stageId, 'PURPLE', riderId, teamId);
              totalJerseys++;
            }
          }
          console.log(`    积分: ${count} 条`);
        }

        // ---- Mountains Classification ----
        else if (td.type === 'mountains') {
          await conn.query('DELETE FROM mountains_classification WHERE stage_id = ?', [stageId]);
          let count = 0;
          for (const cells of rows) {
            if (cells.length < 8) continue;
            const rank = parseInt(cells[0].text().trim());
            if (isNaN(rank)) continue;

            let rider = null;
            for (const cell of cells) {
              const r = extractRiderInfo(cell);
              if (r && !rider) rider = r;
            }
            if (!rider) continue;

            const ptsText = cells[cells.length - 2].text().trim();
            const points = parseInt(ptsText) || 0;

            const riderId = await ensureRider(conn, riderMap, rider);

            await conn.query(
              `INSERT INTO mountains_classification (stage_id, rider_id, \`rank\`, points, jersey_type) 
               VALUES (?,?,?,?,?)
               ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
              [stageId, riderId, rank, points, 'BLUE']
            );
            count++;
          }
          totalMountains += count;

          // 生成蓝衫
          if (count > 0) {
            const mtnFirst = await conn.query(
              'SELECT rider_id FROM mountains_classification WHERE stage_id = ? AND `rank` = 1', [stageId]
            );
            if (mtnFirst[0].length > 0) {
              const riderId = mtnFirst[0][0].rider_id;
              const teamRes = await conn.query(
                'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [riderId, stageId]
              );
              const teamId = teamRes[0].length > 0 ? teamRes[0][0].team_id : riderId;
              await upsertJersey(conn, stageId, 'BLUE', riderId, teamId);
              totalJerseys++;
            }
          }
          console.log(`    爬坡: ${count} 条`);
        }

        // ---- Youth Classification ----
        else if (td.type === 'youth') {
          await conn.query('DELETE FROM youth_classification WHERE stage_id = ?', [stageId]);
          let count = 0;
          for (const cells of rows) {
            if (cells.length < 8) continue;
            const rank = parseInt(cells[0].text().trim());
            if (isNaN(rank)) continue;

            let rider = null;
            for (const cell of cells) {
              const r = extractRiderInfo(cell);
              if (r && !rider) rider = r;
            }
            if (!rider) continue;

            const lastCells = cells.slice(-2);
            const time = fixDuplicatedTime(lastCells[0].text());
            const timeGap = fixDuplicatedTime(lastCells[1].text()) || null;

            const riderId = await ensureRider(conn, riderMap, rider);

            await conn.query(
              `INSERT INTO youth_classification (stage_id, rider_id, \`rank\`, time, time_gap, jersey_type) 
               VALUES (?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), time=VALUES(time), time_gap=VALUES(time_gap)`,
              [stageId, riderId, rank, time, timeGap, 'WHITE']
            );
            count++;
          }
          totalYouth += count;

          // 生成白衫
          if (count > 0) {
            const youthFirst = await conn.query(
              'SELECT rider_id FROM youth_classification WHERE stage_id = ? AND `rank` = 1', [stageId]
            );
            if (youthFirst[0].length > 0) {
              const riderId = youthFirst[0][0].rider_id;
              const teamRes = await conn.query(
                'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [riderId, stageId]
              );
              const teamId = teamRes[0].length > 0 ? teamRes[0][0].team_id : riderId;
              await upsertJersey(conn, stageId, 'WHITE', riderId, teamId);
              totalJerseys++;
            }
          }
          console.log(`    青年: ${count} 条`);
        }

        // ---- Team Classification ----
        else if (td.type === 'team_classification') {
          await conn.query('DELETE FROM team_classification WHERE stage_id = ?', [stageId]);
          let count = 0;
          for (const cells of rows) {
            if (cells.length < 5) continue;
            const rank = parseInt(cells[0].text().trim());
            if (isNaN(rank)) continue;

            let team = null;
            for (const cell of cells) {
              const t = extractTeamInfo(cell);
              if (t && !team) team = t;
            }
            if (!team) continue;

            const lastCells = cells.slice(-2);
            const totalTime = fixDuplicatedTime(lastCells[0].text());
            const timeGap = fixDuplicatedTime(lastCells[1].text()) || null;

            const teamId = await ensureTeam(conn, teamMap, team);

            await conn.query(
              `INSERT INTO team_classification (id, stage_id, \`rank\`, team_id, total_time, time_gap) 
               VALUES (?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE team_id=VALUES(team_id), total_time=VALUES(total_time), time_gap=VALUES(time_gap)`,
              [uuidv4(), stageId, rank, teamId, totalTime, timeGap]
            );
            count++;
          }
          totalTeamClass += count;
          console.log(`    车队: ${count} 条`);
        }
      }
    }

    // -------- 4. 更新车手国籍（从 PCS 页面提取 flag class） --------
    // 二次遍历提取国籍信息
    // -------- 3.5 补充 Stage 19-20 数据（HTML 为空，使用 cached JSON） --------
    console.log('\n📋 步骤 3.5: 补充 Stage 19-20 赛段成绩（从 cached JSON）...');
    const projectRoot = path.join(__dirname, '..', '..');
    for (const stageNum of [19, 20]) {
      const jsonFile = path.join(projectRoot, `stage${stageNum}_full.json`);
      if (!fs.existsSync(jsonFile)) continue;

      const stageId = stageIdMap[stageNum];
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

      await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
      await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);
      let countResults = 0, countGC = 0;

      for (const entry of data) {
        const rank = parseInt(entry.rank);
        if (isNaN(rank) || !entry.riderSlug) continue;

        const rider = { name: entry.riderName.split(' ').reverse().join(' '), slug: entry.riderSlug };
        const team = { name: entry.teamName, slug: entry.teamSlug.replace(/-20\d{2}$/, '') };

        const riderId = await ensureRider(conn, riderMap, rider);
        const teamId = await ensureTeam(conn, teamMap, team);

        // 赛段成绩
        await conn.query(
          `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap) VALUES (?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id), time_gap=VALUES(time_gap)`,
          [uuidv4(), stageId, rank, riderId, teamId, entry.nationality || '', normalizeTimeGap(entry.time) || null]
        );
        countResults++;

        // GC 用同样的排名（这些赛段没有单独的 GC 位置数据）
        await conn.query(
          `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id)`,
          [uuidv4(), stageId, rank, riderId, teamId, entry.nationality || '', entry.time || null, null]
        );
        countGC++;
      }
      totalResults += countResults;
      totalGC += countGC;

      // 生成粉衫
      const gcFirst = await conn.query(
        'SELECT gc.rider_id, gc.team_id FROM general_classification gc WHERE gc.stage_id = ? AND gc.`rank` = 1', [stageId]
      );
      if (gcFirst[0].length > 0) {
        await upsertJersey(conn, stageId, 'PINK', gcFirst[0][0].rider_id, gcFirst[0][0].team_id);
        totalJerseys++;
      }

      console.log(`    Stage ${stageNum}: 成绩 ${countResults} 条, GC ${countGC} 条`);
    }

    console.log('\n📋 步骤 4: 补充车手国籍信息...');
    let natUpdated = 0;
    for (let stageNum = 1; stageNum <= 3; stageNum++) {
      const htmlFile = path.join(HTML_DIR, `giro_s${stageNum}.html`);
      if (!fs.existsSync(htmlFile)) continue;
      const html = fs.readFileSync(htmlFile, 'utf8');
      const $ = cheerio.load(html);

      $('a[href^="rider/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href').replace('rider/', '');
        // PCS nationality 通常在 rider row 中的 span.flag 元素
        const $row = $el.closest('tr');
        const flagClass = $row.find('span.flag, span[class*="flag"]').attr('class') || '';
        const natMatch = flagClass.match(/flag\s+(\w{2})/i) || flagClass.match(/(\w{2})$/);
        if (natMatch) {
          const nat = natMatch[1].toUpperCase();
          if (riderMap.has(href)) {
            conn.query('UPDATE riders SET nationality = ? WHERE id = ? AND (nationality IS NULL OR nationality = "")', [nat, riderMap.get(href)]);
            natUpdated++;
          }
        }
      });
    }
    console.log(`  ✅ 国籍信息已更新`);

    // -------- 汇总 --------
    console.log('\n' + '='.repeat(60));
    console.log('📊 导入完成汇总：');
    console.log('='.repeat(60));
    console.log(`  🏁 赛事: ${RACE.race_name_en} (${raceId})`);
    console.log(`  📅 日期: ${RACE.start_date} ~ ${RACE.end_date}`);
    console.log(`  🏔️ 赛段: 21 个`);
    console.log(`  🚴 车手: ${riderMap.size} 人`);
    console.log(`  🏆 车队: ${teamMap.size} 支`);
    console.log(`  📊 赛段成绩: ${totalResults} 条`);
    console.log(`  🟡 GC总成绩: ${totalGC} 条`);
    console.log(`  🟣 冲刺积分: ${totalPoints} 条`);
    console.log(`  🔵 爬坡积分: ${totalMountains} 条`);
    console.log(`  ⚪ 青年排名: ${totalYouth} 条`);
    console.log(`  🏆 车队排名: ${totalTeamClass} 条`);
    console.log(`  🎽 领骑衫: ${totalJerseys} 条`);
    console.log('='.repeat(60));

    // 验证
    console.log('\n🔍 数据验证...');
    const checks = [
      ['races', `SELECT COUNT(*) as cnt FROM races WHERE race_code = ?`, [RACE.race_code]],
      ['stages', 'SELECT COUNT(*) as cnt FROM stages WHERE race_id = ?', [raceId]],
      ['riders', 'SELECT COUNT(*) as cnt FROM riders', []],
      ['teams', 'SELECT COUNT(*) as cnt FROM teams', []],
      ['stage_results', 'SELECT COUNT(*) as cnt FROM stage_results', []],
      ['general_classification', 'SELECT COUNT(*) as cnt FROM general_classification', []],
      ['points_classification', 'SELECT COUNT(*) as cnt FROM points_classification', []],
      ['mountains_classification', 'SELECT COUNT(*) as cnt FROM mountains_classification', []],
      ['youth_classification', 'SELECT COUNT(*) as cnt FROM youth_classification', []],
      ['team_classification', 'SELECT COUNT(*) as cnt FROM team_classification', []],
      ['jerseys', 'SELECT COUNT(*) as cnt FROM jerseys', []]
    ];
    for (const [label, sql, params] of checks) {
      const [rows] = await conn.query(sql, params);
      console.log(`  ${label}: ${rows[0].cnt}`);
    }

    console.log('\n🎉 环意 2026 全量导入完成！');

  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 确保车手存在，返回 rider_id
 */
async function ensureRider(conn, riderMap, rider) {
  if (riderMap.has(rider.slug)) return riderMap.get(rider.slug);

  // 先按 slug 查
  const [bySlug] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [rider.slug]);
  if (bySlug.length > 0) {
    riderMap.set(rider.slug, bySlug[0].id);
    return bySlug[0].id;
  }

  // 再按名字查
  const [byName] = await conn.query('SELECT id FROM riders WHERE rider_name = ?', [rider.name]);
  if (byName.length > 0) {
    // 更新 slug
    await conn.query('UPDATE riders SET rider_slug = ? WHERE id = ?', [rider.slug, byName[0].id]);
    riderMap.set(rider.slug, byName[0].id);
    return byName[0].id;
  }

  // 新建
  const id = uuidv4();
  await conn.query(
    'INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (?, ?, ?, ?)',
    [id, rider.name, rider.slug, '']
  );
  riderMap.set(rider.slug, id);
  return id;
}

/**
 * 确保车队存在，返回 team_id
 */
async function ensureTeam(conn, teamMap, team) {
  const key = team.slug || team.name;
  if (teamMap.has(key)) return teamMap.get(key);

  // 按 slug 查
  if (team.slug) {
    const [bySlug] = await conn.query('SELECT id FROM teams WHERE team_slug = ?', [team.slug]);
    if (bySlug.length > 0) {
      teamMap.set(key, bySlug[0].id);
      return bySlug[0].id;
    }
  }

  // 按名字查
  const [byName] = await conn.query('SELECT id FROM teams WHERE team_name = ?', [team.name]);
  if (byName.length > 0) {
    if (team.slug) {
      await conn.query('UPDATE teams SET team_slug = ? WHERE id = ?', [team.slug, byName[0].id]);
    }
    teamMap.set(key, byName[0].id);
    return byName[0].id;
  }

  // 新建
  const id = uuidv4();
  await conn.query(
    'INSERT INTO teams (id, team_name, team_slug) VALUES (?, ?, ?)',
    [id, team.name, team.slug || null]
  );
  teamMap.set(key, id);
  return id;
}

/**
 * 插入或更新领骑衫记录
 */
async function upsertJersey(conn, stageId, jerseyType, riderId, teamId) {
  await conn.query(
    `INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) 
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id)`,
    [uuidv4(), stageId, jerseyType, riderId, teamId]
  );
}

// 运行
main();
