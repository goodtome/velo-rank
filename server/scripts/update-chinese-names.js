const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db',
  waitForConnections: true,
  connectionLimit: 10
});

// 车队中文名称映射（英文名 → 中文名）
const TEAM_NAME_ZH_MAP = {
  'Team Visma | Lease a Bike': '维斯玛 | 租赁自行车车队',
  'Lidl - Trek': '利多尔 - 崔克车队',
  'UAE Team Emirates - XRG': '阿联酋航空 - XRG车队',
  'Soudal Quick-Step': '苏达尔 快步车队',
  'Team INEOS Grenadiers': '英力士 掷弹兵车队',
  'Movistar Team': '移动之星车队',
  'Bahrain - Victorious': '巴林胜利车队',
  'Red Bull - BORA - hansgrohe': '红牛 - 博拉 - 汉斯格雅车队',
  'Team Picnic PostNL': '珍宝 邮政车队',
  'Decathlon CMA CGM Team': '迪卡侬 CMA CGM车队',
  'Team Cofidis': '科菲迪斯车队',
  'Groupama - FDJ United': '安盟 - FDJ联合车队',
  'Team Alpecin - Deceuninck': '欧倍青 - 德库宁车队',
  'XDS Astana Team': 'XDS 阿斯塔纳车队',
  'Team Arkea - B&B Hotels': '阿克雅 - B&B酒店车队',
  'Uno-X Mobility': 'Uno-X 移动车队',
  'Team Jayco AlUla': '珍宝 阿尔乌拉车队',
  'Israel - Premier Tech': '以色列 - 博天车队',
  'Lotto Intermarché': '乐透 Intermarché车队',
  'EF Education - EasyPost': 'EF教育 - EasyPost车队',
  'Team Polti VisitMalta': '波尔蒂 马耳他旅游车队',
  'TotalEnergies': '道达尔能源车队',
  'Q36.5 Pro Cycling': 'Q36.5 职业自行车队',
  'Green Project Bardiani CSF Faizane': '绿色计划 巴迪亚尼 CSF车队',
  'Team Coop - Repsol': 'Coop - 雷普索尔车队',
  'Hrinkow Advarics': 'Hrinkow Advarics车队',
  'Nice Metropole': '尼斯大都会车队',
  'NSN Cycling Team': 'NSN自行车队'
};

// 车手中文名称映射（"名+姓"格式 → 中文名）
const RIDER_NAME_ZH_MAP = {
  'Milan Jonathan': '乔纳森·米兰',
  'Kooij Olav': '奥拉夫·库伊',
  'Groenewegen Dylan': '迪兰·格鲁内维根',
  'Philipsen Jasper': '贾斯珀·菲利普森',
  'Pogačar Tadej': '塔代伊·波加萨尔',
  'Vingegaard Jonas': '约纳斯·温格高',
  'Roglic Primož': '普里莫日·罗格里奇',
  'Evenepoel Remco': '雷姆科·埃费内普尔',
  'Van der Poel Mathieu': '马修·范德普尔',
  'Van Aert Wout': '沃特·范阿尔特',
  'Alaphilippe Julian': '朱利安·阿拉菲利普',
  'Cavendish Mark': '马克·卡文迪什',
  'Sagan Peter': '彼得·萨根',
  'Nibali Vincenzo': '温琴佐·尼巴利',
  'Froome Chris': '克里斯·弗鲁姆',
  'Thomas Geraint': '杰兰特·托马斯',
  'Dumoulin Tom': '汤姆·迪穆兰',
  'Bernal Egan': '埃甘·贝尔纳尔',
  'Yates Adam': '亚当·耶茨',
  'Yates Simon': '西蒙·耶茨',
  'Aular Orluis': '奥卢伊斯·奥拉尔',
  'Ciccone Giulio': '朱利奥·奇科内',
  'Magnier Paul': '保罗·马尼耶',
  'Sevilla Diego Pablo': '迭戈·巴勃罗·塞维利亚',
  'Christen Jan': '扬·克里斯特恩',
  'Morgado António': '安东尼奥·摩根纳多',
  'Narvaez Jhonatan': '约翰纳坦·纳瓦埃斯',
  'Silva Guillermo Thomas': '吉列尔莫·托马斯·席尔瓦',
  'Stork Florian': '弗洛里安·施托克',
  'Eulálio Afonso': '阿丰索·欧拉利奥',
  'Vlasov Aleksandr': '亚历山大·弗拉索夫',
  'Tiberi Antonio': '安东尼奥·蒂贝里',
  'Vendrame Andrea': '安德烈亚·文德拉梅',
  'Bettiol Alberto': '阿尔贝托·贝蒂奥利',
  'Krieger Alexander': '亚历山大·克里格尔',
  'Valter Attila': '阿蒂拉·瓦尔特长',
  'Leknessund Andreas': '安德烈亚斯·莱克内松',
  'Laurance Axel': '阿克塞尔·洛朗斯',
  'Zingle Axel': '阿克塞尔·津格尔',
  'Ballerini Davide': '达维德·巴莱里尼',
  'Barguil Warren': '沃伦·巴尔吉伊'
};

