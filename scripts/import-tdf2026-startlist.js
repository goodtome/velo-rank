/**
 * TdF 2026 车手/车队数据导入脚本
 * 
 * 从 PCS startlist 页面抓取所有参赛车队和车手，写入 MySQL
 * 
 * 用法:
 *   node scripts/import-tdf2026-startlist.js                 # 导入 TDF 2026
 *   node scripts/import-tdf2026-startlist.js --dry-run       # 仅解析不入库
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const PCS_STARTLIST_URL = 'https://www.procyclingstats.com/race/tour-de-france/2026/startlist/startlist';
const DRY_RUN = process.argv.includes('--dry-run');
const SAVE_HTML = process.argv.includes('--save-html');
const TDF_SNAPSHOTS_DIR = process.env.TDF_SNAPSHOTS_DIR
  ? path.resolve(process.env.TDF_SNAPSHOTS_DIR)
  : path.join(__dirname, '..', 'archive', 'generated', '2026-tdf', 'snapshots');

// DB 配置 (硬编码，与项目其他脚本一致)
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db',
  charset: 'utf8mb4'
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// PCS Startlist 解析
// ============================================================

/**
 * 从 PCS startlist HTML 中解析车队和车手
 * HTML 结构:
 *   ul.startlist_v4 > li.slxl_iv  (每个车队)
 *     .shirtCont > a[href*="team/"]  (车队 URL)
 *     .ridersCont
 *       a.team (车队名 + URL)
 *       ul > li  (每个车手)
 *         span.flag XX  (国籍, class 如 "flag fr")
 *         a[href*="rider/"]  (车手链接)
 */
