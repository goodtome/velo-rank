const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = 'D:\\codes\\velo-rank';
const nodePath = 'C:\\Users\\feng\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe';
const npmCliPath = 'C:\\Users\\feng\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node_modules\\npm\\bin\\npm-cli.js';

console.log('Installing lark-cli...');
console.log('Project dir:', projectDir);

// Use spawn instead of execSync
const child = spawn(nodePath, [npmCliPath, 'install', 'lark-cli'], {
  cwd: projectDir,
  stdio: 'pipe'
});

let output = '';
child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  output += 'STDERR: ' + data.toString();
});

child.on('close', (code) => {
  console.log('Exit code:', code);
  console.log('Output:', output);

  // Check if installed
  const larkCliPath = path.join(projectDir, 'node_modules', '.bin', 'lark-cli.cmd');
  console.log('lark-cli path:', larkCliPath);
  console.log('Exists:', fs.existsSync(larkCliPath));
});
