const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const routePath = path.join(ROOT, 'server/routes/auth.js');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');
const wechatPath = path.join(ROOT, 'server/utils/wechat.js');

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

function loadLoginHandler({ poolImpl, code2SessionImpl }) {
  delete require.cache[routePath];
  delete require.cache[poolPath];
  delete require.cache[wechatPath];

  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: poolImpl
  };

  require.cache[wechatPath] = {
    id: wechatPath,
    filename: wechatPath,
    loaded: true,
    exports: {
      code2Session: code2SessionImpl
    }
  };

  const router = require(routePath);
  const layer = router.stack.find(entry => entry.route && entry.route.path === '/login' && entry.route.methods.post);
  assert(layer, 'POST /auth/login route not found');
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

async function testRejectsMissingOrNonStringCodeBeforeExternalCalls() {
  const cases = [
    { body: undefined },
    { body: {} },
    { body: { code: 123 } },
    { body: { code: '   ' } }
  ];

  for (const testCase of cases) {
    let poolQueryCount = 0;
    let code2SessionCount = 0;
    const handler = loadLoginHandler({
      poolImpl: {
        async query() {
          poolQueryCount++;
          throw new Error('invalid login payload should not query the database');
        }
      },
      async code2SessionImpl() {
        code2SessionCount++;
        throw new Error('invalid login payload should not call code2Session');
      }
    });

    const { res, nextErr } = await invoke(handler, { body: testCase.body });

    assert.strictEqual(res.jsonBody, null);
    assert(nextErr, 'invalid login payload should be forwarded as AppError');
    assert.strictEqual(nextErr.statusCode, 400);
    assert.strictEqual(poolQueryCount, 0);
    assert.strictEqual(code2SessionCount, 0);
  }
}

async function testTrimsCodeBeforeCode2Session() {
  let receivedCode = null;
  const queries = [];
  const handler = loadLoginHandler({
    poolImpl: {
      async query(sql, params) {
        queries.push({ sql: String(sql), params });
        return [{ affectedRows: 1 }];
      }
    },
    async code2SessionImpl(code) {
      receivedCode = code;
      return { openid: 'openid-123' };
    }
  });

  const { res, nextErr } = await invoke(handler, {
    body: { code: '  wx-code  ' }
  });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.openid, 'openid-123');
  assert.strictEqual(receivedCode, 'wx-code');
  assert.strictEqual(queries.length, 1);
  assert.strictEqual(queries[0].params[1], 'openid-123');
}

(async () => {
  await testRejectsMissingOrNonStringCodeBeforeExternalCalls();
  await testTrimsCodeBeforeCode2Session();
  console.log('Auth login route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
