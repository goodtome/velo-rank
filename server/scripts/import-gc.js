/**
 * 将GC数据从JSON导入MySQL
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

async function main() {
  let conn;
  try {
    // 读取GC数据
    const gcData = JSON.parse(fs.readFileSync('./stage5-gc.json', 'utf-8'));
    console.log(`🚴 GC数据导入工具`);
    console.log(`📊 读取到 ${gcData.length} 条GC记录\n`);
    
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    // 获取race_id和stage_id
    const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', ['giro-ditalia-2026']);
    if (races.length === 0) {
      console.log('❌ 赛事不存在');
      return;
    }
    const raceId = races[0].id;
    
    const [stages] = await conn.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, 5]
    );
    if (stages.length === 0) {
      console.log('❌ 赛段不存在');
      return;
    }
    const stageId = stages[0].id;
    
    console.log(`✅ 赛事ID: ${raceId}`);
    console.log(`✅ 赛段ID: ${stageId}\n`);
    
    // 导入GC数据
    console.log('📊 导入GC总成绩榜...\n');
    
    let imported = 0;
    let skipped = 0;
    
    for (const gc of gcData) {
      try {
        // 查找或创建车手
        const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [gc.rider_name]);
        let riderId;
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
            [riderId, gc.rider_name, 'UNK']
          );
        }
        
        // 查找或创建车队
        const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [gc.team_name]);
        let teamId;
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await conn.query('INSERT INTO teams (id, team_name) VALUES (?, ?)', [teamId, gc.team_name]);
        }
        
        // 插入GC数据
        await conn.query(`
          INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, total_time, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            total_time = VALUES(total_time),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, gc.rank, riderId, teamId, gc.total_time || null, gc.time_gap]);
        
        imported++;
        if (imported <= 10 || imported % 20 === 0) {
          console.log(`  ✅ ${gc.rank}. ${gc.rider_name} (${gc.team_name}) - ${gc.time_gap}`);
        }
      } catch (err) {
        skipped++;
        if (skipped <= 5) {
          console.error(`  ❌ 失败 [${gc.rank}] ${gc.rider_name}:`, err.message);
        }
      }
    }
    
    console.log(`\n📊 GC导入完成: ${imported} 成功, ${skipped} 失败\n`);
    
    // 验证
    const [count] = await conn.query('SELECT COUNT(*) as count FROM general_classification WHERE stage_id = ?', [stageId]);
    console.log(`✅ GC表中该赛段共有 ${count[0].count} 条记录\n`);
    
    // 查询前10
    const [top10] = await conn.query(`
      SELECT gc.rank, r.rider_name, t.team_name, gc.time_gap, gc.total_time
      FROM general_classification gc
      JOIN riders r ON gc.rider_id = r.id
      JOIN teams t ON gc.team_id = t.id
      WHERE gc.stage_id = ?
      ORDER BY gc.rank
      LIMIT 10
    `, [stageId]);
    
    console.log('🏆 GC总成绩榜前10：');
    console.log('排名 | 车手 | 车队 | 时间差 | 总时间');
    console.log('-'.repeat(100));
    top10.forEach(r => {
      console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${r.team_name.padEnd(30)} | ${(r.time_gap || '').padEnd(10)} | ${r.total_time || ''}`);
    });
    
    console.log('\n🎉 GC数据导入完成！');
    
  } catch (err) {
    console.error('❌ 失败:', err);
  } finally {
    if (conn) await conn.end();
  }
}

main();
