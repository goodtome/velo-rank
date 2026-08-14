const assert = require('assert');
const { responseFormatter } = require('../server/middleware/responseFormatter');

function createResponse() {
  return {
    jsonBody: null,
    json(body) {
      this.jsonBody = body;
      return this;
    }
  };
}

function installFormatter() {
  const req = {};
  const res = createResponse();
  let nextCalled = false;

  responseFormatter(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  return res;
}

function testPreservesRealtimeSuccessEnvelope() {
  const res = installFormatter();
  const payload = { success: true, data: { rankings: [] } };

  res.json(payload);

  assert.deepStrictEqual(res.jsonBody, payload);
}

function testPreservesRealtimeErrorEnvelope() {
  const res = installFormatter();
  const payload = { success: false, error: 'missing stageId' };

  res.json(payload);

  assert.deepStrictEqual(res.jsonBody, payload);
}

function testAddsMessageToCodeEnvelope() {
  const res = installFormatter();

  res.json({ code: 200, data: [] });

  assert.deepStrictEqual(res.jsonBody, { code: 200, data: [], message: 'success' });
}

function testWrapsPlainPayload() {
  const res = installFormatter();

  res.json({ hello: 'world' });

  assert.deepStrictEqual(res.jsonBody, {
    code: 200,
    message: 'success',
    data: { hello: 'world' }
  });
}

testPreservesRealtimeSuccessEnvelope();
testPreservesRealtimeErrorEnvelope();
testAddsMessageToCodeEnvelope();
testWrapsPlainPayload();
console.log('Response formatter tests passed.');
