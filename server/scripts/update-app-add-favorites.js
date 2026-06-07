const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'server', 'app.js');

// 读取文件
let content = fs.readFileSync(appJsPath, 'utf8');

// 要替换和插入的内容
const beforeLine = "app.use('/api/v1/search', rateLimit(apiLimiter, { skip: (req) => req.path.startsWith('/health') }), require('./routes/search'));\n  app.use('/api/v1/sync', rateLimit(syncLimiter), require('./routes/sync'));\n";

const newLine = "app.use('/api/v1/search', rateLimit(apiLimiter, { skip: (req) => req.path.startsWith('/health') }), require('./routes/search'));\n  app.use('/api/v1/favorites', rateLimit(apiLimiter, { skip: (req) => req.path.startsWith('/health') }), require('./routes/favorites'));\n  app.use('/api/v1/sync', rateLimit(syncLimiter), require('./routes/sync'));\n";

// 替换
const updated = content.replace(beforeLine, newLine);

if (updated !== content) {
  // 写回文件
  fs.writeFileSync(appJsPath, updated, 'utf8');
  console.log('✓ app.js 已更新，添加了 favorites 路由');
} else {
  console.log('错误: 未找到目标行，可能已经被更新过了');
}
