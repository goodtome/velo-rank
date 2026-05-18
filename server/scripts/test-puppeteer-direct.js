const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.procyclingstats.com';

/**
 * 使用puppeteer获取页面内容
 */
async function fetchPage(url, options = {}) {
  const { 
    headless = true, 
    waitForSelector = null, 
    timeout = 60000,
    waitTime = 5000 
  } = options;
  
  let browser = null;
  try {
    browser = await puppeteer.launch({ 
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const page = await browser.newPage();
    
    // 设置真实浏览器特征
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    
    // 拦截不必要的请求
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    console.log(`正在加载: ${url}`);
    
    // 先访问主页获取cookie
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // 然后导航到目标页面
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    
    if (!response || !response.ok()) {
      console.log(`⚠️ 页面加载状态: ${response ? response.status() : 'no response'}`);
    }
    
    // 等待额外时间
    console.log('等待页面渲染...');
    await new Promise(r => setTimeout(r, waitTime));
    
    // 检查标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
      console.log('⚠️ 仍被Cloudflare拦截，等待更长时间...');
      await new Promise(r => setTimeout(r, 15000));
      
      // 再次检查
      const newTitle = await page.title();
      console.log(`等待后标题: ${newTitle}`);
    }
    
    // 截图
    const filename = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    await page.screenshot({ 
      path: `/d/codes/cycling_new/server/scripts/screenshots/${filename}.png`,
      fullPage: true 
    });
    console.log(`截图已保存`);
    
    // 获取HTML内容
    const html = await page.content();
    
    // 获取文本内容
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
  console.log(`\n🚴 爬取 ${raceCode} Stage ${stageNumber}...`);
  
  const url = `${BASE_URL}/race/${raceCode}/stage-${stageNumber}/result`;
  const html = await fetchPage(url, { 
    waitForSelector: '.results table',
    waitTime: 10000
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
 * 测试主函数
 */
async function main() {
  console.log('🧪 开始测试 Puppeteer\n');
  console.log('='.repeat(60));
  
  try {
    const results = await scrapeStageResult('giro-ditalia-2026', 5);
    if (results && results.length > 0) {
      console.log('\n📊 Stage 5 成绩:');
      console.table(results.slice(0, 10));
    } else {
      console.log('未获取到成绩');
    }
  } catch (err) {
    console.error('失败:', err);
  }
}

main();
