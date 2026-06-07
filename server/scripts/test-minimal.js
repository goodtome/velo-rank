const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navigating...');
    const response = await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('Status:', response ? response.status() : 'no response');
    console.log('URL:', page.url());
    
    const html = await page.content();
    console.log('HTML:', html.length, 'bytes');
    
    // Check for errors
    if (page.url().includes('chrome-error')) {
      console.log('CHROME ERROR PAGE');
      console.log('First 500 chars:', html.substring(0, 500));
    }
  } catch (err) {
    console.error('Navigation error:', err.message);
  }
  
  await browser.close();
}
main();
