// Combined test: same file, two sequential fetches
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPCS(page, url) {
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  const status = resp ? resp.status() : 0;
  console.log(`  Status: ${status}, URL: ${page.url()}, HTML: ${(await page.content()).length}`);
  if (page.url().includes('chrome-error')) throw new Error(`HTTP ${status}`);
  return await page.content();
}

async function main() {
  // Test 1: exact same code as test-minimal-sync
  console.log('Test 1 (minimal pattern):');
  const browser1 = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page1 = await browser1.newPage();
  await page1.setViewport({ width: 1920, height: 1080 });
  
  try {
    const html1 = await fetchPCS(page1, 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1');
    const $ = cheerio.load(html1);
    console.log(`  Rows: ${$('table.results').first().find('tbody tr').length}`);
  } catch (e) {
    console.log(`  FAIL: ${e.message}`);
  }
  await browser1.close();
  
  await sleep(2000);
  
  // Test 2: sync script pattern
  console.log('\nTest 2 (sync pattern):');
  const browser2 = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page2 = await browser2.newPage();
  await page2.setViewport({ width: 1920, height: 1080 });
  
  try {
    const html2 = await fetchPCS(page2, 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1');
    const $ = cheerio.load(html2);
    console.log(`  Rows: ${$('table.results').first().find('tbody tr').length}`);
  } catch (e) {
    console.log(`  FAIL: ${e.message}`);
  }
  await browser2.close();
}

main();
