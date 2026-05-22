const mysql = require('mysql2/promise');

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 13306,
      user: 'root',
      password: 'mysql123456',
      database: 'jersey_db'
    });
    
    console.log('✅ 数据库连接成功\n');
    
    // 检查所有表
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📊 数据库中的表:');
    console.table(tables);
    
    // 检查 races 表结构
    console.log('\n📋 races 表结构:');
    const [racesCols] = await connection.execute('DESCRIBE races');
    console.table(racesCols);
    
    // 检查 races 表数据
    console.log('\n📋 races 表数据:');
    const [races] = await connection.execute('SELECT * FROM races LIMIT 3');
    console.table(races);
    
    // 检查 stages 表结构
    console.log('\n📋 stages 表结构:');
    const [stagesCols] = await connection.execute('DESCRIBE stages');
    console.table(stagesCols);
    
    // 检查 jerseys 表结构
    console.log('\n📋 jerseys 表结构:');
    const [jerseysCols] = await connection.execute('DESCRIBE jerseys');
    console.table(jerseysCols);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

main();
