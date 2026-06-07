/**
 * TdF 2026 自动同步脚本
 * 
 * 使用 Puppeteer + Stealth 绕过 Cloudflare 抓取 PCS 数据并入库
 * 
 * 用法:
 *   node server/scripts/sync-tdf2026.js                              # 同步所有已完成的赛段
 *   node server/scripts/sync-tdf2026.js --stages=1                   # 只同步赛段1
 *   node server/scripts/sync-tdf2026.js --stages=1-3                 # 同步赛段1-3
 *   node server/scripts/sync-tdf2026.js --types=stage,gc             # 只同步赛段成绩和GC
 *   node server/scripts/sync-tdf2026.js --race=tour-de-france-2025  # 用2025数据测试
 *   node server/scripts/sync-tdf2026.js --dry-run                    # 只抓取不入库
 */

// ★ 关键: Puppeteer + Stealth 必须在最前面加载 (与 test-minimal-sync.js 保持一致)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

puppeteer.use(StealthPlugin());
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

const PCS_BASE = 'https://www.procyclingstats.com';
const REQUEST_DELAY = 4000;

// 将 race_code 转换为 PCS URL 路径
// 例如: "tour-de-france-2026" → "tour-de-france/2026"
function racePath(code) {
  const m = code.match(/^(.+)-(\d{4})$/);
  return m ? `${m[1]}/${m[2]}` : code;
}

// 命令行参数
const args = process.argv.slice(2);
let RACE_CODE = 'tour-de-france-2026';
let stagesToSync = null;
let typesToSync = ['stage', 'gc', 'points', 'kom', 'youth'];
let dryRun = false;

