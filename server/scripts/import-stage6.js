/**
 * 导入 Stage 6 数据到数据库
 * 数据来源: stage6-results-2026.json (from PCS)
 * 赛段: Paestum → Napoli, 2026-05-14, 142km, Flat
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

// 读取JSON数据
const data = JSON.parse(fs.readFileSync('./stage6-results-2026.json', 'utf-8'));
const stageResults = data.results;
const jerseyHolders = data.jersey_holders || [];

console.log('🚴 Stage 6 数据导入工具\n');
console.log('='.repeat(60));
console.log(`赛事: Giro d'Italia 2026`);
console.log(`赛段: Stage 6 - Paestum → Napoli (2026-05-14, 142km)`);
console.log(`数据量: ${stageResults.length} 条成绩记录, ${jerseyHolders.length} 件领骑衫`);
console.log('='.repeat(60) + '\n');

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('✅ 数据库连接成功\n');
    
    // 1. 获取赛事
    console.log('📋 1/5 处理赛事信息...');
    const raceCode = 'giro-ditalia-2026';
    const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', [raceCode]);
    
    let raceId;
    if (races.length > 0) {
      raceId = races[0].id;
      console.log(`  ℹ️  赛事已存在: ${races[0].race_name} (${raceId})\n`);
    } else {
      console.error('❌ 赛事不存在，请先创建赛事');
      process.exit(1);
    }
    
    // 2. 获取或创建赛段
    console.log('📋 2/5 处理赛段信息...');
    const stageNumber = 6;
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
        'Paestum → Napoli',
        '2026-05-14',
        142,
        'Flat',
        stageCode
      ]);
      console.log(`  ✅ 创建赛段: Stage ${stageNumber} - Paestum → Napoli (${stageId})\n`);
    }
    
    // 3. 导入赛段成绩
    console.log('📊 3/5 导入赛段成绩...\n');
    
    let imported = 0;
    let skipped = 0;
    
    for (const result of stageResults) {
      try {
        const rank = parseInt(result.rank);
        if (isNaN(rank)) {
          skipped++;
          continue;
        }
        
        // 获取或创建车手
        const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [result.rider]);
        let riderId;
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
            [riderId, result.rider, result.nationality || 'UNK']
          );
        }
        
        // 获取或创建车队
        const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [result.team]);
        let teamId;
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await conn.query('INSERT INTO teams (id, team_name) VALUES (?, ?)', [teamId, result.team]);
        }
        
        // 插入成绩（使用ON DUPLICATE KEY UPDATE避免重复）
        const timeGap = result.time_bonus ? result.time_bonus : (result.stage_time === 's.t.' ? 's.t.' : result.stage_time);
        await conn.query(`
          INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, rank, riderId, teamId, result.nationality || 'UNK', timeGap]);
        
        imported++;
        if (imported <= 10 || imported % 20 === 0) {
          console.log(`  ✅ ${result.rank}. ${result.rider} (${result.team}) - ${result.stage_time}`);
        }
      } catch (err) {
        skipped++;
        if (skipped <= 5) {
          console.error(`  ❌ 失败 [${result.rank}] ${result.rider}:`, err.message);
        }
      }
    }
    
    console.log(`\n  📊 成绩导入完成: ${imported} 成功, ${skipped} 失败\n`);
    
    // 4. 导入领骑衫数据
    console.log('👕 4/5 导入领骑衫数据...');
    
    if (jerseyHolders.length > 0) {
      // 先删除该赛段现有的领骑衫数据
      await conn.query('DELETE FROM jerseys WHERE stage_id = ?', [stageId]);
      
      const jerseyTypeMap = {
        'PINK (GC)': 'PINK',
        'PINK2': 'PINK',
        'PURPLE': 'PURPLE',
        'BLUE2': 'BLUE_SPRINT',
        'WHITE (Youth)': 'WHITE_YOUTH',
        'LIGHT_GRAY': 'WHITE_YOUTH'  // 可能对应白衫
      };
      
      for (const jersey of jerseyHolders) {
        try {
          const jerseyType = jerseyTypeMap[jersey.color] || jersey.color;
          
          // 获取车手ID和车队ID
          const riderName = `${jersey.rider.split(' ')[1]} ${jersey.rider.split(' ')[0]}`;
          const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [riderName]);
          if (riders.length === 0) {
            console.log(`  ⚠️  车手未找到: ${riderName}`);
            continue;
          }
          
          // 获取车队ID（从车手当前车队获取，或从stage_results获取该赛段该车手的车队）
          const [results] = await conn.query(
            'SELECT team_id FROM stage_results WHERE stage_id = ? AND rider_id = ? LIMIT 1',
            [stageId, riders[0].id]
          );
          
          let teamId = null;
          if (results.length > 0) {
            teamId = results[0].team_id;
          } else {
            // 如果stage_results中没有，尝试从riders表获取（如果有team_id字段）
            console.log(`  ⚠️  未找到车手 ${riderName} 在该赛段 的车队信息`);
            continue; // 跳过这条记录，因为team_id是NOT NULL
          }
          
          await conn.query(`
            INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
            VALUES (?, ?, ?, ?, ?)
          `, [uuidv4(), stageId, jerseyType, riders[0].id, teamId]);
          
          console.log(`  ✅ ${jerseyType}: ${jersey.rider} (${jersey.team})`);
        } catch (err) {
          console.error(`  ❌ 领骑衫导入失败:`, err.message);
        }
      }
      console.log('');
    } else {
      console.log('  ⚠️  无领骑衫数据\n');
    }
    
    // 5. 验证
    console.log('📋 5/5 验证数据...');
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
    console.log('排名 | 车手 | 车队 | 时间');
    console.log('-'.repeat(80));
    top10.forEach(r => {
      const rank = String(r.rank).padEnd(6);
      const name = r.rider_name.padEnd(25);
      const team = r.team_name.padEnd(30);
      console.log(`${rank} | ${name} | ${team} | ${r.time_gap}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Stage 6 数据导入完成！');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 导入失败:', err);
  } finally {
    if (conn) await conn.end();
  }
}

main();
