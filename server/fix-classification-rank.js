const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// 需要修复的表和赛段
const FIX_TARGETS = [
  { table: 'points_classification', stageNumbers: [2, 4, 5] },
  { table: 'mountains_classification', stageNumbers: [2, 5, 8, 9] },
  { table: 'youth_classification', stageNumbers: [2, 4, 5] }
];

// 主函数
async function main() {
  let connection;
  
  try {
    console.log('🚴 修复 classification 表的 rank 数据...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 遍历需要修复的表和赛段
    for (const target of FIX_TARGETS) {
      const { table, stageNumbers } = target;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 修复 ${table} 表`);
      console.log('='.repeat(60));
      
      for (const stageNumber of stageNumbers) {
        console.log(`\n处理赛段 ${stageNumber}...`);
        
        // 获取赛段 ID
        const [stageRows] = await connection.execute(
          'SELECT id FROM stages WHERE stage_number = ? LIMIT 1',
          [stageNumber]
        );
        
        if (stageRows.length === 0) {
          console.log(`  ❌ 赛段 ${stageNumber} 不存在`);
          continue;
        }
        
        const stageId = stageRows[0].id;
        
        // 根据表类型，选择排序字段
        let orderClause;
        if (table === 'points_classification' || table === 'mountains_classification') {
          // 按 points 降序
          orderClause = 'ORDER BY points DESC';
        } else if (table === 'youth_classification') {
          // 按 time 升序（时间越短排名越高）
          orderClause = 'ORDER BY time ASC';
        } else {
          // general_classification，按 time 升序
          orderClause = 'ORDER BY time ASC';
        }
        
        // 查询该赛段的所有记录，按正确顺序排序
        // 注意：youth_classification 表没有 points 字段
        let selectFields = '`rank`';
        if (table === 'points_classification' || table === 'mountains_classification') {
          selectFields += ', points';
        } else if (table === 'youth_classification') {
          selectFields += ', time';  // youth 表有 time 字段
        }
        
        const [allRows] = await connection.execute(`
          SELECT id, rider_id, ${selectFields}
          FROM ${table}
          WHERE stage_id = ?
          ${orderClause}
        `, [stageId]);
        
        console.log(`  找到 ${allRows.length} 条记录`);
        
        // 更新 rank
        let updateCount = 0;
        for (let i = 0; i < allRows.length; i++) {
          const newRank = i + 1;
          if (allRows[i].rank !== newRank) {
            await connection.execute(`
              UPDATE ${table}
              SET \`rank\` = ?
              WHERE id = ?
            `, [newRank, allRows[i].id]);
            updateCount++;
          }
        }
        
        console.log(`  ✅ 更新了 ${updateCount} 条记录的 rank`);
        
        // 验证：查询新的第1名
        // 注意：youth_classification 表没有 points 字段
        selectFields = 'rider_id, `rank`';
        if (table === 'points_classification' || table === 'mountains_classification') {
          selectFields += ', points';
        } else if (table === 'youth_classification') {
          selectFields += ', time';  // youth 表有 time 字段
        }
        
        const [leader] = await connection.execute(`
          SELECT ${selectFields}
          FROM ${table}
          WHERE stage_id = ? AND \`rank\` = 1
          LIMIT 1
        `, [stageId]);
        
        if (leader.length > 0) {
          const [rider] = await connection.execute(
            'SELECT rider_name FROM riders WHERE id = ?',
            [leader[0].rider_id]
          );
          
          // 构建输出信息
          let info = `(rank=${leader[0].rank}`;
          if (leader[0].points !== undefined) info += `, points=${leader[0].points}`;
          if (leader[0].time !== undefined) info += `, time=${leader[0].time}`;
          info += ')';
          
          console.log(`  ✓ 新的第1名: ${rider[0]?.rider_name || '未知'} ${info}`);
        }
      }
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 重新生成领骑衫数据...');
    console.log('='.repeat(60) + '\n');
    
    // 清空 jerseys 表
    await connection.execute('TRUNCATE TABLE jerseys');
    console.log('✅ jerseys 表已清空');
    
    // 重新生成领骑衫数据
    const JERSEY_MAPPING = {
      'general': 'pink',
      'points': 'purple',
      'mountains': 'blue',
      'youth': 'white'
    };
    
    const crypto = require('crypto');
    
    for (const [classificationType, jerseyType] of Object.entries(JERSEY_MAPPING)) {
      console.log(`\n处理 ${classificationType} → ${jerseyType}...`);
      
      const tableName = `${classificationType}_classification`;
      
      // 查询每个赛段的第一名
      let query;
      let params;
      
      if (classificationType === 'general') {
        query = `
          SELECT stage_id, rider_id, team_id
          FROM ${tableName}
          WHERE \`rank\` = 1
        `;
        params = [];
      } else {
        // 其他表需要通过 stage_results 获取 team_id
        query = `
          SELECT c.stage_id, c.rider_id, sr.team_id
          FROM ${tableName} c
          JOIN stage_results sr ON c.stage_id = sr.stage_id AND c.rider_id = sr.rider_id
          WHERE c.\`rank\` = 1
          GROUP BY c.stage_id, c.rider_id, sr.team_id
        `;
        params = [];
      }
      
      const [leaders] = await connection.execute(query, params);
      
      console.log(`  找到 ${leaders.length} 个赛段的第1名`);
      
      // 插入到 jerseys 表
      let insertedCount = 0;
      for (const leader of leaders) {
        try {
          const jerseyId = crypto.randomUUID();
          await connection.execute(`
            INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
            VALUES (?, ?, ?, ?, ?)
          `, [jerseyId, leader.stage_id, jerseyType, leader.rider_id, leader.team_id]);
          
          insertedCount++;
        } catch (error) {
          console.error(`  ❌ 插入失败:`, error.message);
        }
      }
      
      console.log(`  ✅ 插入了 ${insertedCount} 条领骑衫记录`);
    }
    
    console.log('\n✅ 修复完成！');
    
    // 验证修复结果
    console.log('\n📊 验证修复结果...');
    
    const [results] = await connection.execute(`
      SELECT 
        s.stage_number,
        j.jersey_type,
        r.rider_name
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN riders r ON j.rider_id = r.id
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
