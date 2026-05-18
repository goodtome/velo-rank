const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db-pool');
const { sleep } = require('./scrape-pcs');

const BASE_URL = 'https://www.procyclingstats.com';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.google.com/',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
  'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not=A?Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-full-version-list': '"Chromium";v="126.0.0.0", "Google Chrome";v="126.0.0.0", "Not=A?Brand";v="99.0.0.0"'
};

/**
 * 生成UUID
 */
function generateId() {
  return uuidv4();
}

/**
 * 从PCS页面提取比赛名称
 */
function extractRaceName($) {
  const title = $('h1').first().text().trim();
  return title || 'Unknown Race';
}

/**
 * 从日期字符串解析为日期对象
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * 根据赛事名称推断分类
 */
function inferCategory(raceName) {
  const name = raceName.toLowerCase();
  if (name.includes('tour de france') || name.includes('giro') || name.includes('vuelta')) {
    return 'GRAND_TOUR';
  }
  if (name.includes('world championships') || name.includes('olympic')) {
    return 'WORLD_CHAMPIONSHIPS';
  }
  if (name.includes('tour') || name.includes('paris-nice') || name.includes('tirreno')) {
    return 'UCI_WORLD_TOUR';
  }
  return 'UCI_WORLD_TOUR'; // 默认
}

/**
 * 保存赛事到数据库
 */
async function saveRace(raceData) {
  const id = generateId();
  const sql = `
    INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, 
                       season, start_date, end_date, total_stages, total_distance, logo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      race_name = VALUES(race_name),
      total_stages = VALUES(total_stages),
      updated_at = CURRENT_TIMESTAMP
  `;
  
  await pool.query(sql, [
    id,
    raceData.race_name,
    raceData.race_name_en || raceData.race_name,
    raceData.race_code,
    raceData.category,
    raceData.gender || 'MEN',
    raceData.season,
    raceData.start_date || null,
    raceData.end_date || null,
    raceData.total_stages || null,
    raceData.total_distance || null,
    raceData.logo_url || null
  ]);
  
  return id;
}

/**
 * 保存赛段到数据库
 */
async function saveStage(raceId, stageData) {
  const id = generateId();
  const stageCode = `${stageData.race_code}-stage-${String(stageData.stage_number).padStart(3, '0')}`;
  
  const sql = `
    INSERT INTO stages (id, race_id, stage_number, stage_name, stage_type, 
                        date, distance_km, elevation_m, stage_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      stage_name = VALUES(stage_name),
      distance_km = VALUES(distance_km),
      updated_at = CURRENT_TIMESTAMP
  `;
  
  await pool.query(sql, [
    id,
    raceId,
    stageData.stage_number,
    stageData.stage_name,
    stageData.stage_type || null,
    stageData.date || null,
    stageData.distance_km || null,
    stageData.elevation_m || null,
    stageCode
  ]);
  
  return id;
}

/**
 * 保存或获取车手ID
 */
async function getOrCreateRider(riderName, nationality = null) {
  // 先查找是否已存在
  const [rows] = await pool.query(
    'SELECT id FROM riders WHERE rider_name = ? LIMIT 1',
    [riderName]
  );
  
  if (rows.length > 0) {
    return rows[0].id;
  }
  
  // 创建新车手
  const id = generateId();
  await pool.query(
    'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
    [id, riderName, nationality || 'UNK']
  );
  
  return id;
}

/**
 * 保存或获取车队ID
 */
async function getOrCreateTeam(teamName, uciCode = null) {
  if (!teamName) return null;
  
  // 先查找
  const [rows] = await pool.query(
    'SELECT id FROM teams WHERE team_name = ? OR uci_code = ? LIMIT 1',
    [teamName, uciCode]
  );
  
  if (rows.length > 0) {
    return rows[0].id;
  }
  
  // 创建新车队
  const id = generateId();
  await pool.query(
    'INSERT INTO teams (id, team_name, uci_code) VALUES (?, ?, ?)',
    [id, teamName, uciCode]
  );
  
  return id;
}

/**
 * 保存赛段成绩
 */
async function saveStageResults(stageId, results) {
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const riderId = await getOrCreateRider(result.rider_name, result.nationality);
    const teamId = await getOrCreateTeam(result.team_name, result.team_code);
    
    if (!riderId || !teamId) continue;
    
    const id = generateId();
    const sql = `
      INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, 
                                 nationality, time_gap, is_same_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        time_gap = VALUES(time_gap),
        is_same_time = VALUES(is_same_time)
    `;
    
    await pool.query(sql, [
      id,
      stageId,
      result.rank || (i + 1),
      riderId,
      teamId,
      result.nationality || 'UNK',
      result.time_gap || '',
      result.time_gap === 's.t.' || result.time_gap === '' ? 1 : 0
    ]);
  }
}

