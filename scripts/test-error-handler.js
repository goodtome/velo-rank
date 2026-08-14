const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const handlerPath = path.join(ROOT, 'server/middleware/errorHandler.js');

function createResponse() {
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

function loadErrorHandler() {
  delete require.cache[handlerPath];
  return require(handlerPath);
}

function testProductionHidesInternalErrorMessage() {
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  process.env.NODE_ENV = 'production';
  console.error = () => {};

  try {
    const { errorHandler } = loadErrorHandler();
    const req = { method: 'GET', originalUrl: '/api/v1/test', path: '/api/v1/test' };
    const res = createResponse();

    errorHandler(new Error('database password leaked'), req, res, () => {});

    assert.strictEqual(res.statusCode, 500);
    assert.deepStrictEqual(res.body, {
      code: 500,
      message: '服务器内部错误'
    });
  } finally {
    console.error = originalConsoleError;
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
  }
}

testProductionHidesInternalErrorMessage();
console.log('Error handler tests passed.');
