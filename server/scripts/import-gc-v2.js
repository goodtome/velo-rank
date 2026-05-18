/**
 * 从HTML提取GC数据（包含国籍）并入库
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('🚴 GC数据提取入库工具\n');
    
    // 获取race_id和stage_id
    const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', ['giro-ditalia-2026']);
    const raceId = races[0].id;
    const [stages] = await conn.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, 5]
    );
    const stageId = stages[0].id;
    
    console.log(`✅ 赛事ID: ${raceId}`);
    console.log(`✅ 赛段ID: ${stageId}\n`);
    
    // 查找GC表格
    console.log('🔍 查找GC表格...');
    const allTables = document.querySelectorAll('table.results');
    let gcTable = null;
    
    for (const table of allTables) {
      const firstRow = table.querySelector('tbody tr');
      if (!firstRow) continue;
      
      const cells = firstRow.querySelectorAll('td');
      // GC表格通常有13列: Rnk|GC|Timelag|BIB|H2H|Specialty|Age|Rider|Team|UCI|Pnt|Time|Time won/lost
      // Stage成绩只有12列
      if (cells.length === 13) {
        console.log(`  📊 找到GC表格 (${cells.length} 列)`);
        gcTable = table;
        break;
      }
    }
    
    if (!gcTable) {
      console.log('❌ 未找到GC表格');
      return;
    }
    
    // 提取GC数据
    const rows = gcTable.querySelectorAll('tbody tr');
    console.log(`  📊 GC表格共有 ${rows.length} 行\n`);
    
    const gcData = [];
    
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 13) continue;
      
      const rank = cells[0]?.textContent?.trim();
      if (!rank || rank === '') continue;
      
      // 获取车手国籍
      const flagEl = cells[7]?.querySelector('.flag');
      const nationality = flagEl?.className?.replace('flag', '').trim() || 'UNK';
      
      // 获取车手名字
      const riderLink = cells[7]?.querySelector('a');
      const riderName = riderLink?.textContent?.trim() || '';
      
      // 获取车队
      const teamLink = cells[8]?.querySelector('a');
      const teamName = teamLink?.textContent?.trim() || '';
      
      // 获取时间差 (GC第3列是time_gap)
      const timeGap = cells[2]?.textContent?.trim() || '';
      
      // 获取总时间 (GC第12列)
      const timeEl = cells[12]?.querySelector('font');
      const totalTime = timeEl?.textContent?.trim() || '';
      
      gcData.push({
        rank: parseInt(rank),
        rider_name: riderName,
        team_name: teamName,
        nationality,
        time_gap: timeGap,
        total_time: totalTime
      });
      
      if (gcData.length <= 10) {
        console.log(`  ${rank}. ${riderName} (${nationality}) - ${timeGap}`);
      }
    }
    
    console.log(`\n✅ 提取到 ${gcData.length} 条GC记录\n`);
    
    // 写入数据库
    console.log('📊 写入GC数据到数据库...\n');
    
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
            [riderId, gc.rider_name, gc.nationality]
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
          INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            nationality = VALUES(nationality),
            total_time = VALUES(total_time),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, gc.rank, riderId, teamId, gc.nationality, gc.total_time || null, gc.time_gap]);
        
        imported++;
        if (imported <= 10 || imported % 20 === 0) {
          console.log(`  ✅ ${gc.rank}. ${gc.rider_name} (${gc.nationality}) - ${gc.time_gap}`);
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
