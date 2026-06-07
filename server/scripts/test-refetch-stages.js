/**
 * 测试重新抓取有问题的赛段
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
puppeteer.use(StealthPlugin());

function parseStageTop5(html, label) {
  const $ = cheerio.load(html);
  const table = $('table.results').first();
  if (!table.length) { console.log(label + ': no table'); return; }
  const rows = table.find('tbody tr');
  console.log(`\n=== ${label} (${rows.length} rows) ===`);
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cols = rows.eq(i).find('td');
    if (cols.length < 10) continue;
    const rank = cols.eq(0).text().trim();
    const timeLag = cols.eq(2).text().trim();
    const riderCell = cols.eq(7);
    const teamText = cols.eq(8).text().trim();
    let riderName = riderCell.text().trim();
    if (teamText && riderName.endsWith(teamText)) riderName = riderName.slice(0, -teamText.length).trim();
    const time = cols.eq(12).text().trim();
    console.log(`  [${rank}] ${riderName.padEnd(25)} (${teamText.padEnd(30)}) lag=${timeLag.padEnd(12)} time=${time}`);
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  // Test stages that had GC data mixed in
  const testStages = [3, 5, 8, 10, 14];
  
  for (const stageNum of testStages) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    const url = `https://www.procyclingstats.com/race/tour-de-france/2025/stage-${stageNum}`;
    console.log(`\nFetching: ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      const status = resp ? resp.status() : 'none';
      if (page.url().includes('chrome-error')) {
        console.log(`  FAILED: ${status}`);
      } else {
        const html = await page.content();
        console.log(`  Status: ${status}, HTML: ${html.length} bytes`);
        parseStageTop5(html, `Stage ${stageNum}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message.substring(0, 80)}`);
    }
    await page.close();
    await new Promise(r => setTimeout(r, 4000));
  }

  await browser.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
