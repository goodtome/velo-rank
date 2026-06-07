/**
 * 最小化复制 sync-tdf2026.js 的结构来定位问题
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

puppeteer.use(StealthPlugin());
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPCSPage(page, url) {
  page.on('requestfailed', req => {
    const err = req.failure();
    if (err) console.log(`  [net-fail] ${req.url().substring(0,60)} - ${err.errorText}`);
  });
  
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  console.log(`  Status: ${resp ? resp.status() : 'none'}, URL: ${page.url()}`);
  const html = await page.content();
  console.log(`  HTML: ${html.length} bytes`);
  return html;
}

async function main() {
  console.log('Step 1: Launch browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Step 2: Fetch PCS page...');
  try {
    const html = await fetchPCSPage(page, 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1');
    
    if (!page.url().includes('chrome-error')) {
      const $ = cheerio.load(html);
      const rows = $('table.results').first().find('tbody tr');
      console.log(`  Parsed ${rows.length} rows`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await browser.close();
}

main();
