const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'miniprogram');
const TARGET_EXTENSIONS = new Set(['.js', '.wxml', '.json']);
const SKIP_DIRS = new Set(['node_modules']);

const FORBIDDEN_PATTERNS = [
  { pattern: /TODO|FIXME|your-template-id|coming soon|敬请期待/i, reason: 'developer placeholder' },
  { pattern: /开发中|功能开发中|滚动功能开发中|关注功能开发中/, reason: 'user-visible unfinished copy' },
  { pattern: /占位/, reason: 'placeholder copy' }
];

const ALLOWLIST = [
  {
    file: 'miniprogram/pages/push-settings/push-settings.js',
    pattern: /订阅模板待配置/,
    reason: 'Intentional P0 copy: tells testers WeChat subscription templates are not configured.'
  },
  {
    file: 'miniprogram/pages/push-settings/push-settings.wxml',
    pattern: /订阅模板待配置/,
    reason: 'Intentional P0 copy: tells testers WeChat subscription templates are not configured.'
  }
];

function normalize(file) {
  return file.replace(/\\/g, '/');
}

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function isAllowed(relativePath, line) {
  const normalized = normalize(relativePath);
  return ALLOWLIST.some(item => item.file === normalized && item.pattern.test(line));
}

const failures = [];

for (const file of collectFiles(TARGET_DIR)) {
  const relativePath = normalize(path.relative(ROOT, file));
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isAllowed(relativePath, line)) return;
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        failures.push(`${relativePath}:${index + 1}: ${reason}: ${line.trim()}`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error('User-visible placeholder copy found:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('User-visible placeholder check passed.');
