/**
 * 更新 teams 表：team_name_zh, team_slug, category
 * 基于 UCI 2026 官方名单交叉验证
 * 
 * UCI WorldTeams 2026 (18): Alpecin-Premier Tech, Bahrain Victorious, Decathlon CMA CGM,
 *   EF Education-EasyPost, Groupama-FDJ United, INEOS Grenadiers, Lidl-Trek,
 *   Lotto Intermarché, Movistar, NSN Cycling Team, Red Bull-Bora-Hansgrohe,
 *   Soudal Quick-Step, Team Jayco AlUla, Team Picnic PostNL, Team Visma|Lease a Bike,
 *   UAE Team Emirates XRG, Uno-X Mobility, XDS Astana
 * 
 * UCI ProTeams 2026 (16): Bardiani CSF, Burgos-BH, Caja Rural, Cofidis, Equipo Kern Pharma,
 *   Euskaltel-Euskadi, Flanders-Baloise, MBH Bank CSB, Modern Adventure, Novo Nordisk,
 *   Pinarello-Q36.5, Polti VisitMalta, Toscana Nippo Rali, TotalEnergies,
 *   Tudor Pro Cycling, Unibet Rose Rockets
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db',
  charset: 'utf8mb4'
};

// 完整更新数据
// key: uci_code (唯一标识), value: { team_name_zh, team_slug, category }
const updates = {
  // ===== UCI WORLD TEAMS 2026 =====
  
  // Alpecin–Premier Tech — WorldTeam ✅ (已有zh名，补slug)
  'APC': {
    team_name_zh: '欧倍青-博泰车队',
    team_slug: 'alpecin-premier-tech',
    category: 'UCI_WORLD_TEAM'
  },
  // Bahrain Victorious — WorldTeam ✅
  'TBV': {
    team_name_zh: '巴林胜利车队',
    team_slug: 'bahrain-victorious',
    category: 'UCI_WORLD_TEAM'
  },
  // Decathlon CMA CGM — WorldTeam ✅
  'DCT': {
    team_name_zh: '迪卡侬达飞车队',
    team_slug: 'decathlon-cma-cgm',
    category: 'UCI_WORLD_TEAM'
  },
  // EF Education–EasyPost — WorldTeam ✅
  'EFE': {
    team_name_zh: 'EF教育-易邮车队',
    team_slug: 'ef-education-easypost',
    category: 'UCI_WORLD_TEAM'
  },
  // Groupama–FDJ United — WorldTeam ✅
  'GFC': {
    team_name_zh: '安盟-FDJ车队',
    team_slug: 'groupama-fdj-united',
    category: 'UCI_WORLD_TEAM'
  },
  // INEOS Grenadiers (Netcompany INEOS) — WorldTeam ✅
  'IGD': {
    team_name_zh: '英力士-掷弹兵车队',
    team_slug: 'netcompany-ineos',
    category: 'UCI_WORLD_TEAM'
  },
  // Lidl–Trek — WorldTeam ✅
  'LTK': {
    team_name_zh: '历德-崔克车队',
    team_slug: 'lidl-trek',
    category: 'UCI_WORLD_TEAM'
  },
  // Lotto Intermarché — WorldTeam ✅ (WT主队)
  'LOI': {
    team_name_zh: '乐透-英特马诗车队',
    team_slug: 'lotto-intermarche',
    category: 'UCI_WORLD_TEAM'
  },
  // Movistar Team — WorldTeam ✅
  'MOV': {
    team_name_zh: '移动之星车队',
    team_slug: 'movistar-team',
    category: 'UCI_WORLD_TEAM'
  },
  // NSN Cycling Team — ⚠️ 由PRO提升为WT！
  'NSN': {
    team_name_zh: 'NSN车队',
    team_slug: 'nsn-cycling-team',
    category: 'UCI_WORLD_TEAM'
  },
  // Red Bull–Bora–Hansgrohe — WorldTeam ✅
  'RBH': {
    team_name_zh: '红牛-博拉-汉斯格雅车队',
    team_slug: 'red-bull-bora-hansgrohe',
    category: 'UCI_WORLD_TEAM'
  },
  // Soudal Quick-Step — WorldTeam ✅
  'SOQ': {
    team_name_zh: '苏达尔-快步车队',
    team_slug: 'soudal-quick-step',
    category: 'UCI_WORLD_TEAM'
  },
  // Team Jayco AlUla — WorldTeam ✅
  'JAY': {
    team_name_zh: '杰科-埃尔奥拉车队',
    team_slug: 'team-jayco-alula',
    category: 'UCI_WORLD_TEAM'
  },
  // Team Picnic PostNL — ⚠️ 由PRO提升为WT！
  'TPP': {
    team_name_zh: '荷兰邮政车队',
    team_slug: 'team-picnic-postnl',
    category: 'UCI_WORLD_TEAM'
  },
  // Team Visma | Lease a Bike — WorldTeam ✅
  'TVL': {
    team_name_zh: '维斯玛-租赁自行车车队',
    team_slug: 'team-visma-lease-a-bike',
    category: 'UCI_WORLD_TEAM'
  },
  // UAE Team Emirates XRG — WorldTeam ✅
  'UAE': {
    team_name_zh: '阿联酋航空-XRG车队',
    team_slug: 'uae-team-emirates-xrg',
    category: 'UCI_WORLD_TEAM'
  },
  // Uno-X Mobility — ⚠️ 由PRO提升为WT！
  'UXM': {
    team_name_zh: 'UNO-X车队',
    team_slug: 'uno-x-mobility',
    category: 'UCI_WORLD_TEAM'
  },
  // XDS Astana Team — WorldTeam ✅
  'XAT': {
    team_name_zh: 'XDS阿斯坦纳车队',
    team_slug: 'xds-astana-team',
    category: 'UCI_WORLD_TEAM'
  },

  // ===== UCI PRO TEAMS 2026 =====

  // Bardiani CSF — ProTeam ✅
  'VBF': {
    team_name_zh: '巴迪亚尼CSF车队',
    team_slug: 'bardiani-csf',
    category: 'UCI_PRO_TEAM'
  },
  // Pinarello Q36.5 — ProTeam ✅
  'Q36': {
    team_name_zh: 'Q36.5车队',
    team_slug: 'pinarello-q365-pro-cycling-team-2026',
    category: 'UCI_PRO_TEAM'
  },
  // Team Polti VisitMalta (PTK = ProTeam主队)
  'PTK': {
    team_name_zh: '波尔蒂-马耳他旅游车队',
    team_slug: 'team-polti-visitmalta',
    category: 'UCI_PRO_TEAM'
  },
  // Tudor Pro Cycling — ProTeam ✅
  'TUD': {
    team_name_zh: '帝舵车队',
    team_slug: 'tudor-pro-cycling-team-2026',
    category: 'UCI_PRO_TEAM'
  },
  // Unibet Rose Rockets — ProTeam ✅ (修复team_name_zh换行)
  'URR': {
    team_name_zh: '尤尼贝特玫瑰火箭车队',
    team_slug: 'unibet-rose-rockets',
    category: 'UCI_PRO_TEAM'
  },

  // ===== 降级/应属ProTeam但之前为null =====

  // Cofidis — ❌ 由WT降级为ProTeam
  'COF': {
    team_name_zh: '科菲迪斯车队',
    team_slug: 'cofidis',
    category: 'UCI_PRO_TEAM'
  },
  // Team Flanders–Baloise — ProTeam
  'TFB': {
    team_name_zh: '弗兰德斯-巴洛伊兹车队',
    team_slug: 'team-flanders-baloise',
    category: 'UCI_PRO_TEAM'
  },
  // Team Novo Nordisk — ProTeam
  'TNN': {
    team_name_zh: '诺和诺德车队',
    team_slug: 'team-novo-nordisk',
    category: 'UCI_PRO_TEAM'
  },
  // TotalEnergies — ProTeam
  'TEN': {
    team_name_zh: '道达尔能源车队',
    team_slug: 'totalenergies',
    category: 'UCI_PRO_TEAM'
  },

  // ===== CONTINENTAL / DEVELOPMENT TEAMS =====

  // Alpecin-Premier Tech (Dev/Continental) — 发展车队
  'APT': {
    team_name_zh: '欧倍青-博泰发展车队',
    team_slug: 'alpecin-premier-tech-devo',
    category: 'UCI_CONTINENTAL'
  },
  // Lotto Intermarché (Dev/Continental) — LIO = Lotto Dstny Development
  'LIO': {
    team_name_zh: '乐透发展车队',
    team_slug: 'lotto-dstny-development',
    category: 'UCI_CONTINENTAL'
  },
  // NSN Development Team — 发展车队
  'NDT': {
    team_name_zh: 'NSN发展车队',
    team_slug: 'nsn-development-team',
    category: 'UCI_CONTINENTAL'
  },
  // Pinarello-Q36.5 Pro Cycling (Dev/Continental) — 发展车队
  'PQT': {
    team_name_zh: 'Q36.5发展车队',
    team_slug: 'pinarello-q365-development',
    category: 'UCI_CONTINENTAL'
  },
  // Team Polti VisitMalta (PTV = Dev/Continental) — 发展车队
  'PTV': {
    team_name_zh: '波尔蒂发展车队',
    team_slug: 'team-polti-kometa-devo',
    category: 'UCI_CONTINENTAL'
  },

  // ===== 独立 Continental 车队 =====
  
  // AARCO
  'AAR': {
    team_name_zh: null,
    team_slug: 'aarco',
    category: 'UCI_CONTINENTAL'
  },
  // Atom 6 Bikes - Cycleur de Lux
  'A6C': {
    team_name_zh: null,
    team_slug: 'atom-6-bikes-cycleur-de-lux',
    category: 'UCI_CONTINENTAL'
  },
  // Baloise Verzekeringen - Het Pelckmans
  'BPL': {
    team_name_zh: null,
    team_slug: 'baloise-verzekeringen-het-pelckmans',
    category: 'UCI_CONTINENTAL'
  },
  // BEAT CC p/b SAXO
  'BCY': {
    team_name_zh: null,
    team_slug: 'beat-cc-pb-saxo',
    category: 'UCI_CONTINENTAL'
  },
  // EEW-VIKT Cyclingteam
  'EEW': {
    team_name_zh: null,
    team_slug: 'eew-vikt-cyclingteam',
    category: 'UCI_CONTINENTAL'
  },
  // Lucky Sport Cycling Team
  'LUC': {
    team_name_zh: null,
    team_slug: 'lucky-sport-cycling-team',
    category: 'UCI_CONTINENTAL'
  },
  // Pauwels Sauzen - Altez Indus (CX + Road)
  'PSA': {
    team_name_zh: null,
    team_slug: 'pauwels-sauzen-altez-indus',
    category: 'UCI_CONTINENTAL'
  },
  // Team ColoQuick — 丹麦
  'TCQ': {
    team_name_zh: null,
    team_slug: 'team-coloquick',
    category: 'UCI_CONTINENTAL'
  },
  // VolkerWessels Cycling Team — 荷兰
  'VWE': {
    team_name_zh: null,
    team_slug: 'volkerwessels-cycling-team',
    category: 'UCI_CONTINENTAL'
  },
};

async function main() {
  const pool = mysql.createPool(DB_CONFIG);
  const conn = await pool.getConnection();
  
  console.log('=== 开始更新 teams 表 ===\n');
  
  let updated = 0;
  let skipped = 0;
  const errors = [];
  
  for (const [uciCode, data] of Object.entries(updates)) {
    try {
      // 只更新非空字段
      const setClauses = [];
      const values = [];
      
      if (data.team_name_zh !== undefined) {
        setClauses.push('team_name_zh = ?');
        values.push(data.team_name_zh);
      }
      if (data.team_slug !== undefined) {
        setClauses.push('team_slug = ?');
        values.push(data.team_slug);
      }
      if (data.category !== undefined) {
        setClauses.push('category = ?');
        values.push(data.category);
      }
      
      if (setClauses.length === 0) {
        skipped++;
        continue;
      }
      
      values.push(uciCode);
      
      const sql = `UPDATE teams SET ${setClauses.join(', ')} WHERE uci_code = ?`;
      const [result] = await conn.query(sql, values);
      
      if (result.affectedRows > 0) {
        updated++;
        console.log(`✅ ${uciCode}: ${result.affectedRows} row(s) → ${data.category || '(keep)'} | ${data.team_name_zh || '(keep)'}`);
      } else {
        console.log(`⚠️  ${uciCode}: not found in DB`);
        skipped++;
      }
    } catch (err) {
      console.error(`❌ ${uciCode}: ${err.message}`);
      errors.push({ uciCode, error: err.message });
    }
  }
  
  // 验证结果
  console.log('\n=== 更新后统计 ===');
  const [stats] = await conn.query(`
    SELECT 
      category,
      COUNT(*) as cnt,
      SUM(CASE WHEN team_name_zh IS NULL OR team_name_zh = '' THEN 1 ELSE 0 END) as missing_zh,
      SUM(CASE WHEN team_slug IS NULL OR team_slug = '' THEN 1 ELSE 0 END) as missing_slug
    FROM teams
    GROUP BY category
    ORDER BY 
      CASE category 
        WHEN 'UCI_WORLD_TEAM' THEN 1 
        WHEN 'UCI_PRO_TEAM' THEN 2 
        WHEN 'UCI_CONTINENTAL' THEN 3 
        ELSE 4 
      END
  `);
  console.table(stats);
  
  // 检查仍缺失的记录
  console.log('\n=== 仍缺失 team_name_zh 的队伍 ===');
  const [missingZh] = await conn.query(
    'SELECT uci_code, team_name, category, country FROM teams WHERE team_name_zh IS NULL OR team_name_zh = "" ORDER BY category, team_name'
  );
  if (missingZh.length === 0) {
    console.log('✅ 所有车队都有中文名！');
  } else {
    for (const t of missingZh) {
      console.log(`  ${t.uci_code} | ${t.team_name} | ${t.category || '(null)'} | ${t.country}`);
    }
  }
  
  console.log('\n=== 仍缺失 team_slug 的队伍 ===');
  const [missingSlug] = await conn.query(
    'SELECT uci_code, team_name, category FROM teams WHERE team_slug IS NULL OR team_slug = "" ORDER BY category, team_name'
  );
  if (missingSlug.length === 0) {
    console.log('✅ 所有车队都有slug！');
  } else {
    for (const t of missingSlug) {
      console.log(`  ${t.uci_code} | ${t.team_name} | ${t.category || '(null)'}`);
    }
  }
  
  conn.release();
  await pool.end();
  
  console.log(`\n=== 完成：更新 ${updated} 条，跳过 ${skipped} 条，错误 ${errors.length} 条 ===`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
