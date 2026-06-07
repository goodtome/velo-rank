#!/usr/bin/env node
/**
 * 修复 points_classification 数据缺失
 * 
 * 问题：Stage 2+ 的积分表格有 Prev|▼▲ 列，被 identifyTableType 标记为 points_dup 并跳过
 * 修复：对所有赛段，找到最大的 points 表格（含/不含 Prev 均可），解析并导入
 */

const mysql = require('mysql2/promise');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const dbConfig = require('../config/database');

const HTML_DIR = path.join(__dirname, 'pcs_html');

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

/**
 * 判断表格是否为积分分类表（不论有无 Prev 列）
 * 条件：有 Pnt + Today，无 Bonis，无 GC，无 UCI（排除 stage_results）
 */
function isPointsTable($, $table) {
  const headers = [];
  $table.find('tr').first().find('th, td').each((_, cell) => {
    headers.push($(cell).text().trim());
  });
  const headerStr = headers.join('|');
  const rowCount = $table.find('tr').length;

  if (rowCount <= 2) return false; // empty
  if (!headerStr.includes('Pnt') || !headerStr.includes('Today')) return false;
  if (headerStr.includes('Bonis')) return false; // mountains
  if (headerStr.includes('GC') && headerStr.includes('UCI')) return false; // stage_results

  return true;
}