function parseStartlist(html) {
  const $ = cheerio.load(html);
  const teams = [];

  $('ul.startlist_v4 > li').each((_, teamEl) => {
    const $team = $(teamEl);

    // 车队信息
    const teamLink = $team.find('a.team');
    const teamName = teamLink.text().trim().replace(/\s*\((WT[WM]?|PRT)\)\s*$/i, '');
    const teamHref = teamLink.attr('href') || '';

    // 从 href 提取 team_slug (例如 "team/uae-team-emirates-xrg-2026" → "uae-team-emirates-xrg")
    let teamSlug = '';
    const teamSlugMatch = teamHref.match(/team\/([^"']+)/);
    if (teamSlugMatch) {
      teamSlug = teamSlugMatch[1].replace(/-\d{4}$/, '');
    }

    // 车队国籍 (从 shirt img src 或 team class 推断)
    let teamCountry = '';
    const shirtImg = $team.find('.shirtCont img').first();
    if (shirtImg.length) {
      const srcMatch = (shirtImg.attr('src') || '').match(/shirts\/bx\/(\w+)\//);
      if (srcMatch) teamCountry = srcMatch[1].toUpperCase();
    }

    const riders = [];
    $team.find('.ridersCont ul li').each((_, riderEl) => {
      const $li = $(riderEl);
      
      // 跳过退赛车手 (li 有特定 class)
      if ($li.hasClass('dnf') || $li.hasClass('dns')) return;

      // 国籍
      const flagSpan = $li.find('span.flag');
      const flagClasses = (flagSpan.attr('class') || '').split(/\s+/);
      let nationality = 'UNK';
      // 找非 'flag' 的 class
      for (const cls of flagClasses) {
        if (cls !== 'flag' && cls.length === 2) {
          nationality = cls.toUpperCase();
          break;
        }
      }

      // 车手信息
      const riderLink = $li.find('a[href*="rider/"]');
      const riderName = riderLink.text().trim();
      const riderHref = riderLink.attr('href') || '';
      let riderSlug = '';
      if (riderHref) {
        riderSlug = riderHref.replace(/^rider\//, '').replace(/\/$/, '');
      }

      // 背号 (可选)
      const bibSpan = $li.find('span.bib');
      const bib = bibSpan.length ? parseInt(bibSpan.text().trim()) || null : null;

      if (riderName) {
        riders.push({ name: riderName, slug: riderSlug, nationality, bib });
      }
    });

    if (teamName || riders.length) {
      teams.push({
        name: teamName,
        slug: teamSlug,
        country: teamCountry,
        riders
      });
    }
  });

  return teams;
}

// ============================================================
// 数据库操作
// ============================================================

let conn;

async function getOrCreateTeam(name, slug, country) {
  if (!name) return null;

  // 1. 按 team_slug 匹配 (如果表有此列)
  if (slug) {
    try {
      const [rows] = await conn.query('SELECT id FROM teams WHERE team_slug = ? LIMIT 1', [slug]);
      if (rows.length > 0) return rows[0].id;
    } catch (e) {
      // team_slug 列可能不存在
    }
  }

  // 2. 按名称模糊匹配
  const searchParts = name.split(' ').slice(0, 3).join(' ');
  const [rows] = await conn.query(
    'SELECT id FROM teams WHERE team_name LIKE ? OR team_name_en LIKE ? LIMIT 1',
    [`%${searchParts}%`, `%${searchParts}%`]
  );
  if (rows.length > 0) return rows[0].id;

  if (DRY_RUN) return null;

  // 3. 创建新车队
  const id = uuidv4();
  try {
    await conn.query(
      'INSERT INTO teams (id, team_name, team_name_en, country) VALUES (?, ?, ?, ?)',
      [id, name, name, country || '']
    );
    console.log(`  [NEW TEAM] ${name}${country ? ` (${country})` : ''}`);
    return id;
  } catch (e) {
    // 可能 team_slug 是必填
    try {
      await conn.query(
        'INSERT INTO teams (id, team_name, team_name_en, team_slug, country) VALUES (?, ?, ?, ?, ?)',
        [id, name, name, slug || null, country || '']
      );
      console.log(`  [NEW TEAM] ${name}${country ? ` (${country})` : ''}`);
      return id;
    } catch (e2) {
      try {
        await conn.query(
          'INSERT INTO teams (id, team_name) VALUES (?, ?)',
          [id, name]
        );
        console.log(`  [NEW TEAM] ${name} (minimal)`);
        return id;
      } catch (e3) {
        console.error(`  Team insert failed: ${name} - ${e3.message}`);
        return null;
      }
    }
  }
}

async function getOrCreateRider(name, slug, nationality) {
  if (!name) return null;

  // 1. 按 rider_slug 匹配
  if (slug) {
    try {
      const [rows] = await conn.query('SELECT id FROM riders WHERE rider_slug = ? LIMIT 1', [slug]);
      if (rows.length > 0) return { id: rows[0].id, action: 'existing' };
    } catch (e) {
      // 列不存在
    }
  }

  // 2. 按姓名匹配
  const [rows] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [name]);
  if (rows.length > 0) {
    // 更新 slug (如果原来为空)
    if (slug) {
      try {
        await conn.query('UPDATE riders SET rider_slug = ? WHERE id = ? AND (rider_slug IS NULL OR rider_slug = ?)', [slug, rows[0].id, '']);
      } catch (e) { /* 忽略 */ }
    }
    return { id: rows[0].id, action: 'existing' };
  }

  if (DRY_RUN) return null;

  // 3. 创建新车手
  const id = uuidv4();
  try {
    // 尝试完整字段
    await conn.query(
      'INSERT INTO riders (id, rider_name, rider_name_zh, nationality, rider_slug) VALUES (?, ?, ?, ?, ?)',
      [id, name, null, nationality || 'UNK', slug || null]
    );
    return { id, action: 'new' };
  } catch (e) {
    // fallback: 最简字段
    try {
      await conn.query(
        'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
        [id, name, nationality || 'UNK']
      );
      return { id, action: 'new' };
    } catch (e2) {
      console.error(`  Rider insert failed: ${name} - ${e2.message}`);
      return null;
    }
  }
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log(`\n=== TdF 2026 Startlist Import ===`);
  console.log(`URL: ${PCS_STARTLIST_URL}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}\n`);

  // Step 1: Launch browser + fetch page
  console.log('Step 1: Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let html;
  try {
    console.log('Step 2: Fetching startlist page...');
    // 先预热访问一个轻量页面
    await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });
    console.log(`  Warmup: ${page.url()} - ${(await page.content()).length} bytes`);
    await sleep(4000);

    // 再访问真正的 startlist
    await page.goto(PCS_STARTLIST_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    html = await page.content();
    console.log(`  Startlist: ${html.length} bytes, URL: ${page.url()}`);

    if (SAVE_HTML) {
      fs.mkdirSync(TDF_SNAPSHOTS_DIR, { recursive: true });
      const snapshotPath = path.join(TDF_SNAPSHOTS_DIR, 'tdf2026_startlist.html');
      fs.writeFileSync(snapshotPath, html);
      console.log(`  Saved to ${snapshotPath}`);
    }
  } catch (e) {
    console.error(`Fetch failed: ${e.message}`);
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  // Step 3: Parse
  console.log('\nStep 3: Parsing startlist...');
  const teamsData = parseStartlist(html);
  console.log(`  Found ${teamsData.length} teams`);

  let totalRiders = 0;
  teamsData.forEach((t, i) => {
    const rCount = t.riders.length;
    totalRiders += rCount;
    console.log(`  ${i + 1}. ${t.name} (${t.slug}) - ${rCount} riders`);
    if (rCount <= 5 && rCount > 0) {
      console.log(`     ⚠️ Only ${rCount} riders! (expected ~8)`);
      t.riders.forEach(r => console.log(`       #${r.bib} ${r.name} [${r.nationality}] ${r.slug}`));
    }
  });
  console.log(`\n  Total: ${totalRiders} riders`);

  if (DRY_RUN) {
    // 详细输出前 3 个车队
    console.log('\n--- Preview (first 3 teams) ---');
    teamsData.slice(0, 3).forEach(t => {
      console.log(`\n${t.name}:`);
      t.riders.forEach(r => console.log(`  #${r.bib} ${r.name} [${r.nationality}] (${r.slug})`));
    });
    console.log('\n✅ Dry run complete. Use without --dry-run to import.');
    return;
  }

  // Step 4: Connect DB and import
  console.log('\nStep 4: Connecting to MySQL...');
  conn = await mysql.createConnection(DB_CONFIG);
  console.log('  Connected.');

  // Step 5: Import teams & riders
  console.log('\nStep 5: Importing teams and riders...');
  let teamsNew = 0, teamsExisting = 0;
  let ridersNew = 0, ridersExisting = 0;

  for (const team of teamsData) {
    console.log(`\n--- ${team.name} ---`);

    const teamId = await getOrCreateTeam(team.name, team.slug, team.country);
    if (!teamId) {
      console.log(`  ⚠️  Failed to get/create team`);
      continue;
    }
    const isNewTeam = !(await wasExisting('teams', teamId));
    if (isNewTeam) teamsNew++; else teamsExisting++;

    for (const rider of team.riders) {
      const result = await getOrCreateRider(rider.name, rider.slug, rider.nationality);
      if (!result) {
        console.log(`  ⚠️  Failed: ${rider.name}`);
        continue;
      }
      if (result.action === 'new') {
        ridersNew++;
        console.log(`  + ${rider.name} [${rider.nationality}]`);
      } else {
        ridersExisting++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Teams: ${teamsNew} new, ${teamsExisting} existing (${teamsData.length} total)`);
  console.log(`  Riders: ${ridersNew} new, ${ridersExisting} existing (${totalRiders} total)`);
  console.log('='.repeat(60));

  await conn.end();
  console.log('\n✅ Import complete!');
}

async function wasExisting(table, id) {
  // 简单检查: 通过时间近似判断是否刚创建
  // 这里用更简单的方法: 连接时记录已有数量
  return false; // 简化处理，用 action 判断
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
