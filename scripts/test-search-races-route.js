const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');
const routePath = path.join(ROOT, 'server/routes/search.js');

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
        return poolQueryImpl(String(sql), params);
      }
    }
  };
  return require(routePath);
}

function getHandler(router, method, pathName) {
  const layer = router.stack.find(entry => entry.route && entry.route.path === pathName && entry.route.methods[method]);
  assert(layer, `Route ${method.toUpperCase()} ${pathName} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
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

async function testRaceFilters() {
  const queries = [];
  const router = loadRoute(async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('COUNT(*) AS total FROM races')) {
      return [[{ total: 1 }]];
    }
    if (sql.includes('FROM races')) {
      return [[{
        id: 'race-1',
        race_name: 'Tour Example',
        race_name_zh: '示例赛',
        race_name_en: 'Tour Example',
        race_code: 'tour-example-2026',
        category: 'WORLD_TOUR',
        gender: 'MEN',
        season: 2026,
        country: 'France',
        start_date: '2026-06-20',
        end_date: '2026-06-25',
        total_stages: 5,
        total_distance: 800,
        logo_url: null,
        status: 'ongoing'
      }]];
    }
    return [[]];
  });

  const handler = getHandler(router, 'get', '/races');
  const { res, nextErr } = await invoke(handler, {
    query: {
      q: 'tour',
      year: '2026',
      status: 'ongoing',
      gender: 'MEN',
      category: 'WORLD_TOUR',
      page: '1',
      limit: '20'
    }
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.total, 1);
  assert.strictEqual(res.jsonBody.data.races[0].status, 'ongoing');
  assert.strictEqual(res.jsonBody.data.races[0].displayName, '示例赛');
  assert(queries[0].sql.includes('start_date <= CURDATE()'), 'status filter should constrain ongoing races');
  assert(queries[0].sql.includes('category = ?'), 'category filter should be included');
  assert(queries[0].sql.includes('gender = ?'), 'gender filter should be included');
  assert(queries[0].params.includes(2026), 'year filter should be passed as a number');
  assert(queries[0].params.includes('WORLD_TOUR'), 'category value should be passed');
  assert(queries[0].params.includes('MEN'), 'gender value should be passed');
}

(async () => {
  await testRaceFilters();
  console.log('Search races route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
