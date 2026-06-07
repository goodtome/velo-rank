/**
 * Debug GC page column structure
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const path = require('path');

puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1-gc';
  console.log('Fetching:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  const html = await page.content();
  console.log('Status: 200, HTML:', html.length, 'bytes');

  const $ = cheerio.load(html);
  const table = $('table.results').first();
  const rows = table.find('tbody tr');
  console.log('Rows:', rows.length);

  // Dump first 5 rows with all column values
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows.eq(i);
    const cols = row.find('td');
    console.log(`\n--- Row ${i} (${cols.length} cols) ---`);
    for (let j = 0; j < cols.length; j++) {
      const text = cols.eq(j).text().trim().replace(/\s+/g, ' ');
      const link = cols.eq(j).find('a').attr('href') || '';
      console.log(`  [${j}] "${text}" ${link ? '(link: ' + link.substring(0, 40) + ')' : ''}`);
    }
  }

  await browser.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
