const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function loadMiniappEnv(storageValue) {
  const envPath = path.join(ROOT, 'miniprogram/config/env.js');
  delete require.cache[envPath];
  global.wx = {
    getStorageSync() {
      return storageValue;
    },
    setStorageSync() {}
  };
  return require(envPath);
}

const failures = [];
const warnings = [];

function assertOk(condition, message) {
  if (!condition) failures.push(message);
}

function warnIf(condition, message) {
  if (condition) warnings.push(message);
}

const projectConfig = readJson('miniprogram/project.config.json');
const appConfig = readJson('miniprogram/app.json');
const env = loadMiniappEnv(undefined);
const currentConfig = env.getConfig();
const templateIds = env.getSubscribeTemplateIds();

assertOk(projectConfig.compileType === 'miniprogram', 'project.config.json compileType must be miniprogram.');
assertOk(projectConfig.appid && !/^tourist/i.test(projectConfig.appid), 'project.config.json must contain a real appid.');
assertOk(projectConfig.__usePrivacyCheck__ === true, 'project.config.json must enable __usePrivacyCheck__.');
assertOk(projectConfig.setting && projectConfig.setting.es6 === true, 'project.config.json should enable ES6.');

assertOk(Array.isArray(appConfig.pages) && appConfig.pages.includes('pages/privacy-policy/privacy-policy'), 'app.json must register privacy-policy page.');
assertOk(Array.isArray(appConfig.pages) && appConfig.pages.includes('pages/user-agreement/user-agreement'), 'app.json must register user-agreement page.');
assertOk(appConfig.pages.includes('pages/profile/profile'), 'app.json must register profile page for account deletion entry.');

assertOk(env.getEnv() === 'production', 'miniprogram/config/env.js default env must be production before review.');
assertOk(currentConfig.baseUrl === 'https://velo-rank-api.fly.dev/api/v1', 'production baseUrl should point to Fly.io HTTPS API.');
assertOk(currentConfig.wsUrl === 'wss://velo-rank-api.fly.dev/ws/realtime', 'production wsUrl should point to Fly.io WSS endpoint.');
assertOk(currentConfig.enableDebug === false, 'production enableDebug should be false.');

const configuredTemplateIds = Object.values(templateIds || {}).filter(Boolean);
warnIf(configuredTemplateIds.length === 0, 'No WeChat subscribe template IDs configured in miniprogram/config/env.js; push preferences can be saved, but real subscribe authorization will not appear.');

const requiredPages = [
  'pages/index/index',
  'pages/search/search',
  'pages/profile/profile',
  'pages/race-detail/race-detail',
  'pages/stage-results/stage-results',
  'pages/classification/classification',
  'pages/race-calendar/race-calendar',
  'pages/race-archive/race-archive',
  'pages/push-settings/push-settings'
];

for (const page of requiredPages) {
  assertOk(appConfig.pages.includes(page), `app.json missing review path page: ${page}`);
}

const tabPages = new Set((appConfig.tabBar && appConfig.tabBar.list || []).map(item => item.pagePath));
assertOk(tabPages.has('pages/index/index'), 'tabBar must include home page.');
assertOk(tabPages.has('pages/search/search'), 'tabBar must include search page.');
assertOk(tabPages.has('pages/profile/profile'), 'tabBar must include profile page.');
assertOk(!tabPages.has('pages/admin-sync/admin-sync'), 'admin-sync must not be exposed in tabBar.');

if (warnings.length > 0) {
  console.warn('Review readiness warnings:');
  warnings.forEach(warning => console.warn(`- ${warning}`));
}

if (failures.length > 0) {
  console.error('Review readiness check failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Review readiness check passed.');
