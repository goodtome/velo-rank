/**
 * PCS 抓取测试脚本
 * 测试能否正常访问 ProCyclingStats 页面并解析 TdF 数据
 */
const https = require('https');
const cheerio = require('cheerio');

const URLS = {
  'TdF 2025 Race Page': 'https://www.procyclingstats.com/race/tour-de-france/2025',
  'TdF 2025 Stage 1 Result': 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1/result',
  'TdF 2025 GC after Stage 1': 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1/gc'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Referer': 'https://www.google.com/',
  'DNT': '1'
};

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function testPage(label, url) {
  console.log(`\n--- ${label} ---`);
  console.log(`URL: ${url}`);
  
  try {
    const { status, body } = await fetchPage(url);
    console.log(`Status: ${status}`);
    console.log(`Body length: ${body.length}`);
    
    if (body.includes('challenge-platform') || body.includes('cf-browser-verification')) {
      console.log('BLOCKED: Cloudflare challenge detected');
      return false;
    }
    
    if (status !== 200) {
      console.log('Non-200 status');
      return false;
    }
    
    const $ = cheerio.load(body);
    const title = $('title').first().text().trim();
    console.log(`Title: ${title}`);
    
    // Check for results table
    const tableRows = $('.results table tbody tr').length;
    console.log(`Table rows found: ${tableRows}`);
    
    if (label.includes('Stage') && label.includes('Result')) {
      // Parse stage results
      const results = [];
      $('.results table tbody tr').each((i, row) => {
        const $row = $(row);
        const cols = $row.find('td');
        if (cols.length < 6) return;
        const rank = cols.eq(0).text().trim();
        const riderCell = cols.eq(2);
        const riderName = riderCell.find('a').text().trim() || riderCell.text().trim();
        const teamName = cols.eq(3).text().trim();
        const time = cols.eq(5).text().trim();
        if (riderName && rank) {
          results.push({ rank, rider: riderName, team: teamName, time: time || 's.t.' });
        }
      });
      console.log(`\nParsed ${results.length} results:`);
      results.slice(0, 10).forEach(r => {
        console.log(`  #${r.rank} ${r.rider} (${r.team}) ${r.time}`);
      });
      if (results.length > 10) console.log(`  ... and ${results.length - 10} more`);
    }
    
    if (label.includes('Race Page')) {
      // Parse stage list
      const stages = [];
      $('.results table tbody tr').each((i, row) => {
        const $row = $(row);
        const cols = $row.find('td');
        if (cols.length < 4) return;
        const stageNum = cols.eq(0).text().trim();
        const dateStr = cols.eq(1).text().trim();
        const route = cols.eq(1).find('a').text().trim();
        if (stageNum) {
          stages.push({ num: stageNum, date: dateStr, route });
        }
      });
      console.log(`\nParsed ${stages.length} stages:`);
      stages.slice(0, 5).forEach(s => console.log(`  Stage ${s.num}: ${s.route} (${s.date})`));
      if (stages.length > 5) console.log(`  ... and ${stages.length - 5} more`);
    }
    
    if (label.includes('GC')) {
      const results = [];
      $('.results table tbody tr').each((i, row) => {
        const $row = $(row);
        const cols = $row.find('td');
        if (cols.length < 6) return;
        const rank = cols.eq(0).text().trim();
        const riderCell = cols.eq(2);
        const riderName = riderCell.find('a').text().trim() || riderCell.text().trim();
        const teamName = cols.eq(3).text().trim();
        const time = cols.eq(5).text().trim();
        if (riderName && rank) {
          results.push({ rank, rider: riderName, team: teamName, time: time || '-' });
        }
      });
      console.log(`\nParsed ${results.length} GC results:`);
      results.slice(0, 10).forEach(r => {
        console.log(`  #${r.rank} ${r.rider} (${r.team}) ${r.time}`);
      });
    }
    
    return true;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== PCS 抓取测试 ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  let delay = 0;
  for (const [label, url] of Object.entries(URLS)) {
    if (delay > 0) {
      console.log(`\n等待 ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
    await testPage(label, url);
    delay = 5000; // 5秒间隔
  }
  
  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);