async function ensureRider(conn, riderMap, rider) {
  if (riderMap.has(rider.slug)) return riderMap.get(rider.slug);
  const [bySlug] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [rider.slug]);
  if (bySlug.length > 0) { riderMap.set(rider.slug, bySlug[0].id); return bySlug[0].id; }
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
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig.development);
    console.log('🔧 修复 points_classification 数据');
    console.log('='.repeat(60));

    // 获取所有赛段 ID
    const [stages] = await conn.query(
      `SELECT s.id, s.stage_number FROM stages s 
       JOIN races r ON s.race_id = r.id 
       WHERE r.race_code = 'giro-ditalia-2026' 
       ORDER BY s.stage_number`
    );

    // 加载车手映射
    const riderMap = new Map();
    const [allRiders] = await conn.query('SELECT id, rider_slug FROM riders WHERE rider_slug IS NOT NULL');
    allRiders.forEach(r => riderMap.set(r.rider_slug, r.id));

    let grandTotal = 0;

    for (const stage of stages) {
      const stageNum = stage.stage_number;
      const stageId = stage.id;
      const htmlFile = path.join(HTML_DIR, `giro_s${stageNum}.html`);

      if (!fs.existsSync(htmlFile)) {
        console.log(`  S${String(stageNum).padStart(2,'0')}: HTML 文件不存在，跳过`);
        continue;
      }

      const html = fs.readFileSync(htmlFile, 'utf8');
      const $ = cheerio.load(html);

      // 找到所有积分表格
      const pointsTables = [];
      $('table').each((idx, table) => {
        const $table = $(table);
        if (isPointsTable($, $table)) {
          const rowCount = $table.find('tr').length - 1; // exclude header
          pointsTables.push({ $table, idx, rowCount });
        }
      });

      if (pointsTables.length === 0) {
        console.log(`  S${String(stageNum).padStart(2,'0')}: 无积分表格`);
        continue;
      }

      // 选最大的积分表格
      let bestTable = pointsTables[0];
      for (const pt of pointsTables) {
        if (pt.rowCount > bestTable.rowCount) bestTable = pt;
      }

      // 解析表头，确定 Pnt 列位置
      const headerCells = [];
      bestTable.$table.find('tr').first().find('th, td').each((_, cell) => {
        headerCells.push($(cell).text().trim());
      });

      // 找 Pnt 列（可能有多个 Pnt，取最后一个非 Today 的）
      let pntColIdx = -1;
      for (let i = headerCells.length - 1; i >= 0; i--) {
        if (headerCells[i] === 'Pnt' && headerCells[i + 1] !== 'Pnt') {
          pntColIdx = i;
          break;
        }
      }
      // 如果没找到，尝试找倒数第二个（Today 前一个）
      if (pntColIdx < 0) {
        const todayIdx = headerCells.lastIndexOf('Today');
        if (todayIdx > 0 && headerCells[todayIdx - 1] === 'Pnt') {
          pntColIdx = todayIdx - 1;
        }
      }
      // 还是没找到就取倒数第二列
      if (pntColIdx < 0) {
        pntColIdx = headerCells.length - 2;
      }

      // 清理旧数据
      await conn.query('DELETE FROM points_classification WHERE stage_id = ?', [stageId]);

      let count = 0;
      const rows = [];
      bestTable.$table.find('tr').slice(1).each((_, tr) => {
        const cells = [];
        $(tr).find('td').each((__, td) => cells.push($(td)));
        if (cells.length > 0) rows.push(cells);
      });

      for (const cells of rows) {
        if (cells.length < 6) continue;

        // 排名：第一列
        const rank = parseInt(cells[0].text().trim());
        if (isNaN(rank)) continue;

        // 车手：动态查找
        let rider = null;
        for (const cell of cells) {
          const r = extractRiderInfo(cell);
          if (r && !rider) { rider = r; break; }
        }
        if (!rider) continue;

        // 积分：Pnt 列
        let points = 0;
        if (pntColIdx >= 0 && pntColIdx < cells.length) {
          points = parseInt(cells[pntColIdx].text().trim()) || 0;
        }

        const riderId = await ensureRider(conn, riderMap, rider);

        await conn.query(
          `INSERT INTO points_classification (stage_id, rider_id, \`rank\`, points, jersey_type) 
           VALUES (?,?,?,?,?)
           ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points)`,
          [stageId, riderId, rank, points, 'PURPLE']
        );
        count++;
      }

      grandTotal += count;

      // 生成紫衫
      if (count > 0) {
        const [ptsFirst] = await conn.query(
          'SELECT pc.rider_id FROM points_classification pc WHERE pc.stage_id = ? AND pc.`rank` = 1', [stageId]
        );
        if (ptsFirst.length > 0) {
          const riderId = ptsFirst[0].rider_id;
          // 获取 team_id
          const [teamRes] = await conn.query(
            'SELECT team_id FROM stage_results WHERE rider_id = ? AND stage_id = ? LIMIT 1', [riderId, stageId]
          );
          const teamId = teamRes.length > 0 ? teamRes[0].team_id : null;
          if (teamId) {
            await upsertJersey(conn, stageId, 'PURPLE', riderId, teamId);
          }
        }
      }

      // 显示 top 3
      const [top3] = await conn.query(
        `SELECT pc.\`rank\`, r.rider_name, pc.points 
         FROM points_classification pc JOIN riders r ON pc.rider_id = r.id 
         WHERE pc.stage_id = ? ORDER BY pc.\`rank\` LIMIT 3`, [stageId]
      );
      const top3Str = top3.map(r => `#${r.rank} ${r.rider_name}(${r.points}pt)`).join(', ');
      console.log(`  S${String(stageNum).padStart(2,'0')}: ${count} 条 | ${top3Str}`);
    }

    // 汇总
    console.log('\n' + '='.repeat(60));
    console.log(`📊 共导入 ${grandTotal} 条积分记录`);

    // 验证
    const [totalCheck] = await conn.query('SELECT COUNT(*) as cnt FROM points_classification');
    console.log(`  points_classification 总计: ${totalCheck[0].cnt}`);

    const [jerseyCheck] = await conn.query(
      `SELECT s.stage_number, r.rider_name, j.jersey_type 
       FROM jerseys j JOIN stages s ON j.stage_id = s.id JOIN riders r ON j.rider_id = r.id
       WHERE j.jersey_type = 'PURPLE' 
       ORDER BY s.stage_number`
    );
    console.log(`  紫衫记录: ${jerseyCheck.length} 条`);
    jerseyCheck.forEach(j => console.log(`    S${String(j.stage_number).padStart(2,'0')}: ${j.rider_name}`));

    console.log('\n🎉 points_classification 修复完成！');

  } catch (err) {
    console.error('❌ 修复失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main().catch(console.error);
