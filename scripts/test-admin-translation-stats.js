const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');
const routePath = path.join(ROOT, 'server/routes/admin.js');

function createResponse() {
  return {
    statusCode: 200,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    }
  };
}

function loadRoute(poolQueryImpl) {
  delete require.cache[routePath];
  delete require.cache[poolPath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: {
      async query(sql, params) {
        if (poolQueryImpl) {
          return poolQueryImpl(String(sql), params);
        }

        const text = String(sql);
        if (text.includes('COUNT(*) as total')) {
          return [[{ total: 0, translated: 0 }]];
        }
        return [[]];
      }
    }
  };
  return require(routePath);
}

function getHandler(router, method, pathName) {
  const layer = router.stack.find(entry => entry.route && entry.route.path === pathName && entry.route.methods[method]);
  assert(layer, `Route ${method.toUpperCase()} ${pathName} not found`);
  return layer.route.stack[0].handle;
}

async function invoke(handler, req) {
  const res = createResponse();
  let nextErr = null;
  handler(req, res, err => {
    nextErr = err;
  });
  await new Promise(resolve => setImmediate(resolve));
  return { res, nextErr };
}

(async () => {
  const originalKey = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = 'secret';

  try {
    let router = loadRoute();
    let handler = getHandler(router, 'get', '/translation-stats');

    const { res, nextErr } = await invoke(handler, { headers: { 'x-admin-key': 'secret' } });

    assert.strictEqual(nextErr, null);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonBody.code, 200);
    assert.strictEqual(res.jsonBody.data.teams.percentage, '0.00');
    assert.strictEqual(res.jsonBody.data.riders.percentage, '0.00');
    assert.strictEqual(res.jsonBody.data.races.percentage, '0.00');
    assert.strictEqual(res.jsonBody.data.stages.percentage, '0.00');

    const queryCalls = [];
    router = loadRoute(async (sql, params) => {
      queryCalls.push({ sql, params });
      if (sql.includes('COUNT(*) as total')) {
        return [[{ total: 0 }]];
      }
      return [[]];
    });

    handler = getHandler(router, 'get', '/riders-without-zh');
    const riderResult = await invoke(handler, { query: { limit: 'not-a-number', offset: '-10' }, headers: { 'x-admin-key': 'secret' } });
    assert.strictEqual(riderResult.nextErr, null);
    const riderListQuery = queryCalls.find(call => call.sql.includes('FROM riders') && call.sql.includes('LIMIT ? OFFSET ?'));
    assert.deepStrictEqual(riderListQuery.params, [50, 0]);

    queryCalls.length = 0;
    handler = getHandler(router, 'get', '/teams-without-zh');
    const teamResult = await invoke(handler, { query: { limit: '9999', offset: 'bad' }, headers: { 'x-admin-key': 'secret' } });
    assert.strictEqual(teamResult.nextErr, null);
    const teamListQuery = queryCalls.find(call => call.sql.includes('FROM teams') && call.sql.includes('LIMIT ? OFFSET ?'));
    assert.deepStrictEqual(teamListQuery.params, [100, 0]);

    console.log('Admin translation stats tests passed.');
  } finally {
    if (originalKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = originalKey;
    }
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
