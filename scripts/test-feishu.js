const fs = require('fs');
const path = require('path');

// 将输出写入文件
const output = [];
output.push('Test script running');
output.push('Node version: ' + process.version);
output.push('Platform: ' + process.platform);
output.push('CWD: ' + process.cwd());

// 检查全局 npm 目录
const globalPaths = require('module').globalPaths;
output.push('Global paths: ' + JSON.stringify(globalPaths));

// 检查 PATH
output.push('PATH: ' + process.env.PATH);

// 检查是否有 lark-cli
const npmGlobalPath = globalPaths.find(p => p.includes('node_modules'));
if (npmGlobalPath) {
  output.push('Checking: ' + npmGlobalPath);
  try {
    const files = fs.readdirSync(npmGlobalPath);
    output.push('Files in global node_modules: ' + files.filter(f => f.includes('lark')).join(', '));
  } catch (e) {
    output.push('Error reading global node_modules: ' + e.message);
  }
}

fs.writeFileSync('D:\\codes\\velo-rank\\scripts\\output.txt', output.join('\n'));
