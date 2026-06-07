/**
 * Isolated test: load same modules as sync script, then navigate
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

puppeteer.use(StealthPlugin());

// Same dotenv/config loading as sync script
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

async function main() {
  console.log('Modules loaded');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  console.log('Browser launched');
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  console.log('Page created');
  
  try {
    const url = 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1';
    console.log('Navigating to:', url);
    
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Status:', response ? response.status() : 'no response');
    console.log('URL:', page.url());
    
    const html = await page.content();
    console.log('HTML:', html.length, 'bytes');
    
    if (page.url().includes('chrome-error')) {
      console.log('CHROME ERROR');
    } else {
      const $ = cheerio.load(html);
      const tables = $('table.results');
      console.log('table.results count:', tables.length);
      
      if (tables.length > 0) {
        const rows = tables.first().find('tbody tr');
        console.log('First table rows:', rows.length);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await browser.close();
}
main();
