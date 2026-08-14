const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_ROOTS = ['scripts', 'server', 'miniprogram'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'archive']);
const SKIP_FILES = new Set([
  'scripts/test-sensitive-config.js',
  'server/config/.env'
]);
const SECRET_PATTERNS = [
  { pattern: /mysql123456/i, label: 'default MySQL password' },
  { pattern: /JkDXt0GyOnhMIagc/i, label: 'TiDB password' },
  { pattern: /2A7GiKTCf4sRJLw/i, label: 'TiDB username' }
];

const LEGACY_SCHEMA_FILES = [
  'server/scripts/sync-to-tidb.js',
  'server/scripts/sync-tdf2026.js'
];

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && /\.(js|json|md|wxml|wxss|sql|env|example)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = SCAN_ROOTS
  .map(dir => path.join(ROOT, dir))
  .filter(dir => fs.existsSync(dir))
  .flatMap(dir => collectFiles(dir));

const failures = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel)) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const { pattern, label } of SECRET_PATTERNS) {
    if (pattern.test(source)) failures.push(`${rel}: contains ${label}`);
  }
}

for (const rel of LEGACY_SCHEMA_FILES) {
  const fullPath = path.join(ROOT, rel);
  if (!fs.existsSync(fullPath)) continue;
  const source = fs.readFileSync(fullPath, 'utf8');
  if (/rank_pos/.test(source)) failures.push(`${rel}: contains legacy rank_pos field`);
}

if (failures.length > 0) {
  console.error('Sensitive config check failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Sensitive config check passed.');
