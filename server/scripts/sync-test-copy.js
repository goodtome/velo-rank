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

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

puppeteer.use(StealthPlugin());

const PCS_BASE = 'https://www.procyclingstats.com';
const REQUEST_DELAY = 3000;

require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

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
// PCS 抓取（复用单个 page）
// ============================================================

async function fetchPCS(page, url) {
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  const status = resp ? resp.status() : 0;
  
  if (page.url().includes('chrome-error') || status >= 400) {
    throw new Error(`HTTP ${status} at ${page.url()}`);
  }
  
  // Cloudflare challenge?
  const html = await page.content();
  if (html.includes('challenge-platform')) {
    console.log('    Cloudflare challenge, waiting 10s...');
    await sleep(10000);
    return await page.content();
  }
  
  return html;
}

// ============================================================
// PCS 表格解析
// ============================================================

function parsePCSTable(html) {
  const $ = cheerio.load(html);
  const table = $('table.results').first();
  if (!table.length) return [];
  
  const rows = table.find('tbody tr');
  const results = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const cols = row.find('td');
    if (cols.length < 10) continue;
    
    const rank = parseInt(cols.eq(0).text().trim());
    if (isNaN(rank)) continue;
    
    const timeLag = cols.eq(2).text().trim() || '';
    
    // Rider: col 7
    const riderCell = cols.eq(7);
    const riderLink = riderCell.find('a[href*="rider/"]');
    const riderSlug = riderLink.length ? riderLink.attr('href').replace('rider/', '') : '';
    const riderFullText = riderCell.text().trim();
    
    // Team: col 8
    const teamText = cols.eq(8).text().trim();
    const teamLink = cols.eq(8).find('a[href*="team/"]');
    const teamSlug = teamLink.length
      ? teamLink.attr('href').replace(/team\//, '').replace(/-\d{4}$/, '')
      : '';
    
    // Extract rider name (text includes team name appended)
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
    
    const racePoints = parseInt(cols.eq(10).text().trim()) || 0;
    const time = cols.eq(12).text().trim() || '';
    const cleanTime = time.replace(/(\d{1,2}:\d{2}:\d{2})\1/, '$1').replace(/^,,/, '+').replace(/^,/, '+');
    
    results.push({
      rank, rider_name: riderName, rider_slug: riderSlug,
      team_name: teamText, team_slug: teamSlug,
      time_gap: timeLag, time: cleanTime, race_points: racePoints
    });
  }
  
  return results;
}

// ============================================================
// 数据库操作
// ============================================================

async function getOrCreateRider(name, slug) {
  if (slug) {
    const [rows] = await conn.query(
      'SELECT id FROM riders WHERE uci_id = ? OR rider_name LIKE ? LIMIT 1',
      [slug, `%${name.split(' ').pop()}%`]
    );
    if (rows.length > 0) return rows[0].id;
  }
  const [rows2] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [name]);
  if (rows2.length > 0) return rows2[0].id;
  
  if (dryRun) return null;
  const id = uuidv4();
  await conn.query('INSERT INTO riders (id, rider_name, uci_id, nationality) VALUES (?, ?, ?, ?)',
    [id, name, slug || null, 'UNK']);
  return id;
}

async function getOrCreateTeam(name, slug) {
  if (!name) return null;
  const [rows] = await conn.query(
    'SELECT id FROM teams WHERE team_name LIKE ? OR uci_code = ? LIMIT 1',
    [`%${name.split(' ').slice(0, 2).join(' ')}%`, slug]
  );
  if (rows.length > 0) return rows[0].id;
  
  if (dryRun) return null;
  const id = uuidv4();
  await conn.query('INSERT INTO teams (id, team_name, uci_code) VALUES (?, ?, ?)',
    [id, name, slug || null]);
  return id;
}

async function getStageId(raceId, stageNumber) {
  const [rows] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?', [raceId, stageNumber]);
  return rows.length > 0 ? rows[0].id : null;
}

async function saveStageResults(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    const teamId = await getOrCreateTeam(r.team_name, r.team_slug);
    if (!riderId || !teamId) continue;
    const isSameTime = !r.time_gap || r.time_gap.includes('+0:00') ? 1 : 0;
    await conn.query(
      `INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap, is_same_time)
       VALUES (?, ?, ?, ?, ?, 'UNK', ?, ?)
       ON DUPLICATE KEY UPDATE time_gap = VALUES(time_gap)`,
      [uuidv4(), stageId, r.rank, riderId, teamId, r.time_gap, isSameTime]);
    n++;
  }
  return n;
}

async function saveGC(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    const teamId = await getOrCreateTeam(r.team_name, r.team_slug);
    if (!riderId || !teamId) continue;
    await conn.query(
      `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap)
       VALUES (?, ?, ?, ?, ?, 'UNK', ?, ?)
       ON DUPLICATE KEY UPDATE \`rank\` = VALUES(\`rank\`), total_time = VALUES(total_time)`,
      [uuidv4(), stageId, r.rank, riderId, teamId, r.time || null, r.time_gap || null]);
    n++;
  }
  return n;
}

async function savePoints(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    if (!riderId) continue;
    await conn.query(
      `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
       VALUES (?, ?, ?, ?, 'GREEN')
       ON DUPLICATE KEY UPDATE \`rank\` = VALUES(\`rank\`), points = VALUES(points)`,
      [stageId, riderId, r.rank, r.race_points]);
    n++;
  }
  return n;
}

