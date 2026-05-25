const fs = require('fs');

const JSON_FILE = 'D:/codes/velo-rank/server/stage10_full.json';

console.log('读取文件:', JSON_FILE);
const rawData = fs.readFileSync(JSON_FILE, 'utf8');
console.log('文件大小:', rawData.length, '字符');

// 尝试解析JSON
try {
  const results = JSON.parse(rawData);
  console.log('解析成功，数据类型:', typeof results);
  
  if (Array.isArray(results)) {
    console.log('是数组，长度:', results.length);
    console.log('前3条数据:');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
    console.log('\n后3条数据:');
    console.log(JSON.stringify(results.slice(-3), null, 2));
  } else {
    console.log('不是数组，内容:');
    console.log(JSON.stringify(results).substring(0, 500));
  }
} catch (err) {
  console.error('JSON解析失败:', err.message);
  console.log('文件前500字符:');
  console.log(rawData.substring(0, 500));
}
