#!/usr/bin/env node
/**
 * 初始化2026年环意大利自行车赛数据
 * 创建赛事记录和21个赛段记录
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// 2026年环意大利赛段数据
const STAGES = [
  { number: 1, name: 'Nessebar - Burgas', distance_km: 147, date: '2026-05-08', stage_type: 'Flat' },
  { number: 2, name: 'Burgas - Veliko Tarnovo', distance_km: 221, date: '2026-05-09', stage_type: 'Hills' },
  { number: 3, name: 'Plovdiv - Sofia', distance_km: 175, date: '2026-05-10', stage_type: 'Flat' },
  { number: 4, name: 'Catanzaro - Cosenza', distance_km: 138, date: '2026-05-12', stage_type: 'Hills' },
  { number: 5, name: 'Praia a Mare - Potenza', distance_km: 203, date: '2026-05-13', stage_type: 'Mountain' },
  { number: 6, name: 'Paestum - Naples', distance_km: 141, date: '2026-05-14', stage_type: 'Flat' },
  { number: 7, name: 'Formia - Blockhaus', distance_km: 244, date: '2026-05-15', stage_type: 'Mountain' },
  { number: 8, name: 'Chieti - Fermo', distance_km: 156, date: '2026-05-16', stage_type: 'Hills' },
  { number: 9, name: 'Cervia - Corno alle Scale', distance_km: 184, date: '2026-05-17', stage_type: 'Mountain' },
  { number: 10, name: 'Viareggio - Massa (ITT)', distance_km: 42, date: '2026-05-19', stage_type: 'ITT' },
  { number: 11, name: 'Porcari (Paper District) - Chiavari', distance_km: 195, date: '2026-05-20', stage_type: 'Hills' },
  { number: 12, name: 'Imperia - Novi Ligure', distance_km: 175, date: '2026-05-21', stage_type: 'Flat' },
  { number: 13, name: 'Alessandria - Verbania', distance_km: 189, date: '2026-05-22', stage_type: 'Hills' },
  { number: 14, name: 'Aosta - Pila (Gressan)', distance_km: 133, date: '2026-05-23', stage_type: 'Mountain' },
  { number: 15, name: 'Voghera - Milan', distance_km: 157, date: '2026-05-24', stage_type: 'Flat' },
  { number: 16, name: 'Bellinzona - Carì', distance_km: 113, date: '2026-05-26', stage_type: 'Mountain' },
  { number: 17, name: 'Cassano d\'Adda - Andalo', distance_km: 202, date: '2026-05-27', stage_type: 'Hills' },
  { number: 18, name: 'Fai della Paganella - Pieve di Soligo', distance_km: 171, date: '2026-05-28', stage_type: 'Hills' },
  { number: 19, name: 'Feltre - Alleghe (Piani di Pezzè)', distance_km: 151, date: '2026-05-29', stage_type: 'Mountain' },
  { number: 20, name: 'Gemona del Friuli 1976-2026 - Piancavallo', distance_km: 200, date: '2026-05-30', stage_type: 'Mountain' },
  { number: 21, name: 'Rome - Rome', distance_km: 131, date: '2026-05-31', stage_type: 'Flat' }
];

async function main() {
  console.log('🚀 初始化2026年环意大利赛事数据...\n');
  
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('✓ 数据库连接成功\n');
  
  try {
    // 1. 创建或获取赛事
    console.log('📦 创建或获取赛事...');
    
    let raceId;
    const [existingRaces] = await conn.query(
      'SELECT id FROM races WHERE race_name = ? AND season = ?',
      ['Giro d\'Italia', 2026]
    );
    
    if (existingRaces.length > 0) {
      raceId = existingRaces[0].id;
      console.log(`  ✓ 赛事已存在，ID: ${raceId}\n`);
    } else {
      raceId = crypto.randomUUID();
      await conn.query(`
        INSERT INTO races 
        (id, race_name, race_name_en, race_name_zh, race_code, category, gender, season, start_date, end_date, total_stages, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        raceId, 
        'Giro d\'Italia', 
        'Giro d\'Italia', 
        '环意自行车赛', 
        'giro-2026', 
        'Grand Tour', 
        'Men', 
        2026, 
        '2026-05-08', 
        '2026-05-31', 
        21, 
        1
      ]);
      console.log(`  ✓ 赛事创建成功，ID: ${raceId}\n`);
    }
    
    // 2. 创建赛段
    console.log('📦 创建赛段...');
    let created = 0;
    let skipped = 0;
    
    for (const stage of STAGES) {
      const stageId = crypto.randomUUID();
      const stageCode = `giro-2026-s${stage.number}`;
      const locations = stage.name.split(' - ');
      const startCity = locations[0] || '';
      const finishCity = locations[1] || '';
      
      try {
        await conn.query(`
          INSERT IGNORE INTO stages 
          (id, race_id, stage_number, stage_name, stage_code, distance_km, date, stage_type, start_city, finish_city)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          stageId, 
          raceId, 
          stage.number, 
          stage.name, 
          stageCode, 
          stage.distance_km, 
          stage.date, 
          stage.stage_type, 
          startCity, 
          finishCity
        ]);
        created++;
        console.log(`  ✓ 赛段 ${stage.number}: ${stage.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          skipped++;
          console.log(`  - 赛段 ${stage.number} 已存在，跳过`);
        } else {
          throw error;
        }
      }
    }
    
    console.log(`\n✅ 完成！创建 ${created} 个赛段，跳过 ${skipped} 个已存在的赛段\n`);
    
    // 3. 验证数据
    const [races] = await conn.query('SELECT COUNT(*) as cnt FROM races');
    const [stages] = await conn.query('SELECT COUNT(*) as cnt FROM stages');
    console.log('📊 数据库统计：');
    console.log(`  赛事: ${races[0].cnt} 条`);
    console.log(`  赛段: ${stages[0].cnt} 条`);
    
    // 4. 验证赛段关联的赛事ID是否正确
    const [stageCheck] = await conn.query(
      'SELECT COUNT(*) as cnt FROM stages WHERE race_id = ?',
      [raceId]
    );
    console.log(`  赛段关联当前赛事: ${stageCheck[0].cnt} 条`);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  } finally {
    await conn.end();
    console.log('\n🔚 数据库连接已关闭');
  }
}

main().catch(error => {
  console.error('程序执行失败:', error);
  process.exit(1);
});
