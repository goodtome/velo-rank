const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, 'miniprogram/config/env.js');

function loadEnvModule(storageValue) {
  delete require.cache[envPath];
  global.wx = {
    getStorageSync() {
      return storageValue;
    },
    setStorageSync() {},
    getWindowInfo() {
      return {};
    },
    getDeviceInfo() {
      return {};
    }
  };

  return require(envPath);
}

const env = loadEnvModule(undefined);
assert.strictEqual(env.getEnv(), 'production');
assert.strictEqual(env.getConfig().baseUrl, 'https://velo-rank-api.fly.dev/api/v1');
assert.strictEqual(env.getConfig().wsUrl, 'wss://velo-rank-api.fly.dev/ws/realtime');
assert.deepStrictEqual(env.getSubscribeTemplateIds(), {
  raceStart: '',
  stageEnd: '',
  riderChange: '',
  keyEvent: ''
});

const devEnv = loadEnvModule('development');
assert.strictEqual(devEnv.getEnv(), 'development');
assert.strictEqual(devEnv.getConfig().baseUrl, 'http://localhost:3000/api/v1');
assert.strictEqual(devEnv.getConfig().wsUrl, 'ws://localhost:3000/ws/realtime');
assert.deepStrictEqual(devEnv.getSubscribeTemplateIds(), {
  raceStart: '',
  stageEnd: '',
  riderChange: '',
  keyEvent: ''
});

console.log('Mini program env default test passed.');
