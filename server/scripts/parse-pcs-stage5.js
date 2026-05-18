/**
 * 解析 PCS Stage 5 HTML 并提取赛段成绩
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

// 读取HTML
const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

console.log('🔍 解析 PCS Stage 5 页面...\n');

// 查找结果表格 - PCS通常有多个表格，找包含排名的那个
const tables = document.querySelectorAll('table');
console.log(`找到 ${tables.length} 个表格\n`);

// 查找包含 "Rider" 或 "Rank" 表头的表格
let resultTable = null;
for (const table of tables) {
  const headers = table.querySelectorAll('th');
  const headerTexts = Array.from(headers).map(h => h.textContent.trim().toLowerCase());
  
  if (headerTexts.some(h => h.includes('rank') || h.includes('rider'))) {
    resultTable = table;
    console.log(`✅ 找到成绩表格，表头: ${headerTexts.slice(0, 6).join(' | ')}`);
    break;
  }
}

if (!resultTable) {
  console.log('❌ 未找到成绩表格');
  process.exit(1);
}

// 解析表格行
const rows = resultTable.querySelectorAll('tbody tr');
console.log(`找到 ${rows.length} 行数据\n`);

const results = [];

for (const row of rows) {
  const cells = row.querySelectorAll('td');
  if (cells.length < 5) continue;
  
  // 提取文本内容
  const getCell = (index) => cells[index]?.textContent?.trim() || '';
  
  const rank = getCell(0);
  const rider = getCell(2); // 通常是第3列
  const team = getCell(3);  // 通常是第4列
  const time = getCell(5) || getCell(4); // 时间列位置不定
  
  if (rank && rider) {
    results.push({
      rank: parseInt(rank) || rank,
      rider_name: rider,
      team_name: team,
      time_gap: time || ''
    });
  }
}

// 输出结果
console.log('📊 提取到成绩数据：\n');
console.log('排名 | 车手 | 车队 | 时间差');
console.log('-'.repeat(80));

results.forEach((r, i) => {
  console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(30)} | ${r.time_gap}`);
});

// 保存为JSON供后续使用
fs.writeFileSync('./stage5-results.json', JSON.stringify(results, null, 2));
console.log(`\n✅ 已保存到 stage5-results.json，共 ${results.length} 条记录`);
