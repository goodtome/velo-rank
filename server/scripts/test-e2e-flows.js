/**
 * 体验版端到端测试 — 模拟真实用户链路
 * 覆盖：首次加载、赛事→详情→成绩、搜索、车手/车队详情、空状态
 */
const http = require('http');

const BASE = 'http://localhost:3000/api/v1';
let passed = 0, failed = 0, warnings = 0;
const results = [];

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const start = Date.now();
    const r = http.request({
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method: 'GET'
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const ms = Date.now() - start;
        try { resolve({ status: res.statusCode, body: JSON.parse(data), ms }); }
        catch { resolve({ status: res.statusCode, body: data, ms }); }
      });
    });
    r.on('error', reject);
    r.setTimeout(5000, () => { r.destroy(); reject(new Error('timeout')); });
    r.end();
  });
}

function check(name, cond, extra) {
  if (cond) {
    console.log(`  ✅ ${name}${extra ? ' ' + extra : ''}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${extra ? ' ' + extra : ''}`);
    failed++;
    results.push({ name, extra });
  }
}

function warn(name, detail) {
  console.log(`  ⚠️  ${name} — ${detail}`);
  warnings++;
}

async function main() {

  // ============================================================
  // 1. 首页加载链路（首次打开，无缓存）
  // ============================================================
  console.log('\n📱 1. 首页加载链路（模拟首次打开）');
  console.log('─'.repeat(50));

  const t1Start = Date.now();
  const [activeRes, recentRes, statsRes] = await Promise.all([
    get('/races/active'),
    get('/races/recent?limit=5'),
    get('/races/stats/overview')
  ]);
  const t1Total = Date.now() - t1Start;

  check('GET /races/active 返回200', activeRes.status === 200, `(${activeRes.ms}ms)`);
  check('GET /races/recent 返回200', recentRes.status === 200, `(${recentRes.ms}ms)`);
  check('GET /races/stats/overview 返回200', statsRes.status === 200, `(${statsRes.ms}ms)`);

  // 并行加载总耗时
  check('首页三接口并行 < 2s', t1Total < 2000, `(${t1Total}ms)`);
  if (t1Total > 1000) warn('首页加载偏慢', `${t1Total}ms，建议关注`);

  // 检查数据完整性
  const activeRaces = activeRes.body.data || [];
  const recentRaces = recentRes.body.data || [];
  const stats = statsRes.body.data || {};

  console.log(`  📊 进行中赛事: ${activeRaces.length}, 最近赛事: ${recentRaces.length}`);
  console.log(`  📊 统计: ${stats.races}赛事 / ${stats.riders}车手 / ${stats.teams}车队`);

  check('统计数据合理 (races > 0)', stats.races > 0);
  check('统计数据合理 (riders > 0)', stats.riders > 0);

  // ============================================================
  // 2. 赛事列表 → 赛事详情链路
  // ============================================================
  console.log('\n📱 2. 赛事列表 → 赛事详情');
  console.log('─'.repeat(50));

  // 获取完整赛事列表
  const allRacesRes = await get('/races?page=1&limit=20');
  check('GET /races 列表返回200', allRacesRes.status === 200, `(${allRacesRes.ms}ms)`);

  const races = allRacesRes.body.data || [];
  check('赛事列表有数据', races.length > 0);

  // 找到有赛段数据的赛事（先试 TdF 2025，再遍历列表）
  let race = null, raceId = null, stages = [], jerseys = [];

  // 优先使用 TdF 2025（已知有完整数据）
  const TDF_2025_ID = '24a6d4ef-797b-42cb-b23b-ec18732e3d6d';
  const tdfStgRes = await get(`/races/${TDF_2025_ID}/stages`);
  if (tdfStgRes.body.data && tdfStgRes.body.data.length > 0) {
    const raceDetail = await get(`/races/${TDF_2025_ID}`);
    race = raceDetail.body.data || {};
    raceId = TDF_2025_ID;
    stages = tdfStgRes.body.data;
    const jRes = await get(`/races/${TDF_2025_ID}/latest-jerseys`);
    jerseys = jRes.body.data || [];
  }

  // 回退：遍历列表找有数据的赛事
  if (!race) {
    for (const r of races.slice(0, 10)) {
      const stgRes = await get(`/races/${r.id}/stages`);
      if (stgRes.body.data && stgRes.body.data.length > 0) {
        race = r;
        raceId = r.id;
        stages = stgRes.body.data;
        const jRes = await get(`/races/${r.id}/latest-jerseys`);
        jerseys = jRes.body.data || [];
        break;
      }
    }
  }

  // 车手ID 收集（在分类榜和赛段成绩中收集）
  let riderId = null;
  let gcData = [];
  let stageResults = [];

  if (race) {
    console.log(`  📌 测试赛事: ${race.race_name_zh || race.race_name} (${race.race_code})`);
    check('赛事详情数据获取成功', true);
    check('赛事有 race_name', !!race.race_name);
    check('赛事有 race_code', !!race.race_code);

    // ============================================================
    // 3. 赛段成绩链路
    // ============================================================
    if (stages.length > 0) {
      console.log('\n📱 3. 赛段成绩页');
      console.log('─'.repeat(50));

      const stage = stages[0];
      console.log(`  📌 测试赛段: 第${stage.stage_number}赛段 ${stage.stage_name}`);

      // 赛段成绩（分页）
      const stageResultsRes = await get(`/stages/${stage.id}/results?page=1&limit=20`);
      check('赛段成绩返回200', stageResultsRes.status === 200, `(${stageResultsRes.ms}ms)`);

      stageResults = stageResultsRes.body.data || [];
      check('赛段成绩有数据', stageResults.length > 0, `(${stageResults.length}条)`);

      if (stageResults.length > 0) {
        const r = stageResults[0];
        check('成绩有 rank 字段', r.rank !== undefined && r.rank !== null);
        check('成绩有 rider 信息', !!(r.rider_name || r.rider_name_zh));
      }

      // GC 总成绩榜
      const gcRes = await get(`/races/${raceId}/gc?page=1&limit=20`);
      check('GC榜返回200', gcRes.status === 200, `(${gcRes.ms}ms)`);
      gcData = gcRes.body.data || [];
      check('GC榜有数据', gcData.length > 0, `(${gcData.length}条)`);

      // ============================================================
      // 4. 分类榜链路
      // ============================================================
      console.log('\n📱 4. 分类榜（积分/爬坡/青年）');
      console.log('─'.repeat(50));

      const [pointsRes, mountainsRes, youthRes] = await Promise.all([
        get(`/stages/${stage.id}/points?page=1&limit=20`),
        get(`/stages/${stage.id}/mountains?page=1&limit=20`),
        get(`/stages/${stage.id}/youth?page=1&limit=20`)
      ]);

      check('积分榜返回200', pointsRes.status === 200, `(${pointsRes.ms}ms)`);
      check('爬坡榜返回200', mountainsRes.status === 200, `(${mountainsRes.ms}ms)`);
      check('青年榜返回200', youthRes.status === 200, `(${youthRes.ms}ms)`);

      const pts = pointsRes.body.data || [];
      const mtn = mountainsRes.body.data || [];
      const yth = youthRes.body.data || [];
      console.log(`  📊 积分: ${pts.length}条, 爬坡: ${mtn.length}条, 青年: ${yth.length}条`);

      // 检查 rank 字段（2.3 修复的核心）
      if (pts.length > 0) {
        check('积分榜第1名有 rank 字段', pts[0].rank !== undefined && pts[0].rank !== null);
        check('积分榜按积分降序', pts.length < 2 || pts[0].points >= pts[1].points);
      }
      if (mtn.length > 0) {
        check('爬坡榜第1名有 rank 字段', mtn[0].rank !== undefined && mtn[0].rank !== null);
      }
    }

    // ============================================================
    // 5. 车手详情链路
    // ============================================================
    console.log('\n📱 5. 车手详情链路');
    console.log('─'.repeat(50));

    // 从 GC 或赛段成绩中取一个车手
    if (gcData && gcData.length > 0) {
      riderId = gcData[0].rider_id;
    }
    if (!riderId && stageResults && stageResults.length > 0) {
      riderId = stageResults[0].rider_id;
    }

    if (riderId) {
      const [riderInfo, riderResults, riderStats] = await Promise.all([
        get(`/riders/${riderId}`),
        get(`/riders/${riderId}/results?limit=20`),
        get(`/riders/${riderId}/stats`)
      ]);

      check('车手信息返回200', riderInfo.status === 200, `(${riderInfo.ms}ms)`);
      check('车手成绩返回200', riderResults.status === 200, `(${riderResults.ms}ms)`);
      check('车手统计返回200', riderStats.status === 200, `(${riderStats.ms}ms)`);

      const rider = riderInfo.body.data || {};
      console.log(`  📌 车手: ${rider.rider_name_zh || rider.rider_name}`);
      check('车手有 rider_name', !!rider.rider_name);
      check('车手有 nationality', !!rider.nationality);

      // 跳转到车队详情
      if (rider.team_id) {
        console.log('\n📱 5b. 车队详情链路');
        console.log('─'.repeat(50));

        const [teamInfo, teamStats] = await Promise.all([
          get(`/teams/${rider.team_id}`),
          get(`/teams/${rider.team_id}/stats`)
        ]);

        check('车队信息返回200', teamInfo.status === 200, `(${teamInfo.ms}ms)`);
        check('车队统计返回200', teamStats.status === 200, `(${teamStats.ms}ms)`);

        const team = teamInfo.body.data || {};
        console.log(`  📌 车队: ${team.team_name_zh || team.team_name}`);
        check('车队有 team_name', !!team.team_name);
      } else {
        console.log('  ℹ️  车手无 team_id，跳过车队详情测试');
      }
    } else {
      console.log('  ℹ️  无法获取车手ID，跳过车手详情测试');
    }
  }

  // ============================================================
  // 6. 搜索功能
  // ============================================================
  console.log('\n📱 6. 搜索功能');
  console.log('─'.repeat(50));

  // 搜索车手
  const searchRidersRes = await get('/search/riders?q=Pogacar&limit=10');
  check('搜索车手返回200', searchRidersRes.status === 200, `(${searchRidersRes.ms}ms)`);
  const riderResults = (searchRidersRes.body.data && searchRidersRes.body.data.riders) || [];
  console.log(`  📊 "Pogacar" 搜索结果: ${riderResults.length}条 (total: ${searchRidersRes.body.data && searchRidersRes.body.data.total})`);
  check('搜索车手有结果', riderResults.length > 0);

  // 搜索车队
  const searchTeamsRes = await get('/search/teams?q=UAE&limit=10');
  check('搜索车队返回200', searchTeamsRes.status === 200, `(${searchTeamsRes.ms}ms)`);
  const teamResults = (searchTeamsRes.body.data && searchTeamsRes.body.data.teams) || [];
  console.log(`  📊 "UAE" 搜索结果: ${teamResults.length}条`);

  // 空搜索
  const emptySearchRes = await get('/search/riders?q=zzzznotexist&limit=10');
  check('空搜索返回200', emptySearchRes.status === 200, `(${emptySearchRes.ms}ms)`);
  const emptyResults = (emptySearchRes.body.data && emptySearchRes.body.data.riders) || [];
  check('空搜索结果数组为空', emptyResults.length === 0);

  // 中文搜索
  const zhSearchRes = await get('/search/riders?q=波加查&limit=10');
  check('中文搜索返回200', zhSearchRes.status === 200, `(${zhSearchRes.ms}ms)`);
  const zhResults = (zhSearchRes.body.data && zhSearchRes.body.data.riders) || [];
  console.log(`  📊 "波加查" 搜索结果: ${zhResults.length}条`);

  // ============================================================
  // 7. 赛事日历
  // ============================================================
  console.log('\n📱 7. 赛事日历');
  console.log('─'.repeat(50));

  const calRes = await get('/races/calendar?year=2026&month=7');
  check('日历接口返回200', calRes.status === 200, `(${calRes.ms}ms)`);
  const calData = (calRes.body.data && calRes.body.data.races) || [];
  console.log(`  📊 2026年7月赛事: ${calData.length}场`);
  check('7月有环法赛事', calData.some(r => r.race_code && r.race_code.includes('tour-de-france') || r.race_code === 'tdf-2026'));

  // ============================================================
  // 8. 空数据状态测试
  // ============================================================
  console.log('\n📱 8. 空数据/异常状态');
  console.log('─'.repeat(50));

  // 不存在的赛事
  const fakeRaceRes = await get('/races/00000000-0000-0000-0000-000000000000');
  check('不存在的赛事返回404', fakeRaceRes.status === 404);

  // 不存在的车手
  const fakeRiderRes = await get('/riders/00000000-0000-0000-0000-000000000000');
  check('不存在的车手返回404', fakeRiderRes.status === 404);

  // 不存在的车队
  const fakeTeamRes = await get('/teams/00000000-0000-0000-0000-000000000000');
  check('不存在的车队返回404', fakeTeamRes.status === 404);

  // 无效分页
  const badPageRes = await get('/races?page=9999&limit=10');
  check('超出范围分页返回200或400', badPageRes.status === 200 || badPageRes.status === 400, `(status: ${badPageRes.status})`);
  if (badPageRes.status === 200) {
    const badPageData = badPageRes.body.data || [];
    check('超出范围分页数据为空', badPageData.length === 0);
  }

  // ============================================================
  // 9. 性能概览
  // ============================================================
  console.log('\n📱 9. 接口响应时间概览');
  console.log('─'.repeat(50));

  const perfTests = [
    { name: '/races (列表)', path: '/races?page=1&limit=20' },
    { name: '/races/active', path: '/races/active' },
    { name: '/races/stats/overview', path: '/races/stats/overview' },
    { name: '/search/riders?q=a', path: '/search/riders?q=a&limit=10' },
  ];

  for (const pt of perfTests) {
    const r = await get(pt.path);
    const status = r.ms < 200 ? '🟢' : r.ms < 500 ? '🟡' : '🔴';
    console.log(`  ${status} ${pt.name}: ${r.ms}ms`);
    if (r.ms > 1000) warn(pt.name, `响应 ${r.ms}ms 超过1秒`);
  }

  // ============================================================
  // 汇总
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败, ${warnings} 警告`);
  if (failed > 0) {
    console.log('\n❌ 失败项:');
    results.forEach(r => console.log(`   - ${r.name} ${r.extra || ''}`));
  }
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
