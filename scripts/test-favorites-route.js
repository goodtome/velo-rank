const assert = require('assert');
const path = require('path');
const { AppError } = require('../server/middleware/errorHandler');

const ROOT = path.resolve(__dirname, '..');
const routePath = path.join(ROOT, 'server/routes/favorites.js');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');
const servicePath = path.join(ROOT, 'server/services/favoritesService.js');

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

function loadRouteWithMocks({ serviceImpl, poolQueryImpl }) {
  delete require.cache[routePath];
  delete require.cache[poolPath];
  delete require.cache[servicePath];

  const mockPool = {
    async query(sql, params) {
      if (poolQueryImpl) {
        return poolQueryImpl(sql, params);
      }

      if (String(sql).includes('FROM riders WHERE id IN')) {
        return [[...(params || []).map(id => ({ id }))]];
      }

      return [[]];
    }
  };

  const serviceStub = {
    async updateFavoritesTransaction() {
      return serviceImpl();
    }
  };

  require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: mockPool };
  require.cache[servicePath] = { id: servicePath, filename: servicePath, loaded: true, exports: serviceStub };

  const router = require(routePath);
  const putLayer = router.stack.find(layer => layer.route && layer.route.path === '/' && layer.route.methods.put);
  assert(putLayer, 'PUT / route not found');
  const handler = putLayer.route.stack[1].handle;

  return { handler };
}

async function invokePutRoute(handler, body) {
  const req = {
    body,
    openid: 'user-1',
    headers: {}
  };
  const res = createResponse();
  let nextErr = null;

  handler(req, res, (err) => {
    nextErr = err;
  });
  await new Promise(resolve => setImmediate(resolve));

  return { req, res, nextErr };
}

async function testMissingArrayValidation() {
  const { handler } = loadRouteWithMocks({
    serviceImpl: async () => {
      throw new Error('should not be called');
    }
  });

  const { nextErr } = await invokePutRoute(handler, { favorite_ids: 'not-an-array' });
  assert(nextErr instanceof AppError);
  assert.strictEqual(nextErr.statusCode, 400);
  assert.strictEqual(nextErr.message, 'favorite_ids必须是数组');
}

async function testInvalidUuidValidation() {
  const { handler } = loadRouteWithMocks({
    serviceImpl: async () => {
      throw new Error('should not be called');
    }
  });

  const { nextErr } = await invokePutRoute(handler, { favorite_ids: ['bad-id'] });
  assert(nextErr instanceof AppError);
  assert.strictEqual(nextErr.statusCode, 400);
  assert.strictEqual(nextErr.message, '无效的车手ID格式: bad-id');
}

async function testGenericTransactionErrorMapping() {
  const { handler } = loadRouteWithMocks({
    serviceImpl: async () => {
      throw new Error('transaction exploded');
    }
  });

  const { nextErr, res } = await invokePutRoute(handler, { favorite_ids: ['11111111-1111-4111-8111-111111111111'] });
  assert(nextErr instanceof AppError);
  assert.strictEqual(nextErr.statusCode, 500);
  assert.strictEqual(nextErr.message, '更新关注列表失败');
  assert.strictEqual(res.jsonBody, null);
}

async function testAppErrorPassThrough() {
  const passedError = new AppError('部分车手不存在', 404);
  const { handler } = loadRouteWithMocks({
    serviceImpl: async () => {
      throw passedError;
    }
  });

  const { nextErr } = await invokePutRoute(handler, { favorite_ids: ['11111111-1111-4111-8111-111111111111'] });
  assert.strictEqual(nextErr, passedError);
  assert.strictEqual(nextErr.statusCode, 404);
  assert.strictEqual(nextErr.message, '部分车手不存在');
}

(async () => {
  await testMissingArrayValidation();
  await testInvalidUuidValidation();
  await testGenericTransactionErrorMapping();
  await testAppErrorPassThrough();
  console.log('Favorites route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
