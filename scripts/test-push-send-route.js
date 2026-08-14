const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const routePath = path.join(ROOT, 'server/routes/push.js');
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

function loadRoute({ poolQueryImpl, sendSubscribeMessageImpl }) {
  delete require.cache[routePath];
  delete require.cache[poolPath];
  delete require.cache[wechatPath];

  const queries = [];
  const sendAttempts = [];
  const mockPool = {
    async query(sql, params) {
      queries.push({ sql: String(sql), params });
      if (poolQueryImpl) {
        return poolQueryImpl(sql, params);
      }
      return [[]];
    }
  };

  const mockWechat = {
    async sendSubscribeMessage(payload) {
      sendAttempts.push(payload);
      if (sendSubscribeMessageImpl) {
        return sendSubscribeMessageImpl(payload);
      }
      return { errcode: 0 };
    }
  };

  const originalEnv = {
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
    ADMIN_KEY: process.env.ADMIN_KEY,
    WECHAT_TEMPLATE_RACE_START: process.env.WECHAT_TEMPLATE_RACE_START,
    WECHAT_TEMPLATE_STAGE_END: process.env.WECHAT_TEMPLATE_STAGE_END,
    WECHAT_TEMPLATE_RANK_CHANGE: process.env.WECHAT_TEMPLATE_RANK_CHANGE,
    WECHAT_TEMPLATE_KEY_EVENT: process.env.WECHAT_TEMPLATE_KEY_EVENT
  };

  require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: mockPool };
  require.cache[wechatPath] = { id: wechatPath, filename: wechatPath, loaded: true, exports: mockWechat };

  const router = require(routePath);
  const sendLayer = router.stack.find(layer => layer.route && layer.route.path === '/send' && layer.route.methods.post);
  assert(sendLayer, 'POST /send route not found');
  const handler = sendLayer.route.stack[0].handle;

  return {
    handler,
    queries,
    sendAttempts,
    restoreEnv() {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      delete require.cache[routePath];
      delete require.cache[poolPath];
      delete require.cache[wechatPath];
    }
  };
}

async function invoke(handler, body) {
  const req = { body, headers: {} };
  const res = createResponse();
  let nextErr = null;
  let settle;
  const finished = new Promise(resolve => { settle = resolve; });
  const originalJson = res.json.bind(res);
  res.json = body => {
    originalJson(body);
    settle();
    return res;
  };

  handler(req, res, err => {
    nextErr = err;
    settle();
  });
  await Promise.race([
    finished,
    new Promise((_, reject) => setTimeout(() => reject(new Error('route handler timeout')), 2000))
  ]);
  return { req, res, nextErr };
}

async function testRejectsHardcodedAdminKeyFallback() {
  const route = loadRoute({
    poolQueryImpl: async () => [[[]]]
  });

  try {
    delete process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_KEY;

    const { nextErr, res } = await invoke(route.handler, {
      adminKey: 'velo-rank-admin-2026',
      type: 'race_start',
      title: 'Race',
      content: 'Content'
    });

    assert(nextErr);
    assert.strictEqual(nextErr.statusCode, 503);
    assert.strictEqual(nextErr.message, '管理密钥未配置');
    assert.strictEqual(res.jsonBody, null);
  } finally {
    route.restoreEnv();
  }
}

async function testRecordsPerUserPushStatus() {
  const originalConsoleError = console.error;
  console.error = () => {};
  const route = loadRoute({
    poolQueryImpl: async sql => {
      if (String(sql).includes('FROM user_push_settings')) {
        return [[
          {
            openid: 'openid-a',
            push_enabled: 1,
            notify_race_start: 1,
            notify_stage_end: 1,
            notify_rider_change: 1,
            notify_key_events: 1,
            dnd_enabled: 0,
            dnd_start: '22:00',
            dnd_end: '07:00'
          },
          {
            openid: 'openid-b',
            push_enabled: 1,
            notify_race_start: 1,
            notify_stage_end: 1,
            notify_rider_change: 1,
            notify_key_events: 1,
            dnd_enabled: 0,
            dnd_start: '22:00',
            dnd_end: '07:00'
          }
        ]];
      }

      return [[[]]];
    },
    sendSubscribeMessageImpl: async payload => {
      if (payload.touser === 'openid-b') {
        throw new Error('send failed');
      }
      return { errcode: 0 };
    }
  });

  try {
    process.env.ADMIN_API_KEY = 'admin-secret';
    process.env.WECHAT_TEMPLATE_RACE_START = 'tmpl-race-start';

    const { res } = await invoke(route.handler, {
      adminKey: 'admin-secret',
      type: 'race_start',
      title: 'Race start',
      content: 'Stage begins'
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonBody.code, 200);
    assert.strictEqual(res.jsonBody.data.sentCount, 1);
    assert.strictEqual(res.jsonBody.data.failedCount, 1);

    const historyInserts = route.queries.filter(q => String(q.sql).includes('INSERT INTO push_history'));
    assert.strictEqual(historyInserts.length, 2);
    assert.strictEqual(historyInserts[0].params[6], 'sent');
    assert.strictEqual(historyInserts[1].params[6], 'failed');
    assert.strictEqual(route.queries.filter(q => String(q.sql).includes('user_push_subscriptions')).length, 1);
    assert.strictEqual(route.sendAttempts.filter(payload => payload.touser === 'openid-b').length, 3);
  } finally {
    console.error = originalConsoleError;
    route.restoreEnv();
  }
}

(async () => {
  await testRejectsHardcodedAdminKeyFallback();
  await testRecordsPerUserPushStatus();
  console.log('Push send route tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
