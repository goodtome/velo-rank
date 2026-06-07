/**
 * Compare /gc vs /stage-21-gc final GC data
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const path = require('path');
puppeteer.use(StealthPlugin());

function parseTop5(html, label) {
  const $ = cheerio.load(html);
  const table = $('table.results').first();
  if (!table.length) { console.log(label + ': no table'); return; }
  const rows = table.find('tbody tr');
  console.log(`\n=== ${label} (${rows.length} total rows) ===`);
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const cols = rows.eq(i).find('td');
    if (cols.length < 10) continue;
    const rank = cols.eq(0).text().trim();
    const timeLag = cols.eq(2).text().trim();
    const riderCell = cols.eq(7);
    const riderLink = riderCell.find('a[href*="rider/"]');
    const riderSlug = riderLink.length ? riderLink.attr('href').replace('rider/', '') : '';
    const teamText = cols.eq(8).text().trim();
    let riderName = riderCell.text().trim();
    if (teamText && riderName.endsWith(teamText)) riderName = riderName.slice(0, -teamText.length).trim();
    const time = cols.eq(12).text().trim();
    console.log(`  [${rank}] ${riderName} (${teamText}) lag=${timeLag} col12=${time} slug=${riderSlug}`);
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  // Test 1: /race/tour-de-france/2025/stage-21 (stage results)
  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  let url = 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-21';
  console.log('Fetching:', url);
  let resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  console.log('Status:', resp ? resp.status() : 'none');
  let html = await page.content();
  parseTop5(html, 'Stage 21 Results');
  await page.close();
  await new Promise(r => setTimeout(r, 3000));

  // Test 2: /race/tour-de-france/2025/gc (overall GC)
  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  url = 'https://www.procyclingstats.com/race/tour-de-france/2025/gc';
  console.log('\nFetching:', url);
  resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  console.log('Status:', resp ? resp.status() : 'none');
  html = await page.content();
  parseTop5(html, 'Overall GC (/gc)');
  await page.close();
  await new Promise(r => setTimeout(r, 3000));

  // Test 3: /race/tour-de-france/2025/stage-21-gc (GC after stage 21)
  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  url = 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-21-gc';
  console.log('\nFetching:', url);
  try {
    resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Status:', resp ? resp.status() : 'none');
    html = await page.content();
    parseTop5(html, 'Stage 21 GC (/stage-21-gc)');
  } catch (e) {
    console.log('Error:', e.message.substring(0, 100));
  }

  await browser.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