for (const arg of args) {
  if (arg.startsWith('--race=')) RACE_CODE = arg.replace('--race=', '');
  if (arg.startsWith('--stages=')) {
    const range = arg.replace('--stages=', '');
    if (range.includes('-')) {
      const [s, e] = range.split('-').map(Number);
      stagesToSync = Array.from({ length: e - s + 1 }, (_, i) => s + i);
    } else {
      stagesToSync = range.split(',').map(Number);
    }
  }
  if (arg.startsWith('--types=')) typesToSync = arg.replace('--types=', '').split(',');
  if (arg === '--dry-run') dryRun = true;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let conn;

// ============================================================
// PCS 抓取 (与 test-minimal-sync.js 完全一致的结构)
// ============================================================

async function fetchPCSPage(page, url, retries = 2) {
  page.removeAllListeners('requestfailed');
  page.on('requestfailed', req => {
    const err = req.failure();
    if (err) console.log(`  [net-fail] ${req.url().substring(0,80)} - ${err.errorText}`);
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const waitSec = 5 * attempt;
      console.log(`  Retry ${attempt}/${retries}, waiting ${waitSec}s...`);
      await sleep(waitSec * 1000);
      // 重试时创建新页面以清除之前的状态
      await page.close();
      page = await page.browser().newPage();
      await page.setViewport({ width: 1920, height: 1080 });
    }

    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    const status = resp ? resp.status() : 0;
    console.log(`  Status: ${status}, Final URL: ${page.url()}`);
    const html = await page.content();
    console.log(`  HTML: ${html.length} bytes`);

    if (!page.url().includes('chrome-error') && status < 400) {
      return { html, page };
    }

    console.log(`  Fetch failed (attempt ${attempt + 1}/${retries + 1})`);
  }

  throw new Error(`All retries exhausted for ${url}`);
}

// ============================================================
// PCS 表格解析
// ============================================================

// PCS 页面包含所有分类表格, 按 tableIndex 选取正确的表格:
//   Table 0  = Stage Results (13 cols: Rnk,GC,Timelag,...,Rider,Team,UCI,Pnt,±,Time)
//   Table 1  = GC            (13 cols: Rnk,Prev,▼▲,...,Rider,Team,UCI,±,Time,TimeGap)
//   Table 2  = Points        (11 cols: Rnk,Prev,▼▲,...,Rider,Team,Pnt,Today)
//   Table 5  = KOM           (11 cols: Rnk,Prev,▼▲,...,Rider,Team,Pnt,Today)
//   Table 14 = Youth         (11 cols: Rnk,Prev,▼▲,...,Rider,Team,Time,TimeGap)
const TABLE_INDEX = { stage: 0, gc: 1, points: 2, kom: 5, youth: 14 };

function parsePCSTable(html, type = 'stage') {
  const $ = cheerio.load(html);
  const tableIdx = TABLE_INDEX[type] ?? 0;
  const tables = $('table.results');
  const table = tables.eq(tableIdx);
  if (!table.length) return [];

  const rows = table.find('tbody tr');
  const results = [];

  // 判断是否为 13 列表格 (stage/gc) 还是 11 列 (points/kom/youth)
  const isWideTable = type === 'stage' || type === 'gc';

  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const cols = row.find('td');
    if (cols.length < 7) continue;

    const rank = parseInt(cols.eq(0).text().trim());
    if (isNaN(rank)) continue;

    // Rider: 所有表格都在 col 7
    const riderCell = cols.eq(7);
    const riderLink = riderCell.find('a[href*="rider/"]');
    const riderSlug = riderLink.length ? riderLink.attr('href').replace('rider/', '') : '';
    const riderFullText = riderCell.text().trim();

    // Team: 所有表格都在 col 8
    const teamText = cols.eq(8).text().trim();
    const teamLink = cols.eq(8).find('a[href*="team/"]');
    const teamSlug = teamLink.length
      ? teamLink.attr('href').replace(/team\//, '').replace(/-\d{4}$/, '')
      : '';

    // 提取车手姓名 (col 7 文本可能包含车队名)
    let riderName = riderFullText;
    if (teamText && riderFullText.endsWith(teamText)) {
      riderName = riderFullText.slice(0, -teamText.length).trim();
    }
    if (!riderName && riderLink.length) {
      const linkText = riderLink.text().trim();
      if (teamText && linkText.endsWith(teamText)) {
        riderName = linkText.slice(0, -teamText.length).trim();
      } else {
        riderName = linkText;
      }
    }

    let timeGap = '', time = '', racePoints = 0;

    if (type === 'stage') {
      // Table 0 (13 cols): col2=Timelag, col10=Pnt, col12=Time
      timeGap = cols.eq(2).text().trim() || '';
      racePoints = parseInt(cols.eq(10).text().trim()) || 0;
      time = cols.eq(12).text().trim() || '';
    } else if (type === 'gc') {
      // GC 表格列结构因中间/最终赛段不同:
      //   中间赛段 (13 cols): col11=Time(leader总时间/其他人时间差), col12=Time won/lost (总是 "..")
      //   最终 GC  (14 cols): col11=Time(同上), col12=Time gap (明确的时间差), col13=".."
      const rawTime = cols.eq(11).text().trim() || '';
      time = rawTime.replace(/(\d{1,2}:\d{2}:\d{2})\1/, '$1');

      if (rank === 1) {
        // 第一名始终是 +0:00
        timeGap = '+0:00';
      } else {
        const col12Text = cols.eq(12).text().trim() || '';
        const hasValidCol12 = col12Text !== '..' && col12Text !== '' && col12Text.includes(':');
        if (hasValidCol12) {
          // 最终 GC: col12 有明确的时间差
          timeGap = col12Text;
        } else {
          // 中间赛段: col11 对非第一名显示时间差
          timeGap = time || '+0:00';
        }
      }
    } else if (type === 'points' || type === 'kom') {
      // Tables 2/5 (11 cols): col9=Pnt (累计积分)
      racePoints = parseInt(cols.eq(9).text().trim()) || 0;
    } else if (type === 'youth') {
      // Table 14 (11 cols): col9=Time(leader总时间/其他人时间差), col10=Time won/lost (总是 "..")
      const rawTime = cols.eq(9).text().trim() || '';
      time = rawTime.replace(/(\d{1,2}:\d{2}:\d{2})\1/, '$1');
      const col10Text = cols.eq(10).text().trim() || '';
      if (col10Text !== '..' && col10Text !== '' && col10Text.includes(':')) {
        // 如果 col10 有有效时间差则使用
        timeGap = col10Text;
      } else if (rank === 1) {
        timeGap = '+0:00';
      } else {
        // col9 对非第一名显示时间差
        timeGap = time || '+0:00';
      }
    }

    const cleanTime = time.replace(/^,,/, '+').replace(/^,/, '+');

    // 通用去重: PCS 页面把时间/差距文本显示两次 (如 "0:290:29", "37:41:4937:41:49", "76:00:3276:00:32")
    const dedupStr = (s) => {
      if (!s) return s;
      // 先尝试 H:MM:SS 级别去重 (整串刚好两段相同)
      const m1 = s.match(/^(\d{1,3}:\d{2}:\d{2})\1$/);
      if (m1) return m1[1];
      // 再尝试 M:SS 级别去重 (整串刚好两段相同)
      const m2 = s.match(/^(\d{1,3}:\d{2})\1$/);
      if (m2) return m2[1];
      // 最后尝试替换首次出现的重复模式 (优先匹配更长的模式)
      return s.replace(/(\d{1,3}:\d{2}:\d{2})\1|(\d{1,3}:\d{2})\2/, (match, g1, g2) => g1 || g2);
    };
    const finalTimeGap = dedupStr(timeGap);
    const finalTime = dedupStr(cleanTime);

    results.push({
      rank, rider_name: riderName, rider_slug: riderSlug,
      team_name: teamText, team_slug: teamSlug,
      time_gap: finalTimeGap, time: finalTime, race_points: racePoints
    });
  }

  return results;
}

// ============================================================
// 数据库操作 (匹配实际 schema)
// ============================================================

async function getOrCreateRider(name, slug) {
  // 先用 slug 匹配 rider_slug 列
  if (slug) {
    const [rows] = await conn.query(
      'SELECT id FROM riders WHERE rider_slug = ? LIMIT 1', [slug]
    );
    if (rows.length > 0) return rows[0].id;
  }
  // 用姓名匹配
  const [rows2] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [name]);
  if (rows2.length > 0) return rows2[0].id;

  if (dryRun) return null;
  const id = uuidv4();
  await conn.query(
    'INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (?, ?, ?, ?)',
    [id, name, slug || null, 'UNK']
  );
  return id;
}

