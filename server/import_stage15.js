const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');

// 第15赛段信息
const STAGE_ID = 'aa458ebe-1ac6-47ec-b558-b884d1695a65';
const STAGE_CODE = 'giro-2026-s15';
const JSON_FILE = 'D:/codes/velo-rank/server/stage15_full.json';

// PCS jersey color mapping for Giro d'Italia
const JERSEY_COLOR_MAP = {
  '#FBA3AF': 'pink',
  '#EA529E': 'purple',
  '#0087EE': 'blue',
  '#f5f5f5': 'white',
};

async function importStage15() {
  let conn;
  let insertedResults = 0;
  let skippedResults = 0;
  let newRiders = 0;
  let newTeams = 0;

  try {
    console.log('读取数据文件:', JSON_FILE);
    const rawData = fs.readFileSync(JSON_FILE, 'utf8');
    const data = JSON.parse(rawData);
    
    const results = data.results || [];
    const jerseys = data.jersey_holders || [];
    
    console.log(`共 ${results.length} 条成绩数据, ${jerseys.length} 件领骑衫`);

    console.log('\n连接数据库...');
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 13306,
      user: 'root',
      password: 'mysql123456',
      database: 'jersey_db'
    });
    console.log('数据库连接成功！');

    console.log(`\n清空赛段 ${STAGE_CODE} 的现有数据...`);
    await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [STAGE_ID]);
    await conn.query('DELETE FROM jerseys WHERE stage_id = ?', [STAGE_ID]);
    await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [STAGE_ID]);
    console.log('旧数据已清理');

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

    console.log(`\n开始导入 ${results.length} 条赛段成绩...`);

    for (const result of results) {
      try {
        const rankNum = parseInt(result.rank);
        if (isNaN(rankNum)) {
          skippedResults++;
          continue;
        }

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
            if (newRiders <= 5) console.log(`  创建新车手: ${result.rider} [${result.nationality}]`);
          }
        }

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

        let timeGap = result.stage_time || '';
        let isSameTime = 0;
        if (timeGap === 's.t.' || timeGap === '' || timeGap === '0:00') {
          isSameTime = 1;
          timeGap = 's.t.';
        }
        if (timeGap.includes(',')) {
          timeGap = timeGap.replace(',', '.');
        }

        let nationality = (result.nationality || '').trim();
        if (!nationality || nationality.length === 0) {
          nationality = 'UNK';
        }
        
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

          let riderName = jersey.rider.trim();
          let riderNameLower = riderName.toLowerCase();
          
          const parts = riderName.split(' ');
          if (parts.length >= 2) {
            const reversed = parts.slice(1).join(' ') + ' ' + parts[0];
            if (!riderCache[riderNameLower] && riderCache[reversed.toLowerCase()]) {
              riderNameLower = reversed.toLowerCase();
            }
          }
          
          let riderId = riderCache[riderNameLower];
          if (!riderId) {
            for (const [name, id] of Object.entries(riderCache)) {
              const jerseyParts = riderNameLower.split(' ');
              if (jerseyParts.every(p => name.includes(p))) {
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
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

importStage15().then(() => {
  console.log('\n✅ 第15赛段数据导入完成！');
  process.exit(0);
}).catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
