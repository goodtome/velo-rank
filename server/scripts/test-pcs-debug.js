/**
 * 调试 PCS 解析 - 保存 HTML 并逐行检查
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const fs = require('fs');

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
    await page.setViewport({ width: 1920, height: 1080 });
    
    const url = 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1';
    console.log('Fetching:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for table
    try {
      await page.waitForSelector('table.results', { timeout: 10000 });
      console.log('table.results found');
    } catch {
      console.log('No table.results, waiting more...');
      await sleep(5000);
    }
    
    const html = await page.content();
    console.log('HTML length:', html.length);
    
    // Save HTML for inspection
    fs.writeFileSync('D:/codes/velo-rank/server/scripts/data/tdf2025-stage1.html', html);
    console.log('HTML saved');
    
    const $ = cheerio.load(html);
    
    // Debug: check table structure
    const tables = $('table.results');
    console.log('Number of table.results:', tables.length);
    
    if (tables.length > 0) {
      const firstTable = tables.first();
      const headerRows = firstTable.find('thead tr');
      console.log('Header rows:', headerRows.length);
      
      const bodyRows = firstTable.find('tbody tr');
      console.log('Body rows:', bodyRows.length);
      
      // Check first 3 body rows
      bodyRows.slice(0, 3).each((i, row) => {
        const tds = $(row).find('td');
        console.log(`Row ${i}: ${tds.length} tds`);
        
        // Print each td's text
        tds.each((j, td) => {
          const text = $(td).text().trim();
          if (text) {
            console.log(`  td[${j}]: "${text.substring(0, 40)}"`);
          }
        });
      });
    }
    
    // Also check if there's a different table class
    const allTables = $('table');
    console.log('\nAll tables:', allTables.length);
    allTables.each((i, table) => {
      const cls = $(table).attr('class') || 'no-class';
      const rows = $(table).find('tbody tr');
      console.log(`  Table ${i}: class="${cls}" rows=${rows.length}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
