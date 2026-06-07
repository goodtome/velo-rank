const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = '156d1b97b6ea62da4fff324c22b66bce';

function fetchUrl(targetUrl, extraParams = {}) {
  return new Promise((resolve, reject) => {
    const params = { api_key: API_KEY, url: targetUrl, render: 'true', premium: 'true', ...extraParams };
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const req = http.get(`http://api.scraperapi.com/?${qs}`, { timeout: 120000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`  Status: ${res.statusCode}, Size: ${body.length} bytes`);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const url = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-19';
  
  // Try 1: Standard
  console.log('尝试 1: standard...');
  const r1 = await fetchUrl(url);
  if (r1.status === 200 && r1.body.length > 50000) {
    fs.writeFileSync(path.join(__dirname, 'pcs_html', 'giro_s19.html'), r1.body, 'utf8');
    console.log('✅ 成功!');
    return;
  }

  // Try 2: ultra_premium
  console.log('尝试 2: ultra_premium...');
  const r2 = await fetchUrl(url, { ultra_premium: 'true' });
  if (r2.status === 200 && r2.body.length > 50000) {
    fs.writeFileSync(path.join(__dirname, 'pcs_html', 'giro_s19.html'), r2.body, 'utf8');
    console.log('✅ 成功!');
    return;
  }

  // Try 3: without render
  console.log('尝试 3: no render...');
  const r3 = await fetchUrl(url, { render: 'false' });
  if (r3.status === 200 && r3.body.length > 50000) {
    fs.writeFileSync(path.join(__dirname, 'pcs_html', 'giro_s19.html'), r3.body, 'utf8');
    console.log('✅ 成功 (no render)!');
    return;
  }

  // Try 4: different URL format
  console.log('尝试 4: /result URL...');
  const r4 = await fetchUrl('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-19/result');
  if (r4.status === 200 && r4.body.length > 50000) {
    fs.writeFileSync(path.join(__dirname, 'pcs_html', 'giro_s19.html'), r4.body, 'utf8');
    console.log('✅ 成功 (/result)!');
    return;
  }

  console.log('❌ 所有尝试失败');
}

main().catch(console.error);
