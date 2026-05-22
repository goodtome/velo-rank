const fs = require('fs');
const { JSDOM } = require('jsdom');

// 读取 HTML 文件
const html = fs.readFileSync('D:/codes/velo-rank/server/debug-points.html', 'utf8');

// 解析 HTML
const dom = new JSDOM(html);
const document = dom.window.document;

// 找到所有表格
const tables = document.querySelectorAll('table.results');

console.log(`找到 ${tables.length} 个表格\n`);
console.log('='.repeat(80) + '\n');

// 遍历所有表格
for (let i = 0; i < tables.length; i++) {
  const table = tables[i];
  
  // 获取表格前面的标题（可能是 h2, h3, 或者 .resultFilter 中的文本）
  let context = '';
  let prev = table.previousElementSibling;
  while (prev && !context) {
    if (prev.tagName === 'H2' || prev.tagName === 'H3') {
      context = prev.textContent.trim();
    }
    prev = prev.previousElementSibling;
  }
  
  // 获取列头
  const headerCells = table.querySelectorAll('thead th, thead td');
  const headerText = Array.from(headerCells).map(cell => cell.textContent.trim().substring(0, 20)).join(' | ');
  
  // 获取前两行数据
  const rows = table.querySelectorAll('tbody tr');
  const preview = [];
  for (let j = 0; j < Math.min(rows.length, 2); j++) {
    const cells = rows[j].querySelectorAll('td');
    const cellTexts = Array.from(cells).map(c => c.textContent.trim().substring(0, 15)).join(' | ');
    preview.push(`  Row ${j}: ${cellTexts}`);
  }
  
  console.log(`表格 #${i}:`);
  console.log(`  行数: ${rows.length}`);
  console.log(`  上下文: ${context || '(无标题)'}`);
  console.log(`  列头: ${headerText || '(无列头)'}`);
  if (preview.length > 0) {
    console.log('  预览:');
    preview.forEach(p => console.log(p));
  }
  console.log('-'.repeat(80) + '\n');
}

console.log('\n✅ 分析完成！');
console.log('\n💡 提示：正确的 Points 分类排名表格应该包含 "Pnt" 或 "Points" 列头\n');
