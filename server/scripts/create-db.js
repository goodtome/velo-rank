/**
 * 创建数据库脚本
 * 连接到MySQL并创建jersey_db数据库
 */

const mysql = require('mysql2/promise');

async function createDatabase() {
  console.log('正在连接MySQL服务器...');
  
  // 连接到MySQL服务器（不指定数据库）
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: ''
  });
  
  console.log('✅ 成功连接到MySQL服务器');
  
  // 创建数据库
  console.log('\n正在创建 jersey_db 数据库...');
  await connection.query(`
    CREATE DATABASE IF NOT EXISTS jersey_db 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ 数据库 jersey_db 创建成功');
  
  // 验证
  const [rows] = await connection.query(
    "SHOW DATABASES LIKE 'jersey_db'"
  );
  
  if (rows.length > 0) {
    console.log('✅ 验证成功：数据库已存在');
  } else {
    console.log('❌ 验证失败：数据库未创建');
  }
  
  await connection.end();
  console.log('\n数据库初始化完成！');
}

createDatabase().catch(err => {
  console.error('创建数据库失败:', err);
  process.exit(1);
});
