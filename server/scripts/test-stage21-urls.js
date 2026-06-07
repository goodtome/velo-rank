/**
 * Test various PCS URLs for TdF 2025 final classifications
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const urls = [
    'https://www.procyclingstats.com/race/tour-de-france/2025/stage-21-gc',
    'https://www.procyclingstats.com/race/tour-de-france/2025/gc',
    'https://www.procyclingstats.com/race/tour-de-france/2025/stage-21-points',
    'https://www.procyclingstats.com/race/tour-de-france/2025/points',
    'https://www.procyclingstats.com/race/tour-de-france/2025/stage-21-kom',
    'https://www.procyclingstats.com/race/tour-de-france/2025/kom',
    'https://www.procyclingstats.com/race/tour-de-france/2025/stage-21-youth',
    'https://www.procyclingstats.com/race/tour-de-france/2025/youth',
  ];

  for (const url of urls) {
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const status = resp ? resp.status() : 'none';
      const isErr = page.url().includes('chrome-error');
      console.log(`${isErr ? 'FAIL' : 'OK'} [${status}] ${url}`);
      if (!isErr) {
        const html = await page.content();
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const rows = $('table.results').first().find('tbody tr').length;
        if (rows > 0) console.log(`       -> ${rows} rows`);
      }
    } catch (e) {
      console.log(`ERR  ${url} - ${e.message.substring(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
