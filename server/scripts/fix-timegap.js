#!/usr/bin/env node
/**
 * 修复 time_gap / total_time 中的 PCS 解析异常
 * 
 * 问题模式：
 *   1. ",,X:XX" → "+X:XX"   (丢失 + 号)
 *   2. ",,"     → "+0:00"   (同时间车手)
 *   3. "*,,X:XX" → "*+X:XX" (带 * 标记的)
 *   4. "*X:XXX:XX" → "*X:XX" (带 * 的重复时间)
 *   5. Stage 19-20 的 "X:XX" → "+X:XX" (JSON 导入缺少 + 前缀)
 * 
 * 影响表：
 *   - stage_results.time_gap
 *   - general_classification.total_time
 *   - youth_classification.time
 *   - team_classification.total_time
 */

const mysql = require('mysql2/promise');
const { localDbConfig } = require('../../scripts/lib/db-config');

/**
 * 修复单个时间字符串
 */
function fixTime(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;

  // 特殊状态不处理
  if (['DNF', 'DNS', 'OTL', 'DSQ', 's.t.'].includes(s)) return s;

  let result = s;

  // Pattern 4: "*X:XXX:XX" → "*X:XX" (带 * 的重复时间，先处理)
  // e.g., "*0:570:57" → "*0:57", "*3:033:03" → "*3:03"
  const starDupMatch = result.match(/^\*(.+?)\1$/);
  if (starDupMatch) {
    result = '*' + starDupMatch[1];
  }

  // Pattern 3: "*,,X:XX" → "*+X:XX"
  if (result.startsWith('*,,')) {
    const rest = result.slice(3);
    result = '*+' + (rest || '0:00');
    return result;
  }

  // Pattern 1: ",,X:XX" → "+X:XX"
  if (result.startsWith(',,')) {
    const rest = result.slice(2);
    result = '+' + (rest || '0:00');
    return result;
  }

  // Pattern 2: bare ",," already handled above, but just in case
  if (result === ',,') return '+0:00';

  return result;
}

async function main() {
  const conn = await mysql.createConnection(localDbConfig());

  console.log('🔧 修复 time_gap / total_time 格式问题');
  console.log('='.repeat(60));

  // 定义需要修复的 (table, column) 对
  const targets = [
    { table: 'stage_results', column: 'time_gap', idColumn: 'id' },
    { table: 'general_classification', column: 'total_time', idColumn: 'id' },
    { table: 'youth_classification', column: 'time', idColumn: 'id' },  // youth 没有单独 id，用组合
    { table: 'team_classification', column: 'total_time', idColumn: 'id' },
  ];

  let grandTotal = 0;

  for (const target of targets) {
    const { table, column, idColumn } = target;
    console.log(`\n📋 处理 ${table}.${column}...`);

    // 查找所有可能有问题的记录
    // 条件：以 ",," 开头，或以 "*" 开头且包含 ",,", 或看起来像重复时间
    const [rows] = await conn.query(
      `SELECT ${idColumn} as id, ${column} as val FROM ${table} 
       WHERE ${column} LIKE ',,%' 
          OR ${column} LIKE '*,,%'
          OR ${column} LIKE '*%:%:%'`
    );

    if (rows.length === 0) {
      console.log('  无需修复');
      continue;
    }

    console.log(`  发现 ${rows.length} 条需修复`);

    // 批量更新（使用 CASE 语句或逐条更新）
    let fixed = 0;
    const batchSize = 500;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const updates = [];
      const ids = [];

      for (const row of batch) {
        const newVal = fixTime(row.val);
        if (newVal !== row.val) {
          updates.push({ id: row.id, oldVal: row.val, newVal });
          ids.push(row.id);
        }
      }

      // 逐条更新（批量 case when 对于大量数据更复杂）
      for (const upd of updates) {
        await conn.query(
          `UPDATE ${table} SET ${column} = ? WHERE ${idColumn} = ?`,
          [upd.newVal, upd.id]
        );
        fixed++;
      }
    }

    console.log(`  ✅ 已修复 ${fixed} 条`);
    if (fixed <= 10) {
      // 显示修复明细
      for (const row of rows.slice(0, 10)) {
        console.log(`    "${row.val}" → "${fixTime(row.val)}"`);
      }
    }
    grandTotal += fixed;
  }

  // ---- 额外修复：Stage 19-20 的 stage_results.time_gap 缺少 + 前缀 ----
  console.log('\n📋 修复 Stage 19-20 缺失的 + 前缀...');
  
  // 查找 stage 19 和 20 的 stage_id
  const [stageIds] = await conn.query(
    `SELECT s.id, s.stage_number FROM stages s 
     JOIN races r ON s.race_id = r.id 
     WHERE r.race_code = 'giro-ditalia-2026' AND s.stage_number IN (19, 20)`
  );

  let stageFixTotal = 0;
  for (const stage of stageIds) {
    // 找出缺少 + 前缀且不是特殊状态的记录
    const [needsFix] = await conn.query(
      `SELECT id, time_gap FROM stage_results 
       WHERE stage_id = ? AND time_gap IS NOT NULL AND time_gap != '' 
         AND time_gap NOT LIKE '+%' AND time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')
         AND time_gap REGEXP '^[0-9]'`,
      [stage.id]
    );

    let stageFix = 0;
    for (const row of needsFix) {
      await conn.query(
        'UPDATE stage_results SET time_gap = ? WHERE id = ?',
        ['+' + row.time_gap, row.id]
      );
      stageFix++;
    }
    console.log(`  Stage ${stage.stage_number}: 修复 ${stageFix} 条`);
    stageFixTotal += stageFix;
  }
  grandTotal += stageFixTotal;

  // ---- 汇总 ----
  console.log('\n' + '='.repeat(60));
  console.log(`📊 共修复 ${grandTotal} 条记录`);

  // 验证：检查是否还有残留问题
  console.log('\n🔍 验证残留问题...');
  const checks = [
    ['stage_results.time_gap 含",,"', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE ',,%'"],
    ['general_classification.total_time 含",,"', "SELECT COUNT(*) as cnt FROM general_classification WHERE total_time LIKE ',,%'"],
    ['youth_classification.time 含",,"', "SELECT COUNT(*) as cnt FROM youth_classification WHERE time LIKE ',,%'"],
    ['team_classification.total_time 含",,"', "SELECT COUNT(*) as cnt FROM team_classification WHERE total_time LIKE ',,%'"],
    ['stage_results.time_gap 含"*,"', "SELECT COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '*%' AND time_gap NOT LIKE '*+%'"],
  ];

  let allClean = true;
  for (const [label, sql] of checks) {
    const [r] = await conn.query(sql);
    const cnt = r[0].cnt;
    if (cnt > 0) {
      console.log(`  ⚠️ ${label}: ${cnt} 条`);
      allClean = false;
    } else {
      console.log(`  ✅ ${label}: 0 条`);
    }
  }

  if (allClean) console.log('\n🎉 所有异常格式已修复！');
  else console.log('\n⚠️ 仍有残留问题需要处理');

  await conn.end();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
