#!/usr/bin/env node
/**
 * 测试Puppeteer访问PCS网站
 */

const puppeteer = require('puppeteer');

async function testPCSAccess() {
  console.log('🚀 启动浏览器...');
  
  const browser = await puppeteer.launch({
    headless: false, // 显示浏览器，方便调试
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('\n📡 访问PCS网站...');
  const url = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-9';
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✓ 页面加载成功');
    
    // 等待表格加载
    await page.waitForSelector('table.results', { timeout: 10000 });
    console.log('✓ 找到成绩表格');
    
    // 获取页面标题
    const title = await page.title();
    console.log(`  页面标题: ${title}`);
    
    // 获取表格行数
    const rowCount = await page.evaluate(() => {
      const table = document.querySelectorAll('table.results')[0];
      return table ? table.querySelectorAll('tbody tr').length : 0;
    });
    console.log(`  表格行数: ${rowCount}`);
    
    // 截图
    await page.screenshot({ path: 'D:/codes/velo-rank/server/test-pcs.png' });
    console.log('📸 截图已保存到 test-pcs.png');
    
    console.log('\n✅ PCS网站访问成功！');
    console.log('浏览器将保持打开状态，按 Ctrl+C 关闭');
    
    // 保持浏览器打开（方便调试）
    // await browser.close();
    
  } catch (error) {
    console.error('❌ 访问失败:', error.message);
    await browser.close();
  }
}

testPCSAccess().catch(console.error);
