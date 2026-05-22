const { chromium } = require('playwright-core');

async function scrapeGiro2026() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\feng\\AppData\\Local\\ms-playwright\\chromium-1209\\chrome-win\\chrome.exe'
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('🚴 开始抓取 2026 年环意大利数据...\n');
  
  try {
    // 1. 打开主页面
    console.log('1️⃣ 打开 PCS Giro 2026 页面...');
    await page.goto('https://www.procyclingstats.com/race/giro-d-italia/2026', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('   ✅ 页面加载成功\n');
    
    // 2. 获取所有赛段链接
    console.log('2️⃣ 获取赛段列表...');
    const stages = await page.evaluate(() => {
      const options = document.querySelectorAll('select[name="stage"] option');
      const stageList = [];
      options.forEach(option => {
        if (option.value && option.value !== '') {
          stageList.push({
            name: option.textContent.trim(),
            url: option.value
          });
        }
      });
      return stageList;
    });
    
    console.log(`   ✅ 找到 ${stages.length} 个赛段\n`);
    
    // 3. 遍历每个赛段，提取数据
    const allData = [];
    
    for (let i = 0; i < Math.min(stages.length, 3); i++) {  // 先测试前3个赛段
      const stage = stages[i];
      console.log(`3️⃣ 处理 ${stage.name}...`);
      
      const stageUrl = `https://www.procyclingstats.com${stage.url}`;
      await page.goto(stageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // 提取赛段结果
      const stageData = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('table.results tbody tr');
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 5) {
            results.push({
              rank: cells[0]?.textContent.trim(),
              rider: cells[1]?.textContent.trim(),
              team: cells[2]?.textContent.trim(),
              time: cells[3]?.textContent.trim()
            });
          }
        });
        
        return results;
      });
      
      allData.push({
        stage: stage.name,
        url: stageUrl,
        results: stageData
      });
      
      console.log(`   ✅ 提取了 ${stageData.length} 条成绩记录`);
    }
    
    console.log('\n✅ 数据抓取完成！');
    console.log('\n📊 抓取统计:');
    allData.forEach(stage => {
      console.log(`   - ${stage.stage}: ${stage.results.length} 条记录`);
    });
    
    // 保存到文件
    const fs = require('fs');
    fs.writeFileSync('giro-2026-data.json', JSON.stringify(allData, null, 2), 'utf8');
    console.log('\n💾 数据已保存到 giro-2026-data.json');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await browser.close();
  }
}

scrapeGiro2026();
