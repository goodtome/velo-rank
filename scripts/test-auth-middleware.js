const assert = require('assert');
const { adminMiddleware } = require('../server/middleware/auth');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function runMiddleware(req) {
  const res = createRes();
  let nextCalled = false;
  adminMiddleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled, req };
}

const originalEnv = {
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  ADMIN_KEY: process.env.ADMIN_KEY,
  NODE_ENV: process.env.NODE_ENV
};

(async () => {
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_KEY;

    let result = runMiddleware({ headers: {} });
    assert.strictEqual(result.nextCalled, false);
    assert.strictEqual(result.res.statusCode, 503);

    process.env.ADMIN_API_KEY = 'secret';
    result = runMiddleware({ headers: { 'x-admin-key': 'wrong' } });
    assert.strictEqual(result.nextCalled, false);
    assert.strictEqual(result.res.statusCode, 403);

    result = runMiddleware({ headers: { 'x-admin-key': 'secret' } });
    assert.strictEqual(result.nextCalled, true);
    assert.strictEqual(result.req.adminAuthenticated, true);

    console.log('Auth middleware tests passed.');
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
