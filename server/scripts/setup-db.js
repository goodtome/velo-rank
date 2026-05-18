/**
 * 创建数据库并验证连接
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/config/.env' });

async function setupDatabase() {
  console.log('🔌 连接MySQL服务器...');
  
  // 1. 连接到MySQL服务器（不指定数据库）
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 13306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });
  
  console.log('✅ MySQL服务器连接成功');
  
  // 2. 创建数据库
  console.log(`\n📦 创建数据库 ${process.env.DB_NAME}...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log('✅ 数据库创建成功');
  
  // 3. 连接到新数据库
  console.log('\n🔗 连接到 jersey_db 数据库...');
  const dbConn = await mysql.createConnection({
    ...{
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 13306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    },
    database: process.env.DB_NAME || 'jersey_db'
  });
  
  console.log('✅ 数据库连接成功');
  
  // 4. 验证
  const [rows] = await dbConn.query('SELECT DATABASE() as db');
  console.log(`✅ 当前数据库: ${rows[0].db}`);
  
  await dbConn.end();
  await conn.end();
  console.log('\n🎉 数据库配置完成！');
}

setupDatabase().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
