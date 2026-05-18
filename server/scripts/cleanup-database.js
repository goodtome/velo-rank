#!/usr/bin/env node
/**
 * 数据库清洗脚本 - 修复车队/车手名称不统一问题
 * 
 * 问题：
 * 1. 同一支车队有多个名称变体（大小写、分隔符、前缀等）
 * 2. 车手名称格式不统一
 * 
 * 使用方法：
 *   node cleanup-database.js [--dry-run]
 */

const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// ==================== 车队名称标准化映射 ====================
// Key: 错误/重复的名称, Value: 标准名称（2026赛季官方名称）
const TEAM_NAME_MAP = {
  // Alpecin (2026: Alpecin - Deceuninck)
  'ALPECIN-PREMIER TECH': 'Alpecin - Deceuninck',
  
  // Arkéa (2026: Team Arkea - B&B Hotels)
  'Arkéa - B&B Hotels': 'Team Arkea - B&B Hotels',
  
  // Astana (2026: XDS Astana Team)
  'Astana Qazaqstan Team': 'XDS Astana Team',
  
  // Bahrain (2026: Bahrain - Victorious)
  'BAHRAIN VICTORIOUS': 'Bahrain - Victorious',
  
  // Bardiani (2026: Green Project Bardiani CSF Faizanè)
  'Bardiani CSF 7 Saber': 'Green Project Bardiani CSF Faizanè',
  'Green Project - Bardiani - CSF - Faizanè': 'Green Project Bardiani CSF Faizanè',
  
  // BORA (2026: Red Bull - BORA - Hansgrohe)
  'BORA - HANSGROHE': 'Red Bull - BORA - Hansgrohe',
  
  // Cofidis (2026: Team Cofidis)
  'Cofidis': 'Team Cofidis',
  
  // EF (2026: EF Education - Easypost)
  // 已有正确格式
  
  // Groupama (2026: Groupama - FDJ United)
  'GROUPAMA-FDJ UNITED': 'Groupama - FDJ United',
  
  // Ineos (2026: Team INEOS Grenadiers)
  'Netcompany INEOS': 'Team INEOS Grenadiers',
  
  // Intermarché (2026: Lotto Intermarché)
  'Intermarche - Wanty': 'Lotto Intermarché',
  
  // Israel (2026: Israel - Premier Tech)
  // 已有正确格式
  
  // Lidl-Trek (2026: Lidl - Trek)
  'LIDL-TREK': 'Lidl - Trek',
  
  // Movistar (2026: Movistar Team)
  // 已有正确格式
  
  // Q36.5 / Pinarello (2026: Q36.5 Pro Cycling)
  'PINARELLO-Q36.5 PRO CYCLING TEAM': 'Q36.5 Pro Cycling',
  
  // Quick-Step / Soudal (2026: Soudal Quick-Step)
  'Quick-Step Alpha Vinyl': 'Soudal Quick-Step',
  
  // Team DSM / PostNL (2026: Team Picnic PostNL)
  'Team DSM Firmenich PostNL': 'Team Picnic PostNL',
  
  // UAE (2026: UAE Team Emirates - XRG)
  'UAE TEAM EMIRATES XRG': 'UAE Team Emirates - XRG',
  
  // Uno-X (2026: Uno-X Mobility)
  'Unibet Tieto Rockets': 'Uno-X Mobility',
  
  // Visma (2026: Team Visma | Lease a Bike)
  'TEAM VISMA - LEASE A BIKE': 'Team Visma | Lease a Bike',
  
  // Tudor (2026: Tudor Pro Cycling Team)
  // 已有正确格式
  
  // Jayco (2026: Team Jayco AlUla)
  // 已有正确格式
  
  // Polti (2026: Team Polti VisitMalta)
  // 已有正确格式
  
  // TotalEnergies (2026: TotalEnergies)
  // 已有正确格式
};

