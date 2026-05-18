/**
 * 导入 Stage 5 数据到数据库
 * 数据来源: PCS HTML 解析结果
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

// 读取解析好的数据
const dataContent = fs.readFileSync('./stage5-results-data.js', 'utf-8');
const match = dataContent.match(/const STAGE_RESULTS_DATA = (\[[\s\S]*?\]);/);
if (!match) {
  console.error('❌ 无法解析 stage5-results-data.js');
  process.exit(1);
}
const stageResults = JSON.parse(match[1]);

console.log('🚴 Stage 5 数据导入工具\n');
console.log('='.repeat(60));
console.log(`赛事: Giro d'Italia 2026`);
console.log(`赛段: Stage 5 - Praia a Mare → Potenza (2026-05-13, 203km)`);
console.log(`数据量: ${stageResults.length} 条成绩记录`);
console.log('='.repeat(60) + '\n');

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('✅ 数据库连接成功\n');
    
    // 1. 获取或创建赛事
    console.log('📋 1/4 处理赛事信息...');
    const raceCode = 'giro-ditalia-2026';
    const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', [raceCode]);
    
    let raceId;
    if (races.length > 0) {
      raceId = races[0].id;
      console.log(`  ℹ️  赛事已存在: ${races[0].race_name} (${raceId})\n`);
    } else {
      raceId = uuidv4();
      await conn.query(`
        INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        raceId,
        'Giro d\'Italia',
        'Giro d\'Italia',
        raceCode,
        'GRAND_TOUR',
        'MEN',
        2026
      ]);
      console.log(`  ✅ 创建赛事: Giro d'Italia (${raceId})\n`);
    }
    
    // 2. 获取或创建赛段
    console.log('📋 2/4 处理赛段信息...');
    const stageNumber = 5;
    const [stages] = await conn.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, stageNumber]
    );
    
    let stageId;
    if (stages.length > 0) {
      stageId = stages[0].id;
      console.log(`  ℹ️  赛段已存在: Stage ${stageNumber} (${stageId})\n`);
    } else {
      stageId = uuidv4();
      const stageCode = `giro-2026-s${stageNumber}`;
      await conn.query(`
        INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        stageId,
        raceId,
        stageNumber,
        'Praia a Mare → Potenza',
        '2026-05-13',
        203,
        'Mountain',
        stageCode
      ]);
      console.log(`  ✅ 创建赛段: Stage ${stageNumber} - Praia a Mare → Potenza (${stageId})\n`);
    }
    
    // 3. 导入赛段成绩
    console.log('📊 3/4 导入赛段成绩...\n');
    
    let imported = 0;
    let skipped = 0;
    
    for (const result of stageResults) {
      try {
        // 获取或创建车手
        const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [result.rider_name]);
        let riderId;
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
            [riderId, result.rider_name, 'UNK']
          );
        }
        
        // 获取或创建车队
        const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [result.team_name]);
        let teamId;
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await conn.query('INSERT INTO teams (id, team_name) VALUES (?, ?)', [teamId, result.team_name]);
        }
        
        // 插入成绩（使用ON DUPLICATE KEY UPDATE避免重复）
        await conn.query(`
          INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, result.rank, riderId, teamId, 'UNK', result.time_gap]);
        
        imported++;
        if (imported <= 10 || imported % 20 === 0) {
          console.log(`  ✅ ${result.rank}. ${result.rider_name} (${result.team_name}) - ${result.time_gap}`);
        }
      } catch (err) {
        skipped++;
        if (skipped <= 5) {
          console.error(`  ❌ 失败 [${result.rank}] ${result.rider_name}:`, err.message);
        }
      }
    }
    
    console.log(`\n  📊 成绩导入完成: ${imported} 成功, ${skipped} 失败\n`);
    
    // 4. 验证
    console.log('📋 4/4 验证数据...');
    const [count] = await conn.query('SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?', [stageId]);
    console.log(`  ✅ 数据库中该赛段共有 ${count[0].count} 条成绩记录\n`);
    
    // 查询前10名
    const [top10] = await conn.query(`
      SELECT sr.rank, r.rider_name, t.team_name, sr.time_gap
      FROM stage_results sr
      JOIN riders r ON sr.rider_id = r.id
      JOIN teams t ON sr.team_id = t.id
      WHERE sr.stage_id = ?
      ORDER BY sr.rank
      LIMIT 10
    `, [stageId]);
    
    console.log('🏆 数据库验证 - 前10名：');
    console.log('排名 | 车手 | 车队 | 时间差');
    console.log('-'.repeat(80));
    top10.forEach(r => {
      console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(30)} | ${r.time_gap}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Stage 5 数据导入完成！');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 导入失败:', err);
  } finally {
    if (conn) await conn.end();
  }
}

main();
