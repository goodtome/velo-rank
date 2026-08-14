const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const poolPath = path.join(ROOT, 'server/config/db-pool.js');
const ridersPath = path.join(ROOT, 'server/routes/riders.js');
const teamsPath = path.join(ROOT, 'server/routes/teams.js');
const stagesPath = path.join(ROOT, 'server/routes/stages.js');

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

function getHandler(routePath, method, pathName) {
  delete require.cache[routePath];
  const router = require(routePath);
  const layer = router.stack.find(entry => entry.route && entry.route.path === pathName && entry.route.methods[method]);
  assert(layer, `Route ${method.toUpperCase()} ${pathName} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function loadWithPool(poolQueryImpl) {
  delete require.cache[poolPath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: {
      async query(sql, params) {
        const text = String(sql);
        if (text.includes('rank_pos')) {
          throw new Error(`legacy rank_pos detected: ${text}`);
        }
        return poolQueryImpl(text, params);
      }
    }
  };
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

async function testRidersStatsUsesRankColumn() {
  loadWithPool(async sql => {
    if (sql.includes('SELECT id FROM riders WHERE id = ?')) {
      return [[{ id: 'rider-1' }]];
    }
    if (sql.includes('COUNT(*) as total FROM stage_results WHERE rider_id = ?')) {
      return [[{ total: 7 }]];
    }
    if (sql.includes('podiums')) {
      return [[{ podiums: 2 }]];
    }
    if (sql.includes('wins')) {
      return [[{ wins: 1 }]];
    }
    if (sql.includes('top10')) {
      return [[{ top10: 4 }]];
    }
    if (sql.includes('GROUP BY s.stage_type')) {
      return [[{ stage_type: 'Flat', count: 3 }]];
    }
    if (sql.includes('ORDER BY s.date DESC')) {
      return [[{ rank: 1, stage_name: 'Stage 1', date: '2026-01-01', race_name: 'Race', race_name_zh: '赛事' }]];
    }
    if (sql.includes('FROM jerseys j')) {
      return [[{ jersey_type: 'rosa', stage_number: 1, stage_name: 'Stage 1' }]];
    }
    return [[]];
  });

  const handler = getHandler(ridersPath, 'get', '/:id/stats');
  const { res, nextErr } = await invoke(handler, { params: { id: 'rider-1' } });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.wins, 1);
}

async function testTeamsStatsUsesRankColumn() {
  loadWithPool(async sql => {
    if (sql.includes('SELECT id FROM teams WHERE id = ?')) {
      return [[{ id: 'team-1' }]];
    }
    if (sql.includes('COUNT(DISTINCT rider_id) as total_riders')) {
      return [[{ total_riders: 8 }]];
    }
    if (sql.includes('COUNT(*) as total FROM stage_results WHERE team_id = ?')) {
      return [[{ total: 12 }]];
    }
    if (sql.includes('COUNT(*) as wins FROM stage_results WHERE team_id = ?')) {
      return [[{ wins: 2 }]];
    }
    if (sql.includes('COUNT(*) as podiums FROM stage_results WHERE team_id = ?')) {
      return [[{ podiums: 5 }]];
    }
    if (sql.includes('COUNT(*) as top10 FROM stage_results WHERE team_id = ?')) {
      return [[{ top10: 9 }]];
    }
    if (sql.includes('FROM jerseys WHERE team_id = ?')) {
      return [[{ total: 3 }]];
    }
    if (sql.includes('SELECT DISTINCT r.id')) {
      return [[{ id: 'race-1', race_name: 'Race', race_name_zh: '赛事', season: 2026, category: 'GRAND_TOUR' }]];
    }
    return [[]];
  });

  const handler = getHandler(teamsPath, 'get', '/:id/stats');
  const { res, nextErr } = await invoke(handler, { params: { id: 'team-1' } });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data.stage_wins, 2);
}

async function testStageResultsUsesRankColumn() {
  loadWithPool(async sql => {
    if (sql.includes('COUNT(*) as total FROM stage_results WHERE stage_id = ?')) {
      return [[{ total: 1 }]];
    }
    if (sql.includes('FROM stage_results sr')) {
      return [[{ rank: 1, rider_name: 'Rider', rider_name_zh: '车手', nationality: 'FRA', photo_url: null, team_name: 'Team', team_name_zh: '车队', uci_code: 'ABC' }]];
    }
    return [[]];
  });

  const handler = getHandler(stagesPath, 'get', '/:id/results');
  const { res, nextErr } = await invoke(handler, { params: { id: 'stage-1' }, query: { page: '1', limit: '20' } });

  assert.strictEqual(nextErr, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonBody.code, 200);
  assert.strictEqual(res.jsonBody.data[0].rank, 1);
}

(async () => {
  await testRidersStatsUsesRankColumn();
  await testTeamsStatsUsesRankColumn();
  await testStageResultsUsesRankColumn();
  console.log('Rank field mapping tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
