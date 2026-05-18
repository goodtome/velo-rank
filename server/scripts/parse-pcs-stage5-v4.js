/**
 * 解析 PCS Stage 5 HTML 并提取赛段成绩 - 修复版
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

console.log('🔍 解析 PCS Stage 5 页面...\n');

const resultTable = document.querySelector('table.results');
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
  if (cells.length < 13) continue;
  
  const rank = cells[0]?.textContent?.trim();
  const gcRank = cells[1]?.textContent?.trim();
  const timeGap = cells[2]?.textContent?.trim();
  const bib = cells[3]?.textContent?.trim();
  
  // Rider列(index 7) - 提取a标签文本
  const riderCell = cells[7];
  const riderLink = riderCell?.querySelector('a');
  const riderName = riderLink?.textContent?.trim() || riderCell?.textContent?.trim() || '';
  
  // Team列(index 8) - 提取a标签文本
  const teamCell = cells[8];
  const teamLink = teamCell?.querySelector('a');
  const teamName = teamLink?.textContent?.trim() || teamCell?.textContent?.trim() || '';
  
  // Time列(index 12) - 只取<font>内的文本，避免<span class="hide">重复
  const timeCell = cells[12];
  const timeFont = timeCell?.querySelector('font');
  const time = timeFont?.textContent?.trim() || timeCell?.textContent?.trim() || '';
  
  if (rank && riderName) {
    results.push({
      rank: parseInt(rank),
      gc_rank: gcRank ? parseInt(gcRank) : null,
      rider_name: riderName,
      team_name: teamName,
      time_gap: timeGap,
      time: time,
      bib: bib
    });
  }
}

// 输出前20名
console.log('📊 前20名成绩：\n');
console.log('排名 | 车手 | 车队 | 时间差 | 完成时间');
console.log('-'.repeat(100));

results.slice(0, 20).forEach(r => {
  console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(32)} | ${r.time_gap.padEnd(10)} | ${r.time}`);
});

if (results.length > 20) {
  console.log(`\n... 还有 ${results.length - 20} 名车手`);
}

// 保存为JSON
fs.writeFileSync('./stage5-results.json', JSON.stringify(results, null, 2));
console.log(`\n✅ 已保存到 stage5-results.json，共 ${results.length} 条记录`);

// 导出为JS模块格式供导入脚本使用
const jsContent = `// Stage 5 赛段成绩数据 - 自动生成\n// 来源: https://www.procyclingstats.com/race/giro-d-italia/2026/stage-5\n// 生成时间: ${new Date().toISOString()}\n\nconst STAGE_RESULTS_DATA = ${JSON.stringify(results.map(r => ({
  rank: r.rank,
  rider_name: r.rider_name,
  team_name: r.team_name,
  time_gap: r.time_gap
})), null, 2)};\n`;

fs.writeFileSync('./stage5-results-data.js', jsContent);
console.log('✅ 已保存为 stage5-results-data.js（可直接导入数据库）');
