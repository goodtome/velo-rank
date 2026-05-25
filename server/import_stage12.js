const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 第12赛段信息
const STAGE_ID = 'f67aba14-54b6-4ca9-9979-75eebdea1094';
const STAGE_CODE = 'giro-2026-s12';
const JSON_FILE = 'D:/codes/velo-rank/server/stage12_full.json';

async function importStage12() {
  let conn;
  let inserted = 0;
  let skipped = 0;
  
  try {
    // 1. 读取JSON文件
    console.log('读取数据文件:', JSON_FILE);
    const rawData = fs.readFileSync(JSON_FILE, 'utf8');
    console.log('文件大小:', rawData.length, '字符');
    
    // 解析JSON（可能需要两次解析）
    let results;
    try {
      const firstParse = JSON.parse(rawData);
      if (typeof firstParse === 'string') {
        console.log('检测到双重字符串化，进行第二次解析...');
        results = JSON.parse(firstParse);
      } else {
        results = firstParse;
      }
    } catch (err) {
      throw new Error('JSON解析失败: ' + err.message);
    }
    
    console.log(`共 ${results.length} 条成绩数据`);
    
    // 2. 连接数据库
    console.log('\n连接数据库...');
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 13306,
      user: 'root',
      password: 'mysql123456',
      database: 'jersey_db'
    });
    console.log('数据库连接成功！');
    
    // 3. 清空该赛段的现有数据
    console.log(`\n清空赛段 ${STAGE_CODE} 的现有成绩数据...`);
    const [deleteResult] = await conn.query(
      'DELETE FROM stage_results WHERE stage_id = ?',
      [STAGE_ID]
    );
    console.log(`已删除 ${deleteResult.affectedRows} 条旧数据`);
    
    // 4. 导入新车手/新车队/成绩
    console.log(`\n开始导入 ${results.length} 条成绩数据...`);
    
    for (const result of results) {
      try {
        // 4.1 查找或创建车手
        let riderId;
        const [riders] = await conn.query(
          'SELECT id FROM riders WHERE rider_name = ? OR rider_name_zh = ? LIMIT 1',
          [result.rider, result.rider]
        );
        
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          // 创建新车手
          riderId = crypto.randomUUID();
          await conn.query(
            'INSERT INTO riders (id, rider_name, country) VALUES (?, ?, ?)',
            [riderId, result.rider, 'ITA']
          );
          console.log(`创建新车手: ${result.rider}`);
        }
        
        // 4.2 查找或创建车队
        let teamId;
        const [teams] = await conn.query(
          'SELECT id FROM teams WHERE team_name = ? OR team_name_en = ? LIMIT 1',
          [result.team, result.team]
        );
        
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          // 创建新车队
          teamId = crypto.randomUUID();
          await conn.query(
            'INSERT INTO teams (id, team_name, team_name_en) VALUES (?, ?, ?)',
            [teamId, result.team, result.team]
          );
          console.log(`创建新车队: ${result.team}`);
        }
        
        // 4.3 插入成绩
        const resultId = crypto.randomUUID();
        
        // 处理时间格式：将欧洲格式转换为标准格式
        let timeGap = result.time || '';
        if (timeGap.includes(',')) {
          timeGap = timeGap.replace(',', '.');
        }
        
        await conn.query(
          `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, sprint_points) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [resultId, STAGE_ID, parseInt(result.rank), riderId, teamId, 'ITA', timeGap, 0]
        );
        
        inserted++;
        
        if (inserted % 50 === 0) {
          console.log(`已导入 ${inserted}/${results.length}...`);
        }
        
      } catch (err) {
        console.error(`错误 at rank ${result.rank}:`, err.message);
        skipped++;
      }
    }
    
    console.log(`\n导入完成:`);
    console.log(`  - 成功: ${inserted} 条`);
    console.log(`  - 跳过: ${skipped} 条`);
    
    // 4.4 更新赛段状态（注意：stages表没有status列，跳过）
    console.log(`\n注意: stages表没有status列，已跳过状态更新`);
    console.log(`注意: stages表没有winner_time列，已跳过冠军时间更新`);
    
  } catch (err) {
    console.error('\n导入失败:', err.message);
    console.error(err.stack);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行导入
importStage12().then(() => {
  console.log('\n✅ 第12赛段数据导入完成！');
  process.exit(0);
}).catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
