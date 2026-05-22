const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
  let browser;
  try {
    console.log('🚴 调试 PCS 页面结构...\n');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 测试不同的 classification 类型
    const types = ['stage', 'gc', 'points', 'mountains', 'youth'];
    
    for (const type of types) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 检查类型: ${type}`);
      console.log('='.repeat(60));
      
      let url;
      if (type === 'stage') {
        url = `https://www.procyclingstats.com/race/giro-d-italia/2026/stage-1`;
      } else {
        url = `https://www.procyclingstats.com/race/giro-d-italia/2026/stage-1/${type}`;
      }
      
      console.log(`🔗 访问: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 保存 HTML
      const html = await page.content();
      fs.writeFileSync(`debug-${type}.html`, html);
      console.log(`  💾 已保存 HTML: debug-${type}.html`);
      
      // 截图
      await page.screenshot({ path: `debug-${type}.png`, fullPage: true });
      console.log(`  📷 已保存截图: debug-${type}.png`);
      
      // 检查表格数量
      const tableCount = await page.evaluate(() => {
        return document.querySelectorAll('table.results').length;
      });
      console.log(`  📊 找到 ${tableCount} 个 table.results`);
      
      // 打印第一个表格的前几行
      const firstTablePreview = await page.evaluate(() => {
        const tables = document.querySelectorAll('table.results');
        if (tables.length === 0) return '没有找到表格';
        
        const firstTable = tables[0];
        const rows = firstTable.querySelectorAll('thead tr, tbody tr');
        const preview = [];
        
        for (let i = 0; i < Math.min(rows.length, 3); i++) {
          const cells = rows[i].querySelectorAll('th, td');
          const cellTexts = Array.from(cells).map(c => c.textContent.trim().substring(0, 20));
          preview.push(cellTexts.join(' | '));
        }
        
        return preview.join('\n');
      });
      
      console.log(`  📋 第一个表格预览:\n${firstTablePreview}`);
    }
    
    console.log('\n✅ 调试完成！请检查生成的 HTML 和截图文件。\n');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(console.error);
