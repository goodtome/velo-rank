const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { TextDecoder } = require('util');

const ROOT = path.resolve(__dirname, '..');
const TEXT_FILE_PATTERN = /(?:\.(?:js|json|wxml|wxss|html|md|sql|csv|txt|ps1|bat|sh|env|example)$|(?:^|[\\/])\.env(?:\..*)?$)/i;
const SKIP_PATH_PATTERN = /^(node_modules|temp|backups|\.git)(\/|\\)/;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const MOJIBAKE_PATTERNS = [
  // Unicode replacement character and private-use placeholders.
  /\uFFFD/,
  /[\uE000-\uF8FF]/,

  // UTF-8 text decoded as Windows-1252 or similar.
  /(?:\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC[\u0098-\u009D\u2122])/,

  // UTF-8 Chinese decoded as GBK/GB18030. These are common fragments seen in UI text.
  /(?:\u59dd\uff44\u7af4|\u68e3\u682d\u3009|\u93bc\u6ec5\u50a8|\u9427\u5267|\u6960\u6223|\u947e\u5cf0\u5f47|\u74a7\u6d97\u7c28|\u93ac\u7ed8\u579a|\u9354\u72ba\u6d47|\u93c7\u5b58\u67ca|\u9352\u72bb\u6ace|\u9418\u8235|\u675e\ufe3d\u589c|\u675e\ufe42\u69e6|\u93c3\u72b3\u6665|\u93c1\u7248\u5d41|\u59ab\u20ac\u93cc|\u93cb\u52eb\u7f13|\u5a0c\u2103\u6e41|\u93bb\u612a\u7df5|\u701b\u6941|\u935a\u5823)/,

  // Mojibake punctuation produced by Chinese UTF-8 bytes decoded as GBK.
  /(?:\u951b|\u9286|\u9225|\u922e|\u9241|\u9242|\u923f)/,

  // Frequent visible fragments from Chinese UTF-8 decoded with the wrong code page.
  new RegExp([
    '\u951b', '\u9286', '\u922b', '\u923f', '\u9983',
    '\u59ab\u20ac', '\u5bee\u20ac', '\u935a', '\u6769', '\u9435',
    '\u7487', '\u93ba', '\u7f03', '\u93c8'
  ].join('|')),

  // Common Chinese UTF-8 text decoded as GBK/GB18030 in configuration and docs.
  new RegExp([
    '\\u59dd\\uff44', '\\u9477', '\\u93c1\\u7248', '\\u93c8\\u5d85',
    '\\u93c1\\u5d85', '\\u93c8\\u5b58', '\\u9427\\u5267', '\\u935a\\u5823',
    '\\u7f03', '\\u9286', '\\u951b'
  ].join('|'))
];

const ALLOWED_REPLACEMENT_CHAR_FILES = new Set([
  'docs/DATA_ENTRY_SPEC.md',
  'server/admin/index.html'
]);

function normalizePath(file) {
  return file.replace(/\\/g, '/');
}

function listTrackedFiles() {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  const localConfigFiles = ['.env', 'server/config/.env'].filter(file =>
    fs.existsSync(path.join(ROOT, file))
  );

  return [...new Set([...`${tracked}\n${untracked}`.split(/\r?\n/).filter(Boolean), ...localConfigFiles])];
}

function isAllowed(file, line) {
  return ALLOWED_REPLACEMENT_CHAR_FILES.has(normalizePath(file)) && /\uFFFD/.test(line);
}

const failures = [];

for (const file of listTrackedFiles()) {
  if (!TEXT_FILE_PATTERN.test(file) || SKIP_PATH_PATTERN.test(file)) {
    continue;
  }

  const absolutePath = path.join(ROOT, file);
  const bytes = fs.readFileSync(absolutePath);
  let content;

  try {
    content = utf8Decoder.decode(bytes);
  } catch (err) {
    failures.push(`${file}: file is not valid UTF-8`);
    continue;
  }

  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    failures.push(`${file}: UTF-8 BOM is not allowed`);
  }

  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (MOJIBAKE_PATTERNS.some(pattern => pattern.test(line)) && !isAllowed(file, line)) {
      failures.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (failures.length > 0) {
  console.error('Potential encoding/mojibake problems found:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Encoding check passed.');
