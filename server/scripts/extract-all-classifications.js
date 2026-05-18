/**
 * 提取所有分类榜单数据
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

const tables = document.querySelectorAll('table.results');

console.log('📊 提取所有分类榜单：\n');

const allClassifications = [];

tables.forEach((table, index) => {
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  
  if (rows.length === 0) return;
  
  // 提取前几名
  const data = [];
  for (const row of rows.slice(0, 10)) {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 6) {
      const rank = cells[0]?.textContent?.trim();
      const riderLink = cells[5]?.querySelector('a') || cells[6]?.querySelector('a') || cells[7]?.querySelector('a');
      const riderName = riderLink?.textContent?.trim() || '';
      const teamLink = cells[6]?.querySelector('a') || cells[7]?.querySelector('a') || cells[8]?.querySelector('a');
      const teamName = teamLink?.textContent?.trim() || '';
      const time = cells[headers.indexOf('Time')]?.textContent?.trim() || 
                   cells[cells.length - 1]?.textContent?.trim() || '';
      
      if (rank && riderName) {
        data.push({ rank, rider_name: riderName, team_name: teamName, time });
      }
    }
  }
  
  if (data.length > 0) {
    allClassifications.push({
      tableIndex: index + 1,
      headers: headers.slice(0, 6),
      rowCount: rows.length,
      data: data.slice(0, 5)
    });
  }
});

// 输出结果
allClassifications.forEach(cls => {
  console.log(`\n📋 表格 ${cls.tableIndex} (${cls.rowCount} 行): ${cls.headers.join(' | ')}`);
  console.log('排名 | 车手 | 车队 | 时间');
  console.log('-'.repeat(70));
  cls.data.forEach(r => {
    console.log(`${r.rank.padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(30)} | ${r.time}`);
  });
});

// 保存所有数据
fs.writeFileSync('./stage5-all-classifications.json', JSON.stringify(allClassifications, null, 2));
console.log('\n✅ 所有分类数据已保存');