// 比赛中文名称映射
const RACE_NAME_ZH_MAP = {
  'Giro d\'Italia': '意大利自行车赛（环意）',
  'Tour de France': '环法自行车赛',
  'Vuelta a España': '环西自行车赛',
  'Tour de Suisse': '环瑞士自行车赛',
  'Paris - Roubaix': '巴黎-鲁贝古典赛',
  'Milano - San Remo': '米兰-圣雷莫古典赛',
  'Liege - Bastogne - Liege': '列日-巴斯托涅-列日古典赛',
  'La Fleche Wallonne': '瓦隆之箭古典赛',
  'Strade Bianche': '白路古典赛',
  'Amstel Gold Race': '阿姆斯特尔黄金赛'
};

async function updateChineseNames() {
  const conn = await pool.getConnection();
  
  try {
    console.log('=== 开始更新中文名称 ===\n');
    
    // 1. 更新车队中文名称
    console.log('1. 更新车队中文名称...');
    let teamUpdateCount = 0;
    for (const [teamName, teamNameZh] of Object.entries(TEAM_NAME_ZH_MAP)) {
      const [result] = await conn.query(
        'UPDATE teams SET team_name_zh = ? WHERE team_name = ?',
        [teamNameZh, teamName]
      );
      if (result.affectedRows > 0) {
        teamUpdateCount += result.affectedRows;
        console.log(`   ✓ ${teamName} → ${teamNameZh}`);
      }
    }
    console.log(`   ✓ 共更新 ${teamUpdateCount} 个车队的中文名称\n`);
    
    // 2. 更新车手中文名称
    console.log('2. 更新车手中文名称...');
    let riderUpdateCount = 0;
    for (const [riderName, riderNameZh] of Object.entries(RIDER_NAME_ZH_MAP)) {
      const [result] = await conn.query(
        'UPDATE riders SET rider_name_zh = ? WHERE rider_name = ?',
        [riderNameZh, riderName]
      );
      if (result.affectedRows > 0) {
        riderUpdateCount += result.affectedRows;
        console.log(`   ✓ ${riderName} → ${riderNameZh}`);
      }
    }
    console.log(`   ✓ 共更新 ${riderUpdateCount} 个车手的中文名称\n`);
    
    // 3. 更新比赛中文名称
    console.log('3. 更新比赛中文名称...');
    let raceUpdateCount = 0;
    for (const [raceName, raceNameZh] of Object.entries(RACE_NAME_ZH_MAP)) {
      const [result] = await conn.query(
        'UPDATE races SET race_name_zh = ? WHERE race_name = ?',
        [raceNameZh, raceName]
      );
      if (result.affectedRows > 0) {
        raceUpdateCount += result.affectedRows;
        console.log(`   ✓ ${raceName} → ${raceNameZh}`);
      }
    }
    console.log(`   ✓ 共更新 ${raceUpdateCount} 个比赛的中文名称\n`);
    
    // 4. 更新赛段中文名称（根据 stage_name 模式匹配）
    console.log('4. 更新赛段中文名称...');
    const [stages] = await conn.query('SELECT id, stage_name FROM stages');
    let stageUpdateCount = 0;
    
    for (const stage of stages) {
      if (stage.stage_name && stage.stage_name.includes('→')) {
        const parts = stage.stage_name.split('→').map(s => s.trim());
        if (parts.length === 2) {
          const stageNameZh = `${parts[0]} → ${parts[1]}`; // 暂时直接使用原名
          const [result] = await conn.query(
            'UPDATE stages SET stage_name_zh = ? WHERE id = ?',
            [stageNameZh, stage.id]
          );
          stageUpdateCount += result.affectedRows;
        }
      }
    }
    console.log(`   ✓ 共更新 ${stageUpdateCount} 个赛段的中文名称\n`);
    
    // 5. 显示更新统计
    console.log('=== 更新完成统计 ===');
    const [teamStats] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN team_name_zh IS NOT NULL THEN 1 ELSE 0 END) as translated FROM teams');
    console.log(`车队: ${teamStats[0].translated}/${teamStats[0].total} 已翻译`);
    
    const [riderStats] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN rider_name_zh IS NOT NULL THEN 1 ELSE 0 END) as translated FROM riders');
    console.log(`车手: ${riderStats[0].translated}/${riderStats[0].total} 已翻译`);
    
    const [raceStats] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN race_name_zh IS NOT NULL THEN 1 ELSE 0 END) as translated FROM races');
    console.log(`比赛: ${raceStats[0].translated}/${raceStats[0].total} 已翻译`);
    
    const [stageStats] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN stage_name_zh IS NOT NULL THEN 1 ELSE 0 END) as translated FROM stages');
    console.log(`赛段: ${stageStats[0].translated}/${stageStats[0].total} 已翻译`);
    
    console.log('\n=== 更新完成 ===');
    
  } catch (err) {
    console.error('更新失败:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

// 命令行参数处理
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
用法: node update-chinese-names.js [选项]

选项:
  --help, -h     显示帮助信息
  --dry-run      仅预览要更新的内容，不实际执行

示例:
  node update-chinese-names.js
  node update-chinese-names.js --dry-run
  `);
  process.exit(0);
}

const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log('=== 预览模式（不会实际更新数据库）===\n');
  console.log('车队中文映射数量:', Object.keys(TEAM_NAME_ZH_MAP).length);
  console.log('车手中文映射数量:', Object.keys(RIDER_NAME_ZH_MAP).length);
  console.log('比赛中文映射数量:', Object.keys(RACE_NAME_ZH_MAP).length);
  console.log('\n预览完成');
} else {
  updateChineseNames().catch(console.error);
}
