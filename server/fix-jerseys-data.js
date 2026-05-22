const mysql = require('mysql2/promise');
const crypto = require('crypto');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// 主函数
async function main() {
  let connection;
  
  try {
    console.log('🚴 修复领骑衫数据...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 清理 points_classification 表中的重复数据
    console.log('📊 清理 points_classification 表中的重复数据...');
    
    // 查找每个赛段有多条 rank=1 记录的 rider_id
    const [duplicates] = await connection.execute(`
      SELECT stage_id, rider_id, COUNT(*) as cnt
      FROM points_classification
      WHERE \`rank\` = 1
      GROUP BY stage_id, rider_id
      HAVING cnt > 1
    `);
    
    console.log(`  找到 ${duplicates.length} 组重复数据`);
    
    for (const dup of duplicates) {
      // 保留一条，删除多余的
      const [rows] = await connection.execute(`
        SELECT id FROM points_classification
        WHERE stage_id = ? AND rider_id = ? AND \`rank\` = 1
        ORDER BY updated_at DESC
      `, [dup.stage_id, dup.rider_id]);
      
      // 删除多余的（保留第一条）
      for (let i = 1; i < rows.length; i++) {
        await connection.execute(`
          DELETE FROM points_classification WHERE id = ?
        `, [rows[i].id]);
        console.log(`  ✅ 删除重复记录: ${rows[i].id}`);
      }
    }
    
    // 2. 修复 jerseys 表中的数据
    console.log('\n📊 修复 jerseys 表中的错误数据...');
    
    // 领骑衫类型映射
    const jerseyTypeMap = {
      'pink': 'general',
      'purple': 'points',
      'blue': 'mountains',
      'white': 'youth'
    };
    
    for (const [jerseyType, classificationType] of Object.entries(jerseyTypeMap)) {
      console.log(`\n处理 ${jerseyType} 领骑衫（对应 ${classificationType} classification）...`);
      
      const tableName = `${classificationType}_classification`;
      
      // 查询每个赛段的正确第一名
      let query;
      let params;
      
      if (classificationType === 'general') {
        query = `
          SELECT 
            c.stage_id,
            c.rider_id,
            c.team_id,
            s.stage_number
          FROM ${tableName} c
          JOIN stages s ON c.stage_id = s.id
          WHERE c.\`rank\` = 1
          ORDER BY s.stage_number
        `;
        params = [];
      } else {
        // 其他 classification 表需要通过 stage_results 获取 team_id
        query = `
          SELECT 
            c.stage_id,
            c.rider_id,
            sr.team_id,
            s.stage_number
          FROM ${tableName} c
          JOIN stages s ON c.stage_id = s.id
          JOIN stage_results sr ON c.stage_id = sr.stage_id AND c.rider_id = sr.rider_id
          WHERE c.\`rank\` = 1
          ORDER BY s.stage_number
        `;
        params = [];
      }
      
      const [leaders] = await connection.execute(query, params);
      
      for (const leader of leaders) {
        // 查询当前的领骑衫持有者
        const [current] = await connection.execute(`
          SELECT rider_id FROM jerseys
          WHERE stage_id = ? AND jersey_type = ?
        `, [leader.stage_id, jerseyType]);
        
        if (current.length === 0) {
          // 没有记录，插入
          const jerseyId = crypto.randomUUID();
          await connection.execute(`
            INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
            VALUES (?, ?, ?, ?, ?)
          `, [jerseyId, leader.stage_id, jerseyType, leader.rider_id, leader.team_id]);
          console.log(`  ✓ 赛段 ${leader.stage_number}: 插入 ${jerseyType} 领骑衫（${leader.rider_id}）`);
        } else if (current[0].rider_id !== leader.rider_id) {
          // 记录不匹配，更新
          await connection.execute(`
            UPDATE jerseys
            SET rider_id = ?, team_id = ?
            WHERE stage_id = ? AND jersey_type = ?
          `, [leader.rider_id, leader.team_id, leader.stage_id, jerseyType]);
          console.log(`  ✓ 赛段 ${leader.stage_number}: 更新 ${jerseyType} 领骑衫（${current[0].rider_id} → ${leader.rider_id}）`);
        } else {
          console.log(`  ✅ 赛段 ${leader.stage_number}: ${jerseyType} 领骑衫正确`);
        }
      }
    }
    
    console.log('\n✅ 修复完成！');
    
    // 3. 验证修复结果
    console.log('\n📊 验证修复结果...');
    
    const [results] = await connection.execute(`
      SELECT 
        s.stage_number,
        j.jersey_type,
        r.rider_name,
        t.team_name
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON j.team_id = t.id
      WHERE s.stage_number <= 9
      ORDER BY s.stage_number, j.jersey_type
    `);
    
    console.log('\n修复后的领骑衫数据:');
    console.table(results);
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// 执行主函数
main().catch(console.error);
