/**
 * 导入 Stage 4 数据到数据库
 * 数据来源: giroditalia.it 官方页面
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

// 读取 Stage 4 数据
const STAGE4_DATA = require('./data/stage4-results.js');

console.log('🚴 Stage 4 数据导入工具\n');
console.log('='.repeat(60));
console.log(`赛事: Giro d'Italia 2026`);
console.log(`赛段: Stage 4 - Catanzaro → Cosenza (2026-05-12, 138km)`);
console.log(`数据量: ${STAGE4_DATA.stage_results.length} 条成绩记录`);
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
    const stageNumber = 4;
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
        'Catanzaro → Cosenza',
        '2026-05-12',
        138,
        'Flat',  // 根据距离判断为平路赛段
        stageCode
      ]);
      console.log(`  ✅ 创建赛段: Stage ${stageNumber} - Catanzaro → Cosenza (${stageId})\n`);
    }
    
    // 3. 导入赛段成绩
    console.log('📊 3/4 导入赛段成绩...\n');
    
    let imported = 0;
    let skipped = 0;
    
    for (const result of STAGE4_DATA.stage_results) {
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
    
    // 4. 导入领骑衫信息
    console.log('📊 4/4 导入领骑衫信息...\n');
    
    // 粉衫
    if (STAGE4_DATA.jersey_holders.pink) {
      const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [STAGE4_DATA.jersey_holders.pink.rider_name]);
      const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [STAGE4_DATA.jersey_holders.pink.team_name]);
      
      if (riders.length > 0 && teams.length > 0) {
        const [existing] = await conn.query(
          'SELECT * FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
          [stageId, 'pink']
        );
        
        if (existing.length > 0) {
          await conn.query(
            'UPDATE jerseys SET rider_id = ?, team_id = ? WHERE id = ?',
            [riders[0].id, teams[0].id, existing[0].id]
          );
          console.log(`  ℹ️  更新粉衫: ${STAGE4_DATA.jersey_holders.pink.rider_name}`);
        } else {
          await conn.query(
            'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), stageId, 'pink', riders[0].id, teams[0].id]
          );
          console.log(`  ✅ 添加粉衫: ${STAGE4_DATA.jersey_holders.pink.rider_name}`);
        }
      }
    }
    
    // 白衫
    if (STAGE4_DATA.jersey_holders.white) {
      const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [STAGE4_DATA.jersey_holders.white.rider_name]);
      const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [STAGE4_DATA.jersey_holders.white.team_name]);
      
      let riderId;
      if (riders.length > 0) {
        riderId = riders[0].id;
      } else {
        // 如果车手不存在，创建新车手
        riderId = uuidv4();
        await conn.query('INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)', [riderId, STAGE4_DATA.jersey_holders.white.rider_name, 'UNK']);
        console.log(`  ℹ️  创建新车手: ${STAGE4_DATA.jersey_holders.white.rider_name}`);
      }
      
      if (teams.length > 0) {
        const teamId = teams[0].id;
        const [existing] = await conn.query(
          'SELECT * FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
          [stageId, 'white']
        );
        
        if (existing.length > 0) {
          await conn.query(
            'UPDATE jerseys SET rider_id = ?, team_id = ? WHERE id = ?',
            [riderId, teamId, existing[0].id]
          );
          console.log(`  ℹ️  更新白衫: ${STAGE4_DATA.jersey_holders.white.rider_name}`);
        } else {
          await conn.query(
            'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), stageId, 'white', riderId, teamId]
          );
          console.log(`  ✅ 添加白衫: ${STAGE4_DATA.jersey_holders.white.rider_name}`);
        }
      }
    }
    
    // 紫衫
    if (STAGE4_DATA.jersey_holders.purple) {
      const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [STAGE4_DATA.jersey_holders.purple.rider_name]);
      const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [STAGE4_DATA.jersey_holders.purple.team_name]);
      
      let riderId;
      if (riders.length > 0) {
        riderId = riders[0].id;
      } else {
        riderId = uuidv4();
        await conn.query('INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)', [riderId, STAGE4_DATA.jersey_holders.purple.rider_name, 'UNK']);
        console.log(`  ℹ️  创建新车手: ${STAGE4_DATA.jersey_holders.purple.rider_name}`);
      }
      
      if (teams.length > 0) {
        const teamId = teams[0].id;
        const [existing] = await conn.query(
          'SELECT * FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
          [stageId, 'purple']
        );
        
        if (existing.length > 0) {
          await conn.query(
            'UPDATE jerseys SET rider_id = ?, team_id = ? WHERE id = ?',
            [riderId, teamId, existing[0].id]
          );
          console.log(`  ℹ️  更新紫衫: ${STAGE4_DATA.jersey_holders.purple.rider_name}`);
        } else {
          await conn.query(
            'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), stageId, 'purple', riderId, teamId]
          );
          console.log(`  ✅ 添加紫衫: ${STAGE4_DATA.jersey_holders.purple.rider_name}`);
        }
      }
    }
    
    // 蓝衫
    if (STAGE4_DATA.jersey_holders.blue) {
      const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [STAGE4_DATA.jersey_holders.blue.rider_name]);
      const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [STAGE4_DATA.jersey_holders.blue.team_name]);
      
      let riderId;
      if (riders.length > 0) {
        riderId = riders[0].id;
      } else {
        riderId = uuidv4();
        await conn.query('INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)', [riderId, STAGE4_DATA.jersey_holders.blue.rider_name, 'UNK']);
        console.log(`  ℹ️  创建新车手: ${STAGE4_DATA.jersey_holders.blue.rider_name}`);
      }
      
      if (teams.length > 0) {
        const teamId = teams[0].id;
        const [existing] = await conn.query(
          'SELECT * FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
          [stageId, 'blue']
        );
        
        if (existing.length > 0) {
          await conn.query(
            'UPDATE jerseys SET rider_id = ?, team_id = ? WHERE id = ?',
            [riderId, teamId, existing[0].id]
          );
          console.log(`  ℹ️  更新蓝衫: ${STAGE4_DATA.jersey_holders.blue.rider_name}`);
        } else {
          await conn.query(
            'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), stageId, 'blue', riderId, teamId]
          );
          console.log(`  ✅ 添加蓝衫: ${STAGE4_DATA.jersey_holders.blue.rider_name}`);
        }
      }
    }
    
    // 5. 验证数据
    console.log('\n📋 验证数据...');
    const [stageCount] = await conn.query('SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?', [stageId]);
    const [jerseyCount] = await conn.query('SELECT COUNT(*) as count FROM jerseys WHERE stage_id = ?', [stageId]);
    
    console.log(`  ✅ Stage 4 成绩记录: ${stageCount[0].count} 条`);
    console.log(`  ✅ Stage 4 领骑衫记录: ${jerseyCount[0].count} 条\n`);
    
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
    
    console.log('🏆 Stage 4 前10名：');
    console.log('排名 | 车手 | 车队 | 时间差');
    console.log('-'.repeat(80));
    top10.forEach(r => {
      console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(30)} | ${r.time_gap}`);
    });
    
    // 查询领骑衫
    const [jerseys] = await conn.query(`
      SELECT j.jersey_type, r.rider_name, t.team_name
      FROM jerseys j
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON j.team_id = t.id
      WHERE j.stage_id = ?
    `, [stageId]);
    
    console.log('\n🎽 Stage 4 领骑衫：');
    jerseys.forEach(j => {
      const jerseyName = { pink: '粉衫', white: '白衫', purple: '紫衫', blue: '蓝衫' }[j.jersey_type] || j.jersey_type;
      console.log(`  ${jerseyName}: ${j.rider_name} (${j.team_name})`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Stage 4 数据导入完成！');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 导入失败:', err);
  } finally {
    if (conn) await conn.end();
  }
}

main();
