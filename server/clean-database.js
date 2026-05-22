const mysql = require('mysql2/promise');

async function cleanDatabase() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 13306,
      user: 'root',
      password: 'mysql123456',
      database: 'jersey_db'
    });
    
    console.log('✅ 数据库连接成功\n');
    console.log('🧹 开始清理数据库...\n');
    
    // 1. 清理分类表
    console.log('1️⃣ 清理分类表...');
    let [result] = await connection.execute('DELETE FROM points_classification');
    console.log(`   ✅ points_classification: 删除 ${result.affectedRows} 条记录`);
    
    [result] = await connection.execute('DELETE FROM mountains_classification');
    console.log(`   ✅ mountains_classification: 删除 ${result.affectedRows} 条记录`);
    
    [result] = await connection.execute('DELETE FROM youth_classification');
    console.log(`   ✅ youth_classification: 删除 ${result.affectedRows} 条记录`);
    
    [result] = await connection.execute('DELETE FROM general_classification');
    console.log(`   ✅ general_classification: 删除 ${result.affectedRows} 条记录`);
    
    // 2. 清理领骑衫表
    console.log('\n2️⃣ 清理领骑衫表...');
    [result] = await connection.execute('DELETE FROM jerseys');
    console.log(`   ✅ jerseys: 删除 ${result.affectedRows} 条记录`);
    
    // 3. 清理赛段成绩表
    console.log('\n3️⃣ 清理赛段成绩表...');
    [result] = await connection.execute('DELETE FROM stage_results');
    console.log(`   ✅ stage_results: 删除 ${result.affectedRows} 条记录`);
    
    // 4. 清理赛段表
    console.log('\n4️⃣ 清理赛段表...');
    [result] = await connection.execute('DELETE FROM stages');
    console.log(`   ✅ stages: 删除 ${result.affectedRows} 条记录`);
    
    // 5. 清理赛事表（保留结构）
    console.log('\n5️⃣ 清理赛事表...');
    [result] = await connection.execute('DELETE FROM races');
    console.log(`   ✅ races: 删除 ${result.affectedRows} 条记录`);
    
    // 6. 重置自增ID（可选）
    console.log('\n6️⃣ 重置自增ID...');
    await connection.execute('ALTER TABLE points_classification AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE mountains_classification AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE youth_classification AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE general_classification AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE jerseys AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE stage_results AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE stages AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE races AUTO_INCREMENT = 1');
    console.log('   ✅ 自增ID已重置');
    
    // 7. 显示清理后的统计
    console.log('\n📊 清理后数据库状态:');
    const tables = ['races', 'stages', 'riders', 'teams', 'stage_results', 'jerseys', 'general_classification', 'points_classification', 'mountains_classification', 'youth_classification'];
    
    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   - ${table}: ${rows[0].count} 条记录`);
      } catch (error) {
        console.log(`   - ${table}: 表不存在或查询失败`);
      }
    }
    
    console.log('\n✅ 数据库清理完成！');
    
    await connection.end();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

cleanDatabase();
