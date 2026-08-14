const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const routePath = path.join(ROOT, 'server/routes/stages.js');
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

function loadPostHandler(poolQueryImpl) {
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

  const router = require(routePath);
  const layer = router.stack.find(entry => entry.route && entry.route.path === '/' && entry.route.methods.post);
  assert(layer, 'POST /stages route not found');
  return layer.route.stack.map(entry => entry.handle);
}

async function invokeHandlers(handlers, req) {
  const res = createResponse();
  let nextErr = null;

  async function run(index) {
    const handler = handlers[index];
    if (!handler || nextErr || res.jsonBody) return;

    let nextCalled = false;
    const maybePromise = handler(req, res, err => {
      nextCalled = true;
      if (err) nextErr = err;
    });

    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise;
    }

    if (nextCalled && !nextErr && !res.jsonBody) {
      await run(index + 1);
    }
  }

  await run(0);
  await new Promise(resolve => setImmediate(resolve));
  return { res, nextErr };
}

async function testStageCodeGeneratedFromRaceCodeWhenMissing() {
  const originalAdminKey = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = 'secret';

  let insertedParams = null;
  try {
    const handlers = loadPostHandler(async (sql, params) => {
      if (sql.includes('FROM races')) {
        assert(sql.includes('race_code'), 'race lookup must include race_code for stage_code generation');
        return [[{ id: 'race-1', race_code: 'tour-2026' }]];
      }
      if (sql.includes('SELECT id FROM stages')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO stages')) {
        insertedParams = params;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    });

    const { res, nextErr } = await invokeHandlers(handlers, {
      headers: { 'x-admin-key': 'secret' },
      body: {
        race_id: 'race-1',
        stage_number: 3,
        stage_name: 'Stage 3',
        date: '2026-06-13'
      }
    });

    assert.strictEqual(nextErr, null);
    assert.strictEqual(res.statusCode, 201);
    assert(insertedParams, 'stage insert should be executed');
    assert.strictEqual(insertedParams[4], 'tour-2026-s3');
  } finally {
    if (originalAdminKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = originalAdminKey;
    }
  }
}

(async () => {
  await testStageCodeGeneratedFromRaceCodeWhenMissing();
  console.log('Stages create route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
