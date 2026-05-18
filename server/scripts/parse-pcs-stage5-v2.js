/**
 * 解析 PCS Stage 5 HTML 并提取赛段成绩 - 修正版
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

console.log('🔍 解析 PCS Stage 5 页面...\n');

// 查找结果表格 - 使用 .results 类
const resultTable = document.querySelector('table.results');
if (!resultTable) {
  console.log('❌ 未找到成绩表格');
  process.exit(1);
}

// 获取表头
const headers = Array.from(resultTable.querySelectorAll('thead th')).map(th => th.textContent.trim());
console.log(`表格表头: ${headers.join(' | ')}\n`);

// 解析表格行
const rows = resultTable.querySelectorAll('tbody tr');
console.log(`找到 ${rows.length} 行数据\n`);

const results = [];

for (const row of rows) {
  const cells = row.querySelectorAll('td');
  if (cells.length < 8) continue;
  
  // PCS标准表格结构：
  // 0: Rank, 1: GC rank, 2: Time gap, 3: Rider name, 4: Team, 5: Bib, ...
  const rank = cells[0]?.textContent?.trim();
  const gcRank = cells[1]?.textContent?.trim();
  const timeGap = cells[2]?.textContent?.trim();
  const riderLink = cells[3]?.querySelector('a');
  const riderName = riderLink?.textContent?.trim() || cells[3]?.textContent?.trim();
  const teamLink = cells[4]?.querySelector('a');
  const teamName = teamLink?.textContent?.trim() || cells[4]?.textContent?.trim();
  
  if (rank && riderName) {
    results.push({
      rank: parseInt(rank) || rank,
      gc_rank: gcRank || null,
      rider_name: riderName,
      team_name: teamName || '',
      time_gap: timeGap || '',
      bib: cells[5]?.textContent?.trim() || ''
    });
  }
}

// 输出前20名
console.log('📊 前20名成绩：\n');
console.log('排名 | 车手 | 车队 | 时间差');
console.log('-'.repeat(80));

results.slice(0, 20).forEach(r => {
  console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(30)} | ${r.time_gap}`);
});

if (results.length > 20) {
  console.log(`\n... 还有 ${results.length - 20} 名车手`);
}

// 保存为JSON
fs.writeFileSync('./stage5-results.json', JSON.stringify(results, null, 2));
console.log(`\n✅ 已保存到 stage5-results.json，共 ${results.length} 条记录`);
