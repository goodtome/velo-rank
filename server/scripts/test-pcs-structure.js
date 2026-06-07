/**
 * 分析 PCS 表格列结构
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Fetch Stage 1 result
    console.log('Fetching TdF 2025 Stage 1...');
    await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForSelector('table.results', { timeout: 15000 });
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Get table headers
    const headers = [];
    $('table.results thead th').each((i, th) => {
      headers.push(`[${i}] ${$(th).text().trim()}`);
    });
    console.log('Table headers:', headers.join(' | '));
    
    // Show first 3 data rows in detail
    console.log('\nFirst 3 data rows (all columns):');
    $('table.results tbody tr').slice(0, 3).each((rowIdx, row) => {
      const cols = $(row).find('td');
      console.log(`\nRow ${rowIdx} (${cols.length} cols):`);
      cols.each((colIdx, td) => {
        const text = $(td).text().trim();
        const link = $(td).find('a');
        const href = link.length ? link.attr('href') : '';
        const cls = $(td).attr('class') || '';
        if (text || href) {
          console.log(`  [${colIdx}] class="${cls}" text="${text.substring(0, 50)}" href="${href}"`);
        }
      });
    });
    
    // Now fetch GC page
    await sleep(3000);
    console.log('\n\nFetching TdF 2025 GC...');
    await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1-gc', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForSelector('table.results', { timeout: 15000 });
    
    const html2 = await page.content();
    const $2 = cheerio.load(html2);
    
    const headers2 = [];
    $2('table.results thead th').each((i, th) => {
      headers2.push(`[${i}] ${$2(th).text().trim()}`);
    });
    console.log('GC Table headers:', headers2.join(' | '));
    
    console.log('\nGC first 2 rows:');
    $2('table.results tbody tr').slice(0, 2).each((rowIdx, row) => {
      const cols = $2(row).find('td');
      console.log(`\nRow ${rowIdx} (${cols.length} cols):`);
      cols.each((colIdx, td) => {
        const text = $2(td).text().trim();
        const link = $2(td).find('a');
        const href = link.length ? link.attr('href') : '';
        if (text || href) {
          console.log(`  [${colIdx}] text="${text.substring(0, 50)}" href="${href}"`);
        }
      });
    });
    
    // Fetch Points classification
    await sleep(3000);
    console.log('\n\nFetching TdF 2025 Points...');
    await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1-points', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForSelector('table.results', { timeout: 15000 }).catch(() => {});
    
    const html3 = await page.content();
    const $3 = cheerio.load(html3);
    
    const headers3 = [];
    $3('table.results thead th').each((i, th) => {
      headers3.push(`[${i}] ${$3(th).text().trim()}`);
    });
    console.log('Points Table headers:', headers3.join(' | '));
    
    // Fetch KOM
    await sleep(3000);
    console.log('\n\nFetching TdF 2025 KOM...');
    await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1-kom', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForSelector('table.results', { timeout: 15000 }).catch(() => {});
    
    const html4 = await page.content();
    const $4 = cheerio.load(html4);
    
    const headers4 = [];
    $4('table.results thead th').each((i, th) => {
      headers4.push(`[${i}] ${$4(th).text().trim()}`);
    });
    console.log('KOM Table headers:', headers4.join(' | '));
    
    // Fetch Youth
    await sleep(3000);
    console.log('\n\nFetching TdF 2025 Youth...');
    await page.goto('https://www.procyclingstats.com/race/tour-de-france/2025/stage-1-youth', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForSelector('table.results', { timeout: 15000 }).catch(() => {});
    
    const html5 = await page.content();
    const $5 = cheerio.load(html5);
    
    const headers5 = [];
    $5('table.results thead th').each((i, th) => {
      headers5.push(`[${i}] ${$5(th).text().trim()}`);
    });
    console.log('Youth Table headers:', headers5.join(' | '));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
