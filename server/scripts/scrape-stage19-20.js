#!/usr/bin/env node
/**
 * 爬取 PCS Stage 19-20 数据（JS 渲染）并导入积分分类
 * 补充 import-giro2026-full.js 中 HTML 为空的赛段
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
const HTML_DIR = path.join(__dirname, 'pcs_html');

// ============================================================
// ScraperAPI
// ============================================================

function fetchViaScraperAPI(targetUrl, extraParams = {}) {
  return new Promise((resolve, reject) => {
    const params = { api_key: API_KEY, url: targetUrl, render: 'true', premium: 'true', ...extraParams };
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const req = http.get(`http://api.scraperapi.com/?${qs}`, { timeout: 120000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ============================================================
// 工具函数
// ============================================================

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

function fixDuplicatedTime(str) {
  if (!str) return null;
  str = str.trim();
  if (!str || str === '..' || str === '-' || str === 'DNF' || str === 'DNS' || str === 'OTL' || str === 'DSQ') return str;
  if (str.startsWith('*')) str = str.slice(1);
  if (str.startsWith(',,')) { const rest = str.slice(2); return '+' + (rest || '0:00'); }
  if (str.length > 2 && str.length % 2 === 0) {
    const half = str.length / 2;
    if (str.substring(0, half) === str.substring(half)) return str.substring(0, half);
  }
  const spaceMatch = str.match(/^(.+?)\s+\1$/);
  if (spaceMatch) return spaceMatch[1];
  return str;
}

function normalizeTimeGap(val) {
  if (!val) return val;
  if (['DNF', 'DNS', 'OTL', 'DSQ', 's.t.'].includes(val)) return val;
  if (val.startsWith('+')) return val;
  return '+' + val;
}

function isPointsTable($, $table) {
  const headers = [];
  $table.find('tr').first().find('th, td').each((_, cell) => headers.push($(cell).text().trim()));
  const headerStr = headers.join('|');
  const rowCount = $table.find('tr').length;
  if (rowCount <= 2) return false;
  if (!headerStr.includes('Pnt') || !headerStr.includes('Today')) return false;
  if (headerStr.includes('Bonis')) return false;
  if (headerStr.includes('GC') && headerStr.includes('UCI')) return false;
  return true;
}

function identifyTableType($, $table) {
  const headers = [];
  $table.find('tr').first().find('th, td').each((_, cell) => headers.push($(cell).text().trim()));
  const headerStr = headers.join('|');
  const rowCount = $table.find('tr').length;
  const hasPrev = headers.includes('Prev') || headers.includes('▼▲');
  if (headerStr.includes('GC') && headerStr.includes('UCI') && headerStr.includes('Pnt')) {
    if (rowCount <= 2) return 'skip'; return 'stage_results';
  }
  if (headerStr.includes('UCI') && headerStr.includes('Time won/lost') && !headerStr.includes('Pnt') && !headerStr.includes('Class')) {
    if (rowCount <= 2) return 'skip'; if (hasPrev) return 'gc_dup'; return 'gc';
  }
  if (!headerStr.includes('UCI') && headerStr.includes('Time won/lost') && !headerStr.includes('Pnt') && !headerStr.includes('Class')) {
    if (rowCount <= 2) return 'skip';
    if (rowCount >= 10 && rowCount <= 60) { if (hasPrev) return 'youth_dup'; return 'youth'; }
    if (rowCount >= 50) { if (hasPrev) return 'gc_dup'; return 'gc'; }
    return 'skip';
  }
  if (headerStr.includes('Pnt') && headerStr.includes('Bonis')) {
    if (rowCount <= 2) return 'skip'; return 'mountains';
  }
  if (headerStr.includes('Class') && headerStr.includes('Time won/lost')) {
    if (rowCount <= 2) return 'skip'; if (hasPrev) return 'team_dup'; return 'team_classification';
  }
  return 'unknown';
}

async function ensureRider(conn, riderMap, rider) {
  if (riderMap.has(rider.slug)) return riderMap.get(rider.slug);
  const [bySlug] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [rider.slug]);
  if (bySlug.length > 0) { riderMap.set(rider.slug, bySlug[0].id); return bySlug[0].id; }
  const [byName] = await conn.query('SELECT id FROM riders WHERE rider_name = ?', [rider.name]);
  if (byName.length > 0) {
    await conn.query('UPDATE riders SET rider_slug = ? WHERE id = ?', [rider.slug, byName[0].id]);
    riderMap.set(rider.slug, byName[0].id); return byName[0].id;
  }
  const id = uuidv4();
  await conn.query('INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (?, ?, ?, ?)', [id, rider.name, rider.slug, '']);
  riderMap.set(rider.slug, id); return id;
}

async function ensureTeam(conn, teamMap, team) {
  const key = team.slug || team.name;
  if (teamMap.has(key)) return teamMap.get(key);
  if (team.slug) {
    const [bySlug] = await conn.query('SELECT id FROM teams WHERE team_slug = ?', [team.slug]);
    if (bySlug.length > 0) { teamMap.set(key, bySlug[0].id); return bySlug[0].id; }
  }
  const [byName] = await conn.query('SELECT id FROM teams WHERE team_name = ?', [team.name]);
  if (byName.length > 0) {
    if (team.slug) await conn.query('UPDATE teams SET team_slug = ? WHERE id = ?', [team.slug, byName[0].id]);
    teamMap.set(key, byName[0].id); return byName[0].id;
  }
  const id = uuidv4();
  await conn.query('INSERT INTO teams (id, team_name, team_slug) VALUES (?, ?, ?)', [id, team.name, team.slug || null]);
  teamMap.set(key, id); return id;
}

async function upsertJersey(conn, stageId, jerseyType, riderId, teamId) {
  await conn.query(
    `INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id)`,
    [uuidv4(), stageId, jerseyType, riderId, teamId]
  );
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('🚴 爬取 PCS Stage 19-20 (JS 渲染)');
  console.log('='.repeat(60));

  const stagesToFetch = [
    { num: 19, url: 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-19' },
    { num: 20, url: 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-20' },
  ];

  const scrapedHTML = {};

  for (const stage of stagesToFetch) {
    console.log(`\n📡 爬取 Stage ${stage.num}...`);
    try {
      const result = await fetchViaScraperAPI(stage.url);
      if (result.status === 200 && result.body.length > 10000) {
        const $ = cheerio.load(result.body);
        const riderLinks = $('a[href^="rider/"]').length;
        console.log(`  Status: ${result.status}, Size: ${result.body.length} bytes, Rider links: ${riderLinks}`);
        if (riderLinks >= 50) {
          scrapedHTML[stage.num] = result.body;
          // 保存 HTML
          const htmlPath = path.join(HTML_DIR, `giro_s${stage.num}.html`);
          if (fs.existsSync(htmlPath)) fs.copyFileSync(htmlPath, htmlPath + '.bak2');
          fs.writeFileSync(htmlPath, result.body, 'utf8');
          console.log(`  ✅ 已保存 HTML`);
        } else {
          console.log(`  ⚠️ Rider links 太少，尝试 ultra_premium...`);
          const result2 = await fetchViaScraperAPI(stage.url, { ultra_premium: 'true' });
          if (result2.status === 200 && result2.body.length > 10000) {
            const $2 = cheerio.load(result2.body);
            const riderLinks2 = $2('a[href^="rider/"]').length;
            console.log(`  ultra_premium: Rider links: ${riderLinks2}`);
            if (riderLinks2 >= 50) {
              scrapedHTML[stage.num] = result2.body;
              const htmlPath = path.join(HTML_DIR, `giro_s${stage.num}.html`);
              if (fs.existsSync(htmlPath)) fs.copyFileSync(htmlPath, htmlPath + '.bak2');
              fs.writeFileSync(htmlPath, result2.body, 'utf8');
              console.log(`  ✅ 已保存 HTML`);
            }
          }
        }
      } else {
        console.log(`  ❌ 请求失败: status=${result.status}`);
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }
  }

  if (Object.keys(scrapedHTML).length === 0) {
    console.log('\n❌ 没有成功爬取任何赛段');
    process.exit(1);
  }

  // ---- 解析并导入 ----
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig.development);
    console.log('\n📋 解析并导入数据...');

    const riderMap = new Map();
    const teamMap = new Map();
    const [allRiders] = await conn.query('SELECT id, rider_slug FROM riders WHERE rider_slug IS NOT NULL');
    allRiders.forEach(r => riderMap.set(r.rider_slug, r.id));
    const [allTeams] = await conn.query('SELECT id, team_slug FROM teams WHERE team_slug IS NOT NULL');
    allTeams.forEach(t => teamMap.set(t.team_slug, t.id));

    for (const [stageNumStr, html] of Object.entries(scrapedHTML)) {
      const stageNum = parseInt(stageNumStr);
      console.log(`\n  --- Stage ${stageNum} ---`);

      const [stageInfo] = await conn.query(
        `SELECT s.id FROM stages s JOIN races r ON s.race_id = r.id 
         WHERE r.race_code = 'giro-ditalia-2026' AND s.stage_number = ?`, [stageNum]
      );
      if (stageInfo.length === 0) continue;
      const stageId = stageInfo[0].id;

      const $ = cheerio.load(html);

      // ---- 1. Stage Results ----
      let stageResultsTable = null;
      $('table').each((_, table) => {
        const $table = $(table);
        if (identifyTableType($, $table) === 'stage_results') stageResultsTable = $table;
      });

      if (stageResultsTable) {
        await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
        await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);

        const headerCells = [];
        stageResultsTable.find('tr').first().find('th, td').each((_, cell) => headerCells.push($(cell).text().trim()));
        const gcColIdx = headerCells.indexOf('GC');
        const timelagColIdx = headerCells.indexOf('Timelag');
        const timeColIdx = headerCells.length - 1;

        let countResults = 0, countGC = 0;

        const rows = [];
        stageResultsTable.find('tr').slice(1).each((_, tr) => {
          const cells = [];
          $(tr).find('td').each((__, td) => cells.push($(td)));
          if (cells.length > 0) rows.push(cells);
        });

        for (const cells of rows) {
          if (cells.length < 10) continue;
          const stageRank = parseInt(cells[0].text().trim());
          if (isNaN(stageRank)) continue;

          let rider = null, team = null, riderIdx = -1;
          for (let ci = 0; ci < cells.length; ci++) {
            if (!rider) { const r = extractRiderInfo(cells[ci]); if (r) { rider = r; riderIdx = ci; } }
            if (!team && ci > (riderIdx > 0 ? riderIdx - 1 : 0)) { const t = extractTeamInfo(cells[ci]); if (t) team = t; }
          }
          if (!rider || !team) continue;

          const timeGap = normalizeTimeGap(fixDuplicatedTime(cells[cells.length - 1].text())) || null;
          let natCode = '';
          for (let ci = 0; ci < cells.length; ci++) {
            const flagClass = cells[ci].find('span.flag, span[class*="flag"]').attr('class') || '';
            const natMatch = flagClass.match(/flag\s+(\w{2})/i) || flagClass.match(/fi\s+(\w{2})/i);
            if (natMatch) { natCode = natMatch[1].toUpperCase(); break; }
          }

          const riderId = await ensureRider(conn, riderMap, rider);
          const teamId = await ensureTeam(conn, teamMap, team);

          await conn.query(
            `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap) VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id), time_gap=VALUES(time_gap)`,
            [uuidv4(), stageId, stageRank, riderId, teamId, natCode, timeGap]
          );
          countResults++;

          if (gcColIdx >= 0 && gcColIdx < cells.length) {
            const gcRank = parseInt(cells[gcColIdx].text().trim());
            if (!isNaN(gcRank) && gcRank > 0) {
              const gcTimeGap = (timelagColIdx >= 0 && timelagColIdx < cells.length) ? fixDuplicatedTime(cells[timelagColIdx].text()) || null : null;
              const totalTime = (timeColIdx >= 0 && timeColIdx < cells.length) ? fixDuplicatedTime(cells[timeColIdx].text()) || null : null;
              await conn.query(
                `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE rider_id=VALUES(rider_id), team_id=VALUES(team_id), total_time=VALUES(total_time), time_gap=VALUES(time_gap)`,
                [uuidv4(), stageId, gcRank, riderId, teamId, natCode, totalTime, gcTimeGap]
              );
              countGC++;
            }
          }
        }
        console.log(`    成绩: ${countResults}, GC: ${countGC}`);

        // 粉衫
        const [gcFirst] = await conn.query(
          'SELECT gc.rider_id, gc.team_id FROM general_classification gc WHERE gc.stage_id = ? AND gc.`rank` = 1', [stageId]
        );
        if (gcFirst.length > 0) {
          await upsertJersey(conn, stageId, 'PINK', gcFirst[0].rider_id, gcFirst[0].team_id);
        }
      }

      // ---- 2. Points Classification ----
      const pointsTables = [];
      $('table').each((_, table) => {
        const $table = $(table);
        if (isPointsTable($, $table)) {
          const rowCount = $table.find('tr').length - 1;
          pointsTables.push({ $table, rowCount });
        }
      });

      if (pointsTables.length > 0) {
        let best = pointsTables[0];
        for (const pt of pointsTables) { if (pt.rowCount > best.rowCount) best = pt; }

        const headerCells = [];
        best.$table.find('tr').first().find('th, td').each((_, cell) => headerCells.push($(cell).text().trim()));
        let pntColIdx = headerCells.length - 2;
        for (let i = headerCells.length - 1; i >= 0; i--) {
          if (headerCells[i] === 'Pnt' && (i + 1 >= headerCells.length || headerCells[i + 1] === 'Today')) { pntColIdx = i; break; }
        }

        await conn.query('DELETE FROM points_classification WHERE stage_id = ?', [stageId]);
        let count = 0;
        const rows = [];
        best.$table.find('tr').slice(1).each((_, tr) => {
          const cells = [];
          $(tr).find('td').each((__, td) => cells.push($(td)));
          if (cells.length > 0) rows.push(cells);
        });

        for (const cells of rows) {
          if (cells.length < 6) continue;
          const rank = parseInt(cells[0].text().trim());
          if (isNaN(rank)) continue;
          let rider = null;
          for (const cell of cells) { const r = extractRiderInfo(cell); if (r && !rider) { rider = r; break; } }
          if (!rider) continue;
          const points = (pntColIdx >= 0 && pntColIdx < cells.length) ? parseInt(cells[pntColIdx].text().trim()) || 0 : 0;
          const riderId = await ensureRider(conn, riderMap, rider);
          await conn.query(
            `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type) VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
            [stageId, riderId, rank, points, 'PURPLE']
          );
          count++;
        }
        if (count > 0) {
          const [ptsFirst] = await conn.query('SELECT rider_id FROM points_classification WHERE stage_id = ? AND `rank` = 1', [stageId]);
          if (ptsFirst.length > 0) {
            const [teamRes] = await conn.query('SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [ptsFirst[0].rider_id, stageId]);
            if (teamRes.length > 0) await upsertJersey(conn, stageId, 'PURPLE', ptsFirst[0].rider_id, teamRes[0].team_id);
          }
        }
        console.log(`    积分: ${count}`);
      }

      // ---- 3. Mountains ----
      let mtnCount = 0;
      const mtnTables = [];
      $('table').each((_, table) => {
        const $table = $(table);
        if (identifyTableType($, $table) === 'mountains') {
          mtnTables.push($table);
        }
      });
      if (mtnTables.length > 0) {
        let bestMtn = mtnTables[0];
        for (const mt of mtnTables) { if (mt.find('tr').length > bestMtn.find('tr').length) bestMtn = mt; }

        await conn.query('DELETE FROM mountains_classification WHERE stage_id = ?', [stageId]);
        const rows = [];
        bestMtn.find('tr').slice(1).each((_, tr) => {
          const cells = [];
          $(tr).find('td').each((__, td) => cells.push($(td)));
          if (cells.length > 0) rows.push(cells);
        });
        for (const cells of rows) {
          if (cells.length < 8) continue;
          const rank = parseInt(cells[0].text().trim());
          if (isNaN(rank)) continue;
          let rider = null;
          for (const cell of cells) { const r = extractRiderInfo(cell); if (r && !rider) rider = r; }
          if (!rider) continue;
          const points = parseInt(cells[cells.length - 2].text().trim()) || 0;
          const riderId = await ensureRider(conn, riderMap, rider);
          await conn.query(
            `INSERT INTO mountains_classification (stage_id, rider_id, \`rank\`, points, jersey_type) VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
            [stageId, riderId, rank, points, 'BLUE']
          );
          mtnCount++;
        }
        if (mtnCount > 0) {
          const [mtnFirst] = await conn.query('SELECT rider_id FROM mountains_classification WHERE stage_id = ? AND `rank` = 1', [stageId]);
          if (mtnFirst.length > 0) {
            const [teamRes] = await conn.query('SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [mtnFirst[0].rider_id, stageId]);
            if (teamRes.length > 0) await upsertJersey(conn, stageId, 'BLUE', mtnFirst[0].rider_id, teamRes[0].team_id);
          }
        }
        console.log(`    爬坡: ${mtnCount}`);
      }

      // ---- 4. Youth ----
      let youthCount = 0;
      const youthTables = [];
      $('table').each((_, table) => {
        const $table = $(table);
        if (identifyTableType($, $table) === 'youth') youthTables.push($table);
      });
      if (youthTables.length > 0) {
        const bestYouth = youthTables[0];
        await conn.query('DELETE FROM youth_classification WHERE stage_id = ?', [stageId]);
        const rows = [];
        bestYouth.find('tr').slice(1).each((_, tr) => {
          const cells = [];
          $(tr).find('td').each((__, td) => cells.push($(td)));
          if (cells.length > 0) rows.push(cells);
        });
        for (const cells of rows) {
          if (cells.length < 8) continue;
          const rank = parseInt(cells[0].text().trim());
          if (isNaN(rank)) continue;
          let rider = null;
          for (const cell of cells) { const r = extractRiderInfo(cell); if (r && !rider) rider = r; }
          if (!rider) continue;
          const lastCells = cells.slice(-2);
          const time = fixDuplicatedTime(lastCells[0].text());
          const timeGap = fixDuplicatedTime(lastCells[1].text()) || null;
          const riderId = await ensureRider(conn, riderMap, rider);
          await conn.query(
            `INSERT INTO youth_classification (stage_id, rider_id, \`rank\`, time, time_gap, jersey_type) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), time=VALUES(time), time_gap=VALUES(time_gap)`,
            [stageId, riderId, rank, time, timeGap, 'WHITE']
          );
          youthCount++;
        }
        if (youthCount > 0) {
          const [youthFirst] = await conn.query('SELECT rider_id FROM youth_classification WHERE stage_id = ? AND `rank` = 1', [stageId]);
          if (youthFirst.length > 0) {
            const [teamRes] = await conn.query('SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [youthFirst[0].rider_id, stageId]);
            if (teamRes.length > 0) await upsertJersey(conn, stageId, 'WHITE', youthFirst[0].rider_id, teamRes[0].team_id);
          }
        }
        console.log(`    青年: ${youthCount}`);
      }

      // ---- 5. Team Classification ----
      let teamCount = 0;
      const teamClassTables = [];
      $('table').each((_, table) => {
        const $table = $(table);
        if (identifyTableType($, $table) === 'team_classification') teamClassTables.push($table);
      });
      if (teamClassTables.length > 0) {
        const bestTeamClass = teamClassTables[0];
        await conn.query('DELETE FROM team_classification WHERE stage_id = ?', [stageId]);
        const rows = [];
        bestTeamClass.find('tr').slice(1).each((_, tr) => {
          const cells = [];
          $(tr).find('td').each((__, td) => cells.push($(td)));
          if (cells.length > 0) rows.push(cells);
        });
        for (const cells of rows) {
          if (cells.length < 5) continue;
          const rank = parseInt(cells[0].text().trim());
          if (isNaN(rank)) continue;
          let team = null;
          for (const cell of cells) { const t = extractTeamInfo(cell); if (t && !team) team = t; }
          if (!team) continue;
          const lastCells = cells.slice(-2);
          const totalTime = fixDuplicatedTime(lastCells[0].text());
          const timeGap = fixDuplicatedTime(lastCells[1].text()) || null;
          const teamId = await ensureTeam(conn, teamMap, team);
          await conn.query(
            `INSERT INTO team_classification (id, stage_id, \`rank\`, team_id, total_time, time_gap) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE team_id=VALUES(team_id), total_time=VALUES(total_time), time_gap=VALUES(time_gap)`,
            [uuidv4(), stageId, rank, teamId, totalTime, timeGap]
          );
          teamCount++;
        }
        console.log(`    车队: ${teamCount}`);
      }
    }

    // 验证
    console.log('\n🔍 验证...');
    for (const sn of [19, 20]) {
      const [res] = await conn.query(
        `SELECT COUNT(*) as cnt FROM points_classification pc 
         JOIN stages s ON pc.stage_id = s.id JOIN races r ON s.race_id = r.id
         WHERE r.race_code = 'giro-ditalia-2026' AND s.stage_number = ?`, [sn]
      );
      const [sr] = await conn.query(
        `SELECT COUNT(*) as cnt FROM stage_results sr
         JOIN stages s ON sr.stage_id = s.id JOIN races r ON s.race_id = r.id
         WHERE r.race_code = 'giro-ditalia-2026' AND s.stage_number = ?`, [sn]
      );
      console.log(`  S${sn}: 成绩 ${sr[0].cnt} 条, 积分 ${res[0].cnt} 条`);
    }

    console.log('\n🎉 Stage 19-20 爬取导入完成！');

  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main().catch(console.error);
