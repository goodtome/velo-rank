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

function loadImportStageHandler(poolImpl) {
  delete require.cache[routePath];
  delete require.cache[poolPath];

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: poolImpl
  };

  const router = require(routePath);
  const layer = router.stack.find(entry => entry.route && entry.route.path === '/import-stage' && entry.route.methods.post);
  assert(layer, 'POST /admin/import-stage route not found');
  return layer.route.stack[0].handle;
}

async function invoke(handler, body) {
  const res = createResponse();
  let nextErr = null;
  const maybePromise = handler({ body }, res, err => {
    nextErr = err;
  });

  if (maybePromise && typeof maybePromise.then === 'function') {
    await maybePromise;
  }

  await new Promise(resolve => setImmediate(resolve));
  return { res, nextErr };
}

function validPayload(overrides = {}) {
  return {
    stage_info: {
      race_code: 'tour-2026',
      stage_number: 1,
      stage_name: 'Stage 1'
    },
    results: [
      { rank: 1, rider_name: 'Rider One', team_name: 'Team One', time_gap: '0:00' }
    ],
    ...overrides
  };
}

async function testRejectsInvalidStageNumberBeforeDbAccess() {
  let queryCount = 0;
  const handler = loadImportStageHandler({
    async query() {
      queryCount++;
      throw new Error('invalid import payload should not query the database');
    }
  });

  const { res, nextErr } = await invoke(handler, validPayload({
    stage_info: {
      race_code: 'tour-2026',
      stage_number: '1; DROP TABLE stages'
    }
  }));

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.jsonBody.code, 400);
  assert.strictEqual(res.jsonBody.data.validation.ok, false);
  assert(res.jsonBody.data.validation.errors.some(error => error.includes('stage_number')));
  assert.strictEqual(queryCount, 0);
}

async function testRejectsInvalidResultBeforeDbAccess() {
  let queryCount = 0;
  const handler = loadImportStageHandler({
    async query() {
      queryCount++;
      throw new Error('invalid result payload should not query the database');
    }
  });

  const { res, nextErr } = await invoke(handler, validPayload({
    results: [
      { rank: 'not-a-rank', rider_name: '', team_name: 'Team One' }
    ]
  }));

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.jsonBody.code, 400);
  assert.strictEqual(res.jsonBody.data.validation.ok, false);
  assert(res.jsonBody.data.validation.errors.some(error => error.includes('rank')));
  assert(res.jsonBody.data.validation.errors.some(error => error.includes('rider_name')));
  assert.strictEqual(queryCount, 0);
}

async function testAllSkippedImportIsNotReportedAsSuccess() {
  const handler = loadImportStageHandler({
    async query(sql) {
      if (sql.includes('SELECT * FROM races')) {
        return [[{ id: 'race-id' }]];
      }

      if (sql.includes('SELECT * FROM stages')) {
        return [[{ id: 'stage-id' }]];
      }

      if (sql.includes('SELECT * FROM riders')) {
        return [[{ id: 'rider-id' }]];
      }

      if (sql.includes('SELECT * FROM teams')) {
        return [[{ id: 'team-id' }]];
      }

      if (sql.includes('INSERT INTO stage_results')) {
        throw new Error('database write failed');
      }

      if (sql.includes('SELECT COUNT(*) as count')) {
        return [[{ count: 0 }]];
      }

      return [[]];
    }
  });

  const { res, nextErr } = await invoke(handler, validPayload());

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.jsonBody.code, 500);
  assert.strictEqual(res.jsonBody.data.results_imported, 0);
  assert.strictEqual(res.jsonBody.data.results_skipped, 1);
  assert.strictEqual(res.jsonBody.data.validation.ok, true);
  assert.strictEqual(res.jsonBody.data.summary.results_imported, 0);
  assert.strictEqual(res.jsonBody.data.summary.results_skipped, 1);
  assert.strictEqual(res.jsonBody.data.row_errors.length, 1);
  assert.strictEqual(res.jsonBody.data.row_errors[0].error, 'database write failed');
}

async function testSuccessfulImportIncludesValidationSummaryAndJerseyErrors() {
  const handler = loadImportStageHandler({
    async query(sql) {
      if (sql.includes('SELECT * FROM races')) {
        return [[{ id: 'race-id' }]];
      }

      if (sql.includes('SELECT * FROM stages')) {
        return [[{ id: 'stage-id' }]];
      }

      if (sql.includes('SELECT * FROM riders')) {
        return [[{ id: 'rider-id' }]];
      }

      if (sql.includes('SELECT * FROM teams')) {
        return [[{ id: 'team-id' }]];
      }

      if (sql.includes('SELECT COUNT(*) as count')) {
        return [[{ count: 1 }]];
      }

      return [{ affectedRows: 1 }];
    }
  });

  const { res, nextErr } = await invoke(handler, validPayload({
    jerseys: [
      { jersey_type: 'pink', rider_name: 'Rider One', team_name: 'Team One' }
    ]
  }));

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.validation.ok, true);
  assert.strictEqual(res.jsonBody.data.summary.results_imported, 1);
  assert.strictEqual(res.jsonBody.data.summary.jerseys_imported, 1);
  assert.strictEqual(res.jsonBody.data.summary.db_result_count, 1);
  assert.deepStrictEqual(res.jsonBody.data.row_errors, []);
  assert.deepStrictEqual(res.jsonBody.data.jersey_errors, []);
}

(async () => {
  await testRejectsInvalidStageNumberBeforeDbAccess();
  await testRejectsInvalidResultBeforeDbAccess();
  await testAllSkippedImportIsNotReportedAsSuccess();
  await testSuccessfulImportIncludesValidationSummaryAndJerseyErrors();
  console.log('Admin import stage tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
