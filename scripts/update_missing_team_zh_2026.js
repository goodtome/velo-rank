const path = require('path');
const mysql = require('mysql2/promise');
const { localDbConfig } = require('./lib/db-config');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'config', '.env') });

const DB_CONFIG = localDbConfig();

const DRY_RUN = process.argv.includes('--dry-run');

const TEAM_ZH_BY_NAME = {
  'Team Picnic PostNL': '荷兰邮政-Picnic车队',
  'Caja Rural-Seguros RGA': '西班牙农业银行-Seguros RGA车队',
  'St Michel-Preference Home-Auber 93': '圣米歇尔-Preference Home-Auber 93车队',
  'FDJ United-SUEZ': 'FDJ联合-SUEZ女子车队',
  'CANYON//SRAM zondacrypto': 'CANYON//SRAM zondacrypto女子车队',
  'EF Education-Oatly': 'EF教育-Oatly女子车队',
  'Burgos Burpellet BH': '布尔戈斯-Burpellet BH车队',
  'Euskaltel - Euskadi': '尤斯卡特尔-巴斯克车队',
  '25': '待核查车队（25）',
  'Equipo Kern Pharma': '凯恩制药车队',
  "Nice Métropole Côte d'Azur": "尼斯大都会-蔚蓝海岸车队",
  'CIC Pro Cycling Academy': 'CIC职业自行车学院队',
  'MBH Bank Ballan Telecom Fort': 'MBH银行-Ballan-Telecom Fort车队',
  'Lotto-Intermarché Ladies': '乐透-英特马诗女子车队',
  'Mayenne-Monbana-Mypie': '马耶讷-Monbana-Mypie车队',
  'Cofidis Women Team': '科菲迪斯女子车队',
  'Ma Petite Entreprise': 'Ma Petite Entreprise车队',
  'Picnic PostNL': '荷兰邮政-Picnic车队',
  'Hitec Products-Fluid Control': 'Hitec Products-Fluid Control女子车队',
  'Elite Fondations Cycling Team': 'Elite Fondations车队',
  'Petrolike': 'Petrolike车队',
  'MBH Bank': 'MBH银行车队',
  'Caja Rural': '西班牙农业银行车队',
  'Movistar': '移动之星车队',
  'China Anta - Mentech Cycling Team': '中国安踏-迈金科技车队',
  'Quick Pro Team': 'Quick Pro车队',
  'Australia': '澳大利亚国家队',
  'Roojai Insurance Winspace': 'Roojai保险-Winspace车队',
  'Fnix-SCOM-Hengxiang Cycling Team': '飞锐-SCOM-恒翔车队',
  'Citymesh-Customm Pro Cycling Team': 'Citymesh-Customm职业自行车队',
  'LX Cycling Team': 'LX自行车队',
  'ATT Investments': 'ATT Investments车队',
  'MG.K vis Costruzioni Ambiente': 'MG.K vis Costruzioni Ambiente车队',
  'Istanbul': '伊斯坦布尔车队',
  'Konya Buyuksehir Belediye': '科尼亚大都会市政车队',
  'Oman': '阿曼国家队',
  'Burgos BH': '布尔戈斯BH车队',
  'Mugla Büyüksehir Belediyesi': '穆拉大都会市政车队',
  'Biesse-Carrera Premac': 'Biesse-Carrera Premac车队',
  'Minimax Cycling Team': 'Minimax自行车队',
  'DAS-Hutchinson': 'DAS-Hutchinson女子车队',
  'Efapel Cycling': 'Efapel自行车队',
  'Spor Toto': 'Spor Toto车队',
  'Aviludo - Louletano - Loulé': 'Aviludo-Louletano-Loulé车队',
  'Feira dos Sofás - Boavista': 'Feira dos Sofás-Boavista车队',
  'Gi Group Holding - Simoldes - UDO': 'Gi Group Holding-Simoldes-UDO车队',
  'Tavfer - Ovos Matinados - Mortágua': 'Tavfer-Ovos Matinados-Mortágua车队',
  'Kern Pharma': '凯恩制药车队',
  'Visma Lease a Bike': '维斯玛-租赁自行车车队',
  'Anicolor / Campicarn Cycling Team': 'Anicolor / Campicarn车队',
  'Credibom - LA Alumínios - Marcos Car': 'Credibom-LA Alumínios-Marcos Car车队',
  'Nusantara Cycling Team': '努桑塔拉自行车队',
  'Team Tavira': '塔维拉车队',
  'Feirense - Beeceler': 'Feirense-Beeceler车队',
  'General Store-Essegibi-F.Ili Curia': 'General Store-Essegibi-F.Ili Curia车队',
  'APS Pro Cycling': 'APS职业自行车队',
  'Go for Gold Philippines': '菲律宾Go for Gold车队',
  'Grant Thornton Cycling Team': 'Grant Thornton自行车队',
  'Malaysia Pro Cycling': '马来西亚职业自行车队',
  'Team Vino-North Qazaqstan Region': 'Vino-北哈萨克斯坦地区车队',
  'Thailand Continental Cycling Team': '泰国洲际自行车队',
  'Wheeltop Rotor Chengdu Team': '成都轮峰-Rotor车队',
  'Thailand': '泰国国家队',
  'JAPAN NATIONAL TEAM': '日本国家队',
  'INEOS Grenadiers': '英力士-掷弹兵车队',
  'Team Technipes #inEmiliaRomagna Caffè Borbone': 'Technipes #inEmiliaRomagna Caffè Borbone车队',
  '7Eleven Cliqq Roadbike Philippines': '菲律宾7Eleven Cliqq Roadbike车队',
  'KSPO': '韩国体育振兴公团车队',
  'St Michel-Preference Home': '圣米歇尔-Preference Home车队',
  'Bodywrap LTWOO Cycling Team': 'Bodywrap蓝图车队',
  'St George Continental Cycling Team': '圣乔治洲际自行车队',
  'SC Padovani Polo Cherry Bank': 'SC Padovani Polo Cherry Bank车队',
  'EEW-VDK Cyclingteam': 'EEW-VDK自行车队',
  'Hongrie': '匈牙利国家队',
  'Italy': '意大利国家队',
  'Singapore': '新加坡国家队',
  'Solme - Olmo': 'Solme-Olmo车队',
  'United Shipping': 'United Shipping车队',
  'Decathlon CMA CGM Development Team': '迪卡侬达飞发展队',
  'Team Vorarlberg': '福拉尔贝格车队',
  'Pauwels Sauzen': 'Pauwels Sauzen车队',
  'Saudi Arabia': '沙特阿拉伯国家队',
  'Campana Imballagi': 'Campana Imballagi车队',
  'Team Abadie-Magnan': 'Abadie-Magnan车队',
  'The JoyRun & Hurricane Cycling Team': '乔瑞-飓风自行车队',
  'Austria': '奥地利国家队',
  'NEXETIS': 'NEXETIS车队',
  'Tudor Pro Cycling Team U23': '帝舵职业自行车U23队',
  'XDS Astana Development Team': 'XDS阿斯坦纳发展队',
  'BHS-PL Beton Bornholm': 'BHS-PL Beton Bornholm车队',
  'Liv AlUla Jayco Women’s Continental Team': 'Liv AlUla Jayco女子洲际队',
  'Metec-SOLARWATT p/b Mantel': 'Metec-SOLARWATT p/b Mantel车队',
  'Nu Colombia': 'Nu哥伦比亚车队',
  "O'SHEA Red Chilli Bikes": "O'SHEA Red Chilli Bikes车队",
  'Red Bull - BORA - hansgrohe Rookies (CT)': '红牛-博拉-汉斯格雅新秀队',
  'St Michel - Preference Home - Auber93 (CT)': '圣米歇尔-Preference Home-Auber93车队',
  'Soudal Quick-Step Devo Team': '苏达尔-快步发展队',
  'Sparkle Oita Racing Team': '大分Sparkle车队',
  'Team Nippo Nuovacomauto Obor': 'Nippo Nuovacomauto Obor车队',
  'Team Eurasia - IRC Tire': '欧亚-IRC轮胎车队',
  'MAT ATOM Deweloper Wroclaw': 'MAT ATOM Deweloper Wroclaw车队',
  'REMBE | rad-net women': 'REMBE | rad-net女子车队',
  'Team Lotto-Kern Haus Outlet Montabaur': '乐透-Kern Haus Outlet Montabaur车队',
  'UZBEKISTAN NATIONAL CYCLING TEAM': '乌兹别克斯坦国家自行车队',
  'Veloce Club Rouen 76': '鲁昂76自行车俱乐部',
  'Spain': '西班牙国家队',
  'Smurfit Westrock Cycling Team': 'Smurfit Westrock自行车队',
  'UAE Development Team': '阿联酋发展队',
  'LKT-Team': 'LKT车队',
  'Movistar Team Academy': '移动之星学院队',
  'Parkhotel Valkenburg': '瓦尔肯堡公园酒店车队',
  'Team Amani': 'Amani车队',
  'Red Bull-BORA-hansgrohe Rookies': '红牛-博拉-汉斯格雅新秀队',
  'Universe Cycling Team': 'Universe自行车队',
  'Atom 6 Bikes - Cycleur de Luxe - Auto Stroo Continental Team': 'Atom 6 Bikes-Cycleur de Luxe-Auto Stroo洲际队',
  'Belgium': '比利时国家队',
  'AG Insurance - Soudal Team (WTW)': 'AG保险-速达尔女子车队',
  'CANYON//SRAM (WTW)': 'CANYON//SRAM女子车队',
  'EF Education-Oatly (WTW)': 'EF教育-Oatly女子车队',
  'FDJ United - SUEZ (WTW)': 'FDJ联合-SUEZ女子车队',
  'Fenix-Premier Tech (WTW)': 'Fenix-Premier Tech女子车队',
  'Human Powered Health (WTW)': 'Human Powered Health女子车队',
  'Lidl - Trek (WTW)': '历德-崔克女子车队',
  'Liv AlUla Jayco (WTW)': 'Liv AlUla Jayco女子车队',
  'Movistar Team (WTW)': '移动之星女子车队',
  'Team Picnic PostNL (WTW)': '荷兰邮政-Picnic女子车队',
  'Team SD Worx - Protime (WTW)': 'SD Worx-Protime女子车队',
  'Team Visma | Lease a Bike (WTW)': '维斯玛-租赁自行车女子车队',
  'UAE Team ADQ (WTW)': '阿联酋ADQ女子车队',
  'Uno-X Mobility (WTW)': 'Uno-X Mobility女子车队'
};

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    const names = Object.keys(TEAM_ZH_BY_NAME);
    const [missing] = await conn.query(
      `SELECT team_name FROM teams
       WHERE (team_name_zh IS NULL OR team_name_zh = '')
       ORDER BY team_name`
    );
    const missingNames = missing.map(row => row.team_name);
    const uncovered = missingNames.filter(name => !TEAM_ZH_BY_NAME[name]);

    const plan = [];
    for (const [teamName, teamNameZh] of Object.entries(TEAM_ZH_BY_NAME)) {
      const [rows] = await conn.query(
        `SELECT id, uci_code, team_name, team_name_zh
         FROM teams
         WHERE team_name = ? AND (team_name_zh IS NULL OR team_name_zh = '')`,
        [teamName]
      );
      if (rows.length > 0) {
        plan.push({ teamName, teamNameZh, rows });
      }
    }

    console.log(JSON.stringify({
      dryRun: DRY_RUN,
      mappingCount: names.length,
      currentMissingCount: missingNames.length,
      uncovered,
      updateCount: plan.reduce((sum, item) => sum + item.rows.length, 0),
      plan
    }, null, 2));

    if (DRY_RUN) return;
    if (uncovered.length > 0) {
      throw new Error(`Uncovered teams remain: ${uncovered.join(', ')}`);
    }

    await conn.beginTransaction();
    try {
      let updated = 0;
      for (const [teamName, teamNameZh] of Object.entries(TEAM_ZH_BY_NAME)) {
        const [result] = await conn.query(
          `UPDATE teams
           SET team_name_zh = ?
           WHERE team_name = ? AND (team_name_zh IS NULL OR team_name_zh = '')`,
          [teamNameZh, teamName]
        );
        updated += result.affectedRows;
      }
      await conn.commit();
      console.log(JSON.stringify({ updated }, null, 2));
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
