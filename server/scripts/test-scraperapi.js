/**
 * 使用ScraperAPI绕过Cloudflare
 * 需要SCRAPERAPI_KEY环境变量
 */
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const BASE_URL = 'https://www.procyclingstats.com';

// ScraperAPI配置
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY || '';
const SCRAPERAPI_URL = 'http://api.scraperapi.com';

/**
 * 使用ScraperAPI获取页面
 */
async function fetchPageWithScraperAPI(url) {
  if (!SCRAPERAPI_KEY) {
    console.error('❌ 请设置SCRAPERAPI_KEY环境变量');
    console.log('获取免费API密钥: https://www.scraperapi.com/signup');
    return null;
  }
  
  try {
    const params = {
      api_key: SCRAPERAPI_KEY,
      url: url,
      render: 'true', // 渲染JavaScript
      country_code: 'us',
      device_type: 'desktop',
      premium: 'true',  // 尝试使用premium参数
      keep_headers: 'true'
    };
    
    console.log(`🔍 ScraperAPI请求: ${url}`);
    const response = await axios.get(SCRAPERAPI_URL, { 
      params, 
      timeout: 60000  // 增加超时到60秒
    });
    console.log(`✅ 响应状态: ${response.status}`);
    return response.data;
    
  } catch (err) {
    console.error('ScraperAPI请求失败:', err.message);
    if (err.code === 'ECONNABORTED') {
      console.error('请求超时，PCS网站可能响应较慢');
    }
    if (err.response) {
      console.error('响应状态:', err.response.status);
      console.error('响应数据:', typeof err.response.data === 'string' ? err.response.data.substring(0, 500) : 'N/A');
    }
    return null;
  }
}

/**
 * 爬取赛段列表
 */
async function scrapeRaceStages(raceCode) {
  console.log(`\n🚴 爬取 ${raceCode} 赛段列表...`);
  
  const url = `${BASE_URL}/race/${raceCode}`;
  const html = await fetchPageWithScraperAPI(url);
  
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
 * 爬取单赛段成绩
 */
async function scrapeStageResult(raceCode, stageNumber) {
  console.log(`\n🚴 爬取 ${raceCode} Stage ${stageNumber}...`);
  
  const url = `${BASE_URL}/race/${raceCode}/stage-${stageNumber}/result`;
  const html = await fetchPageWithScraperAPI(url);
  
  if (!html) return null;
  
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
 * 主函数
 */
async function main() {
  console.log('🧪 开始测试 ScraperAPI\n');
  console.log('='.repeat(60));
  
  if (!SCRAPERAPI_KEY) {
    console.log('⚠️ 未设置SCRAPERAPI_KEY，请先获取免费API密钥');
    console.log('注册地址: https://www.scraperapi.com/signup');
    console.log('免费额度: 1000次请求/月');
    console.log('\n设置方式:');
    console.log('  1. 在server/config/.env中添加: SCRAPERAPI_KEY=your_key');
    console.log('  2. 或设置环境变量: set SCRAPERAPI_KEY=your_key');
    process.exit(0);
  }
  
  try {
    // 测试1: TdF 2025 赛段列表
    const stages = await scrapeRaceStages('tour-de-france-2025');
    if (stages.length > 0) {
      console.log('\n📋 TdF 2025 赛段列表:');
      stages.slice(0, 5).forEach(s => {
        console.log(`  Stage ${s.stage_number}: ${s.stage_name} (${s.date_str})`);
      });
      if (stages.length > 5) console.log(`  ... 共 ${stages.length} 个赛段`);
    }
    
    // 测试2: TdF 2025 Stage 1成绩
    const results = await scrapeStageResult('tour-de-france-2025', 1);
    if (results && results.length > 0) {
      console.log('\n📊 TdF 2025 Stage 1 成绩:');
      results.slice(0, 10).forEach(r => {
        console.log(`  ${r.rank}. ${r.rider_name} (${r.team_name}) - ${r.time_gap}`);
      });
      if (results.length > 10) console.log(`  ... 共 ${results.length} 条`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 测试完成！');
    
  } catch (err) {
    console.error('失败:', err);
  }
}

main();
