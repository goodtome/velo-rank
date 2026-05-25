const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');

// 配置
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

const STAGE_ID = 'ab4d70b3-b05a-4229-85d0-5f64e0ddf7a1'; // Stage 10 ID
const JSON_FILE = 'D:/codes/velo-rank/server/stage10_full.json';

// 时间格式转换：欧洲格式 -> 标准格式
// PCS格式：45.53,87 (分.秒,毫秒) -> 标准格式：45:53.87 或 +1:53.34
function convertTime(timeStr, isWinner) {
  if (!timeStr) return null;
  
  // 替换第一个 . 为 : (分秒分隔符)
  let result = timeStr.replace('.', ':');
  // 替换 , 为 . (欧洲小数点是,)
  result = result.replace(',', '.');
  
  // 如果不是冠军，确保有 + 前缀
  if (!isWinner && !result.startsWith('+')) {
    result = '+' + result;
  }
  
  return result;
}

async function main() {
  let conn;
  try {
    // 1. 读取JSON文件
    console.log('读取数据文件:', JSON_FILE);
    const rawData = fs.readFileSync(JSON_FILE, 'utf8');
    console.log('文件大小:', rawData.length, '字符');
    
    // 解析JSON（可能需要两次解析，因为agent-browser eval可能双重字符串化）
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
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('数据库连接成功');
    
    // 3. 删除第10赛段现有数据（确保准确性）
    console.log('\n删除第10赛段现有数据...');
    const [deleteResult] = await conn.query(
      'DELETE FROM stage_results WHERE stage_id = ?',
      [STAGE_ID]
    );
    console.log(`已删除 ${deleteResult.affectedRows} 条旧数据`);
    
    // 4. 导入新数据
    console.log('\n导入第10赛段成绩数据...');
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const result of results) {
      try {
        const rank = parseInt(result.rank);
        const riderName = result.rider;
        const teamName = result.team;
        const time = convertTime(result.time, rank === 1);
        
        if (!riderName || !teamName) {
          console.log(`  跳过: rank=${rank}, 缺少车手或车队名`);
          skipped++;
          continue;
        }
        
        // 4.1 查找或创建车手
        let riderId;
        const [riders] = await conn.query(
          'SELECT id FROM riders WHERE rider_name = ? OR rider_name_zh = ? LIMIT 1',
          [riderName, riderName]
        );
        
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          // 创建新车手
          riderId = crypto.randomUUID();
          await conn.query(
            'INSERT INTO riders (id, rider_name, country) VALUES (?, ?, ?)',
            [riderId, riderName, 'ITA']
          );
          console.log(`  创建新车手: ${riderName}`);
        }
        
        // 4.2 查找或创建车队
        let teamId;
        const [teams] = await conn.query(
          'SELECT id FROM teams WHERE team_name = ? OR team_name_en = ? LIMIT 1',
          [teamName, teamName]
        );
        
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          // 创建新车队
          teamId = crypto.randomUUID();
          await conn.query(
            'INSERT INTO teams (id, team_name, team_name_en) VALUES (?, ?, ?)',
            [teamId, teamName, teamName]
          );
          console.log(`  创建新车队: ${teamName}`);
        }
        
        // 4.3 插入赛段成绩
        const resultId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, sprint_points) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [resultId, STAGE_ID, rank, riderId, teamId, 'ITA', time, 0]
        );
        
        inserted++;
        if (inserted % 20 === 0) {
          console.log(`  已导入 ${inserted}/${results.length}...`);
        }
        
      } catch (err) {
        console.error(`  错误: rank=${result.rank}, rider=${result.rider}, error=${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n导入完成:`);
    console.log(`  - 成功: ${inserted} 条`);
    console.log(`  - 跳过: ${skipped} 条`);
    console.log(`  - 错误: ${errors} 条`);
    
    // 5. 验证导入结果
    const [countRows] = await conn.query(
      'SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?',
      [STAGE_ID]
    );
    console.log(`\n验证: 第10赛段共有 ${countRows[0].count} 条成绩数据`);
    
    // 6. 显示前10名
    const [top10] = await conn.query(
      `SELECT sr.rank_pos, r.rider_name, t.team_name, sr.time_gap 
       FROM stage_results sr 
       JOIN riders r ON sr.rider_id = r.id 
       JOIN teams t ON sr.team_id = t.id 
       WHERE sr.stage_id = ? 
       ORDER BY sr.rank_pos 
       LIMIT 10`,
      [STAGE_ID]
    );
    
    console.log('\n前10名成绩:');
    console.table(top10);
    
  } catch (err) {
    console.error('错误:', err.message);
    console.error(err.stack);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

main();
