/**
 * 提取GC总成绩榜 - 修复版
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

const tables = document.querySelectorAll('table.results');
const gcTable = tables[1];

console.log('🏆 GC总成绩榜（Stage 5后）\n');

const rows = Array.from(gcTable.querySelectorAll('tbody tr'));
console.log(`共 ${rows.length} 名车手\n`);

const gcData = [];

for (const row of rows) {
  const cells = row.querySelectorAll('td');
  if (cells.length < 12) continue;
  
  const rank = cells[0]?.textContent?.trim();
  const prev = cells[1]?.textContent?.trim();
  const timeGap = cells[2]?.textContent?.trim();
  const bib = cells[3]?.textContent?.trim();
  
  // Rider - 只取<a>标签内容，排除showIfMobile的车队名
  const riderCell = cells[7];
  const riderLink = riderCell?.querySelector('a');
  const riderName = riderLink?.textContent?.trim() || '';
  
  // Team
  const teamCell = cells[8];
  const teamLink = teamCell?.querySelector('a');
  const teamName = teamLink?.textContent?.trim() || '';
  
  // Total time - column 11
  const timeCell = cells[11];
  const timeFont = timeCell?.querySelector('font');
  const totalTime = timeFont?.textContent?.trim() || '';
  
  if (rank && riderName) {
    gcData.push({
      rank: parseInt(rank),
      prev_rank: prev ? parseInt(prev) : null,
      rider_name: riderName,
      team_name: teamName,
      time_gap: timeGap,
      total_time: totalTime,
      bib: bib
    });
  }
}

// 输出前20名
console.log('🏆 GC总成绩榜前20名：');
console.log('排名 | 车手 | 车队 | 总时间');
console.log('-'.repeat(80));

gcData.slice(0, 20).forEach(r => {
  console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(32)} | ${r.total_time}`);
});

// 保存
fs.writeFileSync('./stage5-gc.json', JSON.stringify(gcData, null, 2));
console.log(`\n✅ GC数据已保存到 stage5-gc.json (${gcData.length}条)`);
