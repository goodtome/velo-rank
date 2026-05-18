/**
 * 手动数据收集工具 - 解析从 PCS 复制的赛段成绩数据
 * 
 * 使用方法：
 * 1. 在浏览器访问 https://www.procyclingstats.com/race/giro-ditalia-2026/stage-5/result
 * 2. 手动复制成绩表格数据
 * 3. 粘贴到下方的 STAGE_RESULTS_DATA 常量中
 * 4. 运行: node manual-data-import.js
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

// ==================== 数据收集模板 ====================

// 赛段成绩数据（从 PCS 手动复制）
// 格式：排名 | 车手姓名 | 车队 | 时间差
const STAGE_RESULTS_DATA = [
  // Stage 5 示例格式 - 请替换为实际数据
  // { rank: 1, rider_name: 'Tadej Pogačar', team_name: 'UAE Team Emirates', time_gap: '4h 35\' 12"' },
  // { rank: 2, rider_name: 'Richard Carapaz', team_name: 'EF Education-EasyPost', time_gap: '+ 0"' },
];

// 赛段信息
const STAGE_INFO = {
  race_code: 'giro-ditalia-2026',
  stage_number: 5,
  stage_name: 'Praia a Mare → Potenza',
  date: '2026-05-13',
  distance_km: 203,
  stage_type: 'Mountain', // Flat / Hilly / Mountain / ITT / TTT
};

// 领骑衫信息（可选）
const JERSEYS_DATA = [
  // { jersey_type: 'pink', rider_name: 'Tadej Pogačar', team_name: 'UAE Team Emirates', time_gap: '20h 15\' 30"' },
  // { jersey_type: 'purple', rider_name: 'Jonathan Milan', team_name: 'Lidl-Trek', time_gap: '85 pts' },
  // { jersey_type: 'blue', rider_name: 'Tadej Pogačar', team_name: 'UAE Team Emirates', time_gap: '0"' },
  // { jersey_type: 'white', rider_name: 'Antonio Tiberi', team_name: 'Bahrain Victorious', time_gap: '+ 45"' },
];

// ==================== 数据库操作 ====================

async function getOrCreateRace(conn, raceCode) {
  const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', [raceCode]);
  if (races.length > 0) {
    return races[0];
  }
  
  const raceId = uuidv4();
  await conn.query(`
    INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    raceId,
    'Giro d\'Italia',
    'Giro d\'Italia',
    raceCode,
    'GRAND_TOUR',
    'MEN',
    2026
  ]);
  
  return { id: raceId, race_name: 'Giro d\'Italia' };
}

async function getOrCreateStage(conn, raceId, stageNumber, stageInfo) {
  const [stages] = await conn.query('SELECT * FROM stages WHERE race_id = ? AND stage_number = ?', [raceId, stageNumber]);
  if (stages.length > 0) {
    return stages[0];
  }
  
  const stageId = uuidv4();
  const stageCode = `giro-2026-s${stageNumber}`;
  
  await conn.query(`
    INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    stageId,
    raceId,
    stageNumber,
    stageInfo.stage_name,
    stageInfo.date,
    stageInfo.distance_km,
    stageInfo.stage_type,
    stageCode
  ]);
  
  return { id: stageId };
}

async function getOrCreateRider(conn, riderName) {
  const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [riderName]);
  if (riders.length > 0) {
    return riders[0];
  }
  
  const riderId = uuidv4();
  await conn.query(`
    INSERT INTO riders (id, rider_name, nationality)
    VALUES (?, ?, ?)
  `, [riderId, riderName, 'UNK']);
  
  return { id: riderId };
}

async function getOrCreateTeam(conn, teamName) {
  const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [teamName]);
  if (teams.length > 0) {
    return teams[0];
  }
  
  const teamId = uuidv4();
  await conn.query(`
    INSERT INTO teams (id, team_name)
    VALUES (?, ?)
  `, [teamId, teamName]);
  
  return { id: teamId };
}

async function importStageResults(conn, stageId, results) {
  let imported = 0;
  
  for (const result of results) {
    try {
      const rider = await getOrCreateRider(conn, result.rider_name);
      const team = await getOrCreateTeam(conn, result.team_name);
      
      await conn.query(`
        INSERT INTO stage_results (id, stage_id, rank, rider_id, team_id, nationality, time_gap)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          rider_id = VALUES(rider_id),
          team_id = VALUES(team_id),
          time_gap = VALUES(time_gap)
      `, [
        uuidv4(),
        stageId,
        result.rank,
        rider.id,
        team.id,
        'UNK',
        result.time_gap
      ]);
      
      imported++;
      console.log(`  ✅ ${result.rank}. ${result.rider_name} (${result.team_name}) - ${result.time_gap}`);
    } catch (err) {
      console.error(`  ❌ 导入失败 ${result.rider_name}:`, err.message);
    }
  }
  
  return imported;
}

async function importJerseys(conn, stageId, jerseys) {
  let imported = 0;
  
  for (const jersey of jerseys) {
    try {
      const rider = await getOrCreateRider(conn, jersey.rider_name);
      const team = await getOrCreateTeam(conn, jersey.team_name);
      
      await conn.query(`
        INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id, time_gap)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          rider_id = VALUES(rider_id),
          team_id = VALUES(team_id),
          time_gap = VALUES(time_gap)
      `, [
        uuidv4(),
        stageId,
        jersey.jersey_type,
        rider.id,
        team.id,
        jersey.time_gap
      ]);
      
      imported++;
      console.log(`  ✅ ${jersey.jersey_type}: ${jersey.rider_name} (${jersey.team_name})`);
    } catch (err) {
      console.error(`  ❌ 导入领骑衫失败 ${jersey.rider_name}:`, err.message);
    }
  }
  
  return imported;
}

// ==================== 主函数 ====================

async function main() {
  console.log('🚴 手动数据导入工具\n');
  console.log('='.repeat(60));
  
  if (STAGE_RESULTS_DATA.length === 0) {
    console.log('⚠️  请先在 STAGE_RESULTS_DATA 中填入从 PCS 复制的数据');
    console.log('   参考格式: { rank: 1, rider_name: "Tadej Pogačar", team_name: "UAE Team Emirates", time_gap: "4h 35\' 12"" }');
    return;
  }
  
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('✅ 数据库连接成功\n');
    
    // 1. 获取或创建赛事
    console.log('📋 处理赛事信息...');
    const race = await getOrCreateRace(conn, STAGE_INFO.race_code);
    console.log(`  ✅ 赛事: ${race.race_name} (${race.id})\n`);
    
    // 2. 获取或创建赛段
    console.log('📋 处理赛段信息...');
    const stage = await getOrCreateStage(conn, race.id, STAGE_INFO.stage_number, STAGE_INFO);
    console.log(`  ✅ 赛段 ${STAGE_INFO.stage_number}: ${STAGE_INFO.stage_name} (${stage.id})\n`);
    
    // 3. 导入赛段成绩
    console.log('📊 导入赛段成绩...');
    const resultsImported = await importStageResults(conn, stage.id, STAGE_RESULTS_DATA);
    console.log(`  ✅ 共导入 ${resultsImported} 条成绩\n`);
    
    // 4. 导入领骑衫（如果有）
    if (JERSEYS_DATA.length > 0) {
      console.log('🏆 导入领骑衫信息...');
      const jerseysImported = await importJerseys(conn, stage.id, JERSEYS_DATA);
      console.log(`  ✅ 共导入 ${jerseysImported} 个领骑衫\n`);
    }
    
    console.log('='.repeat(60));
    console.log('🎉 数据导入完成！');
    
    // 验证
    const [count] = await conn.query('SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?', [stage.id]);
    console.log(`📊 数据库中该赛段共有 ${count[0].count} 条成绩记录`);
    
  } catch (err) {
    console.error('❌ 导入失败:', err);
  } finally {
    if (conn) await conn.end();
  }
}

main();
