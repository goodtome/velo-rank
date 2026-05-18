const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.procyclingstats.com';

/**
 * 使用cloudscraper获取页面内容
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    console.log(`请求: ${url}`);
    cloudscraper.get(url, (err, response, body) => {
      if (err) {
        console.error('请求失败:', err.message);
        resolve(null);
        return;
      }
      console.log(`响应状态: ${response.statusCode}`);
      resolve(body);
    });
  });
}

/**
 * 爬取赛段列表
 */
async function scrapeRaceStages(raceCode) {
  console.log(`\n🚴 爬取 ${raceCode} 赛段列表...`);
  
  const url = `${BASE_URL}/race/${raceCode}`;
  const html = await fetchPage(url);
  
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
  const html = await fetchPage(url);
  
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
  console.log('🧪 开始测试 cloudscraper 绕过 Cloudflare\n');
  console.log('='.repeat(60));
  
  try {
    // 测试1: 赛段列表
    const stages = await scrapeRaceStages('giro-ditalia-2026');
    if (stages.length > 0) {
      console.log('\n📋 赛段列表:');
      stages.slice(0, 5).forEach(s => {
        console.log(`  Stage ${s.stage_number}: ${s.stage_name} (${s.date_str})`);
      });
    }
    
    // 测试2: Stage 5成绩
    const results = await scrapeStageResult('giro-ditalia-2026', 5);
    if (results && results.length > 0) {
      console.log('\n📊 Stage 5 成绩:');
      results.slice(0, 10).forEach(r => {
        console.log(`  ${r.rank}. ${r.rider_name} (${r.team_name}) - ${r.time_gap}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 测试完成！');
    
  } catch (err) {
    console.error('失败:', err);
  }
}

main();