/**
 * 保存领骑衫信息
 */
async function saveJerseys(stageId, jerseys) {
  const jerseyTypeMap = {
    'rosa': 'rosa',
    'maglia rosa': 'rosa',
    'ciclamino': 'ciclamino',
    'maglia ciclamino': 'ciclamino',
    'azzurra': 'azzurra',
    'maglia azzurra': 'azzurra',
    'bianca': 'bianca',
    'maglia bianca': 'bianca',
    'green': 'green',
    'yellow': 'yellow',
    'polka dot': 'polka_dot',
    'white': 'white'
  };
  
  for (const jersey of jerseys) {
    const type = jerseyTypeMap[jersey.type.toLowerCase()] || jersey.type.toLowerCase();
    const riderId = await getOrCreateRider(jersey.rider_name, jersey.nationality);
    const teamId = await getOrCreateTeam(jersey.team_name, jersey.team_code);
    
    if (!riderId || !teamId) continue;
    
    const id = generateId();
    const sql = `
      INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id, time_gap, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rider_id = VALUES(rider_id),
        team_id = VALUES(team_id),
        time_gap = VALUES(time_gap),
        points = VALUES(points)
    `;
    
    await pool.query(sql, [
      id,
      stageId,
      type,
      riderId,
      teamId,
      jersey.time_gap || null,
      jersey.points || null
    ]);
  }
}

/**
 * 主同步函数：爬取指定赛事数据并入库
 */
async function syncRace(raceCode) {
  console.log(`\n🚴 开始同步 ${raceCode}...\n`);
  
  try {
    // 1. 爬取赛段列表
    console.log('📋 步骤1: 爬取赛段列表...');
    const stages = await scrapeRaceStages(raceCode);
    if (stages.length === 0) {
      console.log('⚠️ 未找到赛段信息');
      return { success: false, message: '未找到赛段信息' };
    }
    
    // 2. 保存赛事信息
    console.log('💾 步骤2: 保存赛事信息...');
    const raceData = {
      race_name: raceCode.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      race_name_en: raceCode.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      race_code: raceCode,
      category: inferCategory(raceCode),
      gender: 'MEN',
      season: parseInt(raceCode.match(/(\d{4})$/)[1]),
      total_stages: stages.length
    };
    
    const raceId = await saveRace(raceData);
    console.log(`✅ 赛事已保存: ${raceId}`);
    
    // 3. 保存赛段信息
    console.log('💾 步骤3: 保存赛段信息...');
    const stageIds = [];
    for (const stage of stages) {
      const stageData = {
        ...stage,
        race_code: raceCode
      };
      const stageId = await saveStage(raceId, stageData);
      stageIds.push({ number: stage.stage_number, id: stageId });
      console.log(`  ✅ Stage ${stage.stage_number}: ${stage.stage_name}`);
    }
    
    // 4. 爬取并保存每个赛段的成绩
    console.log('\n📊 步骤4: 爬取赛段成绩...');
    for (const { number: stageNum, id: stageId } of stageIds) {
      console.log(`\n--- Stage ${stageNum} ---`);
      
      const results = await scrapeStageResult(raceCode, stageNum);
      if (results && results.length > 0) {
        await saveStageResults(stageId, results);
        console.log(`  ✅ 保存了 ${results.length} 条成绩`);
      }
      
      // 间隔30秒
      if (stageNum < stages.length) {
        await sleep(30000);
      }
    }
    
    // 5. 爬取领骑衫
    console.log('\n🎨 步骤5: 爬取领骑衫信息...');
    const jerseys = await scrapeJerseys(raceCode);
    if (jerseys && jerseys.length > 0) {
      // 保存到最新赛段的领骑衫
      const latestStageId = stageIds[stageIds.length - 1].id;
      await saveJerseys(latestStageId, jerseys);
      console.log(`✅ 保存了 ${jerseys.length} 个领骑衫信息`);
    }
    
    console.log('\n🎉 同步完成！');
    return { 
      success: true, 
      message: '同步完成',
      data: { race_id: raceId, stages_synced: stages.length }
    };
    
  } catch (err) {
    console.error('同步失败:', err);
    return { success: false, message: err.message };
  }
}

// 直接运行
if (require.main === module) {
  const raceCode = process.argv[2];
  if (!raceCode) {
    console.log('用法: node sync-pcs.js <raceCode>');
    console.log('示例: node sync-pcs.js giro-ditalia-2026');
    process.exit(1);
  }
  
  syncRace(raceCode).catch(console.error);
}

module.exports = {
  syncRace,
  saveRace,
  saveStage,
  getOrCreateRider,
  getOrCreateTeam,
  saveStageResults,
  saveJerseys,
  inferCategory
};