async function getOrCreateTeam(name, slug) {
  if (!name) return null;
  // 先用 slug 匹配 team_slug 列
  if (slug) {
    const [rows] = await conn.query(
      'SELECT id FROM teams WHERE team_slug = ? LIMIT 1', [slug]
    );
    if (rows.length > 0) return rows[0].id;
  }
  // 用名称模糊匹配
  const [rows2] = await conn.query(
    'SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',
    [`%${name.split(' ').slice(0, 2).join(' ')}%`]
  );
  if (rows2.length > 0) return rows2[0].id;

  if (dryRun) return null;
  const id = uuidv4();
  await conn.query(
    'INSERT INTO teams (id, team_name, team_slug) VALUES (?, ?, ?)',
    [id, name, slug || null]
  );
  return id;
}

async function getStageId(raceId, stageNumber) {
  const [rows] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?', [raceId, stageNumber]);
  return rows.length > 0 ? rows[0].id : null;
}

// 通用: 检查是否已存在记录
async function existsIn(table, stageId, riderId) {
  const [rows] = await conn.query(
    `SELECT id FROM ${table} WHERE stage_id = ? AND rider_id = ? LIMIT 1`,
    [stageId, riderId]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function saveStageResults(stageId, results) {
  let n = 0;
  const usedRanks = new Set();
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    const teamId = await getOrCreateTeam(r.team_name, r.team_slug);
    if (!riderId || !teamId) continue;
    const isSameTime = !r.time_gap || r.time_gap.includes('+0:00') ? 1 : 0;
    // 处理并列名次: 如果 rank 已被其他车手占用, 递增
    let rank = r.rank;
    while (usedRanks.has(rank)) rank++;
    usedRanks.add(rank);

    const existing = await existsIn('stage_results', stageId, riderId);
    if (existing) {
      await conn.query(
        'UPDATE stage_results SET rank_pos = ?, time_gap = ?, is_same_time = ? WHERE id = ?',
        [rank, r.time_gap, isSameTime, existing]
      );
    } else {
      await conn.query(
        `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time)
         VALUES (?, ?, ?, ?, ?, 'UNK', ?, ?)`,
        [uuidv4(), stageId, rank, riderId, teamId, r.time_gap, isSameTime]
      );
    }
    n++;
  }
  return n;
}

async function saveGC(stageId, results) {
  let n = 0;
  const usedRanks = new Set();

  // PCS 数据中, 某些赛段的 GC rank 可能与 stage rank 混淆
  // 检测: 如果 rank 1 的 time_gap 不是 +0:00, 说明排名有误, 按 time_gap 重新排序
  let needsRerank = false;
  if (results.length > 0) {
    const rank1 = results.find(r => r.rank === 1);
    if (rank1 && rank1.time_gap && rank1.time_gap !== '+0:00' && rank1.time_gap !== '0:00') {
      needsRerank = true;
      console.log('  [GC] Misaligned ranks detected (rank 1 gap=' + rank1.time_gap + '), re-ranking by time_gap...');
      results.sort((a, b) => parseTimeToSeconds(a.time_gap) - parseTimeToSeconds(b.time_gap));
      results.forEach((r, i) => { r.rank = i + 1; });
    }
  }

  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    const teamId = await getOrCreateTeam(r.team_name, r.team_slug);
    if (!riderId || !teamId) continue;

    // total_time: 仅对冠军保留
    let totalTime = null;
    if (r.rank === 1 && r.time && !r.time.startsWith('+')) {
      totalTime = r.time;
    }

    // 处理并列名次
    let rank = r.rank;
    while (usedRanks.has(rank)) rank++;
    usedRanks.add(rank);

    const existing = await existsIn('general_classification', stageId, riderId);
    if (existing) {
      await conn.query(
        'UPDATE general_classification SET `rank` = ?, total_time = ?, time_gap = ? WHERE id = ?',
        [rank, totalTime, r.time_gap || null, existing]
      );
    } else {
      await conn.query(
        `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap)
         VALUES (?, ?, ?, ?, ?, 'UNK', ?, ?)`,
        [uuidv4(), stageId, rank, riderId, teamId, totalTime, r.time_gap || null]
      );
    }
    n++;
  }
  return n;
}

