#!/usr/bin/env node
/**
 * 通用赛段成绩导入脚本
 * 
 * 用法：
 *   node import-stage.js <数据文件路径> [--config <配置文件路径>]
 * 
 * 数据文件（JSON）：
 * {
 *   "stage_info": { "race_code": "giro-ditalia-2026", "stage_number": 1, ... },
 *   "results": [ { "rank": 1, "rider_name": "...", "team_name": "...", "time_gap": "..." } ],
 *   "jerseys": [ { "jersey_type": "pink", "rider_name": "...", "team_name": "..." } ]
 * }
 * 
 * 配置文件（可选，JSON）：
 * {
 *   "race_code": "giro-ditalia-2026",
 *   "stage_number": 1,
 *   "stage_name": "Nessebar → Burgas",
 *   "date": "2026-05-10",
 *   "distance_km": 140,
 *   "stage_type": "Flat"
 * }
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

// 命令行参数解析
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
🚴 领骑 - 通用赛段成绩导入工具

用法:
  node import-stage.js <数据文件路径> [--config <配置文件路径>]

参数:
  <数据文件路径>     JSON格式的赛段数据文件（必填）
  --config <路径>    配置文件路径（可选，用于补充赛段信息）
  --dry-run          预览模式，不实际执行数据库操作

示例:
  # 基本用法
  node import-stage.js ./data/stage1-results.json

  # 使用配置文件
  node import-stage.js ./data/stage1-results.json --config ./config/stage1.json

  # 预览模式
  node import-stage.js ./data/stage1-results.json --dry-run

数据文件格式（JSON）：
{
  "stage_info": {
    "race_code": "giro-ditalia-2026",
    "stage_number": 1,
    "stage_name": "Nessebar → Burgas",
    "date": "2026-05-10",
    "distance_km": 140,
    "stage_type": "Flat"
  },
  "results": [
    { "rank": 1, "rider_name": "Paul MAGNIER", "team_name": "SOUDAL QUICK-STEP", "time_gap": "3h 45' 12\"" }
  ],
  "jerseys": [
    { "jersey_type": "pink", "rider_name": "Paul MAGNIER", "team_name": "SOUDAL QUICK-STEP" }
  ]
}
`);
  process.exit(0);
}

// 加载数据文件
const dataFile = args.find(a => !a.startsWith('--'));
if (!dataFile) {
  console.error('❌ 请指定数据文件路径');
  process.exit(1);
}

if (!fs.existsSync(dataFile)) {
  console.error(`❌ 文件不存在: ${dataFile}`);
  process.exit(1);
}

let data;
try {
  const content = fs.readFileSync(dataFile, 'utf-8');
  data = JSON.parse(content);
} catch (err) {
  console.error('❌ 无法解析JSON文件:', err.message);
  process.exit(1);
}

// 验证必需字段
if (!data.stage_info) {
  console.error('❌ 数据文件缺少 stage_info 字段');
  process.exit(1);
}

if (!data.results || !Array.isArray(data.results)) {
  console.error('❌ 数据文件缺少 results 数组');
  process.exit(1);
}

// 加载配置文件（可选）
const configIndex = args.indexOf('--config');
const configFile = configIndex !== -1 ? args[configIndex + 1] : null;
let config = null;

if (configFile) {
  if (!fs.existsSync(configFile)) {
    console.error(`❌ 配置文件不存在: ${configFile}`);
    process.exit(1);
  }
  try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  } catch (err) {
    console.error('❌ 无法解析配置文件:', err.message);
    process.exit(1);
  }
}

// 合并配置
const stageInfo = { ...config, ...data.stage_info };
const results = data.results;
const jerseys = data.jerseys || [];
const isDryRun = args.includes('--dry-run');

// 打印导入信息
console.log('🚴 领骑 - 赛段成绩导入工具');
console.log('='.repeat(60));
console.log(`📂 数据文件: ${dataFile}`);
console.log(`📊 成绩数量: ${results.length}`);
console.log(`👕 领骑衫数量: ${jerseys.length}`);
console.log(`🏁 赛事: ${stageInfo.race_code}`);
console.log(`📍 赛段: Stage ${stageInfo.stage_number} - ${stageInfo.stage_name || 'N/A'}`);
console.log(`📅 日期: ${stageInfo.date || 'N/A'}`);
console.log(`📏 距离: ${stageInfo.distance_km || 'N/A'}km`);
console.log(`🏷️  类型: ${stageInfo.stage_type || 'N/A'}`);
if (isDryRun) console.log('\n⚠️  预览模式 - 不会执行数据库操作');
console.log('='.repeat(60));

// 主函数
async function main() {
  let conn;
  try {
    if (!isDryRun) {
      conn = await mysql.createConnection({
        ...dbConfig.development,
        database: dbConfig.development.database
      });
      console.log('✅ 数据库连接成功\n');
    } else {
      console.log('🔍 预览模式 - 跳过数据库连接\n');
    }

    // 1. 获取或创建赛事
    console.log('📋 1/5 处理赛事信息...');
    const raceCode = stageInfo.race_code;
    
    if (!isDryRun) {
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
    } else {
      console.log('  ℹ️  预览: 赛事检查\n');
    }

    // 2. 获取或创建赛段
    console.log('📋 2/5 处理赛段信息...');
    const stageNumber = stageInfo.stage_number;
    const stageName = stageInfo.stage_name || `Stage ${stageNumber}`;
    const stageDate = stageInfo.date || '2026-01-01';
    const distanceKm = stageInfo.distance_km || 0;
    const stageType = stageInfo.stage_type || 'Unknown';
    
    if (!isDryRun) {
      const [stages] = await conn.query(
        'SELECT * FROM stages WHERE race_id = (SELECT id FROM races WHERE race_code = ?) AND stage_number = ?',
        [raceCode, stageNumber]
      );
      
      let stageId;
      if (stages.length > 0) {
        stageId = stages[0].id;
        console.log(`  ℹ️  赛段已存在: Stage ${stageNumber} (${stageId})\n`);
      } else {
        stageId = uuidv4();
        const stageCode = `${raceCode}-s${stageNumber}`;
        await conn.query(`
          INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
          VALUES (?, (SELECT id FROM races WHERE race_code = ?), ?, ?, ?, ?, ?, ?)
        `, [stageId, raceCode, stageNumber, stageName, stageDate, distanceKm, stageType, stageCode]);
        console.log(`  ✅ 创建赛段: Stage ${stageNumber} - ${stageName} (${stageId})\n`);
      }
    } else {
      console.log(`  ℹ️  预览: 赛段 ${stageNumber} - ${stageName}\n`);
    }

    // 3. 导入赛段成绩
    console.log('📊 3/5 导入赛段成绩...\n');
    
    let imported = 0;
    let skipped = 0;
    
    if (!isDryRun) {
      for (const result of results) {
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
            VALUES (?, (SELECT id FROM stages WHERE race_id = (SELECT id FROM races WHERE race_code = ?) AND stage_number = ?), ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              rider_id = VALUES(rider_id),
              team_id = VALUES(team_id),
              time_gap = VALUES(time_gap)
          `, [uuidv4(), raceCode, stageNumber, result.rank, riderId, teamId, 'UNK', result.time_gap]);
          
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
    } else {
      console.log(`  ℹ️  预览: 将导入 ${results.length} 条成绩记录\n`);
      results.slice(0, 10).forEach(r => {
        console.log(`  👉 ${r.rank}. ${r.rider_name} (${r.team_name}) - ${r.time_gap}`);
      });
      if (results.length > 10) {
        console.log(`  ... 还有 ${results.length - 10} 条`);
      }
      imported = results.length;
    }
    
    console.log(`\n  📊 成绩处理完成: ${imported} 成功, ${skipped} 失败\n`);
    
    // 4. 验证
    console.log('📋 4/5 验证数据...');
    if (!isDryRun) {
      const [count] = await conn.query(
        'SELECT COUNT(*) as count FROM stage_results sr JOIN stages s ON sr.stage_id = s.id WHERE s.race_id = (SELECT id FROM races WHERE race_code = ?) AND s.stage_number = ?',
        [raceCode, stageNumber]
      );
      console.log(`  ✅ 数据库中该赛段共有 ${count[0].count} 条成绩记录\n`);
      
      // 查询前10名
      const [top10] = await conn.query(`
        SELECT sr.rank, r.rider_name, t.team_name, sr.time_gap
        FROM stage_results sr
        JOIN riders r ON sr.rider_id = r.id
        JOIN teams t ON sr.team_id = t.id
        JOIN stages s ON sr.stage_id = s.id
        WHERE s.race_id = (SELECT id FROM races WHERE race_code = ?) AND s.stage_number = ?
        ORDER BY sr.rank
        LIMIT 10
      `, [raceCode, stageNumber]);
      
      console.log('🏆 数据库验证 - 前10名：');
      console.log('排名 | 车手 | 车队 | 时间差');
      console.log('-'.repeat(80));
      top10.forEach(r => {
        console.log(`${String(r.rank).padEnd(6)} | ${r.rider_name.padEnd(25)} | ${t.team_name.padEnd(30)} | ${r.time_gap}`);
      });
    } else {
      console.log('  ℹ️  预览: 跳过数据库验证\n');
    }
    
    // 5. 导入领骑衫
    if (jerseys.length > 0) {
      console.log('\n📋 5/5 导入领骑衫...');
      
      if (!isDryRun) {
        for (const jersey of jerseys) {
          try {
            const [riders] = await conn.query('SELECT * FROM riders WHERE rider_name = ?', [jersey.rider_name]);
            const [teams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [jersey.team_name]);
            
            if (riders.length === 0 || teams.length === 0) {
              console.error(`  ❌ 找不到车手或车队: ${jersey.rider_name} / ${jersey.team_name}`);
              continue;
            }
            
            const riderId = riders[0].id;
            const teamId = teams[0].id;
            
            await conn.query(`
              INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
              VALUES (?, (SELECT id FROM stages WHERE race_id = (SELECT id FROM races WHERE race_code = ?) AND stage_number = ?), ?, ?, ?)
              ON DUPLICATE KEY UPDATE rider_id = VALUES(rider_id), team_id = VALUES(team_id)
            `, [uuidv4(), raceCode, stageNumber, jersey.jersey_type, riderId, teamId]);
            
            console.log(`  ✅ ${jersey.jersey_type}: ${jersey.rider_name} (${jersey.team_name})`);
          } catch (err) {
            console.error(`  ❌ 失败 ${jersey.jersey_type} ${jersey.rider_name}:`, err.message);
          }
        }
      } else {
        jerseys.forEach(j => {
          console.log(`  👉 ${j.jersey_type}: ${j.rider_name} (${j.team_name})`);
        });
      }
    } else {
      console.log('\n📋 5/5 领骑衫: 无数据\n');
    }
    
    console.log('\n' + '='.repeat(60));
    if (isDryRun) {
      console.log('🔍 预览完成 - 未执行数据库操作');
    } else {
      console.log('🎉 数据导入完成！');
    }
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 导入失败:', err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
