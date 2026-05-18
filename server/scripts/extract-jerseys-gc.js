/**
 * 从PCS Stage 5页面提取领骑衫和GC总成绩榜
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

console.log('🔍 提取领骑衫和GC数据...\n');

// ============ 1. 提取领骑衫 ============
// PCS的领骑衫通常在页面顶部或专门的div中
const jerseySelectors = [
  '.jerseyClassification',      // 领骑衫区块
  '.jersey',                     // 领骑衫元素
  '[class*="jersey"]',          // 包含jersey的class
  '.shirts',                     // 领骑衫展示区
  '.classificationShirts'       // 分类领骑衫
];

let jerseyData = [];

// 尝试查找包含粉/紫/蓝/白衫的元素
const pinkJersey = document.querySelector('.pinkjersey, .jersey.pink, [class*="pink"]');
const purpleJersey = document.querySelector('.purplejersey, .jersey.purple, [class*="purple"]');
const blueJersey = document.querySelector('.bluejersey, .jersey.blue, [class*="blue"]');
const whiteJersey = document.querySelector('.whitejersey, .jersey.white, [class*="white"]');

console.log('🏆 领骑衫数据：');

// 领骑衫信息通常在页面顶部的表格或div中
// 查找所有包含骑手名字和领骑衫类型的区块
const jerseyBlocks = document.querySelectorAll('.jerseyClassification, .shirt, [class*="jerseyClassification"]');
if (jerseyBlocks.length > 0) {
  console.log(`找到 ${jerseyBlocks.length} 个领骑衫区块`);
  jerseyBlocks.forEach(block => {
    console.log(block.textContent.trim().substring(0, 100));
  });
} else {
  console.log('⚠️  未找到标准领骑衫区块，尝试从页面文本提取...');
  
  // 从meta description中提取领骑衫信息
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    console.log(`Meta描述: ${metaDesc.getAttribute('content')}`);
  }
}

// ============ 2. 提取GC总成绩榜 ============
// GC通常在另一个表格中，class可能包含 "gc" 或 "general"
const gcTable = document.querySelector('table.general, table.gc, table[id*="gc"], table[class*="general"]');
if (!gcTable) {
  // 尝试找所有表格，看哪个包含GC数据
  const allTables = document.querySelectorAll('table');
  console.log(`\n📊 查找GC表格... (共${allTables.length}个表格)`);
  
  for (const table of allTables) {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
    if (headers.some(h => h.includes('gc') || h.includes('general') || h.includes('总成绩'))) {
      console.log(`找到GC表格，表头: ${headers.slice(0, 6).join(' | ')}`);
      
      // 解析GC前10
      const rows = table.querySelectorAll('tbody tr');
      console.log(`\n🏆 GC总成绩榜前10名：`);
      console.log('排名 | 车手 | 车队 | 时间差');
      console.log('-'.repeat(80));
      
      let count = 0;
      for (const row of rows) {
        if (count >= 10) break;
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
          const rank = cells[0]?.textContent?.trim();
          const timeGap = cells[2]?.textContent?.trim();
          const riderLink = cells[7]?.querySelector('a');
          const riderName = riderLink?.textContent?.trim() || '';
          const teamLink = cells[8]?.querySelector('a');
          const teamName = teamLink?.textContent?.trim() || '';
          
          if (rank && riderName) {
            console.log(`${rank.padEnd(6)} | ${riderName.padEnd(25)} | ${teamName.padEnd(30)} | ${timeGap}`);
            count++;
          }
        }
      }
      break;
    }
  }
} else {
  console.log('找到GC表格');
}

// ============ 3. 检查页面中所有表格 ============
console.log('\n📋 页面所有表格统计：');
const tables = document.querySelectorAll('table.results');
console.log(`成绩表格数: ${tables.length}`);

// 检查是否有多个结果标签页
const resultTabs = document.querySelectorAll('.resTab, [data-id]');
console.log(`结果标签页数: ${resultTabs.length}`);

// 保存GC数据（如果找到）
if (gcTable) {
  const rows = gcTable.querySelectorAll('tbody tr');
  const gcResults = [];
  
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 8) {
      const rank = cells[0]?.textContent?.trim();
      const timeGap = cells[2]?.textContent?.trim();
      const riderLink = cells[7]?.querySelector('a');
      const riderName = riderLink?.textContent?.trim() || '';
      const teamLink = cells[8]?.querySelector('a');
      const teamName = teamLink?.textContent?.trim() || '';
      
      if (rank && riderName) {
        gcResults.push({
          rank: parseInt(rank),
          rider_name: riderName,
          team_name: teamName,
          time_gap: timeGap
        });
      }
    }
  }
  
  if (gcResults.length > 0) {
    fs.writeFileSync('./stage5-gc.json', JSON.stringify(gcResults, null, 2));
    console.log(`\n✅ GC数据已保存到 stage5-gc.json (${gcResults.length}条)`);
  }
}
