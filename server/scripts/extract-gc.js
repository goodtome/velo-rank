/**
 * 专门提取GC总成绩榜（表格2）
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

const tables = document.querySelectorAll('table.results');

// 表格2应该是GC榜（170行，与stage结果行数接近但显示Prev排名变化）
const gcTable = tables[1]; // index 1 = 第二个表格

console.log('🏆 GC总成绩榜（Stage 5后）\n');

const headers = Array.from(gcTable.querySelectorAll('thead th')).map(th => th.textContent.trim());
console.log(`表头: ${headers.join(' | ')}\n`);

const rows = Array.from(gcTable.querySelectorAll('tbody tr'));
console.log(`共 ${rows.length} 名车手\n`);

const gcData = [];

for (const row of rows) {
  const cells = row.querySelectorAll('td');
  if (cells.length >= 8) {
    const rank = cells[0]?.textContent?.trim();
    const prev = cells[1]?.textContent?.trim(); // 上赛段排名
    const timeGap = cells[2]?.textContent?.trim(); // 时间差
    const bib = cells[3]?.textContent?.trim();
    
    // Rider在index 7
    const riderCell = cells[7];
    const riderLink = riderCell?.querySelector('a');
    const riderName = riderLink?.textContent?.trim() || riderCell?.textContent?.trim() || '';
    
    // Team在index 8
    const teamCell = cells[8];
    const teamLink = teamCell?.querySelector('a');
    const teamName = teamLink?.textContent?.trim() || teamCell?.textContent?.trim() || '';
    
    // Time在index 12
    const timeCell = cells[12];
    const timeFont = timeCell?.querySelector('font');
    const totalTime = timeFont?.textContent?.trim() || timeCell?.textContent?.trim() || '';
    
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
}

// 输出前20名
console.log('🏆 GC总成绩榜前20名：');
console.log('排名 | 车手 | 车队 | 总时间 | 时间差');
console.log('-'.repeat(90));

gcData.slice(0, 20).forEach(r => {
  console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(32)} | ${r.total_time.padEnd(12)} | ${r.time_gap}`);
});

// 保存
fs.writeFileSync('./stage5-gc.json', JSON.stringify(gcData, null, 2));
console.log(`\n✅ GC数据已保存到 stage5-gc.json (${gcData.length}条)`);
