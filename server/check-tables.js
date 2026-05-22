#!/usr/bin/env node
/**
 * 检查数据库表结构
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  
  console.log('📊 检查数据库表结构...\n');
  
  // 查看所有表
  const [tables] = await conn.query('SHOW TABLES');
  console.log('📦 所有表:');
  tables.forEach(t => {
    const tableName = Object.values(t)[0];
    console.log(`  - ${tableName}`);
  });
  
  // 检查分类排名相关的表
  const classificationTables = ['general_classification', 'points_classification', 'mountains_classification', 'youth_classification'];
  
  for (const table of classificationTables) {
    console.log(`\n📋 表结构: ${table}`);
    try {
      const [columns] = await conn.query(`DESCRIBE ${table}`);
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
      });
    } catch (error) {
      console.log(`  ⚠️  表不存在或无法访问: ${error.message}`);
    }
  }
  
  // 检查 stage_results 表
  console.log('\n📋 表结构: stage_results');
  const [stageResultsColumns] = await conn.query('DESCRIBE stage_results');
  stageResultsColumns.forEach(col => {
    console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
  });
  
  await conn.end();
  console.log('\n✓ 检查完成');
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
