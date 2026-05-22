#!/usr/bin/env node
/**
 * 清理重复数据
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
  
  console.log('🧹 清理重复数据\n');
  
  // 1. 检查 points_classification 重复数据
  console.log('📊 检查 points_classification 重复数据...');
  const [duplicates] = await conn.query(`
    SELECT stage_id, rider_id, COUNT(*) as cnt
    FROM points_classification
    GROUP BY stage_id, rider_id
    HAVING cnt > 1
  `);
  
  console.log(`  找到 ${duplicates.length} 组重复数据`);
  
  if (duplicates.length > 0) {
    // 删除重复数据（保留第一条）
    console.log('  🗑️  删除重复数据...');
    for (const dup of duplicates) {
      const [rows] = await conn.query(`
        SELECT id FROM points_classification
        WHERE stage_id = ? AND rider_id = ?
        ORDER BY id ASC
        LIMIT 1 OFFSET 1
      `, [dup.stage_id, dup.rider_id]);
      
      for (const row of rows) {
        await conn.query('DELETE FROM points_classification WHERE id = ?', [row.id]);
      }
    }
    console.log('  ✓ 重复数据已清理');
  }
  
  // 2. 检查其他分类表是否有重复
  const tables = ['mountains_classification', 'youth_classification', 'general_classification'];
  
  for (const table of tables) {
    console.log(`\n📊 检查 ${table} 重复数据...`);
    const [dups] = await conn.query(`
      SELECT stage_id, rider_id, COUNT(*) as cnt
      FROM ${table}
      GROUP BY stage_id, rider_id
      HAVING cnt > 1
    `);
    
    console.log(`  找到 ${dups.length} 组重复数据`);
    
    if (dups.length > 0) {
      console.log(`  🗑️  删除 ${table} 重复数据...`);
      for (const dup of dups) {
        const [rows] = await conn.query(`
          SELECT id FROM ${table}
          WHERE stage_id = ? AND rider_id = ?
          ORDER BY id ASC
          LIMIT 1 OFFSET 1
        `, [dup.stage_id, dup.rider_id]);
        
        for (const row of rows) {
          await conn.query(`DELETE FROM ${table} WHERE id = ?`, [row.id]);
        }
      }
      console.log(`  ✓ ${table} 重复数据已清理`);
    }
  }
  
  // 3. 添加唯一约束防止未来重复
  console.log('\n🔒 添加唯一约束...');
  
  try {
    await conn.query(`
      ALTER TABLE points_classification
      ADD UNIQUE KEY uk_stage_rider (stage_id, rider_id)
    `);
    console.log('  ✓ points_classification 唯一约束已添加');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('  ⚠️  points_classification 唯一约束已存在');
    } else {
      console.error('  ❌ 添加约束失败:', error.message);
    }
  }
  
  try {
    await conn.query(`
      ALTER TABLE mountains_classification
      ADD UNIQUE KEY uk_stage_rider (stage_id, rider_id)
    `);
    console.log('  ✓ mountains_classification 唯一约束已添加');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('  ⚠️  mountains_classification 唯一约束已存在');
    } else {
      console.error('  ❌ 添加约束失败:', error.message);
    }
  }
  
  try {
    await conn.query(`
      ALTER TABLE youth_classification
      ADD UNIQUE KEY uk_stage_rider (stage_id, rider_id)
    `);
    console.log('  ✓ youth_classification 唯一约束已添加');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('  ⚠️  youth_classification 唯一约束已存在');
    } else {
      console.error('  ❌ 添加约束失败:', error.message);
    }
  }
  
  try {
    await conn.query(`
      ALTER TABLE general_classification
      ADD UNIQUE KEY uk_stage_rider (stage_id, rider_id)
    `);
    console.log('  ✓ general_classification 唯一约束已添加');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('  ⚠️  general_classification 唯一约束已存在');
    } else {
      console.error('  ❌ 添加约束失败:', error.message);
    }
  }
  
  await conn.end();
  console.log('\n✅ 清理完成');
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
