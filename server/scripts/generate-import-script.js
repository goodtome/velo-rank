#!/usr/bin/env node
/**
 * 通用MySQL导入脚本生成器
 * 
 * 功能：
 * 1. 读取JSON格式的赛段数据文件
 * 2. 生成标准的MySQL导入SQL脚本
 * 3. 支持预览SQL脚本内容
 * 4. 支持通过Admin后台或命令行执行导入
 * 
 * 使用方法：
 *   node generate-import-script.js <数据文件路径> [--output <脚本路径>]
 * 
 * 数据文件格式（JSON）：
 * {
 *   "stage_info": {
 *     "race_code": "giro-ditalia-2026",
 *     "stage_number": 1,
 *     "stage_name": "Nessebar → Burgas",
 *     "date": "2026-05-10",
 *     "distance_km": 140,
 *     "stage_type": "Flat"
 *   },
 *   "results": [
 *     { "rank": 1, "rider_name": "Paul MAGNIER", "team_name": "SOUDAL QUICK-STEP", "time_gap": "3h 45' 12\"" }
 *   ],
 *   "jerseys": [
 *     { "jersey_type": "pink", "rider_name": "Paul MAGNIER", "team_name": "SOUDAL QUICK-STEP" }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 命令行参数解析
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
🚴 领骑 - MySQL导入脚本生成器

用法:
  node generate-import-script.js <数据文件路径> [--output <脚本路径>] [--preview]

参数:
  <数据文件路径>     JSON格式的赛段数据文件（必填）
  --output <路径>    输出SQL脚本文件路径（可选，默认输出到stdout）
  --preview          仅预览生成的SQL，不保存文件

示例:
  node generate-import-script.js ./data/stage1-results.json --output ./scripts/import-stage1.sql
  node generate-import-script.js ./data/stage1-results.json --preview

JSON数据格式：
{
  "stage_info": { "race_code": "...", "stage_number": 1, "stage_name": "...", "date": "YYYY-MM-DD", "distance_km": 100, "stage_type": "Flat" },
  "results": [ { "rank": 1, "rider_name": "...", "team_name": "...", "time_gap": "..." } ],
  "jerseys": [ { "jersey_type": "pink", "rider_name": "...", "team_name": "..." } ]
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

// ==================== SQL脚本生成 ====================

const stageInfo = data.stage_info;
const results = data.results;
const jerseys = data.jerseys || [];

// 生成安全的SQL字符串（转义单引号）
function sqlStr(str) {
  if (str === undefined || str === null) return "''";
  return `'${String(str).replace(/'/g, "\\'")}'`;
}

// 生成导入脚本
function generateImportScript() {
  const lines = [];
  const raceCode = stageInfo.race_code;
  const stageNumber = stageInfo.stage_number;
  const stageName = sqlStr(stageInfo.stage_name);
  const date = sqlStr(stageInfo.date);
  const distanceKm = stageInfo.distance_km || 0;
  const stageType = sqlStr(stageInfo.stage_type || 'Unknown');
  const stageCode = sqlStr(`${raceCode}-s${stageNumber}`);

  // 头部注释
  lines.push(`-- ============================================
-- 🚴 领骑 / Jersey - MySQL导入脚本
-- ============================================
-- 生成时间: ${new Date().toISOString()}
-- 赛事: ${raceCode}
-- 赛段: Stage ${stageNumber} - ${stageInfo.stage_name}
-- 日期: ${stageInfo.date}
-- 距离: ${stageInfo.distance_km}km
-- 类型: ${stageInfo.stage_type}
-- 
-- 成绩数量: ${results.length}
-- 领骑衫数量: ${jerseys.length}
-- ============================================
--
-- 使用方法:
--   1. 修改下方 DATABASE_PASSWORD 为实际密码
--   2. 执行: mysql -u root -p < import-stage${stageNumber}.sql
--
-- ============================================`);
  
  // 数据库设置
  lines.push(`
-- 设置数据库（请根据实际环境修改）
USE jersey_db;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;`);

  // 1. 获取或创建赛事
  lines.push(`
-- ============================================
-- 1. 处理赛事信息
-- ============================================`);
  lines.push(`INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season)
SELECT 
  '${uuidv4()}' AS id,
  'Giro d''Italia' AS race_name,
  'Giro d''Italia' AS race_name_en,
  '${raceCode}' AS race_code,
  'GRAND_TOUR' AS category,
  'MEN' AS gender,
  2026 AS season
WHERE NOT EXISTS (SELECT 1 FROM races WHERE race_code = '${raceCode}');`);

  // 2. 获取或创建赛段
  lines.push(`
-- ============================================
-- 2. 处理赛段信息
-- ============================================`);
  lines.push(`INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
SELECT 
  '${uuidv4()}' AS id,
  r.id AS race_id,
  ${stageNumber} AS stage_number,
  ${stageName} AS stage_name,
  ${date} AS date,
  ${distanceKm} AS distance_km,
  ${stageType} AS stage_type,
  ${stageCode} AS stage_code
FROM races r
WHERE r.race_code = '${raceCode}'
  AND NOT EXISTS (
    SELECT 1 FROM stages s 
    WHERE s.race_id = r.id AND s.stage_number = ${stageNumber}
  );`);

  // 3. 获取或创建车手和车队（使用临时表批量插入）
  lines.push(`
-- ============================================
-- 3. 创建临时表批量导入车手和车队
-- ============================================`);

  // 车手临时表
  lines.push(`CREATE TEMPORARY TABLE IF NOT EXISTS temp_riders (
  rider_name VARCHAR(255) PRIMARY KEY,
  nationality VARCHAR(10) DEFAULT 'UNK'
);`);

  // 提取所有车手
  const uniqueRiders = [...new Set(results.map(r => r.rider_name))];
  lines.push(`-- 车手数据 (${uniqueRiders.length} 条)`);
  uniqueRiders.forEach(name => {
    lines.push(`INSERT IGNORE INTO temp_riders (rider_name, nationality) VALUES (${sqlStr(name)}, 'UNK');`);
  });

  // 批量插入新车手到riders表
  lines.push(`
INSERT INTO riders (id, rider_name, nationality)
SELECT 
  UUID() AS id,
  tr.rider_name,
  tr.nationality
FROM temp_riders tr
LEFT JOIN riders r ON tr.rider_name = r.rider_name
WHERE r.id IS NULL;`);

  // 车队临时表
  lines.push(`\n-- 车队数据`);
  const uniqueTeams = [...new Set(results.map(r => r.team_name))];
  lines.push(`CREATE TEMPORARY TABLE IF NOT EXISTS temp_teams (
  team_name VARCHAR(255) PRIMARY KEY
);`);
  
  uniqueTeams.forEach(name => {
    lines.push(`INSERT IGNORE INTO temp_teams (team_name) VALUES (${sqlStr(name)});`);
  });

  lines.push(`
INSERT INTO teams (id, team_name)
SELECT 
  UUID() AS id,
  tt.team_name
FROM temp_teams tt
LEFT JOIN teams t ON tt.team_name = t.team_name
WHERE t.id IS NULL;`);

  // 4. 导入赛段成绩
  lines.push(`
-- ============================================
-- 4. 导入赛段成绩
-- ============================================`);
  
  results.forEach((result, index) => {
    const rank = result.rank;
    const riderName = sqlStr(result.rider_name);
    const teamName = sqlStr(result.team_name);
    const timeGap = sqlStr(result.time_gap);
    
    // 注释掉每一行的INSERT，使用批量方式
    lines.push(`-- ${rank}. ${result.rider_name} (${result.team_name})`);
  });

  lines.push(`
-- 使用临时表批量导入成绩
CREATE TEMPORARY TABLE IF NOT EXISTS temp_results (
  rank INT,
  rider_name VARCHAR(255),
  team_name VARCHAR(255),
  time_gap VARCHAR(50)
);`);

  results.forEach(result => {
    lines.push(`INSERT INTO temp_results (rank, rider_name, team_name, time_gap) VALUES (
  ${result.rank},
  ${sqlStr(result.rider_name)},
  ${sqlStr(result.team_name)},
  ${sqlStr(result.time_gap)}
);`);
  });

  lines.push(`
INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, time_gap, nationality)
SELECT 
  UUID() AS id,
  s.id AS stage_id,
  tr.\`rank\`,
  r.id AS rider_id,
  t.id AS team_id,
  tr.time_gap,
  'UNK' AS nationality
FROM temp_results tr
JOIN stages s ON s.race_id = (SELECT id FROM races WHERE race_code = '${raceCode}') AND s.stage_number = ${stageNumber}
JOIN riders r ON r.rider_name = tr.rider_name
JOIN teams t ON t.team_name = tr.team_name
ON DUPLICATE KEY UPDATE
  rider_id = VALUES(rider_id),
  team_id = VALUES(team_id),
  time_gap = VALUES(time_gap);`);

  // 5. 导入领骑衫
  if (jerseys.length > 0) {
    lines.push(`
-- ============================================
-- 5. 导入领骑衫持有者
-- ============================================`);
    
    jerseys.forEach(j => {
      lines.push(`-- ${j.jersey_type}: ${j.rider_name} (${j.team_name})`);
    });

    lines.push(`
INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
SELECT 
  UUID() AS id,
  s.id AS stage_id,
  jt.jersey_type,
  r.id AS rider_id,
  t.id AS team_id
FROM (
  SELECT * FROM (SELECT 'pink' AS jersey_type UNION ALL SELECT 'purple' UNION ALL SELECT 'blue' UNION ALL SELECT 'white') jt
) jt
JOIN (
  SELECT '${jerseys.map(j => j.jersey_type).join("' AS jersey_type UNION ALL SELECT '")}' AS jersey_type
) jlist ON jt.jersey_type = jlist.jersey_type
JOIN stages s ON s.race_id = (SELECT id FROM races WHERE race_code = '${raceCode}') AND s.stage_number = ${stageNumber}
JOIN riders r ON r.rider_name = ${sqlStr(jerseys[0]?.rider_name || '')}
JOIN teams t ON t.team_name = ${sqlStr(jerseys[0]?.team_name || '')}
-- 这里需要分别处理每个领骑衫，请根据实际数据调整`);

    // 实际领骑衫插入
    jerseys.forEach(j => {
      lines.push(`
INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
SELECT 
  UUID(),
  s.id,
  '${j.jersey_type}',
  r.id,
  t.id
FROM stages s
JOIN riders r ON r.rider_name = ${sqlStr(j.rider_name)}
JOIN teams t ON t.team_name = ${sqlStr(j.team_name)}
WHERE s.race_id = (SELECT id FROM races WHERE race_code = '${raceCode}')
  AND s.stage_number = ${stageNumber}
ON DUPLICATE KEY UPDATE rider_id = VALUES(rider_id), team_id = VALUES(team_id);`);
    });
  }

  // 清理临时表
  lines.push(`
-- ============================================
-- 6. 清理临时表
-- ============================================
DROP TEMPORARY TABLE IF EXISTS temp_riders;
DROP TEMPORARY TABLE IF EXISTS temp_teams;
DROP TEMPORARY TABLE IF EXISTS temp_results;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 导入完成
-- ============================================
SELECT CONCAT('✅ Stage ${stageNumber} 导入完成') AS status;`);

  return lines.join('\n');
}

// 主逻辑
const isPreview = args.includes('--preview');
const outputIndex = args.indexOf('--output');
const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;

console.log('🚴 领骑 - MySQL导入脚本生成器');
console.log('='.repeat(60));
console.log(`📂 数据文件: ${dataFile}`);
console.log(`📊 成绩数量: ${results.length}`);
console.log(`👕 领骑衫数量: ${jerseys.length}`);
console.log(`🏁 赛事: ${raceCode} / Stage ${stageNumber}`);
console.log('='.repeat(60));

const sqlScript = generateImportScript();

if (isPreview) {
  console.log('\n📄 生成的SQL脚本预览:\n');
  console.log(sqlScript);
  console.log('\n' + '='.repeat(60));
  console.log('✅ 脚本预览完成（未保存）');
} else if (outputFile) {
  fs.writeFileSync(outputFile, sqlScript, 'utf-8');
  console.log(`\n✅ 导入脚本已保存: ${outputFile}`);
  console.log(`\n📝 使用方法:`);
  console.log(`   mysql -u root -p < ${outputFile}`);
  console.log(`\n📋 或者通过Admin后台执行:`);
  console.log(`   访问 http://localhost:3000/admin/import`);
} else {
  console.log('\n📄 生成的SQL脚本:\n');
  console.log(sqlScript);
}

// 导出生成器函数供API调用
module.exports = { generateImportScript, sqlStr };
