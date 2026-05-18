const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BASE_URL = 'https://www.procyclingstats.com';
const REQUEST_INTERVAL = 30000; // 30秒间隔

// 请求头模拟浏览器 - 增强反反爬
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.google.com/',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取页面内容 - 使用curl绕过Cloudflare
 */
async function fetchPage(url) {
  try {
    // 使用curl + User-Agent绕过Cloudflare保护
    const curlCommand = `curl -s -L -A "${headers['User-Agent']}" -H "Accept: ${headers['Accept']}" -H "Accept-Language: ${headers['Accept-Language']}" "${url}"`;
    
    const { stdout, stderr } = await execPromise(curlCommand, { maxBuffer: 10 * 1024 * 1024 });
    
    if (stderr) {
      console.warn(`curl警告 ${url}:`, stderr);
    }
    
    return stdout;
  } catch (err) {
    console.error(`请求失败 ${url}:`, err.message);
    return null;
  }
}

/**
 * 从PCS赛事列表页爬取赛事信息
 * URL: https://www.procyclingstats.com/races.php?year=2026
 */
async function scrapeRaces(year = 2026) {
  console.log(`开始爬取 ${year} 年赛事列表...`);
  const html = await fetchPage(`${BASE_URL}/races.php?year=${year}`);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const races = [];
  
  // PCS赛事列表在 .results table 中
  $('.results table tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 5) return;
    
    const nameCell = cols.eq(1);
    const link = nameCell.find('a').first();
    const href = link.attr('href');
    const name = link.text().trim();
    
    if (!href || !name) return;
    
    // 从href提取赛事代码，如 /race/giro-ditalia/2026
    const match = href.match(/\/race\/([^/]+)\/(\d{4})/);
    if (!match) return;
    
    const raceCode = `${match[1]}-${match[2]}`;
    
    races.push({
      race_name: name,
      race_name_en: name,
      race_code: raceCode,
      category: 'UCI_WORLD_TOUR', // 需要后续分类
      gender: 'MEN',
      season: parseInt(year),
      pcs_url: `${BASE_URL}${href}`
    });
  });
  
  console.log(`爬取到 ${races.length} 个赛事`);
  return races;
}

/**
 * 爬取单个赛事的赛段列表
 * URL: https://www.procyclingstats.com/race/giro-ditalia/2026
 */
async function scrapeRaceStages(raceCode) {
  console.log(`爬取赛事 ${raceCode} 的赛段列表...`);
  
  // raceCode格式: giro-ditalia-2026
  const url = `${BASE_URL}/race/${raceCode}`;
  const html = await fetchPage(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const stages = [];
  
  // 赛段信息在 .results table 中
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
  
  console.log(`爬取到 ${stages.length} 个赛段`);
  return stages;
}

/**
 * 爬取单赛段成绩
 * URL: https://www.procyclingstats.com/race/giro-ditalia/2026/stage-5/result
 */
async function scrapeStageResult(raceCode, stageNumber) {
  console.log(`爬取 ${raceCode} Stage ${stageNumber} 成绩...`);
  
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
    
    if (!riderName || !rank) return;
    
    results.push({
      rank: parseInt(rank) || (i + 1),
      rider_name: riderName,
      team_name: teamName,
      time_gap: time === '' ? 's.t.' : time
    });
  });
  
  console.log(`爬取到 ${results.length} 条成绩`);
  return results;
}

/**
 * 爬取领骑衫信息
 * URL: https://www.procyclingstats.com/race/giro-ditalia/2026/leaderboard
 */
async function scrapeJerseys(raceCode) {
  console.log(`爬取 ${raceCode} 领骑衫信息...`);
  
  const url = `${BASE_URL}/race/${raceCode}/leaderboard`;
  const html = await fetchPage(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const jerseys = [];
  
  // 领骑衫信息通常在页面中的多个表格中
  // 这里需要根据实际页面结构调整
  $('.results table tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 3) return;
    
    const riderName = cols.eq(0).text().trim();
    const teamName = cols.eq(1).text().trim();
    const timeGap = cols.eq(2).text().trim();
    
    if (!riderName) return;
    
    jerseys.push({
      rider_name: riderName,
      team_name: teamName,
      time_gap: timeGap
    });
  });
  
  console.log(`爬取到 ${jerseys.length} 个领骑衫信息`);
  return jerseys;
}

/**
 * 主函数：爬取指定赛事的所有数据
 */
async function main() {
  const raceCode = process.argv[2] || 'giro-ditalia-2026';
  
  console.log(`\n🚴 开始爬取 ${raceCode} 数据\n`);
  
  // 1. 爬取赛段列表
  const stages = await scrapeRaceStages(raceCode);
  if (stages.length === 0) {
    console.log('未找到赛段信息，请检查raceCode是否正确');
    return;
  }
  
  // 保存赛段信息
  const fs = require('fs');
  fs.writeFileSync(`/d/codes/cycling_new/server/scripts/data/${raceCode}-stages.json`, 
    JSON.stringify(stages, null, 2));
  console.log(`✅ 赛段信息已保存\n`);
  
  // 2. 爬取每个赛段的成绩
  for (const stage of stages) {
    const stageNum = stage.stage_number;
    const results = await scrapeStageResult(raceCode, stageNum);
    if (results) {
      fs.writeFileSync(`/d/codes/cycling_new/server/scripts/data/${raceCode}-stage${stageNum}-result.json`,
        JSON.stringify(results, null, 2));
      console.log(`✅ Stage ${stageNum} 成绩已保存\n`);
    }
    
    // 间隔30秒
    if (i < stages.length - 1) {
      console.log(`等待 ${REQUEST_INTERVAL/1000} 秒后继续...\n`);
      await sleep(REQUEST_INTERVAL);
    }
  }
  
  // 3. 爬取领骑衫
  const jerseys = await scrapeJerseys(raceCode);
  if (jerseys.length > 0) {
    fs.writeFileSync(`/d/codes/cycling_new/server/scripts/data/${raceCode}-jerseys.json`,
      JSON.stringify(jerseys, null, 2));
    console.log(`✅ 领骑衫信息已保存\n`);
  }
  
  console.log('\n🎉 爬取完成！');
}

// 确保数据目录存在
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 直接运行main函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  fetchPage,
  scrapeRaces,
  scrapeRaceStages,
  scrapeStageResult,
  scrapeJerseys,
  sleep
};
