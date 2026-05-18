/**
 * 导入 Stage 1 数据到数据库
 * 数据来源: giroditalia.it (agent-browser JS DOM extraction)
 * 赛段: Stage 1 - Nessebar / Несебър → Burgas / Бургас (2026-05-10)
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

// 读取解析好的数据（直接导出 JSON 对象）
const stage1ResultsData = require('./stage1-results-data.js');

// Stage 1 领骑衫数据（从 giroditalia.it 页面领奖台提取）
// 冠军: Paul MAGNIER (SOUDAL QUICK-STEP) - 粉衫持有者
const JERSEYS_DATA = [
  { jersey_type: 'pink',        rider: 'Paul MAGNIER',            team: 'SOUDAL QUICK-STEP'         },
  // blue/white/purple 领骑衫在 giroditalia.it 页面上未显示，仅有 Stage Winner
];

// Stage 1 赛段信息
const STAGE_INFO = {
  stage_number: 1,
  stage_name: 'Nessebar / Несебър - Burgas / Бургас',
  date: '2026-05-10',
  distance_km: 140,
  stage_type: 'Flat',
  stage_code: 'giro-2026-s1'
};

console.log('🚴 Stage 1 数据导入工具\n');
console.log('='.repeat(60));
console.log(`赛事: Giro d'Italia 2026`);
console.log(`赛段: Stage 1 - ${STAGE_INFO.stage_name} (${STAGE_INFO.date}, ${STAGE_INFO.distance_km}km)`);
console.log(`成绩数据: ${stage1ResultsData.total} 条`);
console.log(`领骑衫: ${JERSEYS_DATA.length} 件`);
console.log('='.repeat(60) + '\n');

function normalizeTeamName(name) {
  // 统一车队名称格式（去除多余空格）
  return name.replace(/\s+/g, ' ').trim();
}

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });

    console.log('✅ 数据库连接成功\n');

    // 1. 获取或创建赛事
    console.log('📋 1/5 处理赛事信息...');
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
    console.log('📋 2/5 处理赛段信息...');
    const [stages] = await conn.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, STAGE_INFO.stage_number]
    );

    let stageId;
    if (stages.length > 0) {
      stageId = stages[0].id;
      console.log(`  ℹ️  赛段已存在: Stage ${STAGE_INFO.stage_number} - ${STAGE_INFO.stage_name} (${stageId})\n`);
    } else {
      stageId = uuidv4();
      await conn.query(`
        INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        stageId,
        raceId,
        STAGE_INFO.stage_number,
        STAGE_INFO.stage_name,
        STAGE_INFO.date,
        STAGE_INFO.distance_km,
        STAGE_INFO.stage_type,
        STAGE_INFO.stage_code
      ]);
      console.log(`  ✅ 创建赛段: Stage ${STAGE_INFO.stage_number} - ${STAGE_INFO.stage_name} (${stageId})\n`);
    }

    // 3. 导入赛段成绩
    console.log('📊 3/5 导入赛段成绩...\n');

    let imported = 0;
    let skipped = 0;
    const batchSize = 50;

    // 使用事务批量导入
    await conn.query('START TRANSACTION');

    // 处理同名次（s.t. 共享排名）：为同名次的后续记录递增 rank
    const rankCount = new Map();
    const processedResults = stage1ResultsData.results.map(r => {
      const rawRank = r.rank;
      if (rawRank === null || rawRank === undefined || isNaN(rawRank)) return r;
      const count = (rankCount.get(rawRank) || 0) + 1;
      rankCount.set(rawRank, count);
      const effectiveRank = count === 1 ? rawRank : rawRank + count - 1;
      return { ...r, rank: effectiveRank };
    });

    for (const result of processedResults) {
      try {
        // 跳过无排名的记录
        if (result.rank === null || result.rank === undefined || isNaN(result.rank)) {
          skipped++;
          continue;
        }

        const riderName = result.rider.trim();
        const teamName = normalizeTeamName(result.team);
        const nationality = result.nationality || 'UNK';
        // time_gap 格式: "0:00" 表示领先/同时间, "+0:04" 表示落后
        const timeGap = result.gap || result.time || '';

        // 获取或创建车手
        const [riders] = await conn.query(
          'SELECT * FROM riders WHERE rider_name = ?',
          [riderName]
        );
        let riderId;
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
            [riderId, riderName, nationality]
          );
        }

        // 获取或创建车队
        const [teams] = await conn.query(
          'SELECT * FROM teams WHERE team_name = ?',
          [teamName]
        );
        let teamId;
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await conn.query(
            'INSERT INTO teams (id, team_name) VALUES (?, ?)',
            [teamId, teamName]
          );
        }

        // 插入成绩（使用 ON DUPLICATE KEY UPDATE 避免重复）
        await conn.query(`
          INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, result.rank, riderId, teamId, nationality, timeGap]);

        imported++;
        if (imported <= 10 || imported % 30 === 0) {
          console.log(`  ✅ ${String(result.rank).padStart(3)}. ${riderName.padEnd(30)} (${teamName.substring(0, 25)}) ${timeGap}`);
        }
      } catch (err) {
        skipped++;
        if (skipped <= 5) {
          console.error(`  ❌ 失败 [rank=${result.rank}] ${result.rider}:`, err.message);
        }
      }
    }

    await conn.query('COMMIT');
    console.log(`\n  📊 成绩导入完成: ${imported} 成功, ${skipped} 跳过\n`);

    // 4. 导入领骑衫
    console.log('📋 4/5 导入领骑衫...\n');

    let jerseyImported = 0;
    for (const j of JERSEYS_DATA) {
      try {
        const [riders] = await conn.query(
          'SELECT * FROM riders WHERE rider_name = ?',
          [j.rider]
        );
        if (riders.length === 0) {
          console.log(`  ⚠️  车手未找到: ${j.rider}，跳过`);
          continue;
        }
        const riderId = riders[0].id;

        const [teams] = await conn.query(
          'SELECT * FROM teams WHERE team_name = ?',
          [j.team]
        );
        if (teams.length === 0) {
          console.log(`  ⚠️  车队未找到: ${j.team}，跳过`);
          continue;
        }
        const teamId = teams[0].id;

        await conn.query(`
          INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id)
        `, [uuidv4(), stageId, j.jersey_type, riderId, teamId]);

        console.log(`  ✅ ${j.jersey_type}: ${j.rider} (${j.team})`);
        jerseyImported++;
      } catch (err) {
        console.error(`  ❌ ${j.jersey_type} ${j.rider}:`, err.message);
      }
    }
    console.log(`\n  📊 领骑衫导入完成: ${jerseyImported} 件\n`);

    // 5. 验证
    console.log('📋 5/5 验证数据...');
    const [resultCount] = await conn.query(
      'SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?',
      [stageId]
    );
    console.log(`  ✅ 数据库中该赛段成绩: ${resultCount[0].count} 条`);

    const [jerseyCount] = await conn.query(
      'SELECT COUNT(*) as count FROM jerseys WHERE stage_id = ?',
      [stageId]
    );
    console.log(`  ✅ 数据库中该赛段领骑衫: ${jerseyCount[0].count} 件\n`);

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

    console.log('🏆 数据库验证 - Stage 1 前10名：');
    console.log('排名 | 车手 | 车队 | 时间差');
    console.log('-'.repeat(80));
    top10.forEach(r => {
      console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(28)} | ${(r.team_name || '').padEnd(30)} | ${r.time_gap}`);
    });

    // 查询领骑衫
    const [jerseys] = await conn.query(`
      SELECT j.jersey_type, r.rider_name, t.team_name
      FROM jerseys j
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON j.team_id = t.id
      WHERE j.stage_id = ?
      ORDER BY j.jersey_type
    `, [stageId]);

    console.log('\n🎨 数据库验证 - Stage 1 领骑衫：');
    if (jerseys.length === 0) {
      console.log('  ℹ️  无领骑衫数据（giroditalia.it 页面未提供）');
    } else {
      jerseys.forEach(j => {
        console.log(`  ${j.jersey_type}: ${j.rider_name} (${j.team_name})`);
      });
    }

    // 查询总车队数和车手数
    const [teamStats] = await conn.query('SELECT COUNT(*) as count FROM teams');
    const [riderStats] = await conn.query('SELECT COUNT(*) as count FROM riders');
    console.log(`\n📈 数据库统计：`);
    console.log(`  车队: ${teamStats[0].count} 支`);
    console.log(`  车手: ${riderStats[0].count} 人`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Stage 1 数据导入完成！');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('❌ 导入失败:', err);
    if (conn) await conn.query('ROLLBACK');
  } finally {
    if (conn) await conn.end();
  }
}

main();
