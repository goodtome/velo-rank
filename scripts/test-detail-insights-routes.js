const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');

function response() {
  return {
    jsonBody: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.jsonBody = body; return this; }
  };
}

function loadRoute(routeName, query) {
  const routePath = path.join(ROOT, `server/routes/${routeName}.js`);
  delete require.cache[routePath];
  delete require.cache[poolPath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: { query: async (sql, params) => query(String(sql), params) }
  };
  return require(routePath);
}

function handler(router, pathName) {
  const layer = router.stack.find(entry => entry.route && entry.route.path === pathName && entry.route.methods.get);
  assert(layer, `GET ${pathName} handler not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function invoke(fn) {
  const res = response();
  let nextErr = null;
  fn({ params: { id: 'entity-1' }, query: {} }, res, err => { nextErr = err; });
  for (let i = 0; i < 10 && !res.jsonBody && !nextErr; i += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.strictEqual(nextErr, null);
  assert(res.jsonBody, 'route should return JSON');
  return res.jsonBody;
}

async function testRiderInsightsContract() {
  let index = 0;
  const replies = [
    [{ id: 'entity-1' }], [{ total: 8 }], [{ podiums: 3 }], [{ wins: 1 }], [{ top10: 5 }],
    [{ stage_type: 'flat', count: 8 }], [{ rank: 2 }], [{ jersey_type: 'YELLOW' }],
    [{ total_races: 2, total_seasons: 1, best_stage_rank: 1 }], [{ best_gc_rank: 2, gc_races: 1 }],
    [{ season: 2026, starts: 8, wins: 1, podiums: 3, best_rank: 1 }],
    [{ rank: 1, stage_id: 'stage-1', stage_number: 2, race_name: 'Race' }]
  ];
  const router = loadRoute('riders', async () => [replies[index++] || []]);
  const body = await invoke(handler(router, '/:id/stats'));
  assert.deepStrictEqual(body.data.career, {
    total_races: 2,
    total_seasons: 1,
    best_stage_rank: 1,
    best_gc_rank: 2,
    gc_races: 1
  });
  assert.strictEqual(body.data.season_summaries[0].season, 2026);
  assert.strictEqual(body.data.recent_form[0].stage_id, 'stage-1');
}

async function testTeamInsightsContract() {
  let index = 0;
  const replies = [
    [{ id: 'entity-1' }], [{ total_riders: 7 }], [{ total: 30 }], [{ wins: 2 }], [{ podiums: 5 }],
    [{ top10: 11 }], [{ total: 4 }], [{ id: 'race-1' }], [{ best_team_rank: 1, team_podiums: 2 }],
    [{ nationalities: 6, races_count: 3, seasons_count: 1 }],
    [{ id: 'rider-1', rider_name: 'Rider', wins: 2, podiums: 3, best_rank: 1 }],
    [{ season: 2026, starts: 30, wins: 2, podiums: 5 }],
    [{ stage_id: 'stage-1', rider_id: 'rider-1', rank: 1 }]
  ];
  const router = loadRoute('teams', async () => [replies[index++] || []]);
  const body = await invoke(handler(router, '/:id/stats'));
  assert.strictEqual(body.data.profile.best_team_rank, 1);
  assert.strictEqual(body.data.profile.nationalities, 6);
  assert.strictEqual(body.data.top_riders[0].id, 'rider-1');
  assert.strictEqual(body.data.recent_highlights[0].rank, 1);
}

(async () => {
  await testRiderInsightsContract();
  await testTeamInsightsContract();
  console.log('Detail insights route tests passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
