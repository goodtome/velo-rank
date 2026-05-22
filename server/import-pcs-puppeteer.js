#!/usr/bin/env node
/**
 * PCS 2026 Giro d'Italia 数据爬取和入库脚本
 * 
 * 功能：
 * 1. 使用Puppeteer绕过Cloudflare保护
 * 2. 爬取赛段成绩
 * 3. 解析HTML并提取结构化数据
 * 4. 存入jersey_db数据库
 * 
 * 使用：
 * node import-pcs-puppeteer.js [--stages=1-9] [--types=stage,gc,points,mountains,youth]
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// 使用stealth插件
puppeteer.use(StealthPlugin());

// 数据库配置
const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// PCS基础URL
const PCS_BASE = 'https://www.procyclingstats.com';

// 赛事信息
const RACE = {
  name: 'Giro d\'Italia',
  year: 2026,
  id: null // 将从数据库获取
};

// 解析命令行参数
const args = process.argv.slice(2);
let stagesToCrawl = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 默认1-9（已完成赛段）
let typesToCrawl = ['stage']; // 默认只爬取赛段成绩

for (const arg of args) {
  if (arg.startsWith('--stages=')) {
    const range = arg.replace('--stages=', '');
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(Number);
      stagesToCrawl = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      stagesToCrawl = range.split(',').map(Number);
    }
  }
  if (arg.startsWith('--types=')) {
    typesToCrawl = arg.replace('--types=', '').split(',');
  }
}

// URL生成函数
function getPCSUrl(stage, type = 'stage') {
  const base = `${PCS_BASE}/race/giro-d-italia/${RACE.year}/stage-${stage}`;
  if (type === 'stage') return base;
  // PCS 使用连字符而不是斜杠：/stage-1-points, /stage-1-kom, /stage-1-youth
  const typeMap = {
    'gc': 'gc',
    'points': 'points',
    'mountains': 'kom',  // PCS 使用 kom 而不是 mountains
    'youth': 'youth'
  };
  return `${base}-${typeMap[type] || type}`;
}

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 解析赛段成绩表格
async function parseStageResults(page, stageNumber) {
  console.log(`    📊 解析赛段 ${stageNumber} 成绩...`);
  
  try {
    // 等待表格加载
    await page.waitForSelector('table.results', { timeout: 10000 });
    
    // 提取表格数据
    const data = await page.evaluate(() => {
      const tables = document.querySelectorAll('table.results');
      if (!tables || tables.length === 0) return [];
      
      const table = tables[0]; // 第一个表格是赛段成绩
      const rows = table.querySelectorAll('tbody tr');
      const results = [];
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 12) continue;
        
        // 提取车手姓名和URL
        const riderCell = cells[7];
        const riderLink = riderCell ? riderCell.querySelector('a') : null;
        const riderName = riderLink ? riderLink.textContent.trim() : '';
        const riderUrl = riderLink ? riderLink.href : '';
        const riderSlug = riderUrl ? riderUrl.split('/').pop() : '';
        
        // 提取车队名称和URL
        const teamCell = cells[8];
        const teamLink = teamCell ? teamCell.querySelector('a') : null;
        const teamName = teamLink ? teamLink.textContent.trim() : '';
        const teamUrl = teamLink ? teamLink.href : '';
        const teamSlug = teamUrl ? teamUrl.split('/').pop() : '';
        
        // 提取国籍（从flag图标）
        let nationality = '';
        const flagSpan = cells[7].querySelector('span.flag');
        if (flagSpan) {
          const flagClass = flagSpan.className;
          const match = flagClass.match(/flag\s+(\S+)/);
          if (match) nationality = match[1].toUpperCase();
        }
        
        // 提取时间（从font标签或span标签）
        const timeCell = cells[11];
        const timeFont = timeCell ? timeCell.querySelector('font') : null;
        const timeSpan = timeCell ? timeCell.querySelector('span.hide') : null;
        const timeGap = timeFont ? timeFont.textContent.trim() : 
                     timeSpan ? timeSpan.textContent.trim() : 
                     timeCell ? timeCell.textContent.trim() : '';
        
        results.push({
          rank: cells[0].textContent.trim(),
          rider_name: riderName,
          rider_slug: riderSlug,
          team_name: teamName,
          team_slug: teamSlug,
          nationality: nationality,
          time_gap: timeGap
        });
      }
      
      return results;
    });
    
    console.log(`    ✓ 解析到 ${data.length} 条成绩`);
    return data;
    
  } catch (error) {
    console.error(`    ❌ 解析赛段成绩失败:`, error.message);
    return [];
  }
}

// 插入赛段成绩到数据库
async function insertStageResults(conn, stageId, results) {
  console.log(`    💾 插入 ${results.length} 条赛段成绩...`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const result of results) {
    try {
      // 先确保车手存在
      let riderId = null;
      const [riders] = await conn.query(
        'SELECT id FROM riders WHERE rider_slug = ?',
        [result.rider_slug]
      );
      
      if (riders.length > 0) {
        riderId = riders[0].id;
      } else {
        // 创建新车手
        riderId = crypto.randomUUID();
        await conn.query(`
          INSERT IGNORE INTO riders 
          (id, rider_name, rider_slug)
          VALUES (?, ?, ?)
        `, [riderId, result.rider_name, result.rider_slug]);
      }
      
      // 确保车队存在
      let teamId = null;
      if (result.team_slug) {
        const [teams] = await conn.query(
          'SELECT id FROM teams WHERE team_slug = ?',
          [result.team_slug]
        );
        
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          // 创建新车队
          teamId = crypto.randomUUID();
          await conn.query(`
            INSERT IGNORE INTO teams 
            (id, team_name, team_slug)
            VALUES (?, ?, ?)
          `, [teamId, result.team_name, result.team_slug]);
        }
      }
      
      // 插入赛段成绩
      await conn.query(`
        INSERT IGNORE INTO stage_results 
        (id, stage_id, rider_id, team_id, rank_pos, time_gap, nationality)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(), 
        stageId, 
        riderId, 
        teamId, 
        parseInt(result.rank) || null, 
        result.time_gap || null, 
        result.nationality || null
      ]);
      
      inserted++;
      
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        skipped++;
      } else {
        console.error(`    ❌ 插入成绩失败:`, error.message);
      }
    }
  }
  
  console.log(`    ✓ 插入 ${inserted} 条，跳过 ${skipped} 条`);
  return inserted;
}

// 解析分类排名表格（GC/积分/爬坡/青年）
async function parseClassification(page, stageNumber, type) {
  console.log(`    📊 解析 ${type} 排名...`);
  
  try {
    // 等待表格加载
    await page.waitForSelector('table.results', { timeout: 10000 });
    
    // 提取表格数据
    const data = await page.evaluate((classType) => {
      const tables = document.querySelectorAll('table.results');
      if (!tables || tables.length === 0) return [];
      
      // 根据分类类型，找到正确的表格
      let targetTable = null;
      
      // 策略：遍历所有表格，根据列头和行数综合判断
      for (let idx = 0; idx < tables.length; idx++) {
        const table = tables[idx];
        const headerCells = table.querySelectorAll('thead th, thead td');
        const headerText = Array.from(headerCells).map(cell => cell.textContent.trim().toUpperCase()).join(' ');
        const rowCount = table.querySelectorAll('tbody tr').length;
        
        // 跳过赛段成绩表（有 "TIMELAG" 列，且行数最多，通常是第一个表）
        if (headerText.includes('TIMELAG')) {
          continue;
        }
        
        // 根据分类类型匹配
        if (classType === 'gc') {
          // GC 表格特征：
          // 1. 包含 "PREV" 和 "TIME WON/LOST"
          // 2. 行数多（~170行，接近完赛人数）
          // 3. 不包含 "PNT" 或 "TODAY"（这些是积分榜特征）
          if (headerText.includes('PREV') && 
              headerText.includes('TIME WON/LOST') && 
              !headerText.includes('PNT') &&
              rowCount > 100) {
            targetTable = table;
            console.log(`找到GC表格: 索引=${idx}, 行数=${rowCount}, 列头=${headerText.substring(0, 50)}`);
            break;
          }
        } else if (classType === 'points') {
          // 冲刺积分榜特征：
          // 1. 包含 "PNT" 和 "TODAY"
          // 2. 行数适中（~50-70行，积分榜只显示有积分的车手）
          if (headerText.includes('PNT') && 
              headerText.includes('TODAY') &&
              rowCount > 30 && rowCount < 100) {
            targetTable = table;
            console.log(`找到Points表格: 索引=${idx}, 行数=${rowCount}, 列头=${headerText.substring(0, 50)}`);
            break;
          }
        } else if (classType === 'mountains') {
          // 爬坡积分榜特征：
          // 1. 包含 "PNT" 和 "TODAY"
          // 2. 行数较少（~20-30行，爬坡积分榜只显示有积分的车手）
          if (headerText.includes('PNT') && 
              headerText.includes('TODAY') &&
              rowCount > 10 && rowCount < 40) {
            targetTable = table;
            console.log(`找到Mountains表格: 索引=${idx}, 行数=${rowCount}, 列头=${headerText.substring(0, 50)}`);
            break;
          }
        } else if (classType === 'youth') {
          // 青年榜特征：
          // 1. 包含 "PREV" 和 "TIME WON/LOST"
          // 2. 不包含 "PNT"
          // 3. 行数适中（~40-60行，U26车手）
          if (headerText.includes('PREV') && 
              headerText.includes('TIME WON/LOST') && 
              !headerText.includes('PNT') &&
              rowCount > 20 && rowCount < 80) {
            targetTable = table;
            console.log(`找到Youth表格: 索引=${idx}, 行数=${rowCount}, 列头=${headerText.substring(0, 50)}`);
            break;
          }
        }
      }
      
      // 如果没找到，使用兜底逻辑：跳过第一个表，选第二个表
      if (!targetTable) {
        console.warn('未找到匹配的表格，使用兜底逻辑（跳过前两个表）');
        for (let i = 2; i < tables.length; i++) {
          const headerCells = tables[i].querySelectorAll('thead th, thead td');
          const headerText = Array.from(headerCells).map(cell => cell.textContent.trim().toUpperCase()).join(' ');
          // 跳过赛段成绩表和GC表
          if (!headerText.includes('TIMELAG')) {
            targetTable = tables[i];
            console.log(`兜底选择表格: 索引=${i}`);
            break;
          }
        }
      }
      
      if (!targetTable) {
        console.error('无法找到任何合适的表格');
        return [];
      }
      
      const rows = targetTable.querySelectorAll('tbody tr');
      const results = [];
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 8) continue;
        
        // 提取车手姓名和URL
        const riderCell = cells[7];
        const riderLink = riderCell ? riderCell.querySelector('a') : null;
        const riderName = riderLink ? riderLink.textContent.trim() : '';
        const riderUrl = riderLink ? riderLink.href : '';
        const riderSlug = riderUrl ? riderUrl.split('/').pop() : '';
        
        // 提取车队名称和URL
        const teamCell = cells[8];
        const teamLink = teamCell ? teamCell.querySelector('a') : null;
        const teamName = teamLink ? teamLink.textContent.trim() : '';
        const teamUrl = teamLink ? teamLink.href : '';
        const teamSlug = teamUrl ? teamUrl.split('/').pop() : '';
        
        // 提取国籍
        let nationality = '';
        const flagSpan = cells[7].querySelector('span.flag');
        if (flagSpan) {
          const flagClass = flagSpan.className;
          const match = flagClass.match(/flag\s+(\S+)/);
          if (match) nationality = match[1].toUpperCase();
        }
        
        const result = {
          rank: cells[0].textContent.trim(),
          rider_name: riderName,
          rider_slug: riderSlug,
          team_name: teamName,
          team_slug: teamSlug,
          nationality: nationality
        };
        
        // 根据分类类型提取不同字段
        if (classType === 'gc') {
          // GC: 有 time_gap（在最后一个 Time 列）
          for (let c = cells.length - 1; c >= 0; c--) {
            const text = cells[c].textContent.trim();
            if (text.includes(':') || text === '' || text === '..') {
              result.time_gap = text;
              break;
            }
          }
        } else if (classType === 'points') {
          // 积分榜: 有 points（Pnt列，通常是第9列）
          const pointsCell = cells[9];
          result.points = pointsCell ? parseInt(pointsCell.textContent.trim()) || 0 : 0;
        } else if (classType === 'mountains') {
          // 爬坡榜: 有 points（Pnt列，通常是第9列）
          const pointsCell = cells[9];
          result.points = pointsCell ? parseInt(pointsCell.textContent.trim()) || 0 : 0;
        } else if (classType === 'youth') {
          // 青年榜: 有 time_gap
          for (let c = cells.length - 1; c >= 0; c--) {
            const text = cells[c].textContent.trim();
            if (text.includes(':') || text === '' || text === '..') {
              result.time_gap = text;
              break;
            }
          }
        }
        
        results.push(result);
      }
      
      return results;
    }, type);
    
    console.log(`    ✓ 解析到 ${data.length} 条 ${type} 排名`);
    return data;
    
  } catch (error) {
    console.error(`    ❌ 解析 ${type} 排名失败:`, error.message);
    return [];
  }
}

// 插入分类排名到数据库
async function insertClassification(conn, stageId, results, type) {
  console.log(`    💾 插入 ${results.length} 条 ${type} 排名...`);
  
  let inserted = 0;
  let skipped = 0;
  
  // 根据类型确定表名和字段
  const tableMap = {
    'gc': 'general_classification',
    'points': 'points_classification',
    'mountains': 'mountains_classification',
    'youth': 'youth_classification'
  };
  
  const tableName = tableMap[type];
  if (!tableName) {
    console.error(`    ❌ 未知的分类类型: ${type}`);
    return 0;
  }
  
  for (const result of results) {
    try {
      // 先确保车手存在
      let riderId = null;
      const [riders] = await conn.query(
        'SELECT id FROM riders WHERE rider_slug = ?',
        [result.rider_slug]
      );
      
      if (riders.length > 0) {
        riderId = riders[0].id;
      } else {
        // 创建新车手
        riderId = crypto.randomUUID();
        await conn.query(`
          INSERT IGNORE INTO riders 
          (id, rider_name, rider_slug)
          VALUES (?, ?, ?)
        `, [riderId, result.rider_name, result.rider_slug]);
      }
      
      // 确保车队存在
      let teamId = null;
      if (result.team_slug) {
        const [teams] = await conn.query(
          'SELECT id FROM teams WHERE team_slug = ?',
          [result.team_slug]
        );
        
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = crypto.randomUUID();
          await conn.query(`
            INSERT IGNORE INTO teams 
            (id, team_name, team_slug)
            VALUES (?, ?, ?)
          `, [teamId, result.team_name, result.team_slug]);
        }
      }
      
      // 根据类型插入不同表
      if (type === 'gc') {
        await conn.query(`
          INSERT IGNORE INTO general_classification 
          (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          stageId,
          parseInt(result.rank) || null,
          riderId,
          teamId,
          result.nationality || null,
          result.time_gap || null
        ]);
      } else if (type === 'points') {
        await conn.query(`
          INSERT IGNORE INTO points_classification 
          (stage_id, rider_id, \`rank\`, points, jersey_type)
          VALUES (?, ?, ?, ?, ?)
        `, [
          stageId,
          riderId,
          parseInt(result.rank) || null,
          result.points || 0,
          null
        ]);
      } else if (type === 'mountains') {
        await conn.query(`
          INSERT IGNORE INTO mountains_classification 
          (stage_id, rider_id, \`rank\`, points, jersey_type)
          VALUES (?, ?, ?, ?, ?)
        `, [
          stageId,
          riderId,
          parseInt(result.rank) || null,
          result.points || 0,
          null
        ]);
      } else if (type === 'youth') {
        await conn.query(`
          INSERT IGNORE INTO youth_classification 
          (stage_id, rider_id, \`rank\`, time_gap, jersey_type)
          VALUES (?, ?, ?, ?, ?)
        `, [
          stageId,
          riderId,
          parseInt(result.rank) || null,
          result.time_gap || null,
          null
        ]);
      }
      
      inserted++;
      
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        skipped++;
      } else {
        console.error(`    ❌ 插入 ${type} 数据失败:`, error.message);
      }
    }
  }
  
  console.log(`    ✓ 插入 ${inserted} 条，跳过 ${skipped} 条`);
  return inserted;
}

// 主函数
async function main() {
  console.log('🚀 开始爬取PCS数据...');
  console.log(`赛段: ${stagesToCrawl.join(', ')}`);
  console.log(`类型: ${typesToCrawl.join(', ')}\n`);
  
  // 启动浏览器
  console.log('🌐 启动浏览器...');
  const browser = await puppeteer.launch({
    headless: false, // 设为true可后台运行
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // 连接数据库
  console.log('📦 连接数据库...');
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('✓ 数据库连接成功\n');
  
  // 获取赛事ID
  const [races] = await conn.query(
    'SELECT id FROM races WHERE race_name = ? AND season = ?',
    [RACE.name, RACE.year]
  );
  
  if (races.length > 0) {
    RACE.id = races[0].id;
    console.log(`✓ 找到赛事: ${RACE.name} (${RACE.year}), ID: ${RACE.id}\n`);
  } else {
    console.log('⚠️  未找到赛事，需要先创建');
    await conn.end();
    await browser.close();
    return;
  }
  
  // 爬取数据
  let totalResults = 0;
  
  for (const stage of stagesToCrawl) {
    console.log(`\n=== 赛段 ${stage} ===`);
    
    // 为每个赛段创建新页面（避免状态污染）
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 获取赛段ID
    const [stages] = await conn.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?',
      [RACE.id, stage]
    );
    
    if (stages.length === 0) {
      console.log(`  ⚠️  赛段 ${stage} 不存在，跳过`);
      continue;
    }
    
    const stageId = stages[0].id;
    
    for (const type of typesToCrawl) {
      const url = getPCSUrl(stage, type);
      console.log(`\n  📡 获取 ${type}: ${url}`);
      
      try {
        // 访问页面
        console.log(`    📡 导航到: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // 等待页面完全加载（Cloudflare 验证）
        console.log(`    ⏳ 等待页面渲染...`);
        
        // 等待标题变化（Cloudflare 验证完成）
        let title = await page.title();
        console.log(`    📄 初始标题: ${title}`);
        
        // 如果标题包含"请稍候"或"Just a moment"，等待Cloudflare验证
        let waitCount = 0;
        while ((title.includes('请稍候') || title.includes('Just a moment') || title.includes('Checking')) && waitCount < 20) {
          console.log(`    ⚠️  检测到Cloudflare拦截，等待... (${waitCount + 1}/20)`);
          await sleep(2000);
          title = await page.title();
          waitCount++;
        }
        
        console.log(`    ✓ 页面标题: ${title}`);
        console.log(`    URL: ${page.url()}`);
        
        // 等待表格加载
        console.log(`    ⏳ 等待表格加载...`);
        try {
          await page.waitForSelector('table.results', { timeout: 20000 });
          console.log(`    ✓ 表格已加载`);
        } catch (e) {
          console.log(`    ⚠️  表格未找到，页面内容:`, await page.content().then(c => c.substring(0, 500)));
        }
        
        await sleep(3000); // 额外等待表格渲染
        
        // 解析数据
        let data = [];
        if (type === 'stage') {
          data = await parseStageResults(page, stage);
          
          // 入库
          if (data.length > 0) {
            const inserted = await insertStageResults(conn, stageId, data);
            totalResults += inserted;
          }
        } else {
          // 解析分类排名（GC/积分/爬坡/青年）
          data = await parseClassification(page, stage, type);
          
          // 入库
          if (data.length > 0) {
            const inserted = await insertClassification(conn, stageId, data, type);
            totalResults += inserted;
          }
        }
        
      } catch (error) {
        console.error(`  ❌ 处理 ${type} 失败:`, error.message);
      }
      
      // 延迟避免请求过快
      await sleep(3000);
    }
    
    // 关闭页面（释放资源）- 在所有类型处理完成后关闭
    await page.close();
  }
  
  // 清理
  await conn.end();
  await browser.close();
  
  console.log(`\n✅ 数据爬取完成！共处理 ${totalResults} 条数据`);
}

main().catch(error => {
  console.error('❌ 程序执行失败:', error);
  process.exit(1);
});
