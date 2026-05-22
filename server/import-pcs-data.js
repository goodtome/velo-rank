#!/usr/bin/env node
/**
 * PCS 2026 Giro d'Italia 数据爬取和入库脚本
 * 
 * 功能：
 * 1. 从PCS网站爬取赛段成绩、GC、积分榜、爬坡榜、青年榜数据
 * 2. 解析HTML并提取结构化数据
 * 3. 存入jersey_db数据库
 * 
 * 使用：
 * node import-pcs-data.js [--stages=1-9] [--types=stage,gc,points,mountains,youth]
 */

const mysql = require('mysql2/promise');
const axios = require('axios');
const { JSDOM } = require('jsdom');

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
  race_code: 'giro-2026'
};

// 要爬取的赛段和类型
const args = process.argv.slice(2);
let stagesToCrawl = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 默认1-9
let typesToCrawl = ['stage', 'gc', 'points', 'mountains', 'youth']; // 默认全部

// 解析命令行参数
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
  return `${base}/${type}`;
}

// 获取HTML
async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`❌ 获取 ${url} 失败:`, error.message);
    return null;
  }
}

// 解析赛段成绩页面
function parseStageResults(html, stageId) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const results = [];
  
  // 查找成绩表格
  const tables = doc.querySelectorAll('table');
  console.log(`  找到 ${tables.length} 个表格`);
  
  // TODO: 根据实际HTML结构解析
  // 这需要查看PCS的实际HTML结构
  
  return results;
}

// 主函数
async function main() {
  console.log('🚀 开始爬取PCS数据...');
  console.log(`赛段: ${stagesToCrawl.join(', ')}`);
  console.log(`类型: ${typesToCrawl.join(', ')}`);
  
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('✓ 数据库连接成功');
  
  // TODO: 确保赛事和赛段存在
  
  // 爬取数据
  for (const stage of stagesToCrawl) {
    console.log(`\n=== 赛段 ${stage} ===`);
    
    for (const type of typesToCrawl) {
      const url = getPCSUrl(stage, type);
      console.log(`\n  正在获取 ${type}: ${url}`);
      
      const html = await fetchHTML(url);
      if (!html) continue;
      
      console.log(`  ✓ HTML获取成功 (${html.length} bytes)`);
      
      // 解析并入库
      if (type === 'stage') {
        const results = parseStageResults(html, stage);
        console.log(`  解析到 ${results.length} 条成绩`);
        // TODO: 入库
      }
      
      // 延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await conn.end();
  console.log('\n✅ 数据爬取完成！');
}

main().catch(console.error);
