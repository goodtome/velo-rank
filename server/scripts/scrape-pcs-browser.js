const puppeteer = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

// 启用stealth插件绕过Cloudflare等反爬检测
puppeteer.use(stealthPlugin());

// 获取Chrome路径
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const BASE_URL = 'https://www.procyclingstats.com';

/**
 * 使用浏览器自动化获取页面内容（绕过Cloudflare验证）
 */
async function fetchPageWithBrowser(url, options = {}) {
  const { headless = true, waitForSelector = null, timeout = 60000 } = options;
  
  let browser = null;
  try {
    browser = await puppeteer.launch({ 
      headless,
      executablePath: CHROME_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
    
    const page = await browser.newPage();
    
    // 设置真实浏览器特征
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    
    // 拦截不必要的请求以加速
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    console.log(`正在加载页面: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout 
    });
    
    // 等待额外时间确保动态内容加载
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 检查是否需要验证
    const title = await page.title();
    if (title && title.includes('Just a moment')) {
      console.log('⚠️ 检测到Cloudflare验证页面，等待更长时间...');
      await page.waitForTimeout(10000);
    }
    
    // 等待指定选择器
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout });
        console.log(`✅ 等待选择器成功: ${waitForSelector}`);
      } catch (e) {
        console.warn(`⚠️ 选择器 ${waitForSelector} 未出现`);
      }
    }
    
    const html = await page.content();
    return html;
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 爬取单个赛段的成绩（使用浏览器）
 */
async function scrapeStageResult(raceCode, stageNumber) {
  console.log(`🚴 正在爬取 ${raceCode} Stage ${stageNumber} 成绩...`);
  
  const url = `${BASE_URL}/race/${raceCode}/stage-${stageNumber}/result`;
  const html = await fetchPageWithBrowser(url, { 
    waitForSelector: '.results table' 
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
    
    if (!riderName || !rank) return;
    
    results.push({
      rank: parseInt(rank) || (i + 1),
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
  console.log(`🚴 正在爬取 ${raceCode} 赛段列表...`);
  
  const url = `${BASE_URL}/race/${raceCode}`;
  const html = await fetchPageWithBrowser(url, { 
    waitForSelector: '.results table' 
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
    // 测试Stage 5
    console.log('='.repeat(60));
    const results = await scrapeStageResult(raceCode, 5);
    
    if (results && results.length > 0) {
      console.log('\n📊 Stage 5 成绩预览:');
      console.table(results.slice(0, 10));
    } else {
      console.log('❌ 未获取到成绩数据');
    }
    
    // 测试赛段列表
    console.log('\n' + '='.repeat(60));
    const stages = await scrapeRaceStages(raceCode);
    if (stages.length > 0) {
      console.log('\n📋 赛段列表:');
      console.table(stages);
    } else {
      console.log('❌ 未获取到赛段数据');
    }
    
  } catch (err) {
    console.error('测试失败:', err);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchPageWithBrowser,
  scrapeStageResult,
  scrapeRaceStages
};
