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

// 需要修复的赛段和领骑衫类型
const FIX_LIST = [
  { stageNumber: 7, jerseyType: 'purple', classificationTable: 'points_classification' },
  { stageNumber: 9, jerseyType: 'purple', classificationTable: 'points_classification' }
];

// 主函数
async function main() {
  let connection;
  
  try {
    console.log('🚴 修复 jerseys 表中的错误数据...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    const issues = [];
    
    // 遍历需要修复的条目
    for (const fix of FIX_LIST) {
      const { stageNumber, jerseyType, classificationTable } = fix;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 修复赛段 ${stageNumber} 的 ${jerseyType} 领骑衫`);
      console.log('='.repeat(60));
      
      // 1. 获取赛段 ID
      const [stageRows] = await connection.execute(
        'SELECT id FROM stages WHERE stage_number = ? LIMIT 1',
        [stageNumber]
      );
      
      if (stageRows.length === 0) {
        console.log(`  ❌ 赛段 ${stageNumber} 不存在`);
        continue;
      }
      
      const stageId = stageRows[0].id;
      
      // 2. 查询 classification 表中的正确第1名
      const [leaders] = await connection.execute(`
        SELECT rider_id FROM ${classificationTable}
        WHERE stage_id = ? AND \`rank\` = 1
        LIMIT 1
      `, [stageId]);
      
      if (leaders.length === 0) {
        console.log(`  ❌ classification 表中无 rank=1 记录`);
        issues.push(`赛段 ${stageNumber} ${jerseyType}: classification 表中无数据`);
        continue;
      }
      
      const correctRiderId = leaders[0].rider_id;
      
      // 查询正确车手姓名
      const [correctRider] = await connection.execute(
        'SELECT rider_name FROM riders WHERE id = ?',
        [correctRiderId]
      );
      
      // 3. 查询当前的领骑衫持有者
      const [current] = await connection.execute(`
        SELECT rider_id FROM jerseys
        WHERE stage_id = ? AND jersey_type = ?
      `, [stageId, jerseyType]);
      
      if (current.length === 0) {
        // 没有记录，插入
        const teamId = await getTeamId(connection, stageId, correctRiderId);
        
        const jerseyId = crypto.randomUUID();
        await connection.execute(`
          INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
          VALUES (?, ?, ?, ?, ?)
        `, [jerseyId, stageId, jerseyType, correctRiderId, teamId]);
        
        console.log(`  ✓ 插入 ${jerseyType} 领骑衫（${correctRider[0]?.rider_name || '未知'}）`);
      } else if (current[0].rider_id !== correctRiderId) {
        // 记录不匹配，更新
        const teamId = await getTeamId(connection, stageId, correctRiderId);
        
        await connection.execute(`
          UPDATE jerseys
          SET rider_id = ?, team_id = ?
          WHERE stage_id = ? AND jersey_type = ?
        `, [correctRiderId, teamId, stageId, jerseyType]);
        
        // 查询当前车手姓名
        const [currentRider] = await connection.execute(
          'SELECT rider_name FROM riders WHERE id = ?',
          [current[0].rider_id]
        );
        
        console.log(`  ✓ 更新 ${jerseyType} 领骑衫（${currentRider[0]?.rider_name || '未知'} → ${correctRider[0]?.rider_name || '未知'}）`);
      } else {
        console.log(`  ✅ ${jerseyType} 领骑衫正确（${correctRider[0]?.rider_name || '未知'}）`);
      }
    }
    
    // 验证修复结果
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 验证修复结果');
    console.log('='.repeat(60) + '\n');
    
    const [results] = await connection.execute(`
      SELECT 
        s.stage_number,
        j.jersey_type,
        r.rider_name
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN riders r ON j.rider_id = r.id
      WHERE s.stage_number IN (7, 9) AND j.jersey_type = 'purple'
      ORDER BY s.stage_number
    `);
    
    console.log('修复后的数据:');
    console.table(results);
    
    // 输出总结
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 修复总结');
    console.log('='.repeat(60));
    
    if (issues.length === 0) {
      console.log('\n✅ 所有数据已修复！');
    } else {
      console.log(`\n❌ 还有 ${issues.length} 个问题:\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * 获取车手的 team_id（通过 stage_results 表）
 */
async function getTeamId(connection, stageId, riderId) {
  const [rows] = await connection.execute(`
    SELECT team_id FROM stage_results
    WHERE stage_id = ? AND rider_id = ?
    LIMIT 1
  `, [stageId, riderId]);
  
  return rows.length > 0 ? rows[0].team_id : null;
}

// 执行主函数
main().catch(console.error);
