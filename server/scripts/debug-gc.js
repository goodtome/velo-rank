/**
 * 调试GC表格Time列
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

const tables = document.querySelectorAll('table.results');
const gcTable = tables[1];

const headers = Array.from(gcTable.querySelectorAll('thead th'));
console.log('GC表格表头（带索引）：');
headers.forEach((h, i) => {
  console.log(`  ${i}: "${h.textContent.trim()}" (class: ${h.className})`);
});

console.log('\n前3行详细数据：');
const rows = Array.from(gcTable.querySelectorAll('tbody tr')).slice(0, 3);

rows.forEach((row, rowIndex) => {
  console.log(`\n第${rowIndex + 1}行：`);
  const cells = row.querySelectorAll('td');
  cells.forEach((cell, i) => {
    const font = cell.querySelector('font');
    const text = font?.textContent?.trim() || cell?.textContent?.trim() || '';
    if (text) {
      console.log(`  列${i}: "${text}"`);
    }
  });
});
