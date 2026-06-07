#!/usr/bin/env node
/**
 * 爬取 PCS Giro 2026 Stage 21 数据（JS 渲染页面）
 * 
 * 使用 ScraperAPI + render=true 获取动态渲染后的 HTML
 * 然后解析并导入 stage_results + GC + jerseys
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const dbConfig = require('../config/database');

const API_KEY = process.env.SCRAPERAPI_KEY || '156d1b97b6ea62da4fff324c22b66bce';
const STAGE_NUM = 21;
const STAGE_ID = 'f0e1cab7-cdbc-4b47-8394-c5db034d7603'; // existing UUID in DB
const HTML_SAVE_PATH = path.join(__dirname, 'pcs_html', `giro_s${STAGE_NUM}.html`);

// 尝试多个 URL 格式
const URLS_TO_TRY = [
  'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-21',
  'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-21/result',
  'https://www.procyclingstats.com/race/giro-ditalia/2026/stage-21',
];

// ============================================================
// ScraperAPI 请求
// ============================================================

function fetchViaScraperAPI(targetUrl, extraParams = {}) {
  return new Promise((resolve, reject) => {
    const params = {
      api_key: API_KEY,
      url: targetUrl,
      render: 'true',
      premium: 'true',
      ...extraParams
    };
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const apiUrl = `http://api.scraperapi.com/?${qs}`;
    
    console.log(`  ScraperAPI request: ${targetUrl}`);
    console.log(`  Extra params: ${JSON.stringify(extraParams)}`);

    const req = http.get(apiUrl, { timeout: 120000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`  Status: ${res.statusCode}, Size: ${body.length} bytes`);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout after 120s')); });
  });
}

// ============================================================
// HTML 解析工具（复用 import-giro2026-full.js 的逻辑）
// ============================================================

function fixDuplicatedTime(str) {
  if (!str) return null;
  str = str.trim();
  if (!str || str === '..' || str === '-' || str === 'DNF' || str === 'DNS' || str === 'OTL' || str === 'DSQ') return str;
  if (str.length > 2 && str.length % 2 === 0) {
    const half = str.length / 2;
    if (str.substring(0, half) === str.substring(half)) return str.substring(0, half);
  }
  const spaceMatch = str.match(/^(.+?)\s+\1$/);
  if (spaceMatch) return spaceMatch[1];
  return str;
}

function extractRiderInfo($cell) {
  const link = $cell.find('a[href^="rider/"]').first();
  if (!link.length) return null;
  const slug = link.attr('href').replace('rider/', '');
  const name = link.text().trim();
  if (!name) return null;
  const parts = name.split(' ');
  const displayName = parts.length >= 2 ? parts.slice(1).join(' ') + ' ' + parts[0] : name;
  return { name: displayName, slug, nameRaw: name };
}

function extractTeamInfo($cell) {
  const link = $cell.find('a[href^="team/"]').first();
  if (!link.length) return null;
  const slug = link.attr('href').replace('team/', '').replace(/-20\d{2}$/, '');
  const name = link.text().trim();
  return { name, slug };
}

function identifyTableType($, $table) {
  const headers = [];
  $table.find('tr').first().find('th, td').each((_, cell) => {
    headers.push($(cell).text().trim());
  });
  const headerStr = headers.join('|');
  const rowCount = $table.find('tr').length;
  const hasPrev = headers.includes('Prev') || headers.includes('▼▲');

  if (headerStr.includes('GC') && headerStr.includes('UCI') && headerStr.includes('Pnt')) {
    if (rowCount <= 2) return 'skip';
    return 'stage_results';
  }
  if (headerStr.includes('UCI') && headerStr.includes('Time won/lost') && !headerStr.includes('Pnt') && !headerStr.includes('Class')) {
    if (rowCount <= 2) return 'skip';
    if (hasPrev) return 'gc_dup';
    return 'gc';
  }
  if (!headerStr.includes('UCI') && headerStr.includes('Time won/lost') && !headerStr.includes('Pnt') && !headerStr.includes('Class')) {
    if (rowCount <= 2) return 'skip';
    if (rowCount >= 10 && rowCount <= 60) {
      if (hasPrev) return 'youth_dup';
      return 'youth';
    }
    if (rowCount >= 50) {
      if (hasPrev) return 'gc_dup';
      return 'gc';
    }
    return 'skip';
  }
  if (headerStr.includes('Pnt') && headerStr.includes('Today') && !headerStr.includes('Bonis')) {
    if (hasPrev) return 'points_dup';
    if (rowCount >= 10) return 'points';
    return 'mountains_alt';
  }
  if (headerStr.includes('Pnt') && headerStr.includes('Bonis')) {
    if (rowCount <= 2) return 'skip';
    return 'mountains';
  }
  if (headerStr.includes('Class') && headerStr.includes('Time won/lost')) {
    if (rowCount <= 2) return 'skip';
    if (hasPrev) return 'team_dup';
    return 'team_classification';
  }
  return 'unknown';
}

// ============================================================
// 车手/车队辅助函数
// ============================================================

async function ensureRider(conn, riderMap, rider) {
  if (riderMap.has(rider.slug)) return riderMap.get(rider.slug);
  const [bySlug] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [rider.slug]);
  if (bySlug.length > 0) {
    riderMap.set(rider.slug, bySlug[0].id);
    return bySlug[0].id;
  }
  const [byName] = await conn.query('SELECT id FROM riders WHERE rider_name = ?', [rider.name]);
  if (byName.length > 0) {
    await conn.query('UPDATE riders SET rider_slug = ? WHERE id = ?', [rider.slug, byName[0].id]);
    riderMap.set(rider.slug, byName[0].id);
    return byName[0].id;
  }
  const id = uuidv4();
  await conn.query('INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (?, ?, ?, ?)', [id, rider.name, rider.slug, '']);
  riderMap.set(rider.slug, id);
  return id;
}

async function ensureTeam(conn, teamMap, team) {
  const key = team.slug || team.name;
  if (teamMap.has(key)) return teamMap.get(key);
  if (team.slug) {
    const [bySlug] = await conn.query('SELECT id FROM teams WHERE team_slug = ?', [team.slug]);
    if (bySlug.length > 0) {
      teamMap.set(key, bySlug[0].id);
      return bySlug[0].id;
    }
  }
  const [byName] = await conn.query('SELECT id FROM teams WHERE team_name = ?', [team.name]);
  if (byName.length > 0) {
    if (team.slug) await conn.query('UPDATE teams SET team_slug = ? WHERE id = ?', [team.slug, byName[0].id]);
    teamMap.set(key, byName[0].id);
    return byName[0].id;
  }
  const id = uuidv4();
  await conn.query('INSERT INTO teams (id, team_name, team_slug) VALUES (?, ?, ?)', [id, team.name, team.slug || null]);
  teamMap.set(key, id);
  return id;
}

async function upsertJersey(conn, stageId, jerseyType, riderId, teamId) {
  await conn.query(
    `INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id)`,
    [uuidv4(), stageId, jerseyType, riderId, teamId]
  );
}

// ============================================================
// 检查 HTML 是否包含有效数据
// ============================================================

function hasValidData(html) {
  const $ = cheerio.load(html);
  let validTableFound = false;
  
  $('table').each((_, table) => {
    const $table = $(table);
    const type = identifyTableType($, $table);
    if (type === 'stage_results') {
      const dataRows = $table.find('tr').slice(1);
      if (dataRows.length >= 10) {
        validTableFound = true;
        return false; // break
      }
    }
  });

  // 也检查是否有足够多的 rider links
  const riderLinks = $('a[href^="rider/"]').length;
  
  return validTableFound || riderLinks >= 50;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('🚴 PCS Stage 21 爬取脚本');
  console.log('='.repeat(60));

  // Step 1: 尝试爬取
  let html = null;
  
  for (const url of URLS_TO_TRY) {
    console.log(`\n📡 尝试 URL: ${url}`);
    
    // 第一次尝试：标准参数
    try {
      const result = await fetchViaScraperAPI(url);
      if (result.status === 200 && result.body.length > 10000) {
        if (hasValidData(result.body)) {
          html = result.body;
          console.log(`  ✅ 获取到有效数据！`);
          break;
        } else {
          console.log(`  ⚠️ 页面获取成功但无有效数据，尝试 ultra_premium...`);
          // 尝试 ultra_premium
          const result2 = await fetchViaScraperAPI(url, { ultra_premium: 'true' });
          if (result2.status === 200 && result2.body.length > 10000 && hasValidData(result2.body)) {
            html = result2.body;
            console.log(`  ✅ ultra_premium 获取到有效数据！`);
            break;
          }
        }
      } else {
        console.log(`  ❌ 状态码 ${result.status} 或内容太小`);
      }
    } catch (err) {
      console.log(`  ❌ 错误: ${err.message}`);
    }
  }

  // 如果所有 URL 都失败，尝试不带 render
  if (!html) {
    console.log('\n📡 所有 JS 渲染尝试失败，尝试不带 render...');
    for (const url of URLS_TO_TRY.slice(0, 2)) {
      try {
        const result = await fetchViaScraperAPI(url, { render: 'false' });
        if (result.status === 200 && result.body.length > 10000 && hasValidData(result.body)) {
          html = result.body;
          console.log(`  ✅ 无 JS 渲染获取到有效数据！`);
          break;
        }
      } catch (err) {
        console.log(`  ❌ ${err.message}`);
      }
    }
  }

  if (!html) {
    console.log('\n❌ 所有爬取尝试均失败，无法获取 Stage 21 数据');
    process.exit(1);
  }

  // Step 2: 保存 HTML
  console.log(`\n💾 保存 HTML 到: ${HTML_SAVE_PATH}`);
  // 先备份旧的
  if (fs.existsSync(HTML_SAVE_PATH)) {
    const backupPath = HTML_SAVE_PATH + '.bak';
    fs.copyFileSync(HTML_SAVE_PATH, backupPath);
    console.log(`  旧文件已备份到: ${backupPath}`);
  }
  fs.writeFileSync(HTML_SAVE_PATH, html, 'utf8');
  console.log(`  已保存 ${html.length} bytes`);

  // Step 3: 解析并导入
  console.log('\n📋 解析 HTML 并导入数据...');
  const $ = cheerio.load(html);
  const stageId = STAGE_ID;

  // 识别所有表格
  const tableData = [];
  $('table').each((tableIdx, table) => {
    const $table = $(table);
    const type = identifyTableType($, $table);
    if (type !== 'unknown' && type !== 'skip' && !type.endsWith('_dup')) {
      const rowCount = $table.find('tr').length;
      console.log(`  Table ${tableIdx}: type=${type}, rows=${rowCount}`);
      tableData.push({ $table, type, tableIdx });
    }
  });

  // 连接数据库
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig.development);
    console.log('  ✅ 数据库连接成功');

    // 加载现有车手/车队映射
    const riderMap = new Map();
    const teamMap = new Map();
    const [allRiders] = await conn.query('SELECT id, rider_slug FROM riders WHERE rider_slug IS NOT NULL');
    allRiders.forEach(r => riderMap.set(r.rider_slug, r.id));
    const [allTeams] = await conn.query('SELECT id, team_slug FROM teams WHERE team_slug IS NOT NULL');
    allTeams.forEach(t => teamMap.set(t.team_slug, t.id));
    console.log(`  已加载 ${riderMap.size} 车手, ${teamMap.size} 车队`);

    // 清理 Stage 21 旧数据
    await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
    await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);
    await conn.query('DELETE FROM points_classification WHERE stage_id = ?', [stageId]);
    await conn.query('DELETE FROM mountains_classification WHERE stage_id = ?', [stageId]);
    await conn.query('DELETE FROM youth_classification WHERE stage_id = ?', [stageId]);
    await conn.query('DELETE FROM team_classification WHERE stage_id = ?', [stageId]);
    await conn.query('DELETE FROM jerseys WHERE stage_id = ?', [stageId]);

    let totalResults = 0, totalGC = 0, totalPoints = 0, totalMountains = 0;
    let totalYouth = 0, totalTeamClass = 0, totalJerseys = 0;

    for (const td of tableData) {
      const rows = [];
      td.$table.find('tr').slice(1).each((_, tr) => {
        const cells = [];
        $(tr).find('td').each((__, cell) => cells.push($(cell)));
        if (cells.length > 0) rows.push(cells);
      });

      // ---- Stage Results ----
      if (td.type === 'stage_results') {
        const headerCells = [];
        td.$table.find('tr').first().find('th, td').each((_, cell) => {
          headerCells.push($(cell).text().trim());
        });
        const gcColIdx = headerCells.indexOf('GC');
        const timelagColIdx = headerCells.indexOf('Timelag');
        const timeColIdx = headerCells.length - 1;

        let countResults = 0, countGC = 0;

        for (const cells of rows) {
          if (cells.length < 10) continue;
          const stageRank = parseInt(cells[0].text().trim());
          if (isNaN(stageRank)) continue;

          let rider = null, team = null, riderIdx = -1;
          for (let ci = 0; ci < cells.length; ci++) {
            if (!rider) {
              const r = extractRiderInfo(cells[ci]);
              if (r) { rider = r; riderIdx = ci; }
            }
            if (!team && ci > (riderIdx > 0 ? riderIdx - 1 : 0)) {
              const t = extractTeamInfo(cells[ci]);
              if (t) { team = t; }
            }
          }
          if (!rider || !team) continue;

          const timeGap = fixDuplicatedTime(cells[cells.length - 1].text()) || null;

          let natCode = '';
          for (let ci = 0; ci < cells.length; ci++) {
            const flagClass = cells[ci].find('span.flag, span[class*="flag"]').attr('class') || '';
            const natMatch = flagClass.match(/flag\s+(\w{2})/i) || flagClass.match(/fi\s+(\w{2})/i);
            if (natMatch) { natCode = natMatch[1].toUpperCase(); break; }
          }

          const riderId = await ensureRider(conn, riderMap, rider);
          const teamId = await ensureTeam(conn, teamMap, team);

          await conn.query(
            `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap) 
             VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id), time_gap=VALUES(time_gap)`,
            [uuidv4(), stageId, stageRank, riderId, teamId, natCode, timeGap]
          );
          countResults++;

          // 提取 GC
          if (gcColIdx >= 0 && gcColIdx < cells.length) {
            const gcRank = parseInt(cells[gcColIdx].text().trim());
            if (!isNaN(gcRank) && gcRank > 0) {
              const gcTimeGap = (timelagColIdx >= 0 && timelagColIdx < cells.length)
                ? fixDuplicatedTime(cells[timelagColIdx].text()) || null : null;
              const totalTime = (timeColIdx >= 0 && timeColIdx < cells.length)
                ? fixDuplicatedTime(cells[timeColIdx].text()) || null : null;

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

        totalResults = countResults;
        totalGC = countGC;
        console.log(`  ✅ Stage Results: ${countResults} 条, GC: ${countGC} 条`);

        // 粉衫
        if (countGC > 0) {
          const [gcFirst] = await conn.query(
            'SELECT gc.rider_id, gc.team_id FROM general_classification gc WHERE gc.stage_id = ? AND gc.`rank` = 1', [stageId]
          );
          if (gcFirst.length > 0) {
            await upsertJersey(conn, stageId, 'PINK', gcFirst[0].rider_id, gcFirst[0].team_id);
            totalJerseys++;
          }
        }

        // 赛段冠军紫衫
        if (countResults > 0) {
          const [stageWinner] = await conn.query(
            'SELECT rider_id, team_id FROM stage_results WHERE stage_id = ? AND rank_pos = 1', [stageId]
          );
          if (stageWinner.length > 0) {
            console.log(`  🏆 赛段冠军: rider_id=${stageWinner[0].rider_id}`);
          }
        }
      }

      // ---- Points ----
      else if (td.type === 'points') {
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
            `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type) 
             VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
            [stageId, riderId, rank, points, 'PURPLE']
          );
          count++;
        }
        totalPoints = count;
        if (count > 0) {
          const [ptsFirst] = await conn.query(
            'SELECT rider_id FROM points_classification WHERE stage_id = ? AND `rank` = 1', [stageId]
          );
          if (ptsFirst.length > 0) {
            const [teamRes] = await conn.query(
              'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [ptsFirst[0].rider_id, stageId]
            );
            const teamId = teamRes.length > 0 ? teamRes[0].team_id : null;
            await upsertJersey(conn, stageId, 'PURPLE', ptsFirst[0].rider_id, teamId);
            totalJerseys++;
          }
        }
        console.log(`  ✅ Points: ${count} 条`);
      }

      // ---- Mountains ----
      else if (td.type === 'mountains') {
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
             VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
            [stageId, riderId, rank, points, 'BLUE']
          );
          count++;
        }
        totalMountains = count;
        if (count > 0) {
          const [mtnFirst] = await conn.query(
            'SELECT rider_id FROM mountains_classification WHERE stage_id = ? AND `rank` = 1', [stageId]
          );
          if (mtnFirst.length > 0) {
            const [teamRes] = await conn.query(
              'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [mtnFirst[0].rider_id, stageId]
            );
            const teamId = teamRes.length > 0 ? teamRes[0].team_id : null;
            await upsertJersey(conn, stageId, 'BLUE', mtnFirst[0].rider_id, teamId);
            totalJerseys++;
          }
        }
        console.log(`  ✅ Mountains: ${count} 条`);
      }

      // ---- Youth ----
      else if (td.type === 'youth') {
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
             VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), time=VALUES(time), time_gap=VALUES(time_gap)`,
            [stageId, riderId, rank, time, timeGap, 'WHITE']
          );
          count++;
        }
        totalYouth = count;
        if (count > 0) {
          const [youthFirst] = await conn.query(
            'SELECT rider_id FROM youth_classification WHERE stage_id = ? AND `rank` = 1', [stageId]
          );
          if (youthFirst.length > 0) {
            const [teamRes] = await conn.query(
              'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [youthFirst[0].rider_id, stageId]
            );
            const teamId = teamRes.length > 0 ? teamRes[0].team_id : null;
            await upsertJersey(conn, stageId, 'WHITE', youthFirst[0].rider_id, teamId);
            totalJerseys++;
          }
        }
        console.log(`  ✅ Youth: ${count} 条`);
      }

      // ---- Team Classification ----
      else if (td.type === 'team_classification') {
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
             VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE team_id=VALUES(team_id), total_time=VALUES(total_time), time_gap=VALUES(time_gap)`,
            [uuidv4(), stageId, rank, teamId, totalTime, timeGap]
          );
          count++;
        }
        totalTeamClass = count;
        console.log(`  ✅ Team Classification: ${count} 条`);
      }
    }

    // 汇总
    console.log('\n' + '='.repeat(60));
    console.log('📊 Stage 21 导入汇总：');
    console.log(`  赛段成绩: ${totalResults} 条`);
    console.log(`  GC总成绩: ${totalGC} 条`);
    console.log(`  冲刺积分: ${totalPoints} 条`);
    console.log(`  爬坡积分: ${totalMountains} 条`);
    console.log(`  青年排名: ${totalYouth} 条`);
    console.log(`  车队排名: ${totalTeamClass} 条`);
    console.log(`  领骑衫:   ${totalJerseys} 条`);

    // 验证 Top 5
    console.log('\n🔍 Stage 21 Top 5:');
    const [top5] = await conn.query(
      `SELECT sr.rank_pos, r.rider_name, t.team_name, sr.time_gap 
       FROM stage_results sr 
       JOIN riders r ON sr.rider_id = r.id 
       JOIN teams t ON sr.team_id = t.id 
       WHERE sr.stage_id = ? ORDER BY sr.rank_pos LIMIT 5`, [stageId]
    );
    top5.forEach(row => {
      console.log(`  ${row.rank_pos}. ${row.rider_name} (${row.team_name}) - ${row.time_gap || 'N/A'}`);
    });

    // 验证最终 GC Top 5
    console.log('\n🔍 最终 GC Top 5:');
    const [gcTop5] = await conn.query(
      `SELECT gc.\`rank\`, r.rider_name, t.team_name, gc.total_time, gc.time_gap 
       FROM general_classification gc 
       JOIN riders r ON gc.rider_id = r.id 
       JOIN teams t ON gc.team_id = t.id 
       WHERE gc.stage_id = ? ORDER BY gc.\`rank\` LIMIT 5`, [stageId]
    );
    gcTop5.forEach(row => {
      console.log(`  ${row.rank}. ${row.rider_name} (${row.team_name}) - ${row.total_time || 'N/A'} (${row.time_gap || 'N/A'})`);
    });

    console.log('\n🎉 Stage 21 数据导入完成！');

  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main().catch(console.error);