async function cleanupDatabase() {
  const isDryRun = process.argv.includes('--dry-run');
  
  const conn = await mysql.createConnection({
    ...dbConfig.development,
    database: dbConfig.development.database
  });
  
  console.log('🧹 数据库清洗工具\n');
  console.log('='.repeat(60));
  if (isDryRun) {
    console.log('⚠️  预览模式 - 不会执行实际修改');
  }
  console.log('='.repeat(60) + '\n');
  
  try {
    // ==================== 1. 清洗车队数据 ====================
    console.log('1️⃣ 清洗车队数据...\n');
    
    const [teams] = await conn.query('SELECT * FROM teams ORDER BY team_name');
    console.log(`  找到 ${teams.length} 个车队记录`);
    
    let teamUpdateCount = 0;
    
    for (const [wrongName, correctName] of Object.entries(TEAM_NAME_MAP)) {
      // 查找错误名称的车队
      const [wrongTeams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [wrongName]);
      const [correctTeams] = await conn.query('SELECT * FROM teams WHERE team_name = ?', [correctName]);
      
      if (wrongTeams.length > 0 && correctTeams.length > 0) {
        const wrongId = wrongTeams[0].id;
        const correctId = correctTeams[0].id;
        
        console.log(`  🔄 ${wrongName}`);
        console.log(`     → ${correctName}`);
        
        if (!isDryRun) {
          // 更新 stage_results 中的 team_id
          const [updateResult] = await conn.query(
            'UPDATE stage_results SET team_id = ? WHERE team_id = ?',
            [correctId, wrongId]
          );
          console.log(`     ✅ 更新了 ${updateResult.affectedRows} 条成绩记录`);
          
          // 删除错误的车队记录
          await conn.query('DELETE FROM teams WHERE id = ?', [wrongId]);
          console.log(`     🗑️  删除错误记录: ${wrongName}`);
        } else {
          const [count] = await conn.query(
            'SELECT COUNT(*) as cnt FROM stage_results WHERE team_id = ?',
            [wrongId]
          );
          console.log(`     ℹ️  将更新 ${count[0].cnt} 条成绩记录 (预览模式)`);
        }
        
        teamUpdateCount++;
      }
    }
    
    console.log(`\n   ✅ 车队清洗完成: ${teamUpdateCount} 个重复项已处理\n`);
    
    // ==================== 2. 验证清洗结果 ====================
    console.log('2️⃣ 验证清洗结果...\n');
    
    const [finalTeams] = await conn.query('SELECT COUNT(*) as cnt FROM teams');
    const [finalResults] = await conn.query('SELECT COUNT(*) as cnt FROM stage_results');
    
    console.log(`  车队数: ${finalTeams[0].cnt}`);
    console.log(`  成绩数: ${finalResults[0].cnt}`);
    
    // 检查是否还有悬空的 team_id
    const [orphanResults] = await conn.query(`
      SELECT COUNT(*) as cnt 
      FROM stage_results sr
      LEFT JOIN teams t ON sr.team_id = t.id
      WHERE t.id IS NULL
    `);
    
    if (orphanResults[0].cnt > 0) {
      console.log(`\n   ⚠️  发现 ${orphanResults[0].cnt} 条成绩记录引用了不存在的车队！`);
    } else {
      console.log('\n   ✅ 所有成绩记录都引用了有效的车队');
    }
    
    console.log('\n' + '='.repeat(60));
    if (isDryRun) {
      console.log('🔍 预览完成 - 未执行实际修改');
      console.log('   运行不带 --dry-run 参数来执行实际清洗');
    } else {
      console.log('✅ 数据库清洗完成！');
    }
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 清洗失败:', err);
    throw err;
  } finally {
    await conn.end();
  }
}

// 主函数
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧹 数据库清洗工具

用法:
  node cleanup-database.js [--dry-run]

参数:
  --dry-run              预览模式，不执行实际修改
  --help, -h            显示帮助信息

示例:
  node cleanup-database.js --dry-run
  node cleanup-database.js
`);
    process.exit(0);
  }
  
  cleanupDatabase().catch(err => {
    console.error('失败:', err);
    process.exit(1);
  });
}

module.exports = { cleanupDatabase, TEAM_NAME_MAP };
