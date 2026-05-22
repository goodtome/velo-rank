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
const JERSEY_TYPES = ['pink', 'purple', 'blue', 'white'];

/**
 * 验证领骑衫数据
 */
async function validateJerseys(connection) {
  console.log('🚴 开始验证领骑衫数据...\n');
  
  const issues = [];
  
  // 1. 检查每个赛段是否有 4 件领骑衫
  console.log('📊 检查领骑衫数据完整性...');
  const [stageCounts] = await connection.execute(`
    SELECT 
      s.stage_number,
      COUNT(j.id) as jersey_count,
      GROUP_CONCAT(j.jersey_type ORDER BY j.jersey_type) as jersey_types
    FROM stages s
    LEFT JOIN jerseys j ON s.id = j.stage_id
    WHERE s.stage_number <= 9
    GROUP BY s.id, s.stage_number
    ORDER BY s.stage_number
  `);
  
  for (const row of stageCounts) {
    if (row.jersey_count !== 4) {
      issues.push(`赛段 ${row.stage_number}: 只有 ${row.jersey_count} 件领骑衫 (应有 4 件)`);
      console.log(`  ❌ 赛段 ${row.stage_number}: ${row.jersey_count}/4 件领骑衫`);
    } else {
      console.log(`  ✅ 赛段 ${row.stage_number}: 4/4 件领骑衫`);
    }
  }
  
  // 2. 检查领骑衫持有者是否在对应 classification 中排名第 1
  console.log('\n📊 检查领骑衫持有者排名...');
  
  for (const jerseyType of JERSEY_TYPES) {
    const classificationType = jerseyType === 'pink' ? 'general' :
                              jerseyType === 'purple' ? 'points' :
                              jerseyType === 'blue' ? 'mountains' : 'youth';
    
    const tableName = `${classificationType}_classification`;
    
    // 查询领骑衫持有者
    const [jerseys] = await connection.execute(`
      SELECT j.stage_id, s.stage_number, j.rider_id, r.rider_name
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN riders r ON j.rider_id = r.id
      WHERE j.jersey_type = ? AND s.stage_number <= 9
      ORDER BY s.stage_number
    `, [jerseyType]);
    
    for (const jersey of jerseys) {
      // 查询该赛段该分类的第 1 名
      const [leaders] = await connection.execute(`
        SELECT rider_id FROM ${tableName}
        WHERE stage_id = ? AND \`rank\` = 1
        LIMIT 1
      `, [jersey.stage_id]);
      
      if (leaders.length === 0) {
        issues.push(`赛段 ${jersey.stage_number} ${jerseyType} 领骑衫: classification 中无数据`);
        console.log(`  ❌ 赛段 ${jersey.stage_number} ${jerseyType}: classification 中无数据`);
      } else if (leaders[0].rider_id !== jersey.rider_id) {
        // 查询期望的持有者姓名
        const [expectedRider] = await connection.execute(`
          SELECT rider_name FROM riders WHERE id = ?
        `, [leaders[0].rider_id]);
        
        issues.push(`赛段 ${jersey.stage_number} ${jerseyType} 领骑衫: 实际="${jersey.rider_name}", 期望="${expectedRider[0]?.rider_name}"`);
        console.log(`  ❌ 赛段 ${jersey.stage_number} ${jerseyType}: 不匹配`);
        console.log(`     实际: ${jersey.rider_name}`);
        console.log(`     期望: ${expectedRider[0]?.rider_name || '未知'}`);
      } else {
        console.log(`  ✅ 赛段 ${jersey.stage_number} ${jerseyType}: ${jersey.rider_name}`);
      }
    }
  }
  
  // 3. 检查是否有重复数据
  console.log('\n📊 检查重复数据...');
  const [duplicates] = await connection.execute(`
    SELECT stage_id, jersey_type, COUNT(*) as cnt
    FROM jerseys
    GROUP BY stage_id, jersey_type
    HAVING cnt > 1
  `);
  
  if (duplicates.length > 0) {
    duplicates.forEach(dup => {
      issues.push(`stage_id=${dup.stage_id}, jersey_type=${dup.jersey_type}: ${dup.cnt} 条重复记录`);
    });
    console.log(`  ❌ 发现 ${duplicates.length} 组重复数据`);
  } else {
    console.log('  ✅ 无重复数据');
  }
  
  // 输出总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 验证总结');
  console.log('='.repeat(60));
  
  if (issues.length === 0) {
    console.log('\n✅ 所有验证通过！领骑衫数据正确。');
  } else {
    console.log(`\n❌ 发现 ${issues.length} 个问题:\n`);
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  return issues;
}

/**
 * 主函数
 */
async function main() {
  let connection;
  
  try {
    console.log('🚴 领骑衫数据验证\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 执行验证
    const issues = await validateJerseys(connection);
    
    // 保存验证报告
    if (issues.length > 0) {
      const fs = require('fs');
      const reportPath = 'JERSEYS_VALIDATION_REPORT.md';
      const report = [
        '# 领骑衫数据验证报告',
        '',
        `生成时间: ${new Date().toLocaleString('zh-CN')}`,
        '',
        '## 验证结果',
        '',
        issues.length === 0 ? '✅ 所有验证通过！' : `❌ 发现 ${issues.length} 个问题:`,
        '',
        ...issues.map((issue, i) => `${i + 1}. ${issue}`),
        ''
      ].join('\n');
      
      fs.writeFileSync(reportPath, report);
      console.log(`\n📄 验证报告已保存: ${reportPath}`);
    }
    
  } catch (error) {
    console.error('\n❌ 验证失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// 执行主函数
main().catch(console.error);
