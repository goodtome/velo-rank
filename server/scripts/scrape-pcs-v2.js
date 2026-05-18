const { chromium } = require('playwright');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.procyclingstats.com';

/**
 * 使用Playwright获取页面内容
 */
async function fetchPageWithPlaywright(url, options = {}) {
  const { 
    headless = true, 
    waitForSelector = null, 
    timeout = 60000,
    waitTime = 5000 
  } = options;
  
  let browser = null;
  try {
    browser = await chromium.launch({ 
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'Asia/Shanghai',
      permissions: ['geolocation'],
      geolocation: { longitude: 0, latitude: 0 }
    });
    
    // 注入脚本以隐藏webdriver属性
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.challengeTimeout = 120000;
    });
    
    const page = await context.newPage();
    
    // 拦截不必要的请求
    await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf}', route => route.abort());
    
    console.log(`正在加载: ${url}`);
    
    // 先访问主页获取cookie
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // 然后导航到目标页面
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    
    if (!response || !response.ok()) {
      console.log(`⚠️ 页面加载状态: ${response ? response.status() : 'no response'}`);
    }
    
    // 等待额外时间让Cloudflare验证完成
    console.log('等待页面渲染...');
    await new Promise(r => setTimeout(r, waitTime));
    
    // 检查标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
      console.log('⚠️ 仍被Cloudflare拦截，尝试截图...');
      await page.screenshot({ path: '/d/codes/cycling_new/server/scripts/screenshots/cf-blocked.png' });
      
      // 尝试等待更长时间
      console.log('等待额外15秒...');
      await new Promise(r => setTimeout(r, 15000));
    }
    
    // 截图
    await page.screenshot({ 
      path: `/d/codes/cycling_new/server/scripts/screenshots/${encodeURIComponent(url.replace(/[^a-zA-Z0-9]/g, '_'))}.png`,
      fullPage: true 
    });
    
    // 获取HTML内容
    const html = await page.content();
    
    // 获取文本内容用于调试
    const text = await page.evaluate(() => document.body.innerText);
    console.log('页面文本(前1000字):', text.substring(0, 1000));
    
    await browser.close();
    return html;
    
  } catch (err) {
    console.error('浏览器访问出错:', err.message);
    if (browser) await browser.close();
    return null;
  }
}

/**
 * 爬取单个赛段的成绩
 */
async function scrapeStageResult(raceCode, stageNumber) {
  console.log(`🚴 爬取 ${raceCode} Stage ${stageNumber}...`);
  
  const url = `${BASE_URL}/race/${raceCode}/stage-${stageNumber}/result`;
  const html = await fetchPageWithPlaywright(url, { 
    waitForSelector: '.results table',
    waitTime: 8000
  });
  
  if (!html) {
    console.log('❌ 获取页面失败');
    return null;
  }
  
  const $ = cheerio.load(html);
  const results = [];
  
  $('.results table tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 6) return;
    
    const rank = cols.eq(0).text().trim();
    const riderCell = cols.eq(2);
    const riderName = riderCell.find('a').text().trim();
    const teamCell = cols.eq(3);
    const teamName = teamCell.text().trim();
    const timeCell = cols.eq(5);
    const time = timeCell.text().trim();
    
    if (!riderName || !rank || isNaN(parseInt(rank))) return;
    
    results.push({
      rank: parseInt(rank),
      rider_name: riderName,
      team_name: teamName,
      time_gap: time === '' ? 's.t.' : time
    });
  });
  
  console.log(`✅ 爬取到 ${results.length} 条成绩`);
  return results;
}

/**
 * 爬取赛事赛段列表
 */
async function scrapeRaceStages(raceCode) {
  console.log(`🚴 爬取 ${raceCode} 赛段列表...`);
  
  const url = `${BASE_URL}/race/${raceCode}`;
  const html = await fetchPageWithPlaywright(url, { 
    waitForSelector: '.results table',
    waitTime: 8000
  });
  
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const stages = [];
  
  $('.results table tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 4) return;
    
    const stageNum = cols.eq(0).text().trim();
    const dateCell = cols.eq(1);
    const stageName = dateCell.find('a').text().trim();
    const dateStr = dateCell.text().replace(stageName, '').trim();
    
    if (!stageNum || !stageName) return;
    
    stages.push({
      stage_number: parseInt(stageNum) || (i + 1),
      stage_name: stageName,
      date_str: dateStr,
      pcs_url: `${BASE_URL}/race/${raceCode}/stage-${stageNum}`
    });
  });
  
  console.log(`✅ 爬取到 ${stages.length} 个赛段`);
  return stages;
}

/**
 * 测试主函数
 */
async function main() {
  const raceCode = process.argv[2] || 'giro-ditalia-2026';
  
  try {
    const results = await scrapeStageResult(raceCode, 5);
    if (results && results.length > 0) {
      console.log('\n📊 Stage 5 成绩:');
      console.table(results);
    } else {
      console.log('未获取到成绩');
    }
  } catch (err) {
    console.error('失败:', err);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchPageWithPlaywright, scrapeStageResult, scrapeRaceStages };
