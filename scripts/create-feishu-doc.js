const https = require('https');
const fs = require('fs');

// 读取文档内容
const docContent = fs.readFileSync('D:\\codes\\velo-rank\\docs\\小程序功能点与BUG记录.md', 'utf8');

console.log('文档内容长度:', docContent.length);
console.log('前100字符:', docContent.substring(0, 100));

// 由于没有 access_token，我们需要用户先提供
// 这里只是一个示例脚本
console.log('\n请提供飞书应用的 App ID 和 App Secret，或者 user_access_token');
console.log('然后修改此脚本并运行以创建文档');
