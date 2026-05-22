#!/usr/bin/env node
/**
 * 详细检查分类数据
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
  
  console.log('📊 详细检查分类数据\n');
  
  // 获取赛事ID
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
  
  // 检查 points_classification
  console.log('📋 points_classification 按赛段统计:');
  const [pointsStats] = await conn.query(`
    SELECT s.stage_number, COUNT(pc.id) as cnt
    FROM stages s
    LEFT JOIN points_classification pc ON s.id = pc.stage_id
    WHERE s.race_id = ?
    GROUP BY s.stage_number
    ORDER BY s.stage_number
  `, [raceId]);
  
  let totalPoints = 0;
  pointsStats.forEach(s => {
    console.log(`  Stage ${s.stage_number}: ${s.cnt} 条`);
    totalPoints += s.cnt;
  });
  console.log(`  总计: ${totalPoints} 条\n`);
  
  // 检查 mountains_classification
  console.log('📋 mountains_classification 按赛段统计:');
  const [mountainsStats] = await conn.query(`
    SELECT s.stage_number, COUNT(mc.id) as cnt
    FROM stages s
    LEFT JOIN mountains_classification mc ON s.id = mc.stage_id
    WHERE s.race_id = ?
    GROUP BY s.stage_number
    ORDER BY s.stage_number
  `, [raceId]);
  
  let totalMountains = 0;
  mountainsStats.forEach(s => {
    console.log(`  Stage ${s.stage_number}: ${s.cnt} 条`);
    totalMountains += s.cnt;
  });
  console.log(`  总计: ${totalMountains} 条\n`);
    
  await conn.end();
  console.log('✓ 检查完成');
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
