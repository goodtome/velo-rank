const { spawn } = require('child_process');
const path = require('path');

const nodePath = 'C:\\Users\\feng\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe';
const npmCliPath = 'C:\\Users\\feng\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node_modules\\npm\\bin\\npm-cli.js';

console.log('Installing @larksuite/cli globally...');

// Set environment to avoid NODE_OPTIONS issues
const env = { ...process.env };
delete env.NODE_OPTIONS;

const child = spawn(nodePath, [npmCliPath, 'install', '-g', '@larksuite/cli'], {
  env,
  stdio: 'pipe'
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
});

child.on('close', (code) => {
  console.log('Exit code:', code);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);

  // Check if installed
  const fs = require('fs');
  const globalPaths = [
    'C:\\Users\\feng\\AppData\\Roaming\\npm\\lark-cli.cmd',
    'C:\\Users\\feng\\.npm-global\\bin\\lark-cli',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'lark-cli.cmd')
  ];

  globalPaths.forEach(p => {
    console.log(`Checking ${p}: ${fs.existsSync(p)}`);
  });
});
