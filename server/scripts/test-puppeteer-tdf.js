/**
 * Puppeteer + Stealth 测试 PCS 抓取 TdF 2025 数据
 * 
 * 测试目标：
 * 1. 绕过 Cloudflare 获取 PCS 页面
 * 2. 解析赛段成绩表格
 * 3. 解析 GC / Points / KOM / Youth 分类
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

const PCS_BASE = 'https://www.procyclingstats.com';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * 解析成绩表格 (通用)
 */
function parseResultsTable(html, label) {
  const $ = cheerio.load(html);
  const table = $('table.results').first();
  
  if (!table.length) {
    // Try alternate: any table with tr containing rider links
    const allTables = $('table');
    console.log(`  [${label}] No .results table, found ${allTables.length} tables total`);
    return [];
  }
  
  const rows = table.find('tbody tr');
  console.log(`  [${label}] Found ${rows.length} rows in .results table`);
  
  const results = [];
  rows.each((i, row) => {
    const cols = $(row).find('td');
    if (cols.length < 4) return;
    
    // Generic parsing - different columns for different table types
    const rank = cols.eq(0).text().trim();
    
    // Find rider name (usually in column 2 or 3 with an <a> tag)
    let riderName = '';
    let teamName = '';
    let timeOrPoints = '';
    
    for (let c = 1; c < Math.min(cols.length, 6); c++) {
      const link = cols.eq(c).find('a[href*="/rider/"]');
      if (link.length) {
        riderName = link.text().trim();
        // Team is usually the next column
        if (c + 1 < cols.length) {
          teamName = cols.eq(c + 1).text().trim();
        }
        // Time/points is usually in the last few columns
        timeOrPoints = cols.eq(cols.length - 1).text().trim();
        break;
      }
    }
    
    if (!riderName) {
      riderName = cols.eq(2).find('a').text().trim() || cols.eq(2).text().trim();
      teamName = cols.eq(3).text().trim();
      timeOrPoints = cols.eq(5).text().trim();
    }
    
    if (riderName) {
      results.push({
        rank: parseInt(rank) || (i + 1),
        rider: riderName,
        team: teamName,
        value: timeOrPoints || '-'
      });
    }
  });
  
  return results;
}

async function main() {
  console.log('=== Puppeteer PCS 抓取测试 (TdF 2025) ===\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // ---- Test 1: TdF 2025 Stage 1 Result ----
    console.log('📋 Test 1: TdF 2025 Stage 1 Result');
    const stage1Url = `${PCS_BASE}/race/tour-de-france/2025/stage-1`;
    console.log(`  URL: ${stage1Url}`);
    
    await page.goto(stage1Url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for Cloudflare challenge to resolve (if any)
    try {
      await page.waitForSelector('table', { timeout: 15000 });
      console.log('  Page loaded successfully');
    } catch (e) {
      console.log('  Waiting for Cloudflare...');
      await sleep(8000);
      await page.waitForSelector('table', { timeout: 15000 }).catch(() => {
        console.log('  No table found after waiting');
      });
    }
    
    const pageUrl = page.url();
    console.log(`  Final URL: ${pageUrl}`);
    const pageTitle = await page.title();
    console.log(`  Title: ${pageTitle}`);
    
    const html1 = await page.content();
    console.log(`  HTML length: ${html1.length}`);
    
    // Parse the stage result
    const stageResults = parseResultsTable(html1, 'Stage 1 Result');
    if (stageResults.length > 0) {
      console.log(`  Top 10 results:`);
      stageResults.slice(0, 10).forEach(r => {
        console.log(`    #${r.rank} ${r.rider} (${r.team}) ${r.value}`);
      });
    }
    
    // ---- Test 2: GC after Stage 1 ----
    await sleep(3000);
    console.log('\n📋 Test 2: TdF 2025 GC after Stage 1');
    const gcUrl = `${PCS_BASE}/race/tour-de-france/2025/stage-1-gc`;
    console.log(`  URL: ${gcUrl}`);
    
    await page.goto(gcUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    
    const html2 = await page.content();
    console.log(`  HTML length: ${html2.length}`);
    
    const gcResults = parseResultsTable(html2, 'GC');
    if (gcResults.length > 0) {
      console.log(`  Top 5 GC:`);
      gcResults.slice(0, 5).forEach(r => {
        console.log(`    #${r.rank} ${r.rider} (${r.team}) ${r.value}`);
      });
    }
    
    // ---- Test 3: Stage list from race page ----
    await sleep(3000);
    console.log('\n📋 Test 3: TdF 2025 Race Page (stage list)');
    const raceUrl = `${PCS_BASE}/race/tour-de-france/2025`;
    console.log(`  URL: ${raceUrl}`);
    
    await page.goto(raceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    
    const html3 = await page.content();
    const $3 = cheerio.load(html3);
    
    // Count stage links
    const stageLinks = $3('a[href*="stage-"]');
    console.log(`  Found ${stageLinks.length} stage links`);
    stageLinks.slice(0, 5).each((i, el) => {
      console.log(`    ${$3(el).text().trim()} -> ${$3(el).attr('href')}`);
    });
    
    console.log('\n=== 测试完成 ===');
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    if (browser) await browser.close();
  }
}

main();
