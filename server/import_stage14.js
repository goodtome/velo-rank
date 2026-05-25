const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');

// 第14赛段信息
const STAGE_ID = 'a95eb43d-e2c0-4311-80c0-527fc965c95f';
const STAGE_CODE = 'giro-2026-s14';
const JSON_FILE = 'D:/codes/velo-rank/server/stage14_full.json';

// PCS jersey color mapping for Giro d'Italia
const JERSEY_COLOR_MAP = {
  '#FBA3AF': 'pink',    // Maglia Rosa (GC)
  '#EA529E': 'purple',  // Maglia Ciclamino (Points)
  '#0087EE': 'blue',    // Maglia Azzurra (KOM)
  '#f5f5f5': 'white',   // Maglia Bianca (Youth)
  '#f5e947': 'yellow',  // (Tour de France, not Giro)
  '#8bd600': 'green',   // (Points, not Giro)
  '#ff4a36': 'red',     // (KOM, not Giro)
};

async function importStage14() {
  let conn;
  let insertedResults = 0;
  let skippedResults = 0;
  let newRiders = 0;
  let newTeams = 0;

  try {
    // 1. 读取JSON文件
    console.log('读取数据文件:', JSON_FILE);
    const rawData = fs.readFileSync(JSON_FILE, 'utf8');
    const data = JSON.parse(rawData);
    
    const results = data.results || [];
    const jerseys = data.jersey_holders || [];
    
    console.log(`共 ${results.length} 条成绩数据, ${jerseys.length} 件领骑衫`);

    // 2. 连接数据库
    console.log('\n连接数据库...');
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 13306,
      user: 'root',
      password: 'mysql123456',
      database: 'jersey_db'
    });
    console.log('数据库连接成功！');

    // 3. 清空该赛段的现有数据
    console.log(`\n清空赛段 ${STAGE_CODE} 的现有数据...`);
    await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [STAGE_ID]);
    await conn.query('DELETE FROM jerseys WHERE stage_id = ?', [STAGE_ID]);
    await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [STAGE_ID]);
    console.log('旧数据已清理');

    // 4. 缓存已有的车手和车队（避免重复查询）
    console.log('\n加载已有车手和车队缓存...');
    const [existingRiders] = await conn.query('SELECT id, rider_name FROM riders');
    const riderCache = {};
    for (const r of existingRiders) {
      riderCache[r.rider_name.toLowerCase()] = r.id;
    }
    console.log(`  已有 ${existingRiders.length} 名车手`);

    const [existingTeams] = await conn.query('SELECT id, team_name, team_name_en FROM teams');
    const teamCache = {};
    for (const t of existingTeams) {
      const nameLower = (t.team_name || '').toLowerCase();
      const nameEnLower = (t.team_name_en || '').toLowerCase();
      if (nameLower) teamCache[nameLower] = t.id;
      if (nameEnLower && nameEnLower !== nameLower) teamCache[nameEnLower] = t.id;
    }
    console.log(`  已有 ${existingTeams.length} 支车队`);

    // 5. 导入赛段成绩
    console.log(`\n开始导入 ${results.length} 条赛段成绩...`);

    for (const result of results) {
      try {
        const rankNum = parseInt(result.rank);
        if (isNaN(rankNum)) {
          console.log(`跳过无效排名: ${result.rank}`);
          skippedResults++;
          continue;
        }

        // 5.1 查找或创建车手
        let riderId;
        const riderNameLower = result.rider.toLowerCase();
        if (riderCache[riderNameLower]) {
          riderId = riderCache[riderNameLower];
        } else {
          // 尝试名字顺序反转匹配 (PCS: "Firstname Surname" vs DB: "Surname Firstname")
          const parts = riderNameLower.split(' ');
          let foundAlt = false;
          if (parts.length >= 2) {
            const reversed = parts.slice(1).join(' ') + ' ' + parts[0];
            if (riderCache[reversed]) {
              riderId = riderCache[reversed];
              foundAlt = true;
            }
          }
          if (!foundAlt) {
            riderId = crypto.randomUUID();
            await conn.query(
              'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
              [riderId, result.rider, result.nationality || 'UNK']
            );
            riderCache[riderNameLower] = riderId;
            newRiders++;
            if (newRiders <= 5) console.log(`  创建新车手: ${result.rider}`);
          }
        }

        // 5.2 查找或创建车队
        let teamId;
        const teamNameLower = result.team.toLowerCase();
        if (teamCache[teamNameLower]) {
          teamId = teamCache[teamNameLower];
        } else {
          teamId = crypto.randomUUID();
          await conn.query(
            'INSERT INTO teams (id, team_name, team_name_en) VALUES (?, ?, ?)',
            [teamId, result.team, result.team]
          );
          teamCache[teamNameLower] = teamId;
          newTeams++;
          console.log(`  创建新车队: ${result.team}`);
        }

        // 5.3 处理时间格式
        let timeGap = result.stage_time || '';
        let isSameTime = 0;
        
        if (timeGap === 's.t.' || timeGap === '' || timeGap === '0:00') {
          isSameTime = 1;
          timeGap = 's.t.';
        }
        
        // 处理欧洲数字格式（逗号换点号）
        if (timeGap.includes(',')) {
          timeGap = timeGap.replace(',', '.');
        }

        // 5.4 处理国籍 - 使用PCS提取的2字母ISO代码
        let nationality = (result.nationality || '').trim();
        if (!nationality || nationality.length === 0) {
          nationality = 'UNK';
        }
        
        // 5.5 插入成绩
        const resultId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time, sprint_points, mountain_points) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [resultId, STAGE_ID, rankNum, riderId, teamId, nationality, timeGap, isSameTime, 0, 0]
        );

        insertedResults++;

        if (insertedResults % 50 === 0) {
          console.log(`  已导入 ${insertedResults}/${results.length}...`);
        }

      } catch (err) {
        console.error(`  错误 at rank ${result.rank} (${result.rider}):`, err.message);
        skippedResults++;
      }
    }

    console.log(`\n赛段成绩导入完成:`);
    console.log(`  - 成功: ${insertedResults} 条`);
    console.log(`  - 跳过: ${skippedResults} 条`);
    console.log(`  - 新车手: ${newRiders} 名`);
    console.log(`  - 新车队: ${newTeams} 支`);

    // 6. 导入领骑衫
    if (jerseys.length > 0) {
      console.log(`\n导入 ${jerseys.length} 件领骑衫...`);
      let jerseyInserted = 0;

      for (const jersey of jerseys) {
        try {
          const jerseyType = JERSEY_COLOR_MAP[jersey.bg_hex];
          if (!jerseyType) {
            console.log(`  跳过未知颜色: ${jersey.bg_hex} (${jersey.color})`);
            continue;
          }

          // 查找车手（PCS jersey name格式: "Surname Firstname"）
          let riderName = jersey.rider.trim();
          let riderNameLower = riderName.toLowerCase();
          
          // 尝试切换名姓顺序 (PCS: "Vingegaard Jonas" -> "Jonas Vingegaard")
          const parts = riderName.split(' ');
          if (parts.length === 2) {
            const reversed = `${parts[1]} ${parts[0]}`.toLowerCase();
            if (!riderCache[riderNameLower] && riderCache[reversed]) {
              riderNameLower = reversed;
            }
          }
          
          let riderId = riderCache[riderNameLower];
          if (!riderId) {
            // 宽松匹配
            for (const [name, id] of Object.entries(riderCache)) {
              if (name.includes(parts[parts.length - 1].toLowerCase()) &&
                  name.includes(parts[0].toLowerCase())) {
                riderId = id;
                riderNameLower = name;
                console.log(`  宽松匹配车手: ${riderName} -> ${name}`);
                break;
              }
            }
          }

          if (!riderId) {
            console.log(`  找不到车手: ${riderName}, 跳过领骑衫 ${jerseyType}`);
            continue;
          }

          // 查找车队
          let teamNameLower = jersey.team.toLowerCase();
          let teamId = teamCache[teamNameLower];

          const jerseyId = crypto.randomUUID();
          await conn.query(
            `INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)`,
            [jerseyId, STAGE_ID, jerseyType, riderId, teamId || riderId]
          );

          jerseyInserted++;
          console.log(`  ${jerseyType}: ${riderName} (${jersey.team})`);

        } catch (err) {
          console.error(`  领骑衫导入错误:`, err.message);
        }
      }

      console.log(`领骑衫导入完成: ${jerseyInserted} 件`);
    }

  } catch (err) {
    console.error('\n导入失败:', err.message);
    console.error(err.stack);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行导入
importStage14().then(() => {
  console.log('\n✅ 第14赛段数据导入完成！');
  process.exit(0);
}).catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
