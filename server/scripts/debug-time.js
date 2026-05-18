/**
 * 调试 - 查看Time列完整数据
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

const resultTable = document.querySelector('table.results');
const rows = resultTable.querySelectorAll('tbody tr');

console.log('前5名完整数据：\n');

for (let i = 0; i < Math.min(5, rows.length); i++) {
  const cells = rows[i].querySelectorAll('td');
  if (cells.length >= 13) {
    const rank = cells[0]?.textContent?.trim();
    const gc = cells[1]?.textContent?.trim();
    const timeGap = cells[2]?.textContent?.trim();
    const bib = cells[3]?.textContent?.trim();
    const riderLink = cells[7]?.querySelector('a');
    const riderName = riderLink?.textContent?.trim();
    const teamLink = cells[8]?.querySelector('a');
    const teamName = teamLink?.textContent?.trim();
    const uci = cells[9]?.textContent?.trim();
    const pnt = cells[10]?.textContent?.trim();
    const time = cells[12]?.textContent?.trim();
    
    console.log(`${rank}. ${riderName} (${teamName})`);
    console.log(`   GC: ${gc}, 时间差: ${timeGap}, 时间: ${time}, BIB: ${bib}`);
    console.log(`   UCI: ${uci}, Pnt: ${pnt}`);
    console.log('');
  }
}
