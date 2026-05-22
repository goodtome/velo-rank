#!/usr/bin/env node
/**
 * 调试PCS页面表格结构
 * 查看每个classification页面上有多少表格，以及它们的列头文本
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const PCS_BASE = 'https://www.procyclingstats.com';

// 测试赛段和类型
const TEST_CASES = [
  { stage: 5, type: 'points', url: `${PCS_BASE}/race/giro-d-italia/2026/stage-5-points` },
  { stage: 5, type: 'mountains', url: `${PCS_BASE}/race/giro-d-italia/2026/stage-5-kom` },
  { stage: 5, type: 'youth', url: `${PCS_BASE}/race/giro-d-italia/2026/stage-5-youth` },
  { stage: 5, type: 'gc', url: `${PCS_BASE}/race/giro-d-italia/2026/stage-5-gc` }
];

async function debugTables() {
  console.log('🚀 启动浏览器调试表格结构...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  for (const test of TEST_CASES) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 测试: Stage ${test.stage} - ${test.type}`);
    console.log(`🔗 URL: ${test.url}`);
    console.log('='.repeat(80));
    
    try {
      await page.goto(test.url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // 等待Cloudflare
      let title = await page.title();
      let waitCount = 0;
      while ((title.includes('请稍候') || title.includes('Just a moment') || title.includes('Checking')) && waitCount < 20) {
        console.log(`   ⏳ 等待Cloudflare验证... (${waitCount + 1}/20)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        title = await page.title();
        waitCount++;
      }
      
      console.log(`   ✓ 页面标题: ${title}`);
      
      // 等待表格加载
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 提取所有表格的信息
      const tablesInfo = await page.evaluate(() => {
        const tables = document.querySelectorAll('table.results');
        const info = [];
        
        tables.forEach((table, index) => {
          // 获取列头
          const headerCells = table.querySelectorAll('thead th, thead td');
          const headerText = Array.from(headerCells).map(cell => cell.textContent.trim()).join(', ');
          
          // 获取前两行数据（用于识别表格内容）
          const rows = table.querySelectorAll('tbody tr');
          const firstRowCells = rows[0] ? Array.from(rows[0].querySelectorAll('td')).map(cell => cell.textContent.trim().substring(0, 30)) : [];
          const secondRowCells = rows[1] ? Array.from(rows[1].querySelectorAll('td')).map(cell => cell.textContent.trim().substring(0, 30)) : [];
          
          info.push({
            index: index,
            headerText: headerText,
            firstRow: firstRowCells.join(' | '),
            secondRow: secondRowCells.join(' | '),
            rowCount: rows.length
          });
        });
        
        return info;
      });
      
      console.log(`\n   找到 ${tablesInfo.length} 个表格:\n`);
      
      tablesInfo.forEach((table, idx) => {
        console.log(`   📋 表格 ${idx}:`);
        console.log(`      列头: ${table.headerText}`);
        console.log(`      行数: ${table.rowCount}`);
        console.log(`      第1行: ${table.firstRow}`);
        console.log(`      第2行: ${table.secondRow}`);
        console.log('');
      });
      
      // 等待一下再继续
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`   ❌ 错误: ${error.message}`);
    }
  }
  
  await browser.close();
  console.log('\n✅ 调试完成！');
}

debugTables().catch(error => {
  console.error('❌ 调试失败:', error);
  process.exit(1);
});