// 将 "+H:MM:SS" 或 "+M:SS" 格式转换为秒数
function parseTimeToSeconds(timeStr) {
  if (!timeStr || timeStr === '+0:00' || timeStr === '0:00') return 0;
  const cleaned = timeStr.replace('+', '').replace('-', '');
  const parts = cleaned.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 999999;
}

// 将 time_gap 加到 baseTime 上, 例如 addTimeGap("3:53:11", "+0:04") => "3:53:15"
function addTimeGap(baseTime, gap) {
  try {
    const baseParts = baseTime.match(/(\d+):(\d+):(\d+)/);
    if (!baseParts) return baseTime;
    let baseSec = parseInt(baseParts[1]) * 3600 + parseInt(baseParts[2]) * 60 + parseInt(baseParts[3]);

    // 解析 time_gap: "+0:04" or "+1:23:45" or "-0:02"
    const gapMatch = gap.match(/([+-]?)(\d+):(\d+)(?::(\d+))?/);
    if (!gapMatch) return baseTime;
    const sign = gapMatch[1] === '-' ? -1 : 1;
    const gapH = gapMatch[4] ? parseInt(gapMatch[2]) : 0;
    const gapM = gapMatch[4] ? parseInt(gapMatch[3]) : parseInt(gapMatch[2]);
    const gapS = gapMatch[4] ? parseInt(gapMatch[4]) : parseInt(gapMatch[3]);
    const gapSec = sign * (gapH * 3600 + gapM * 60 + gapS);

    const total = baseSec + gapSec;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } catch {
    return baseTime;
  }
}

async function savePoints(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    if (!riderId) continue;
    const existing = await existsIn('points_classification', stageId, riderId);
    if (existing) {
      await conn.query(
        'UPDATE points_classification SET `rank` = ?, points = ? WHERE id = ?',
        [r.rank, r.race_points, existing]
      );
    } else {
      await conn.query(
        `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
         VALUES (?, ?, ?, ?, 'GREEN')`,
        [stageId, riderId, r.rank, r.race_points]
      );
    }
    n++;
  }
  return n;
}

async function saveKOM(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    if (!riderId) continue;
    const existing = await existsIn('mountains_classification', stageId, riderId);
    if (existing) {
      await conn.query(
        'UPDATE mountains_classification SET `rank` = ?, points = ? WHERE id = ?',
        [r.rank, r.race_points, existing]
      );
    } else {
      await conn.query(
        `INSERT INTO mountains_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
         VALUES (?, ?, ?, ?, 'POLKA_DOT')`,
        [stageId, riderId, r.rank, r.race_points]
      );
    }
    n++;
  }
  return n;
}

