/**
 * 导入环意2026第10赛段数据（ITT Viareggio - Massa）
 * 从stage10_results.json读取数据并导入数据库
 * 基于实际的表结构（riders/teams/stage_results）
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');  // 用于生成UUID

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

const STAGE_ID = 'ab4d70b3-b05a-4229-85d0-5f64e0ddf7a1';
const STAGE_CODE = 'giro-2026-s10';
const STAGE_NUMBER = 10;
const RACE_CODE = 'giro-2026';

// 读取JSON数据
function loadData() {
  const filePath = path.join(__dirname, 'stage10_results.json');
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

// 导入数据到数据库
async function importResults(results) {
  const conn = await mysql.createConnection(DB_CONFIG);
  
  try {
    // 1. 获取race_id
    const [races] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE_CODE]);
    if (races.length === 0) {
      throw new Error(`Race not found: ${RACE_CODE}`);
    }
    const raceId = races[0].id;
    console.log(`Race ID: ${raceId}`);
    
    // 2. 删除existing results for this stage
    const [deleteResult] = await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [STAGE_ID]);
    console.log(`已删除第10赛段原有数据: ${deleteResult.affectedRows} 条`);
    
    // 3. 插入新数据
    let inserted = 0;
    let skipped = 0;
    
    for (const result of results) {
      try {
        // 查找或创建车手
        let riderId;
        const [riders] = await conn.query(
          'SELECT id, nationality FROM riders WHERE rider_name = ? OR rider_name_zh = ? LIMIT 1',
          [result.rider_name, result.rider_name]
        );
        
        if (riders.length > 0) {
          riderId = riders[0].id;
          var riderNationality = riders[0].nationality || 'ITA';
        } else {
          // 创建新车手（需要生成UUID）
          riderId = crypto.randomUUID();
          riderNationality = 'ITA';  // 默认意大利
          const [insertResult] = await conn.query(
            'INSERT INTO riders (id, rider_name, country) VALUES (?, ?, ?)',
            [riderId, result.rider_name, riderNationality]
          );
          console.log(`创建新车手: ${result.rider_name}`);
        }
        
        // 查找或创建车队
        let teamId;
        const [teams] = await conn.query(
          'SELECT id FROM teams WHERE team_name = ? OR team_name_en = ? LIMIT 1',
          [result.team_name, result.team_name]
        );
        
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          // 创建新车队（需要生成UUID）
          teamId = crypto.randomUUID();
          const [insertResult] = await conn.query(
            'INSERT INTO teams (id, team_name, team_name_en) VALUES (?, ?, ?)',
            [teamId, result.team_name, result.team_name]
          );
          console.log(`创建新车队: ${result.team_name}`);
        }
        
        // 插入成绩（基于实际的stage_results表结构）
        // 表结构: id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, sprint_points, mountain_points, youth_eligible, jersey_earned, created_at
        const resultId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, sprint_points) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [resultId, STAGE_ID, result.rank, riderId, teamId, riderNationality, result.time, result.pnt_points || 0]
        );
        
        inserted++;
        
        if (inserted % 10 === 0) {
          console.log(`已导入 ${inserted} 条成绩数据...`);
        }
      } catch (e) {
        console.error(`导入车手 ${result.rider_name} 失败:`, e.message);
        skipped++;
      }
    }
    
    console.log(`\n导入完成:`);
    console.log(`  - 成功: ${inserted} 条`);
    console.log(`  - 跳过: ${skipped} 条`);
    
  } finally {
    await conn.end();
  }
}

// 主函数
async function main() {
  try {
    console.log('=== 开始导入环意2026第10赛段数据 ===');
    console.log(`赛段: ${STAGE_CODE} (${STAGE_NUMBER})`);
    console.log(`赛段ID: ${STAGE_ID}\n`);
    
    // 1. 读取JSON数据
    const results = loadData();
    console.log(`读取到 ${results.length} 条成绩数据\n`);
    
    if (results.length === 0) {
      console.error('错误: JSON文件为空或未正确解析');
      process.exit(1);
    }
    
    // 2. 导入数据库
    await importResults(results);
    
    console.log('\n=== 导入完成 ===');
    console.log('可以使用以下SQL验证:');
    console.log(`  SELECT COUNT(*) as count FROM stage_results WHERE stage_id = '${STAGE_ID}';`);
    console.log(`  SELECT * FROM stage_results WHERE stage_id = '${STAGE_ID}' ORDER BY rank_pos LIMIT 10;`);
    
  } catch (error) {
    console.error('导入失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
