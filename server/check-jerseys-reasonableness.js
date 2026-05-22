const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// 领骑衫类型映射
const JERSEY_TYPE_MAP = {
  'pink': 'general',
  'purple': 'points',
  'blue': 'mountains',
  'white': 'youth'
};

// 主函数
async function main() {
  let connection;
  
  try {
    console.log('🚴 领骑衫数据合理性检查...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    const issues = [];
    
    // 遍历每种领骑衫
    for (const [jerseyType, classificationType] of Object.entries(JERSEY_TYPE_MAP)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 检查 ${jerseyType} 领骑衫（对应 ${classificationType} classification）`);
      console.log('='.repeat(60));
      
      const tableName = `${classificationType}_classification`;
      
      // 查询领骑衫持有者
      const [jerseys] = await connection.execute(`
        SELECT j.stage_id, s.stage_number, j.rider_id, r.rider_name
        FROM jerseys j
        JOIN stages s ON j.stage_id = s.id
        JOIN riders r ON j.rider_id = r.id
        WHERE j.jersey_type = ?
        ORDER BY s.stage_number
      `, [jerseyType]);
      
      for (const jersey of jerseys) {
        // 查询该赛段该分类的前3名
        let topRiders;
        
        if (classificationType === 'general') {
          const [rows] = await connection.execute(`
            SELECT rider_id FROM ${tableName}
            WHERE stage_id = ? AND \`rank\` <= 3
            ORDER BY \`rank\`
          `, [jersey.stage_id]);
          topRiders = rows;
        } else {
          // 其他 classification 表，按 points 降序（youth 表按 rank 升序）
          let orderClause;
          if (classificationType === 'youth') {
            orderClause = 'ORDER BY `rank` ASC';
          } else {
            orderClause = 'ORDER BY points DESC';
          }
          
          const [rows] = await connection.execute(`
            SELECT rider_id FROM ${tableName}
            WHERE stage_id = ?
            ${orderClause}
            LIMIT 3
          `, [jersey.stage_id]);
          topRiders = rows;
        }
        
        // 检查领骑衫持有者是否在前3名中
        const isInTop3 = topRiders.some(r => r.rider_id === jersey.rider_id);
        
        if (!isInTop3) {
          const topRiderNames = topRiders.map(r => {
            // 查询车手姓名
            // 这里简化，只显示 rider_id
            return r.rider_id.substring(0, 8) + '...';
          });
          
          issues.push(`赛段 ${jersey.stage_number} ${jerseyType} 领骑衫: ${jersey.rider_name} 不在前3名中`);
          console.log(`  ❌ 赛段 ${jersey.stage_number}: ${jersey.rider_name} 不在前3名中`);
          console.log(`     前3名: ${topRiderNames.join(', ')}`);
        } else {
          console.log(`  ✅ 赛段 ${jersey.stage_number}: ${jersey.rider_name}`);
        }
      }
    }
    
    // 输出总结
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 检查总结');
    console.log('='.repeat(60));
    
    if (issues.length === 0) {
      console.log('\n✅ 所有领骑衫数据合理！');
    } else {
      console.log(`\n❌ 发现 ${issues.length} 个问题:\n`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 检查失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// 执行主函数
main().catch(console.error);
