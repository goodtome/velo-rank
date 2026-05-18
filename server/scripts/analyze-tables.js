/**
 * 分析页面所有表格内容
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

console.log('📊 分析页面所有表格：\n');

const tables = document.querySelectorAll('table');
console.log(`共 ${tables.length} 个表格\n`);

tables.forEach((table, index) => {
  const headers = Array.from(table.querySelectorAll('thead th')).slice(0, 6).map(th => th.textContent.trim());
  const rowCount = table.querySelectorAll('tbody tr').length;
  const className = table.className;
  
  console.log(`表格 ${index + 1}: ${className || '(无class)'}`);
  console.log(`  表头: ${headers.join(' | ')}`);
  console.log(`  行数: ${rowCount}`);
  console.log('');
});
