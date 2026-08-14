const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');
const routePath = path.join(ROOT, 'server/routes/realtime.js');
const websocketPath = path.join(ROOT, 'server/websocket.js');

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
        const text = String(sql);
        if (text.includes('rank_pos') || text.includes(' t.name ') || text.includes(' sr.time ') || text.includes(' j.race_id ') || text.includes(' j.type ') || /\br\.team_id\b/.test(text)) {
          throw new Error(`legacy schema detected: ${text}`);
        }
        return poolQueryImpl(text, params);
      }
    }
  };
  return require(routePath);
}

function getHandler(router, method, pathName) {
  const layer = router.stack.find(entry => entry.route && entry.route.path === pathName && entry.route.methods[method]);
  assert(layer, `Route ${method.toUpperCase()} ${pathName} not found`);
  return layer.route.stack[0].handle;
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

function assertNoLegacyRealtimeSchema(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const legacyPatterns = [
    { pattern: /\br\.name\b/, label: 'r.name' },
    { pattern: /\bt\.name\b/, label: 't.name' },
    { pattern: /\br\.team_id\b/, label: 'r.team_id' },
    { pattern: /\bsr\.race_id\b/, label: 'sr.race_id' },
    { pattern: /\bgc\.race_id\b/, label: 'gc.race_id' },
    { pattern: /\bsr\.time\b/, label: 'sr.time' },
    { pattern: /rank_pos/, label: 'rank_pos' }
  ];

  for (const { pattern, label } of legacyPatterns) {
    assert(!pattern.test(source), `${path.basename(filePath)} contains legacy schema reference: ${label}`);
  }
}

async function testGcStageAndRaceStatusPreserveIds() {
  const router = loadRoute(async sql => {
    if (sql.includes('FROM general_classification gc')) {
      return [[{ riderId: 'r-1', riderName: 'Rider', teamName: 'Team', rank: 1, timeGap: '0:00', isLeader: 1 }]];
    }
    return [[]];
  });
  const handler = getHandler(router, 'get', '/gc');
  const { res, nextErr } = await invoke(handler, { query: { raceId: 'race-uuid', stageId: 'stage-uuid' } });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.success, true);
  assert.strictEqual(res.jsonBody.data.raceId, 'race-uuid');
  assert.strictEqual(res.jsonBody.data.stageId, 'stage-uuid');
  assert.strictEqual(res.jsonBody.data.rankings[0].teamName, 'Team');
}

async function testStageResultsAndPointsUseCurrentSchema() {
  const router = loadRoute(async sql => {
    if (sql.includes('FROM stage_results sr')) {
      return [[{ rank: 1, riderId: 'r-1', riderName: 'Rider', teamName: 'Team', timeGap: '0:00' }]];
    }
    if (sql.includes('FROM points_classification')) {
      return [[{ riderId: 'r-1', riderName: 'Rider', teamName: 'Team', points: 10, rank: 1 }]];
    }
    if (sql.includes('FROM mountains_classification')) {
      return [[{ riderId: 'r-1', riderName: 'Rider', teamName: 'Team', points: 5, rank: 1 }]];
    }
    if (sql.includes('FROM youth_classification')) {
      return [[{ riderId: 'r-1', riderName: 'Rider', teamName: 'Team', age: 24, rank: 1, timeGap: '0:00' }]];
    }
    return [[]];
  });

  const stageHandler = getHandler(router, 'get', '/stage');
  const pointsHandler = getHandler(router, 'get', '/points');
  const mountainsHandler = getHandler(router, 'get', '/mountains');
  const youthHandler = getHandler(router, 'get', '/youth');
  const statusHandler = getHandler(router, 'get', '/race-status');

  const stageRes = await invoke(stageHandler, { query: { raceId: 'race-uuid', stageId: 'stage-uuid' } });
  assert.strictEqual(stageRes.nextErr, null);
  assert.strictEqual(stageRes.res.jsonBody.data.raceId, 'race-uuid');
  assert.strictEqual(stageRes.res.jsonBody.data.stageId, 'stage-uuid');
  assert.strictEqual(stageRes.res.jsonBody.data.results[0].teamName, 'Team');

  const pointsRes = await invoke(pointsHandler, { query: { raceId: 'race-uuid', stageId: 'stage-uuid' } });
  assert.strictEqual(pointsRes.nextErr, null);
  assert.strictEqual(pointsRes.res.jsonBody.data.raceId, 'race-uuid');
  assert.strictEqual(pointsRes.res.jsonBody.data.stageId, 'stage-uuid');
  assert.strictEqual(pointsRes.res.jsonBody.data.rankings[0].points, 10);

  const mountainsRes = await invoke(mountainsHandler, { query: { raceId: 'race-uuid', stageId: 'stage-uuid' } });
  assert.strictEqual(mountainsRes.nextErr, null);
  assert.strictEqual(mountainsRes.res.jsonBody.data.raceId, 'race-uuid');
  assert.strictEqual(mountainsRes.res.jsonBody.data.rankings[0].points, 5);

  const youthRes = await invoke(youthHandler, { query: { raceId: 'race-uuid', stageId: 'stage-uuid' } });
  assert.strictEqual(youthRes.nextErr, null);
  assert.strictEqual(youthRes.res.jsonBody.data.raceId, 'race-uuid');
  assert.strictEqual(youthRes.res.jsonBody.data.stageId, 'stage-uuid');
  assert.strictEqual(youthRes.res.jsonBody.data.rankings[0].age, 24);

  const statusRes = await invoke(statusHandler, { query: { raceId: 'race-uuid', stageId: 'stage-uuid' } });
  assert.strictEqual(statusRes.nextErr, null);
  assert.strictEqual(statusRes.res.jsonBody.data.status, 'live');
}

(async () => {
  assertNoLegacyRealtimeSchema(routePath);
  assertNoLegacyRealtimeSchema(websocketPath);
  await testGcStageAndRaceStatusPreserveIds();
  await testStageResultsAndPointsUseCurrentSchema();
  console.log('Realtime schema tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
