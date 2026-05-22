/**
 * 批量导入环意 2026 赛段数据
 * 从 PCS 下载赛段成绩和 GC 数据，然后导入数据库
 * 
 * 使用方式：
 * 1. 下载赛段页面 HTML：python fetch_pcs_stage.py <stage_url> <output.html>
 * 2. 运行此脚本：node import-giro2026-stages.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { JSDOM } = require('jsdom');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: `${__dirname}/../config/.env` });

const dbConfig = require('../config/database');

// 环意 2026 赛段配置
const STAGES = [
  { number: 6, name: 'Potenza → Tagliacozzo', date: '2026-05-13' },
  { number: 7, name: 'Tagliacozzo → Lanciano', date: '2026-05-14' },
  { number: 8, name: 'Lanciano → Giulianova', date: '2026-05-15' },
  { number: 9, name: 'Giulianova → Abbazia di Sant\'Angelo', date: '2026-05-16' },
  { number: 10, name: 'Abbazia di Sant\'Angelo → Viareggio', date: '2026-05-17' },
  // 继续添加更多赛段...
];

const JERSEY_COLORS = {
  '#f5e947': 'YELLOW',
  '#8bd600': 'GREEN',
  '#ff4a36': 'POLKADOT',
  '#e0e0e0': 'WHITE',
  '#007deb': 'BLUE',
  '#EA529E': 'PURPLE',
  '#FBA3AF': 'PINK',
  '#0087EE': 'BLUE_SPRINT',
  '#f5f5f5': 'WHITE_YOUTH'
};

async function downloadStageData(stageNumber) {
  const url = `https://www.procyclingstats.com/race/giro-d-italia/2026/stage-${stageNumber}`;
  const output = `stage-${stageNumber}.html`;
  
  console.log(`\n[${stageNumber}] 下载赛段数据: ${url}`);
  
  try {
    // 使用 curl 下载（简化版，实际应使用 Python 脚本处理 Cloudflare）
    execSync(`curl -s "${url}" -o "${output}"`, { cwd: __dirname });
    console.log(`✅ 下载完成: ${output}`);
    return true;
  } catch (err) {
    console.error(`❌ 下载失败: ${err.message}`);
    return false;
  }
}

async function importStageData(conn, raceId, stageNumber) {
  const htmlFile = path.join(__dirname, `stage-${stageNumber}.html`);
  
  if (!fs.existsSync(htmlFile)) {
    console.log(`⚠️  文件不存在: ${htmlFile}`);
    return false;
  }
  
  const html = fs.readFileSync(htmlFile, 'utf-8');
  const dom = new JSDOM(html);
  const { document } = dom.window;
  
  // 1. 获取或创建赛段记录
  const [stages] = await conn.query(
    'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
    [raceId, stageNumber]
  );
  
  let stageId;
  if (stages.length === 0) {
    stageId = uuidv4();
    await conn.query(
      'INSERT INTO stages (id, race_id, stage_number, stage_code, stage_name, stage_date, distance, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [stageId, raceId, stageNumber, `giro-ditalia-2026-s${stageNumber}`, `Stage ${stageNumber}`, STAGES.find(s => s.number === stageNumber).date, null, null]
    );
    console.log(`✅ 创建赛段记录: ${stageId}`);
  } else {
    stageId = stages[0].id;
    console.log(`✅ 赛段已存在: ${stageId}`);
  }
  
  // 2. 提取并导入赛段成绩
  const rows = document.querySelectorAll('.result-cont .datatable table tr');
  let importCount = 0;
  
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) continue;
    
    const rankText = cells[0]?.textContent?.trim();
    if (!rankText || isNaN(parseInt(rankText))) continue;
    
    const rank = parseInt(rankText);
    const riderName = cells[7]?.textContent?.trim();
    const teamName = cells[8]?.textContent?.trim();
    const time = cells[12]?.textContent?.trim();
    
    if (!riderName) continue;
    
    // 检查是否已存在
    const [existing] = await conn.query(
      'SELECT * FROM stage_results WHERE stage_id = ? AND rank = ?',
      [stageId, rank]
    );
    
    if (existing.length === 0) {
      await conn.query(
        'INSERT INTO stage_results (id, stage_id, rank, rider_name, team_name, time) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), stageId, rank, riderName, teamName, time]
      );
      importCount++;
    }
  }
  
  console.log(`✅ 导入赛段成绩: ${importCount} 条`);
  
  // 3. 提取并导入领骑衫数据
  const jerseys = document.querySelectorAll('.jersey-holder');
  let jerseyCount = 0;
  
  for (const jersey of jerseys) {
    const color = jersey.style.backgroundColor;
    const jerseyType = JERSEY_COLORS[color] || 'UNKNOWN';
    const riderName = jersey.textContent?.trim();
    
    if (!riderName) continue;
    
    const [existing] = await conn.query(
      'SELECT * FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
      [stageId, jerseyType]
    );
    
    if (existing.length === 0) {
      await conn.query(
        'INSERT INTO jerseys (id, stage_id, jersey_type, rider_name) VALUES (?, ?, ?, ?)',
        [uuidv4(), stageId, jerseyType, riderName]
      );
      jerseyCount++;
    }
  }
  
  console.log(`✅ 导入领骑衫数据: ${jerseyCount} 条`);
  
  return true;
}

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('🚴 批量导入环意 2026 赛段数据\n');
    console.log('='.repeat(60));
    
    // 获取赛事 ID
    const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', ['giro-ditalia-2026']);
    if (races.length === 0) {
      console.log('❌ 赛事不存在，请先导入赛事数据');
      return;
    }
    const raceId = races[0].id;
    console.log(`✅ 赛事ID: ${raceId}`);
    
    // 遍历所有赛段
    for (const stage of STAGES) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`赛段 ${stage.number}: ${stage.name}`);
      console.log(`${'='.repeat(60)}`);
      
      // 下载数据
      const downloaded = await downloadStageData(stage.number);
      if (!downloaded) continue;
      
      // 导入数据
      await importStageData(conn, raceId, stage.number);
    }
    
    console.log(`\n✅ 批量导入完成！`);
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}

main();
