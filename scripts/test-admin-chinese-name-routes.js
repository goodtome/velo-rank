const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const routePath = path.join(ROOT, 'server/routes/admin.js');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');

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

function loadRoute(poolImpl) {
  delete require.cache[routePath];
  delete require.cache[poolPath];

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: poolImpl
  };

  return require(routePath);
}

function getHandler(router, pathName) {
  const layer = router.stack.find(entry => entry.route && entry.route.path === pathName && entry.route.methods.put);
  assert(layer, `PUT ${pathName} route not found`);
  return layer.route.stack[0].handle;
}

async function invoke(handler, req) {
  const res = createResponse();
  let nextErr = null;
  const maybePromise = handler(req, res, err => {
    nextErr = err;
  });

  if (maybePromise && typeof maybePromise.then === 'function') {
    await maybePromise;
  }

  await new Promise(resolve => setImmediate(resolve));
  return { res, nextErr };
}

async function testRejectsMissingOrNonStringNamesBeforeDb() {
  const routeCases = [
    { path: '/rider/:id/chinese-name', field: 'rider_name_zh' },
    { path: '/team/:id/chinese-name', field: 'team_name_zh' },
    { path: '/race/:id/chinese-name', field: 'race_name_zh' },
    { path: '/stage/:id/chinese-name', field: 'stage_name_zh' }
  ];

  for (const routeCase of routeCases) {
    let queryCount = 0;
    const router = loadRoute({
      async query() {
        queryCount++;
        throw new Error('invalid chinese name payload should not query the database');
      }
    });
    const handler = getHandler(router, routeCase.path);

    const missingBody = await invoke(handler, { params: { id: 'entity-id' } });
    assert.strictEqual(missingBody.nextErr, null);
    assert.strictEqual(missingBody.res.statusCode, 400);
    assert.strictEqual(missingBody.res.jsonBody.code, 400);

    const nonStringName = await invoke(handler, {
      params: { id: 'entity-id' },
      body: { [routeCase.field]: 123 }
    });
    assert.strictEqual(nonStringName.nextErr, null);
    assert.strictEqual(nonStringName.res.statusCode, 400);
    assert.strictEqual(nonStringName.res.jsonBody.code, 400);
    assert.strictEqual(queryCount, 0);
  }
}

async function testTrimsChineseNameBeforeUpdate() {
  const queries = [];
  const router = loadRoute({
    async query(sql, params) {
      queries.push({ sql: String(sql), params });
      return [{ affectedRows: 1 }];
    }
  });
  const handler = getHandler(router, '/rider/:id/chinese-name');

  const { res, nextErr } = await invoke(handler, {
    params: { id: 'rider-id' },
    body: { rider_name_zh: '  张三  ' }
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.entity_type, 'rider');
  assert.strictEqual(res.jsonBody.data.id, 'rider-id');
  assert.strictEqual(res.jsonBody.data.field, 'rider_name_zh');
  assert.strictEqual(res.jsonBody.data.value, '张三');
  assert.strictEqual(res.jsonBody.data.summary.updated, 1);
  assert.strictEqual(queries[0].params[0], '张三');
  assert.strictEqual(queries[0].params[1], 'rider-id');
}

(async () => {
  await testRejectsMissingOrNonStringNamesBeforeDb();
  await testTrimsChineseNameBeforeUpdate();
  console.log('Admin Chinese name route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