async function saveKOM(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    if (!riderId) continue;
    await conn.query(
      `INSERT INTO mountains_classification (stage_id, rider_id, \`rank\`, points, jersey_type)
       VALUES (?, ?, ?, ?, 'POLKA_DOT')
       ON DUPLICATE KEY UPDATE \`rank\` = VALUES(\`rank\`), points = VALUES(points)`,
      [stageId, riderId, r.rank, r.race_points]);
    n++;
  }
  return n;
}

async function saveYouth(stageId, results) {
  let n = 0;
  for (const r of results) {
    const riderId = await getOrCreateRider(r.rider_name, r.rider_slug);
    if (!riderId) continue;
    await conn.query(
      `INSERT INTO youth_classification (id, stage_id, rider_id, \`rank\`, time, time_gap, jersey_type)
       VALUES (?, ?, ?, ?, ?, ?, 'WHITE')
       ON DUPLICATE KEY UPDATE \`rank\` = VALUES(\`rank\`)`,
      [uuidv4(), stageId, riderId, r.rank, r.time || null, r.time_gap || null]);
    n++;
  }
  return n;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log(`\n🚴 TdF Sync | Race: ${RACE_CODE} | Types: ${typesToSync.join(',')} | Dry: ${dryRun}`);
  
  if (!dryRun) {
    conn = await mysql.createConnection(dbConfig.development);
    const [r] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]);
    if (!r.length) { console.error(`Race ${RACE_CODE} not found`); process.exit(1); }
    console.log(`Race ID: ${r[0].id}`);
  }
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // Auto-detect stages
    if (!stagesToSync) {
      console.log('Detecting stages...');
      const raceHtml = await fetchPCS(page, `${PCS_BASE}/race/${RACE_CODE}`);
      const $ = cheerio.load(raceHtml);
      const detected = new Set();
      $('a[href*="stage-"]').each((_, el) => {
        const m = $(el).attr('href').match(/stage-(\d+)/);
        if (m) detected.add(parseInt(m[1]));
      });
      stagesToSync = [...detected].sort((a, b) => a - b);
      console.log(`Found ${stagesToSync.length} stages: ${stagesToSync.join(', ')}`);
      if (!stagesToSync.length) return;
      await sleep(REQUEST_DELAY);
    }
    
    const stats = { stage: 0, gc: 0, points: 0, kom: 0, youth: 0 };
    
    for (const stageNum of stagesToSync) {
      console.log(`\n--- Stage ${stageNum} ---`);
      
      let stageId = null;
      if (!dryRun) {
        const [r] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]);
        stageId = await getStageId(r[0].id, stageNum);
        if (!stageId) { console.log('  Stage not in DB, skipping'); continue; }
      }
      
      // Stage result
      if (typesToSync.includes('stage')) {
        try {
          const html = await fetchPCS(page, `${PCS_BASE}/race/${RACE_CODE}/stage-${stageNum}`);
          const results = parsePCSTable(html);
          console.log(`  Stage: ${results.length} results`);
          if (results.length && !dryRun) {
            stats.stage += await saveStageResults(stageId, results);
          }
          if (results.length && dryRun) {
            results.slice(0, 3).forEach(r => console.log(`    #${r.rank} ${r.rider_name} (${r.team_name}) ${r.time_gap}`));
          }
        } catch (e) { console.log(`  Stage error: ${e.message}`); }
        await sleep(REQUEST_DELAY);
      }
      
      // GC
      if (typesToSync.includes('gc')) {
        try {
          const html = await fetchPCS(page, `${PCS_BASE}/race/${RACE_CODE}/stage-${stageNum}-gc`);
          const results = parsePCSTable(html);
          console.log(`  GC: ${results.length} results`);
          if (results.length && !dryRun) stats.gc += await saveGC(stageId, results);
        } catch (e) { console.log(`  GC error: ${e.message}`); }
        await sleep(REQUEST_DELAY);
      }
      
      // Points
      if (typesToSync.includes('points')) {
        try {
          const html = await fetchPCS(page, `${PCS_BASE}/race/${RACE_CODE}/stage-${stageNum}-points`);
          const results = parsePCSTable(html);
          console.log(`  Points: ${results.length} results`);
          if (results.length && !dryRun) stats.points += await savePoints(stageId, results);
        } catch (e) { console.log(`  Points error: ${e.message}`); }
        await sleep(REQUEST_DELAY);
      }
      
      // KOM
      if (typesToSync.includes('kom')) {
        try {
          const html = await fetchPCS(page, `${PCS_BASE}/race/${RACE_CODE}/stage-${stageNum}-kom`);
          const results = parsePCSTable(html);
          console.log(`  KOM: ${results.length} results`);
          if (results.length && !dryRun) stats.kom += await saveKOM(stageId, results);
        } catch (e) { console.log(`  KOM error: ${e.message}`); }
        await sleep(REQUEST_DELAY);
      }
      
      // Youth
      if (typesToSync.includes('youth')) {
        try {
          const html = await fetchPCS(page, `${PCS_BASE}/race/${RACE_CODE}/stage-${stageNum}-youth`);
          const results = parsePCSTable(html);
          console.log(`  Youth: ${results.length} results`);
          if (results.length && !dryRun) stats.youth += await saveYouth(stageId, results);
        } catch (e) { console.log(`  Youth error: ${e.message}`); }
        await sleep(REQUEST_DELAY);
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
