/**
 * 提取领骑衫和GC数据并入库
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

const html = fs.readFileSync('./page.html', 'utf-8');
const dom = new JSDOM(html);
const { document } = dom.window;

// 领骑衫颜色映射
const JERSEY_COLORS = {
  '#f5e947': 'YELLOW',    // 总成绩GC (黄色)
  '#8bd600': 'GREEN',     // 冲刺积分Points (绿色)
  '#ff4a36': 'POLKADOT',  // 爬坡KOM (红色/圆点)
  '#e0e0e0': 'WHITE',     // 青年Youth (白色)
  '#007deb': 'BLUE',      // 车队Teams (蓝色)
  '#EA529E': 'PURPLE',    // 紫衫
  '#FBA3AF': 'PINK',      // 粉衫
  '#0087EE': 'BLUE_SPRINT', // 蓝衫(冲刺)
  '#f5f5f5': 'WHITE_YOUTH'  // 白衫(青年)
};

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('🚴 领骑衫和GC数据入库工具\n');
    console.log('='.repeat(60));
    console.log('赛事: Giro d\'Italia 2026');
    console.log('赛段: Stage 5 - Praia a Mare → Potenza');
    console.log('='.repeat(60) + '\n');
    
    // 1. 获取race_id和stage_id
    const [races] = await conn.query('SELECT * FROM races WHERE race_code = ?', ['giro-ditalia-2026']);
    if (races.length === 0) {
      console.log('❌ 赛事不存在，请先导入赛事数据');
      return;
    }
    const raceId = races[0].id;
    
    const [stages] = await conn.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, 5]
    );
    if (stages.length === 0) {
      console.log('❌ 赛段不存在，请先导入赛段数据');
      return;
    }
    const stageId = stages[0].id;
    
    console.log(`✅ 赛事ID: ${raceId}`);
    console.log(`✅ 赛段ID: ${stageId}\n`);
    
    // 2. 提取领骑衫持有者
    console.log('🏆 提取领骑衫持有者...');
    const jerseyRows = document.querySelectorAll('table.results tbody tr');
    const jerseyHolders = new Map(); // jersey_type -> rider info
    
    for (const row of jerseyRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 9) continue;
      
      // 查找领骑衫图标
      const shirtIcon = row.querySelector('.svg_shirt');
      if (!shirtIcon) continue;
      
      const bgColor = shirtIcon.getAttribute('style')?.match(/background:\s*([^;]+)/)?.[1]?.trim();
      if (!bgColor) continue;
      
      // 提取车手和车队信息
      const riderLink = cells[7]?.querySelector('a');
      const riderName = riderLink?.textContent?.trim();
      const teamLink = cells[8]?.querySelector('a');
      const teamName = teamLink?.textContent?.trim();
      const timeCell = cells[11];
      const timeGap = timeCell?.textContent?.trim();
      
      if (!riderName || !bgColor) continue;
      
      // 确定领骑衫类型
      let jerseyType = JERSEY_COLORS[bgColor];
      if (!jerseyType) {
        console.log(`⚠️  未知颜色: ${bgColor}`);
        continue;
      }
      
      jerseyHolders.set(jerseyType, {
        rider_name: riderName,
        team_name: teamName || '',
        time_gap: timeGap || ''
      });
      
      console.log(`  🎽 ${jerseyType}: ${riderName} (${teamName})`);
    }
    
    // 3. 写入领骑衫数据
    console.log('\n📊 写入领骑衫数据到数据库...');
    
    let jerseyImported = 0;
    for (const [jerseyType, holder] of jerseyHolders) {
      try {
        // 查找或创建车手
        const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [holder.rider_name]);
        let riderId;
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
            [riderId, holder.rider_name, 'UNK']
          );
        }
        
        // 查找或创建车队
        const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [holder.team_name]);
        let teamId;
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await conn.query('INSERT INTO teams (id, team_name) VALUES (?, ?)', [teamId, holder.team_name]);
        }
        
        // 写入领骑衫数据
        await conn.query(`
          INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id, time_gap)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, jerseyType, riderId, teamId, holder.time_gap]);
        
        jerseyImported++;
        console.log(`  ✅ ${jerseyType}: ${holder.rider_name}`);
      } catch (err) {
        console.error(`  ❌ 失败 [${jerseyType}] ${holder.rider_name}:`, err.message);
      }
    }
    
    console.log(`\n✅ 领骑衫数据导入完成: ${jerseyImported} 条\n`);
    
    // 4. 提取并写入GC数据
    console.log('🏆 提取GC总成绩榜...');
    const [gcData] = await conn.query(
      'SELECT * FROM general_classification WHERE stage_id = ? ORDER BY `rank`',
      [stageId]
    );
    console.log(`  📊 GC表中已有 ${gcData.length} 条记录`);
    
    if (gcData.length > 0) {
      console.log('\n🏆 GC总成绩榜前10：');
      console.log('排名 | 车手 | 车队 | 时间差');
      console.log('-'.repeat(80));
      gcData.slice(0, 10).forEach(r => {
        console.log(`${String(r.rank).padEnd(6)} | ${(r.rider_name || '').padEnd(25)} | ${(r.team_name || '').padEnd(30)} | ${r.time_gap || ''}`);
      });
    }
    
    // 5. 汇总
    console.log('\n' + '='.repeat(60));
    console.log('📊 数据汇总：');
    console.log('='.repeat(60));
    
    const [stageCount] = await conn.query('SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?', [stageId]);
    const [jerseyCount] = await conn.query('SELECT COUNT(*) as count FROM jerseys WHERE stage_id = ?', [stageId]);
    const [gcCount] = await conn.query('SELECT COUNT(*) as count FROM general_classification WHERE stage_id = ?', [stageId]);
    
    console.log(`  🏁 赛段成绩: ${stageCount[0].count} 条`);
    console.log(`  🎽 领骑衫:   ${jerseyCount[0].count} 条`);
    console.log(`  🏆 GC总成绩: ${gcCount[0].count} 条`);
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 失败:', err);
  } finally {
    if (conn) await conn.end();
  }
}

main();
