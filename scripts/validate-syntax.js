const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['server', 'miniprogram'];
const SKIP_DIRS = new Set(['node_modules', 'temp', '.git', 'scripts', 'archive']);
const SKIP_FILE_SUFFIXES = ['.bak'];

function collectJsFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectJsFiles(fullPath, files);
      }
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.js') &&
      !SKIP_FILE_SUFFIXES.some(suffix => entry.name.endsWith(suffix))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = TARGET_DIRS
  .map(dir => path.join(ROOT, dir))
  .filter(dir => fs.existsSync(dir))
  .flatMap(dir => collectJsFiles(dir));

let failures = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ['-c', file], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failures += 1;
    console.error(`Syntax check failed: ${path.relative(ROOT, file)}`);
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} file(s) failed syntax validation.`);
  process.exit(1);
}

console.log(`Syntax validation passed for ${files.length} file(s).`);
