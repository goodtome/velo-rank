const assert = require('assert');
const path = require('path');

const store = new Map();
global.wx = {
  getStorageSync(key) { return store.get(key); },
  setStorageSync(key, value) { store.set(key, value); }
};

const cache = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'cache.js'));

const key = cache.makeKey('stage-results', { stageId: 's-1', page: 1 });
assert.strictEqual(key, 'stage-results:page=1&stageId=s-1');

cache.set(key, { rows: [1, 2] });
const fresh = cache.get(key, { ttl: 60 * 1000 });
assert.deepStrictEqual(fresh.data, { rows: [1, 2] });
assert.strictEqual(fresh.isExpired, false);

store.set(`velo_rank_cache_v1:${key}`, { cachedAt: Date.now() - 1000, data: { rows: [1] } });
assert.strictEqual(cache.get(key, { ttl: 1 }), null);
const stale = cache.get(key, { ttl: 1, allowStale: true });
assert.strictEqual(stale.isExpired, true);
assert.strictEqual(cache.formatCachedAt(stale.cachedAt).length, 5);

console.log('Miniapp cache tests passed.');
