/**
 * Tour of Austria 2026 数据导入
 * 
 * 数据来源: PCS + tour-magazin.de + tourofaustria.com
 * 赛段距离精确到一位小数
 * 
 * 用法:
 *   node scripts/import-austria-2026.js                  # 完整导入
 *   node scripts/import-austria-2026.js --stages-only    # 仅更新赛段
 *   node scripts/import-austria-2026.js --dry-run        # 仅抓取不入库
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

puppeteer.use(StealthPlugin());

const RACE_CODE = 'tour-austria-2026';
const PCS_STARTLIST_URL = 'https://www.procyclingstats.com/race/tour-of-austria/2026/startlist/startlist';

const DRY_RUN = process.argv.includes('--dry-run');
const STAGES_ONLY = process.argv.includes('--stages-only');

const DB_CONFIG = {
  host: '127.0.0.1', port: 13306, user: 'root',
  password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4'
};

// ============================================================
// 赛事 & 赛段数据 (来源: PCS + tour-magazin.de, 距离精确到一位小数)
// ============================================================

const RACE_INFO = {
  race_name: '环奥地利 2026',
  race_name_en: 'Tour of Austria 2026',
  race_code: RACE_CODE,
  category: '2.1',
  category_zh: 'UCI 2.1',
  gender: 'MEN',
  season: 2026,
  country: 'Austria',
  start_date: '2026-07-08',
  end_date: '2026-07-12',
  total_stages: 5,
  total_distance: 845.8,
  official_url: 'https://www.tourofaustria.com'
};

// Stage types based on PCS ProfileScore + elevation:
//   FLAT:    PS < 50  (Stage 5, PS=34)
//   HILLS:   PS 50-200 (Stage 1 PS=153, Stage 3 PS=125, Stage 4 PS=147)
//   MOUNTAIN: PS > 200 (Stage 2 PS=314, mountaintop finish at Großglockner)
const STAGES = [
  { n: 1, d: '2026-07-08', start: 'Graz', finish: 'Gamlitz', km: 188.0, elv: 2718, type: 'HILLS',
    zh: '格拉茨 → 甘利茨', name: 'Graz → Gamlitz' },
  { n: 2, d: '2026-07-09', start: 'Bad Kleinkirchheim', finish: 'Großglockner (Kaiser-Franz-Josef-Höhe)', km: 188.8, elv: 3033, type: 'MOUNTAIN',
    zh: '巴特克莱因基希海姆 → 大格洛克纳山', name: 'Bad Kleinkirchheim → Großglockner' },
  { n: 3, d: '2026-07-10', start: 'Lienz', finish: 'St. Johann Alpendorf', km: 189.5, elv: 2578, type: 'HILLS',
    zh: '利恩茨 → 圣约翰阿尔彭多夫', name: 'Lienz → St. Johann Alpendorf' },
  { n: 4, d: '2026-07-11', start: 'Steyr', finish: 'Steyr', km: 170.5, elv: 2436, type: 'HILLS',
    zh: '施泰尔 → 施泰尔 (环线)', name: 'Steyr → Steyr' },
  { n: 5, d: '2026-07-12', start: 'Langenlois', finish: 'Wien', km: 109.0, elv: 771, type: 'FLAT',
    zh: '朗根洛伊斯 → 维也纳', name: 'Langenlois → Wien' }
];

// 验证总距离
const calcTotal = STAGES.reduce((s, x) => s + x.km, 0);
if (Math.abs(calcTotal - 845.8) > 0.1) {
  console.error(`WARNING: total distance mismatch: ${calcTotal} vs 845.8`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// 数据库操作
// ============================================================

async function updateRace(conn) {
  const [existing] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]);
  if (!existing.length) {
    // 不存在则创建
    const id = uuidv4();
    await conn.query(`INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages, total_distance, official_url, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,true)`,
      [id, RACE_INFO.race_name, RACE_INFO.race_name_en, RACE_INFO.race_name_en, RACE_INFO.race_code, RACE_INFO.category, RACE_INFO.category_zh, RACE_INFO.gender, RACE_INFO.season, RACE_INFO.country, RACE_INFO.start_date, RACE_INFO.end_date, RACE_INFO.total_stages, RACE_INFO.total_distance, RACE_INFO.official_url]
    );
    console.log('  [NEW RACE] created');
    return id;
  }
  // 更新
  await conn.query(`UPDATE races SET race_name=?, race_name_en=?, category=?, category_zh=?, gender=?, season=?, country=?, start_date=?, end_date=?, total_stages=?, total_distance=?, official_url=? WHERE id=?`,
    [RACE_INFO.race_name, RACE_INFO.race_name_en, RACE_INFO.category, RACE_INFO.category_zh, RACE_INFO.gender, RACE_INFO.season, RACE_INFO.country, RACE_INFO.start_date, RACE_INFO.end_date, RACE_INFO.total_stages, RACE_INFO.total_distance, RACE_INFO.official_url, existing[0].id]
  );
  console.log('  [UPDATE RACE] stages: 7→5, dates: 7/4-10→7/8-12, dist: null→845.8');
  return existing[0].id;
}

async function createStages(conn, raceId) {
  let created = 0, updated = 0;
  
  // 删除多余赛段 (如果之前有 7 个)
  await conn.query('DELETE FROM stages WHERE race_id = ? AND stage_number > 5', [raceId]);
  
  for (const s of STAGES) {
    const code = `tour-austria-2026-s${String(s.n).padStart(2, '0')}`;
    const name = s.name;
    
    const [exist] = await conn.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?', [raceId, s.n]
    );
    
    if (exist.length) {
      await conn.query(
        'UPDATE stages SET stage_name=?, stage_name_zh=?, stage_type=?, date=?, distance_km=?, elevation_m=?, start_city=?, finish_city=?, start_city_zh=?, finish_city_zh=?, stage_code=? WHERE id=?',
        [name, s.zh, s.type, s.d, s.km, s.elv, s.start, s.finish, null, null, code, exist[0].id]
      );
      updated++;
    } else {
      await conn.query(
        'INSERT INTO stages (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date, distance_km, elevation_m, start_city, finish_city, stage_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [uuidv4(), raceId, s.n, name, s.zh, s.type, s.d, s.km, s.elv, s.start, s.finish, code]
      );
      created++;
    }
  }
  console.log(`  Stages: ${created} created, ${updated} updated`);
}

async function importStartlist(conn, teamsData) {
  if (STAGES_ONLY) return;

  let teamsNew = 0, ridersNew = 0, ridersExisting = 0;
  
  for (const team of teamsData) {
    // 车队
    let teamId;
    if (team.slug) {
      try {
        const [rows] = await conn.query('SELECT id FROM teams WHERE team_slug = ? LIMIT 1', [team.slug]);
        if (rows.length) teamId = rows[0].id;
      } catch (e) {}
    }
    if (!teamId) {
      const [rows] = await conn.query(
        'SELECT id FROM teams WHERE team_name LIKE ? OR team_name_en LIKE ? LIMIT 1',
        [`%${team.name.split(' ').slice(0, 3).join(' ')}%`, `%${team.name.split(' ').slice(0, 3).join(' ')}%`]
      );
      if (rows.length) teamId = rows[0].id;
    }
    if (!teamId) {
      teamId = uuidv4();
      try {
        await conn.query('INSERT INTO teams (id, team_name, team_name_en, team_slug, country) VALUES (?,?,?,?,?)',
          [teamId, team.name, team.name, team.slug || null, team.country || 'AT']);
        teamsNew++;
      } catch (e) {
        // minimal fallback
        try {
          await conn.query('INSERT INTO teams (id, team_name) VALUES (?,?)', [teamId, team.name]);
          teamsNew++;
        } catch (e2) {
          console.log(`  SKIP team: ${team.name} - ${e2.message}`);
          continue;
        }
      }
    }
    
    // 车手
    for (const rider of team.riders) {
      let riderId;
      if (rider.slug) {
        try {
          const [rows] = await conn.query('SELECT id FROM riders WHERE rider_slug = ? LIMIT 1', [rider.slug]);
          if (rows.length) riderId = rows[0].id;
        } catch (e) {}
      }
      if (!riderId) {
        const [rows] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [rider.name]);
        if (rows.length) riderId = rows[0].id;
      }
      if (!riderId) {
        riderId = uuidv4();
        try {
          await conn.query('INSERT INTO riders (id, rider_name, nationality, rider_slug) VALUES (?,?,?,?)',
            [riderId, rider.name, rider.nationality || 'UNK', rider.slug || null]);
          ridersNew++;
        } catch (e) {
          try {
            await conn.query('INSERT INTO riders (id, rider_name, nationality) VALUES (?,?,?)',
              [riderId, rider.name, rider.nationality || 'UNK']);
            ridersNew++;
          } catch (e2) {
            console.log(`  SKIP rider: ${rider.name} - ${e2.message}`);
            continue;
          }
        }
      } else {
        ridersExisting++;
        // 更新 slug 如果缺失
        if (rider.slug) {
          try {
            await conn.query('UPDATE riders SET rider_slug = ? WHERE id = ? AND (rider_slug IS NULL OR rider_slug = ?)',
              [rider.slug, riderId, '']);
          } catch (e) {}
        }
      }
    }
  }
  
  console.log(`  Teams: ${teamsNew} new | Riders: ${ridersNew} new, ${ridersExisting} existing`);
}

// ============================================================
// PCS Startlist 解析
// ============================================================

function parseStartlist(html) {
  const $ = cheerio.load(html);
  const teams = [];

  $('ul.startlist_v4 > li').each((_, teamEl) => {
    const $team = $(teamEl);
    const teamLink = $team.find('a.team');
    if (!teamLink.length) return;
    
    const teamName = teamLink.text().trim().replace(/\s*\((WT[WM]?|PRT|CT)\)\s*$/i, '');
    const teamHref = teamLink.attr('href') || '';
    let teamSlug = '';
    const slugMatch = teamHref.match(/team\/([^"']+)/);
    if (slugMatch) teamSlug = slugMatch[1].replace(/-\d{4}$/, '');

    let teamCountry = '';
    const shirtImg = $team.find('.shirtCont img').first();
    if (shirtImg.length) {
      const srcMatch = (shirtImg.attr('src') || '').match(/shirts\/bx\/(\w+)\//);
      if (srcMatch) teamCountry = srcMatch[1].toUpperCase();
    }

    const riders = [];
    $team.find('.ridersCont ul li').each((_, riderEl) => {
      const $li = $(riderEl);
      if ($li.hasClass('dnf') || $li.hasClass('dns')) return;

      const flagClasses = ($li.find('span.flag').attr('class') || '').split(/\s+/);
      let nationality = 'UNK';
      for (const cls of flagClasses) {
        if (cls !== 'flag' && cls.length === 2) { nationality = cls.toUpperCase(); break; }
      }

      const riderLink = $li.find('a[href*="rider/"]');
      const riderName = riderLink.text().trim();
      let riderSlug = '';
      if (riderLink.length) {
        riderSlug = (riderLink.attr('href') || '').replace(/^rider\//, '').replace(/\/$/, '');
      }

      const bibSpan = $li.find('span.bib');
      const bib = bibSpan.length ? parseInt(bibSpan.text().trim()) || null : null;

      if (riderName) riders.push({ name: riderName, slug: riderSlug, nationality, bib });
    });

    if (teamName && riders.length) {
      teams.push({ name: teamName, slug: teamSlug, country: teamCountry, riders });
    }
  });

  return teams;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log(`\n=== Tour of Austria 2026 Import ===`);
  console.log(`Race: ${RACE_INFO.race_name_en} | ${RACE_INFO.start_date} ~ ${RACE_INFO.end_date}`);
  console.log(`Stages: ${STAGES.length} | Distance: ${STAGES.reduce((s,x)=>s+x.km,0)} km`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : STAGES_ONLY ? 'STAGES ONLY' : 'FULL'}\n`);

  // Step 1: 更新 DB 中的赛事+赛段
  if (!DRY_RUN) {
    const conn = await mysql.createConnection(DB_CONFIG);
    
    console.log('1. Updating race info...');
    const raceId = await updateRace(conn);
    
    console.log('2. Creating/updating stages...');
    await createStages(conn, raceId);

    // 验证
    const [stages] = await conn.query('SELECT stage_number, stage_name_zh, stage_type, distance_km, elevation_m, date FROM stages WHERE race_id = ? ORDER BY stage_number', [raceId]);
    console.log('\n   Verification:');
    let total = 0;
    stages.forEach(s => {
      total += s.distance_km;
      console.log(`   S${s.stage_number} | ${String(s.date).substring(0,10)} | ${s.stage_name_zh} | ${s.distance_km} km | ${s.elevation_m}m | ${s.stage_type}`);
    });
    console.log(`   Total: ${total} km (expected 845.8)`);

    if (STAGES_ONLY) {
      await conn.end();
      console.log('\nDone (stages only).');
      return;
    }

    // Step 3: 抓取 startlist
    console.log('\n3. Fetching startlist...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 预热
    console.log('   Warmup...');
    await page.goto('https://www.procyclingstats.com/race/tour-of-austria/2025/stage-1', {
      waitUntil: 'networkidle2', timeout: 45000
    });
    await sleep(4000);

    // 抓取
    console.log('   Fetching startlist page...');
    await page.goto(PCS_STARTLIST_URL, {
      waitUntil: 'networkidle2', timeout: 60000
    });
    const html = await page.content();
    console.log(`   HTML: ${html.length} bytes, URL: ${page.url()}`);
    await browser.close();

    // Step 4: 解析
    console.log('4. Parsing startlist...');
    const teamsData = parseStartlist(html);
    let totalRiders = 0;
    teamsData.forEach((t, i) => {
      totalRiders += t.riders.length;
      console.log(`   ${i + 1}. ${t.name} (${t.slug}) - ${t.riders.length} riders`);
    });
    console.log(`   Total: ${teamsData.length} teams, ${totalRiders} riders`);

    // Step 5: 导入
    console.log('\n5. Importing startlist...');
    await importStartlist(conn, teamsData);

    await conn.end();
    console.log('\n✅ Complete!');
  } else {
    // Dry run: 只抓取和解析
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('https://www.procyclingstats.com/race/tour-of-austria/2025/stage-1', {
      waitUntil: 'networkidle2', timeout: 45000
    });
    await sleep(4000);
    await page.goto(PCS_STARTLIST_URL, {
      waitUntil: 'networkidle2', timeout: 60000
    });
    const html = await page.content();
    await browser.close();

    const teamsData = parseStartlist(html);
    let totalRiders = 0;
    console.log('\nStage data:');
    STAGES.forEach(s => console.log(`  S${s.n} | ${s.d} | ${s.zh} | ${s.km} km | ${s.elv}m | ${s.type}`));
    console.log('\nTeams preview:');
    teamsData.slice(0, 5).forEach(t => {
      console.log(`\n${t.name}:`);
      t.riders.slice(0, 5).forEach(r => console.log(`  #${r.bib} ${r.name} [${r.nationality}]`));
      if (t.riders.length > 5) console.log(`  ... +${t.riders.length - 5} more`);
    });
    console.log(`\nTotal: ${teamsData.length} teams, ${totalRiders} riders`);
    console.log('\n✅ Dry run complete.');
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
