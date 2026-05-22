const puppeteer = require('puppeteer');

async function main() {
  let browser;
  try {
    console.log('🚴 调试 PCS 分类排名页面表格结构...\n');
    
    browser = await puppeteer.launch({
      headless: false, // 有头浏览器，方便调试
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 测试 Stage 1 的 Points 分类排名页面
    const url = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-1-points';
    console.log(`🔗 访问: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待页面完全渲染
    
    console.log('✅ 页面加载完成\n');
    
    // 获取所有 table.results 的信息
    const tablesInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table.results');
      const info = [];
      
      tables.forEach((table, index) => {
        // 获取表格前面的标题或文本
        let context = '';
        let prev = table.previousElementSibling;
        while (prev && !context) {
          if (prev.tagName === 'H2' || prev.tagName === 'H3' || prev.tagName === 'H4') {
            context = prev.textContent.trim();
          }
          prev = prev.previousElementSibling;
        }
        
        // 获取表格的列头
        const headerCells = table.querySelectorAll('thead th, thead td');
        const headerText = Array.from(headerCells).map(cell => cell.textContent.trim().substring(0, 30)).join(' | ');
        
        // 获取表格的前几行数据
        const rows = table.querySelectorAll('tbody tr');
        const preview = [];
        for (let i = 0; i < Math.min(rows.length, 3); i++) {
          const cells = rows[i].querySelectorAll('td');
          const cellTexts = Array.from(cells).map(c => c.textContent.trim().substring(0, 15)).join(' | ');
          preview.push(`  Row ${i}: ${cellTexts}`);
        }
        
        info.push({
          index: index,
          rowCount: rows.length,
          context: context || '(无标题)',
          header: headerText || '(无列头)',
          preview: preview.join('\n')
        });
      });
      
      return info;
    });
    
    console.log(`📊 找到 ${tablesInfo.length} 个 table.results:\n`);
    console.log('='.repeat(80));
    
    tablesInfo.forEach(table => {
      console.log(`\n表格 #${table.index}:`);
      console.log(`  行数: ${table.rowCount}`);
      console.log(`  上下文: ${table.context}`);
      console.log(`  列头: ${table.header}`);
      if (table.preview) {
        console.log(`  预览:\n${table.preview.replace(/\n/g, '\n    ')}`);
      }
      console.log('-'.repeat(80));
    });
    
    console.log('\n✅ 调试完成！');
    console.log('💡 提示：正确的 Points classification 表格应该包含 "Pnt" 或 "Points" 列头\n');
    
    // 保持浏览器打开，方便手动检查
    console.log('\n🌐 浏览器保持打开状态，按 Ctrl+C 退出...\n');
    await new Promise(() => {}); // 永久等待
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
  } finally {
    // 不自动关闭浏览器
  }
}

main().catch(console.error);
