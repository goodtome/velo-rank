#!/usr/bin/env node
/**
 * 修复 Stage 2 分类数据（删除后重新爬取）
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
  
  console.log('🧹 修复 Stage 2 分类数据\n');
  
  // 获取 Stage 2 的 ID
  const [races] = await conn.query(
    'SELECT id FROM races WHERE race_name = ? AND season = ?',
    ['Giro d\'Italia', 2026]
  );
  
  if (races.length === 0) {
    console.log('❌ 未找到 Giro d\'Italia 2026');
    await conn.end();
    return;
  }
  
  const raceId = races[0].id;
  
  const [stages] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?',
    [raceId, 2]
  );
  
  if (stages.length === 0) {
    console.log('❌ 未找到 Stage 2');
    await conn.end();
    return;
  }
  
  const stageId = stages[0].id;
  console.log(`✓ 找到 Stage 2, ID: ${stageId}\n`);
  
  // 删除 points_classification
  console.log('🗑️  删除 points_classification...');
  const [pointsResult] = await conn.query(
    'DELETE FROM points_classification WHERE stage_id = ?',
    [stageId]
  );
  console.log(`  ✓ 删除 ${pointsResult.affectedRows} 条记录`);
  
  // 删除 mountains_classification
  console.log('🗑️  删除 mountains_classification...');
  const [mountainsResult] = await conn.query(
    'DELETE FROM mountains_classification WHERE stage_id = ?',
    [stageId]
  );
  console.log(`  ✓ 删除 ${mountainsResult.affectedRows} 条记录`);
  
  // 删除 youth_classification
  console.log('🗑️  删除 youth_classification...');
  const [youthResult] = await conn.query(
    'DELETE FROM youth_classification WHERE stage_id = ?',
    [stageId]
  );
  console.log(`  ✓ 删除 ${youthResult.affectedRows} 条记录`);
  
  await conn.end();
  console.log('\n✅ 修复完成，现在可以重新爬取 Stage 2 的分类数据');
  console.log('   运行: node import-pcs-puppeteer.js --stages=2 --types=points,mountains,youth');
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
