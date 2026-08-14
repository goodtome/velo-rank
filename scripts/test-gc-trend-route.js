const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const routePath = path.join(ROOT, 'server/routes/races.js');
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

function getHandler(router) {
  const layer = router.stack.find(entry => (
    entry.route
    && entry.route.path === '/:id/visualization/gc-trend'
    && entry.route.methods.get
  ));
  assert(layer, 'GC trend route not found');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function invoke(handler, req) {
  const res = createResponse();
  let nextErr = null;
  handler(req, res, err => { nextErr = err; });
  for (let index = 0; index < 4 && !res.jsonBody && !nextErr; index += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
  return { res, nextErr };
}

async function testCompleteTrend() {
  const queries = [];
  const router = loadRoute(async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('JOIN general_classification gc ON gc.stage_id = s.id')) {
      return [[{ id: 'stage-3', stage_number: 3 }]];
    }
    if (sql.includes('FROM stages') && sql.includes('stage_name_zh')) {
      return [[
        { id: 'stage-1', stage_number: 1, stage_name: 'Stage 1', stage_name_zh: '' },
        { id: 'stage-2', stage_number: 2, stage_name: 'Stage 2', stage_name_zh: '第二赛段' },
        { id: 'stage-3', stage_number: 3, stage_name: 'Stage 3', stage_name_zh: '' }
      ]];
    }
    if (sql.includes('WHERE gc.stage_id = ?') && sql.includes('r.rider_name')) {
      return [[
        { rider_id: 'rider-1', rank: 1, rider_name: 'Leader', rider_name_zh: '领骑' },
        { rider_id: 'rider-2', rank: 2, rider_name: 'Chaser', rider_name_zh: '' }
      ]];
    }
    if (sql.includes('AND gc.rider_id IN (?)')) {
      return [[
        { stage_id: 'stage-1', rider_id: 'rider-1', rank: 1, time_gap: '0:00', stage_number: 1 },
        { stage_id: 'stage-1', rider_id: 'rider-2', rank: 2, time_gap: '+0:10', stage_number: 1 },
        { stage_id: 'stage-2', rider_id: 'rider-1', rank: 1, time_gap: '0:00', stage_number: 2 },
        { stage_id: 'stage-2', rider_id: 'rider-2', rank: 2, time_gap: '+0:20', stage_number: 2 },
        { stage_id: 'stage-3', rider_id: 'rider-1', rank: 1, time_gap: '0:00', stage_number: 3 },
        { stage_id: 'stage-3', rider_id: 'rider-2', rank: 2, time_gap: '+0:30', stage_number: 3 }
      ]];
    }
    return [[]];
  });

  const { res, nextErr } = await invoke(getHandler(router), {
    params: { id: 'race-1' },
    query: { limit: '8' }
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.status, 'ready');
  assert.strictEqual(res.jsonBody.data.stages.length, 3);
  assert.strictEqual(res.jsonBody.data.riders.length, 2);
  assert.strictEqual(res.jsonBody.data.riders[0].name, '领骑');
  assert.strictEqual(res.jsonBody.data.riders[1].points.length, 3);
  assert.strictEqual(queries[2].params[1], 8, 'requested rider limit should be retained within bounds');
}

async function testPartialTrendAndEmptyTrend() {
  let queryCount = 0;
  const partialRouter = loadRoute(async (sql) => {
    queryCount += 1;
    if (queryCount === 1) return [[{ id: 'stage-2', stage_number: 2 }]];
    if (queryCount === 2) return [[
      { id: 'stage-1', stage_number: 1 },
      { id: 'stage-2', stage_number: 2 }
    ]];
    if (queryCount === 3) return [[
      { rider_id: 'rider-1', rank: 1, rider_name: 'Leader', rider_name_zh: '' },
      { rider_id: 'rider-2', rank: 2, rider_name: 'Chaser', rider_name_zh: '' }
    ]];
    assert(sql.includes('gc.rider_id IN (?)'));
    return [[
      { stage_id: 'stage-1', rider_id: 'rider-1', rank: 1, time_gap: '0:00', stage_number: 1 },
      { stage_id: 'stage-2', rider_id: 'rider-1', rank: 1, time_gap: '0:00', stage_number: 2 },
      { stage_id: 'stage-2', rider_id: 'rider-2', rank: 2, time_gap: '+0:20', stage_number: 2 }
    ]];
  });
  const partial = await invoke(getHandler(partialRouter), { params: { id: 'race-1' }, query: {} });
  assert.strictEqual(partial.nextErr, null);
  assert.strictEqual(partial.res.jsonBody.data.status, 'partial');

  const emptyRouter = loadRoute(async () => [[]]);
  const empty = await invoke(getHandler(emptyRouter), { params: { id: 'race-1' }, query: {} });
  assert.strictEqual(empty.nextErr, null);
  assert.strictEqual(empty.res.jsonBody.data.status, 'empty');
}

(async () => {
  await testCompleteTrend();
  await testPartialTrendAndEmptyTrend();
  console.log('GC trend route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
