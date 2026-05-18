/**
 * 调试脚本 - 查看表格真实结构
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

const resultTable = document.querySelector('table.results');
if (!resultTable) {
  console.log('未找到表格');
  process.exit(1);
}

// 打印前3行的完整HTML
const rows = resultTable.querySelectorAll('tbody tr');
console.log(`共 ${rows.length} 行\n`);

for (let i = 0; i < Math.min(3, rows.length); i++) {
  console.log(`=== 第 ${i+1} 行 ===`);
  console.log(rows[i].innerHTML.substring(0, 1000));
  console.log('');
}

// 打印表头
console.log('=== 表头 ===');
const headers = Array.from(resultTable.querySelectorAll('thead th'));
headers.forEach((h, i) => {
  console.log(`${i}: ${h.textContent.trim()}`);
});
