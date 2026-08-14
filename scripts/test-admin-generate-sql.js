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

function loadGenerateSqlHandler() {
  delete require.cache[routePath];
  delete require.cache[poolPath];

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: {
      async query() {
        throw new Error('generate-sql should not query the database');
      }
    }
  };

  const router = require(routePath);
  const layer = router.stack.find(entry => entry.route && entry.route.path === '/generate-sql' && entry.route.methods.post);
  assert(layer, 'POST /admin/generate-sql route not found');
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

async function testGeneratedSqlMatchesCurrentSchema() {
  const handler = loadGenerateSqlHandler();
  const { res, nextErr } = await invoke(handler, {
    stage_info: {
      race_code: "tour-'2026",
      stage_number: 1,
      stage_name: "Stage '1",
      date: '2026-06-13',
      distance_km: 123,
      stage_type: 'Flat'
    },
    results: [
      { rank: 1, rider_name: "Rider O'One", team_name: "Team O'One" }
    ],
    jerseys: [
      { jersey_type: "YELLOW", rider_name: "Rider O'One", team_name: "Team O'One" }
    ]
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  const sql = res.jsonBody.data.sql;
  assert(!sql.includes('FROM stages WHERE race_code ='), 'stages table does not have race_code');
  assert(sql.includes('INSERT INTO riders (id, rider_name, nationality)'), 'rider inserts must provide UUID primary key');
  assert(sql.includes('INSERT INTO teams (id, team_name)'), 'team inserts must provide UUID primary key');
  assert(sql.includes("'tour-''2026'"), 'race_code should be SQL escaped');
  assert(sql.includes("'Stage ''1'"), 'stage_name should be SQL escaped');
  assert(sql.includes("'Rider O''One'"), 'rider_name should be SQL escaped');
  assert(sql.includes("'Team O''One'"), 'team_name should be SQL escaped');
  assert(sql.includes('NULL AS time_gap'), 'missing time_gap should be generated as SQL NULL');
  assert(!sql.includes('FROM (VALUES'), 'generated SQL should avoid non-MySQL VALUES table syntax');
  assert(sql.includes("SELECT 1 AS `rank`, 'Rider O''One' AS rider_name"), 'result rows should be generated as a MySQL SELECT union');
  assert.strictEqual(res.jsonBody.data.results_count, 1);
  assert.strictEqual(res.jsonBody.data.jerseys_count, 1);
  assert.strictEqual(res.jsonBody.data.validation.ok, true);
  assert.strictEqual(res.jsonBody.data.validation.summary.results_count, 1);
  assert.strictEqual(res.jsonBody.data.validation.summary.jerseys_count, 1);
  assert.strictEqual(res.jsonBody.data.validation.summary.missing_time_gap_count, 1);
  assert(res.jsonBody.data.validation.warnings.length > 0, 'missing time_gap should produce a warning');
  assert.strictEqual(res.jsonBody.data.summary.unique_riders, 1);
  assert.strictEqual(res.jsonBody.data.summary.unique_teams, 1);
  assert(res.jsonBody.data.summary.generated_sql_bytes > 0, 'summary should include generated SQL size');
}

async function testRejectsInvalidStageNumber() {
  const handler = loadGenerateSqlHandler();
  const { res, nextErr } = await invoke(handler, {
    stage_info: {
      race_code: 'tour-2026',
      stage_number: '1; DROP TABLE stages'
    },
    results: []
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.jsonBody.code, 400);
  assert.strictEqual(res.jsonBody.data.validation.ok, false);
  assert(res.jsonBody.data.validation.errors.some(error => error.includes('stage_number')));
}

async function testRejectsEmptyResults() {
  const handler = loadGenerateSqlHandler();
  const { res, nextErr } = await invoke(handler, {
    stage_info: {
      race_code: 'tour-2026',
      stage_number: 1
    },
    results: []
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.jsonBody.code, 400);
  assert.strictEqual(res.jsonBody.data.validation.ok, false);
  assert(res.jsonBody.data.validation.errors.some(error => error.includes('results must contain')));
}

async function testRejectsInvalidResultRows() {
  const handler = loadGenerateSqlHandler();
  const { res, nextErr } = await invoke(handler, {
    stage_info: {
      race_code: 'tour-2026',
      stage_number: 1
    },
    results: [
      { rank: 'not-a-rank', rider_name: '', team_name: 'Team One' }
    ]
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.jsonBody.code, 400);
  assert.strictEqual(res.jsonBody.data.validation.ok, false);
  assert(res.jsonBody.data.validation.errors.length >= 2);
}

(async () => {
  await testGeneratedSqlMatchesCurrentSchema();
  await testRejectsInvalidStageNumber();
  await testRejectsEmptyResults();
  await testRejectsInvalidResultRows();
  console.log('Admin generate SQL tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
