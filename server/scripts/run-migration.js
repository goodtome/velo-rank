const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: `${__dirname}/../config/.env` });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 13306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jersey_db',
  multipleStatements: true // 允许执行多条SQL语句
};

async function runMigration() {
  let conn;
  try {
    console.log('开始执行数据库迁移...');
    
    // 连接到数据库
    conn = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 读取SQL迁移文件
    const migrationFile = path.join(__dirname, '../db/migrations/003_create_push_tables.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('📄 读取迁移文件:', migrationFile);
    
    // 执行SQL语句
    console.log('⏳ 执行SQL语句...');
    await conn.query(sql);
    
    console.log('✅ 数据库迁移执行成功！');
    console.log('🎉 推送相关表创建完成：');
    console.log('   - user_push_settings (用户推送设置表)');
    console.log('   - user_push_subscriptions (用户推送订阅记录表)');
    console.log('   - push_history (推送历史记录表)');
    
  } catch (err) {
    console.error('❌ 数据库迁移失败:', err.message);
    console.error('详细错误:', err);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      console.log('数据库连接已关闭');
    }
  }
}

runMigration();