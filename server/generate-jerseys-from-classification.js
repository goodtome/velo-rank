const mysql = require('mysql2/promise');
const crypto = require('crypto');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db',
  charset: 'utf8mb4'
};

// 领骑衫类型映射
const JERSEY_MAPPING = {
  'general': 'pink',
  'points': 'purple',
  'mountains': 'blue',
  'youth': 'white'
};

// 主函数
async function main() {
  let connection;
  
  try {
    console.log('🚴 从 classification 数据生成领骑衫数据...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 遍历每种分类
    for (const [classificationType, jerseyType] of Object.entries(JERSEY_MAPPING)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 处理 ${classificationType} → ${jerseyType} 领骑衫`);
      console.log('='.repeat(60));
      
      // 确定表名
      const tableName = `${classificationType}_classification`;
      
      // 查询每个赛段的第一名
      // 注意：general_classification 有 team_id，其他表需要通过 stage_results 获取
      let query;
      let params;
      
      if (classificationType === 'general') {
        // general_classification 有 team_id 字段
        query = `
          SELECT 
            c.stage_id,
            c.rider_id,
            c.team_id,
            s.stage_number,
            MIN(c.\`rank\`) as rank_num
          FROM ${tableName} c
          JOIN stages s ON c.stage_id = s.id
          JOIN races r ON s.race_id = r.id
          WHERE r.race_name LIKE ? AND r.season = ?
          AND c.\`rank\` = 1
          GROUP BY c.stage_id, c.rider_id, c.team_id, s.stage_number
          ORDER BY s.stage_number
        `;
        params = ['%Giro d\'Italia%', 2026];
      } else {
        // 其他 classification 表没有 team_id，需要 JOIN stage_results
        query = `
          SELECT 
            c.stage_id,
            c.rider_id,
            sr.team_id,
            s.stage_number,
            MIN(c.\`rank\`) as rank_num
          FROM ${tableName} c
          JOIN stages s ON c.stage_id = s.id
          JOIN races r ON s.race_id = r.id
          JOIN stage_results sr ON c.stage_id = sr.stage_id AND c.rider_id = sr.rider_id
          WHERE r.race_name LIKE ? AND r.season = ?
          AND c.\`rank\` = 1
          GROUP BY c.stage_id, c.rider_id, sr.team_id, s.stage_number
          ORDER BY s.stage_number
        `;
        params = ['%Giro d\'Italia%', 2026];
      }
      
      // 执行查询
      const [leaders] = await connection.execute(query, params);
      
      console.log(`✅ 找到 ${leaders.length} 条领骑衫记录（${jerseyType}）`);
      
      // 插入到 jerseys 表
      let insertedCount = 0;
      for (const leader of leaders) {
        try {
          // 检查是否已存在
          const [existing] = await connection.execute(`
            SELECT id FROM jerseys 
            WHERE stage_id = ? AND jersey_type = ?
          `, [leader.stage_id, jerseyType]);
          
          if (existing.length > 0) {
            console.log(`  ⏭️  赛段 ${leader.stage_number} 的 ${jerseyType} 领骑衫已存在，跳过`);
            continue;
          }
          
          // 插入领骑衫记录
          const jerseyId = crypto.randomUUID();
          await connection.execute(`
            INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
            VALUES (?, ?, ?, ?, ?)
          `, [jerseyId, leader.stage_id, jerseyType, leader.rider_id, leader.team_id]);
          
          insertedCount++;
          console.log(`  ✓ 赛段 ${leader.stage_number}: ${jerseyType} 领骑衫已插入`);
          
        } catch (error) {
          console.error(`  ❌ 插入失败:`, error.message);
        }
      }
      
      console.log(`\n💾 ${jerseyType} 领骑衫: 成功插入 ${insertedCount} 条记录`);
    }
    
    // 显示统计
    console.log('\n' + '='.repeat(60));
    console.log('📊 领骑衫数据统计');
    console.log('='.repeat(60) + '\n');
    
    const [stats] = await connection.execute(`
      SELECT 
        s.stage_number,
        j.jersey_type,
        r.rider_name,
        t.team_name
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN races rc ON s.race_id = rc.id
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON j.team_id = t.id
      WHERE rc.race_name LIKE ? AND rc.season = ?
      ORDER BY s.stage_number, j.jersey_type
    `, ['%Giro d\'Italia%', 2026]);
    
    console.table(stats);
    
    // 按赛段和领骑衫类型统计
    const [summary] = await connection.execute(`
      SELECT 
        s.stage_number,
        j.jersey_type,
        COUNT(*) as count
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN races r ON s.race_id = r.id
      WHERE r.race_name LIKE ? AND r.season = ?
      GROUP BY s.stage_number, j.jersey_type
      ORDER BY s.stage_number, j.jersey_type
    `, ['%Giro d\'Italia%', 2026]);
    
    console.log('\n📊 领骑衫数据分布:');
    console.table(summary);
    
  } catch (error) {
    console.error('\n❌ 程序执行失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// 执行主函数
main().catch(console.error);
