/**
 * ScraperAPI v2 测试 - 尝试不同的反反爬参数
 */
const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

const API_KEY = '156d1b97b6ea62da4fff324c22b66bce';

function fetchUrl(params) {
  return new Promise((resolve, reject) => {
    const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url = `http://api.scraperapi.com/?${qs}`;
    console.log(`  Request: ${url.substring(0, 120)}...`);
    
    const req = http.get(url, { timeout: 60000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`  Status: ${res.statusCode}, Body: ${body.length} bytes`);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function testFetch(label, targetUrl, extraParams = {}) {
  console.log(`\n--- ${label} ---`);
  console.log(`  Target: ${targetUrl}`);
  
  const params = {
    api_key: API_KEY,
    url: targetUrl,
    render: 'true',
    ...extraParams
  };
  
  try {
    const { status, body } = await fetchUrl(params);
    
    if (status !== 200) {
      console.log(`  FAIL: ${body.substring(0, 200)}`);
      return null;
    }
    
    const $ = cheerio.load(body);
    const title = $('title').first().text().trim();
    console.log(`  Title: ${title}`);
    
    if (body.includes('challenge-platform') || body.includes('Just a moment')) {
      console.log('  BLOCKED: Cloudflare challenge');
      return null;
    }
    
    // Check for results
    const rows = $('.results table tbody tr');
    if (rows.length > 0) {
      console.log(`  Found ${rows.length} result rows`);
      rows.slice(0, 5).each((i, row) => {
        const cols = $(row).find('td');
        if (cols.length >= 4) {
          const texts = [];
          cols.slice(0, 6).each((j, td) => texts.push($(td).text().trim()));
          console.log(`    ${texts.join(' | ')}`);
        }
      });
    }
    
    return body;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('=== ScraperAPI v2 测试 ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  // Test 1: Simple URL to verify API key works
  await testFetch('API Key 验证 (example.com)', 'https://example.com');
  
  // Test 2: PCS homepage
  await testFetch('PCS 首页', 'https://www.procyclingstats.com', { premium: 'true' });
  
  // Test 3: TdF 2025 with ultra_premium
  await testFetch('TdF 2025 (ultra_premium)', 
    'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1/result',
    { ultra_premium: 'true', premium: 'true' });
  
  // Test 4: TdF 2025 without render (some sites work better without JS)
  await testFetch('TdF 2025 (no render)', 
    'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1/result',
    { render: 'false', premium: 'true' });
  
  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);
