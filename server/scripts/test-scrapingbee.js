/**
 * ScrapingBee 免费 Cloudflare 绕过测试脚本
 * 
 * 使用方法：
 * node test-scrapingbee.js
 */

const { ScrapingBeeClient } = require('scrapingbee');

// API Key
const API_KEY = 'IHJAEVSPET4YJAA8DA89H7YIR6LL0U0MVRX5A43W03CNX43LDSNPP4Z4GBBIZET0L9PK1YLM0T1Q0FEK';

const client = new ScrapingBeeClient(API_KEY);
const BASE_URL = 'https://www.procyclingstats.com';

/**
 * 使用 ScrapingBee 获取页面内容
 */
async function fetchPage(url) {
  try {
    console.log(`\n🔍 请求: ${url}`);
    const response = await client.htmlApi({
      url,
      params: {
        render_js: 'true',       // 渲染 JavaScript（绕过 Cloudflare）
        wait: 3000,               // 等待页面加载
        wait_for: '.results',      // 等待 .results 元素出现
        block_resources: false,   // 不拦截资源
        stealth_proxy: 'true',    // 使用 stealth proxy 绕过检测（75 credits/次）
      }
    });
    
    console.log(`✅ 状态码: ${response.status}`);
    console.log(`📄 内容长度: ${response.data.length}`);
    return response.data;
  } catch (err) {
    console.error(`❌ 请求失败: ${err.message}`);
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', err.response.data?.toString().substring(0, 500));
    }
    return null;
  }
}

/**
 * 爬取赛段列表
 */
async function scrapeRaceStages(raceCode) {
  const url = `${BASE_URL}/race/${raceCode}`;
  const html = await fetchPage(url);
  
  if (!html) return [];
  
  const cheerio = require('cheerio');
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
  const url = `${BASE_URL}/race/${raceCode}/stage-${stageNumber}/result`;
  const html = await fetchPage(url);
  
  if (!html) return null;
  
  const cheerio = require('cheerio');
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
 * 主函数
 */
async function main() {
  const raceCode = 'giro-ditalia-2026';
  
  console.log('🚴 开始测试 ScrapingBee 爬取 PCS 数据\n');
  console.log('='.repeat(60));
  
  // 测试 1: 赛段列表
  const stages = await scrapeRaceStages(raceCode);
  if (stages.length > 0) {
    console.log('\n📋 赛段列表:');
    stages.slice(0, 5).forEach(s => {
      console.log(`  Stage ${s.stage_number}: ${s.stage_name} (${s.date_str})`);
    });
  } else {
    console.log('❌ 未获取到赛段数据');
  }
  
  // 测试 2: Stage 5 成绩
  console.log('\n' + '='.repeat(60));
  const results = await scrapeStageResult(raceCode, 5);
  if (results && results.length > 0) {
    console.log('\n📊 Stage 5 成绩预览:');
    results.slice(0, 10).forEach(r => {
      console.log(`  ${r.rank}. ${r.rider_name} (${r.team_name}) - ${r.time_gap}`);
    });
  } else {
    console.log('❌ 未获取到成绩数据');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 测试完成！');
}

main().catch(console.error);
