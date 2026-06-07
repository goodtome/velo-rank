/**
 * 直接用 puppeteer (不用 stealth) 测试 PCS
 */
const puppeteer = require('puppeteer');

async function main() {
  console.log('Launching plain puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  page.on('requestfailed', req => {
    const err = req.failure();
    if (err) console.log(`FAILED: ${req.url().substring(0, 80)} - ${err.errorText}`);
  });
  
  try {
    const url = 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1';
    console.log('Navigating:', url);
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    console.log('Status:', resp ? resp.status() : 'none');
    console.log('URL:', page.url());
    
    const html = await page.content();
    console.log('HTML:', html.length, 'bytes');
    
    if (!page.url().includes('chrome-error')) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      console.log('table.results:', $('table.results').length);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await browser.close();
}

main();
