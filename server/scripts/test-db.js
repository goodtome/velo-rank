/**
 * 数据库连接测试脚本
 * 测试MySQL连接和表结构
 * 
 * 用法: node test-db.js
 */

const mysql = require('mysql2/promise');
const pool = require('../config/db-pool');

async function testDatabase() {
  console.log('🧪 开始数据库测试\n');
  console.log('='.repeat(50));
  
  try {
    // 测试1: 连接测试
    console.log('\n🔌 测试1: 数据库连接');
    console.log('-'.repeat(50));
    const connection = await pool.getConnection();
    console.log('✅ 成功获取数据库连接');
    
    // 测试2: 查询数据库版本
    console.log('\n📊 测试2: 数据库版本');
    console.log('-'.repeat(50));
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`✅ MySQL版本: ${rows[0].version}`);
    
    // 测试3: 检查表是否存在
    console.log('\n📋 测试3: 检查表结构');
    console.log('-'.repeat(50));
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    );
    
    const expectedTables = [
      'races', 'stages', 'riders', 'teams', 
      'stage_results', 'jerseys', 'general_classification'
    ];
    
    console.log(`找到 ${tables.length} 张表:`);
    tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));
    
    const existingTableNames = tables.map(t => t.TABLE_NAME);
    const missingTables = expectedTables.filter(t => !existingTableNames.includes(t));
    
    if (missingTables.length === 0) {
      console.log('\n✅ 所有必需表都已存在');
    } else {
      console.log(`\n⚠️ 缺少 ${missingTables.length} 张表: ${missingTables.join(', ')}`);
      console.log('请先运行: npm run init-db');
    }
    
    // 测试4: 检查races表结构
    console.log('\n🏗️  测试4: races表结构');
    console.log('-'.repeat(50));
    const [columns] = await connection.query(
      "DESCRIBE races"
    );
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Key ? '(' + col.Key + ')' : ''}`);
    });
    
    connection.release();
    console.log('\n' + '='.repeat(50));
    console.log('🎉 数据库测试完成！');
    
  } catch (err) {
    console.error('\n❌ 数据库测试失败:', err.message);
    console.log('\n请检查:');
    console.log('1. MySQL服务是否已启动');
    console.log('2. .env文件中的数据库配置是否正确');
    console.log('3. 数据库是否已创建');
    process.exit(1);
  }
}

// 运行测试
testDatabase();
