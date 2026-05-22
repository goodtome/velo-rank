#!/usr/bin/env node
/**
 * 验证数据库中的数据
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
  
  console.log('📊 数据库数据验证\n');
  
  // 统计各表记录数
  const tables = [
    'races',
    'stages',
    'riders',
    'teams',
    'stage_results',
    'general_classification',
    'points_classification',
    'mountains_classification',
    'youth_classification',
    'jerseys'
  ];
  
  for (const table of tables) {
    try {
      const [result] = await conn.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`  ${table}: ${result[0].cnt} 条`);
    } catch (error) {
      console.log(`  ${table}: ❌ ${error.message}`);
    }
  }
  
  // 获取赛事ID
  const [races] = await conn.query(
    'SELECT id FROM races WHERE race_name = ? AND season = ?',
    ['Giro d\'Italia', 2026]
  );
  
  if (races.length === 0) {
    console.log('\n❌ 未找到 Giro d\'Italia 2026');
    await conn.end();
    return;
  }
  
  const raceId = races[0].id;
  
  // 按赛段统计赛段成绩
  console.log('\n📋 按赛段统计（赛段成绩）:');
  const [stageStats] = await conn.query(`
    SELECT s.stage_number, COUNT(sr.id) as result_count
    FROM stages s
    LEFT JOIN stage_results sr ON s.id = sr.stage_id
    WHERE s.race_id = ?
    GROUP BY s.stage_number
    ORDER BY s.stage_number
  `, [raceId]);
  
  stageStats.forEach(s => {
    console.log(`  Stage ${s.stage_number}: ${s.result_count} 条成绩`);
  });
  
  // 按赛段统计GC排名
  console.log('\n📋 按赛段统计（GC排名）:');
  const [gcStats] = await conn.query(`
    SELECT s.stage_number, COUNT(gc.id) as gc_count
    FROM stages s
    LEFT JOIN general_classification gc ON s.id = gc.stage_id
    WHERE s.race_id = ?
    GROUP BY s.stage_number
    ORDER BY s.stage_number
  `, [raceId]);
  
  gcStats.forEach(s => {
    console.log(`  Stage ${s.stage_number}: ${s.gc_count} 条GC排名`);
  });
  
  // 按赛段统计积分排名
  console.log('\n📋 按赛段统计（积分排名）:');
  const [pointsStats] = await conn.query(`
    SELECT s.stage_number, COUNT(pc.id) as points_count
    FROM stages s
    LEFT JOIN points_classification pc ON s.id = pc.stage_id
    WHERE s.race_id = ?
    GROUP BY s.stage_number
    ORDER BY s.stage_number
  `, [raceId]);
  
  pointsStats.forEach(s => {
    console.log(`  Stage ${s.stage_number}: ${s.points_count} 条积分排名`);
  });
  
  await conn.end();
  console.log('\n✓ 验证完成');
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