async function saveYouth(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    if (!riderId) continue;
    const existing = await existsIn('youth_classification', stageId, riderId);
    if (existing) {
      await conn.query(
        'UPDATE youth_classification SET `rank` = ?, time = ?, time_gap = ? WHERE id = ?',
        [r.rank, r.time ? String(r.time).substring(0, 20) : null, r.time_gap ? String(r.time_gap).substring(0, 20) : null, existing]
      );
    } else {
      // id 是自增 int，不传入
      await conn.query(
        `INSERT INTO youth_classification (stage_id, rider_id, \`rank\`, time, time_gap, jersey_type)
         VALUES (?, ?, ?, ?, ?, 'WHITE')`,
        [stageId, riderId, r.rank,
         r.time ? String(r.time).substring(0, 20) : null,
         r.time_gap ? String(r.time_gap).substring(0, 20) : null]
      );
    }
    n++;
  }
  return n;
}

// 根据 classification 数据生成 jerseys 记录
async function saveJerseys(stageId) {
  const jerseyMap = [
    { type: 'YELLOW',     table: 'general_classification' },
    { type: 'GREEN',      table: 'points_classification' },
    { type: 'POLKA_DOT',  table: 'mountains_classification' },
    { type: 'WHITE',      table: 'youth_classification' },
  ];
  
  let count = 0;
  for (const jm of jerseyMap) {
    const [rows] = await conn.query(
      `SELECT rider_id FROM ${jm.table} WHERE stage_id = ? AND \`rank\` = 1 LIMIT 1`,
      [stageId]
    );
    if (rows.length === 0) continue;
    const riderId = rows[0].rider_id;
    
    // 从 stage_results 获取 team_id (部分 classification 表没有 team_id)
    let teamId = null;
    const [teamRows] = await conn.query(
      'SELECT team_id FROM stage_results WHERE stage_id = ? AND rider_id = ? LIMIT 1',
      [stageId, riderId]
    );
    if (teamRows.length) {
      teamId = teamRows[0].team_id;
    } else {
      // 如果 stage_results 没有, 尝试从 GC 获取
      const [gcRows] = await conn.query(
        'SELECT team_id FROM general_classification WHERE stage_id = ? AND rider_id = ? LIMIT 1',
        [stageId, riderId]
      );
      if (gcRows.length) teamId = gcRows[0].team_id;
    }
    if (!teamId) {
      console.log(`  Jerseys: skipping ${jm.type} - no team_id for rider`);
      continue;
    }
    
    // UPSERT
    const [existing] = await conn.query(
      'SELECT id FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
      [stageId, jm.type]
    );
    if (existing.length > 0) {
      await conn.query(
        'UPDATE jerseys SET rider_id = ?, team_id = ? WHERE id = ?',
        [riderId, teamId, existing[0].id]
      );
    } else {
      await conn.query(
        'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), stageId, jm.type, riderId, teamId]
      );
    }
    count++;
  }
  if (count > 0) console.log(`  Jerseys: ${count} updated`);
  return count;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log(`\nTdF Sync | Race: ${RACE_CODE} | Types: ${typesToSync.join(',')} | Dry: ${dryRun}`);

  // ★ Step 1: 先启动浏览器
  console.log('Step 1: Launch browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // ★ Step 2: 预热
  console.log('Step 2: Warmup fetch...');
  try {
    const result = await fetchPCSPage(page, `${PCS_BASE}/race/tour-de-france/2025/stage-1`);
    page = result.page;
    if (page.url().includes('chrome-error')) {
      console.error('Warmup failed (chrome-error), aborting.');
      await browser.close();
      process.exit(1);
    }
    const $w = cheerio.load(result.html);
    const warmupRows = $w('table.results').first().find('tbody tr').length;
    console.log(`  Warmup OK: ${warmupRows} rows`);
  } catch (e) {
    console.error(`Warmup error: ${e.message}`);
    await browser.close();
    process.exit(1);
  }
  await sleep(REQUEST_DELAY);

  // ★ Step 3: 连接数据库
  if (!dryRun) {
    console.log('Step 3: Connect DB...');
    conn = await mysql.createConnection(dbConfig.development);
    const [r] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]);
    if (!r.length) {
      console.error(`Race ${RACE_CODE} not found`);
      await browser.close();
      process.exit(1);
    }
    console.log(`  Race ID: ${r[0].id}`);
  }

  try {
    // Auto-detect stages
    if (!stagesToSync) {
      console.log('Detecting stages...');
      const result = await fetchPCSPage(page, `${PCS_BASE}/race/${racePath(RACE_CODE)}`);
      page = result.page;
      const $ = cheerio.load(result.html);
      const detected = new Set();
      $('a[href*="stage-"]').each((_, el) => {
        const m = $(el).attr('href').match(/stage-(\d+)/);
        if (m) detected.add(parseInt(m[1]));
      });
      stagesToSync = [...detected].sort((a, b) => a - b);
      console.log(`  Found ${stagesToSync.length} stages: ${stagesToSync.join(', ')}`);
      if (!stagesToSync.length) return;
      await sleep(REQUEST_DELAY);
    }

    const stats = { stage: 0, gc: 0, points: 0, kom: 0, youth: 0 };
    // 从 DB 获取赛事真正的最后赛段号 (非 stagesToSync 的最大值)
    let lastStageInRace = Math.max(...stagesToSync);
    if (!dryRun && conn) {
      const [raceRow] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]);
      if (raceRow.length) {
        const [maxStage] = await conn.query('SELECT MAX(stage_number) as m FROM stages WHERE race_id = ?', [raceRow[0].id]);
        if (maxStage[0].m) lastStageInRace = maxStage[0].m;
      }
    }
    console.log(`  Last stage in race: ${lastStageInRace}`);

    for (const stageNum of stagesToSync) {
      console.log(`\n--- Stage ${stageNum} ---`);

      let stageId = null;
      if (!dryRun) {
        stageId = await getStageId(
          (await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]))[0][0].id,
          stageNum
        );
        if (!stageId) { console.log('  Stage not in DB, skipping'); continue; }
      }

      // 辅助函数: 抓取 + 解析 + 保存
      // 所有分类表格都在同一个 PCS 页面上, 只需抓取一次
      const stageUrl = `${PCS_BASE}/race/${racePath(RACE_CODE)}/stage-${stageNum}`;
      let pageHtml = null;

      const fetchPageOnce = async () => {
        if (pageHtml) return pageHtml;
        try {
          try { await page.evaluate('1'); } catch {
            console.log(`  [page-reset] creating new page`);
            page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
          }
          const result = await fetchPCSPage(page, stageUrl);
          page = result.page;
          pageHtml = result.html;
          return pageHtml;
        } catch (e) {
          console.log(`  Fetch error: ${e.message}`);
          throw e;
        }
      };

      const parseAndSave = async (html, typeName, saveFn, type) => {
        try {
          const results = parsePCSTable(html, type);
          console.log(`  ${typeName}: ${results.length} results`);
          if (results.length && !dryRun) {
            return await saveFn(stageId, results);
          }
          if (results.length && dryRun) {
            results.slice(0, 3).forEach(r => {
              const val = r.race_points ? `pts=${r.race_points}` : `gap=${r.time_gap}`;
              console.log(`    #${r.rank} ${r.rider_name} (${r.team_name}) ${val}`);
            });
          }
          return 0;
        } catch (e) {
          console.log(`  ${typeName} error: ${e.message}`);
          return 0;
        }
      };

      // 先抓取赛段页面 (只抓一次)
      if (typesToSync.length > 0) {
        try {
          await fetchPageOnce();
        } catch (e) {
          console.log(`  Skipping stage ${stageNum}: ${e.message}`);
          continue;
        }
      }

      // Stage result (Table 0)
      if (typesToSync.includes('stage')) {
        stats.stage += await parseAndSave(pageHtml, 'Stage', saveStageResults, 'stage');
      }
      // GC (Table 1)
      if (typesToSync.includes('gc')) {
        stats.gc += await parseAndSave(pageHtml, 'GC', saveGC, 'gc');
      }
      // Points (Table 2)
      if (typesToSync.includes('points')) {
        stats.points += await parseAndSave(pageHtml, 'Points', savePoints, 'points');
      }
      // KOM (Table 5)
      if (typesToSync.includes('kom')) {
        stats.kom += await parseAndSave(pageHtml, 'KOM', saveKOM, 'kom');
      }
      // Youth (Table 14)
      if (typesToSync.includes('youth')) {
        stats.youth += await parseAndSave(pageHtml, 'Youth', saveYouth, 'youth');
      }
      
      // 生成 jerseys 记录 (从 classification rank 1 自动推导)
      if (!dryRun) {
        await saveJerseys(stageId);
      }
    }

    console.log(`\nDone! ${dryRun ? '(dry run)' : `Saved: stage=${stats.stage} gc=${stats.gc} pts=${stats.points} kom=${stats.kom} youth=${stats.youth}`}`);

  } finally {
    await browser.close();
    if (conn) await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
