require('dotenv').config();
const mysql = require('mysql2/promise');

// 车手中文名字数据库 - 优先级1：车手具体姓名
const riderTranslations = {
  "Mathieu van der Poel": "马蒂厄·范德弗尔登",
  "Remco Evenepoel": "兰斯·雷姆科·埃文波勒",
  "Tadej Pogačar": "蒂亚戈·波加查",
  "Jonas Vingegaard": "乔纳斯·温格高",
  "Sepp Kuss": "塞普·库斯",
  "Wout van Aert": "沃特·范阿特",
  "Primož Roglič": "普里莫日·罗格里奇",
  "Biniam Girmay": "比尼阿姆·吉尔迈",
  "Juan Ayuso": "胡安·阿尤索",
  "Carlos Rodríguez": "卡洛斯·罗德里格斯",
  "Richard Carapaz": "理查德·卡拉斯普",
  "Mikel Landa": "米克尔·兰达",
  "Enric Mas": "埃里克·马斯",
  "Marc Soler": "马克·索列尔",
  "Rigoberto Uran": "里戈贝托·乌兰",
  "Nairo Quintana": "纳伊罗·昆塔纳",
  "Ion Izagirre": "伊翁·伊萨吉雷",
  "Julian Alaphilippe": "朱利安·阿拉菲利普",
  "Michael Matthews": "迈克尔·马修斯",
  "José Joaquín Rojas": "何塞·华金·罗哈斯",
  "Jaysumat": "贾苏吗特",
  "Bramme": "布拉姆",
  "Jasper Stuyven": "贾斯珀·斯图芬",
  "Christophe Laporte": "克里斯托夫·拉波特",
  "Oliver Naesen": "奥利弗·纳森",
  "Timm Brand": "蒂姆·布兰特",
  "Michael Woods": "迈克尔·伍兹",
  "Scott Sunderland": "斯科特·桑德兰",
  "Davide Villella": "达维德·维耶拉",
  "Giulio Ciccone": "朱利奥·奇科内",
  "Juan Sebastian Molina": "胡安·塞巴斯蒂安·莫利纳",
  "Adrien Costa": "阿德里安·科斯塔",
  "Brayan Cuesta": "布里扬·库埃斯塔",
  "Alexis Maucoups": "亚历克西·莫库普",
  "Jhon Edgar Bras": "约翰·埃德加·布拉",
  "Guillaume Boivin": "纪尧姆·博维",
  "Cristian Rodríguez": "克里斯蒂安·罗德里格斯",
  "Mathias Herrmann": "马蒂亚斯·赫尔曼",
  "Nils Politt": "尼尔斯·波利特",
  "Lars Van den Berg": "拉尔斯·范登贝格",
  "Oscar Onley": "奥斯卡·昂利",
  "Antonio Tiberi": "安东尼奥·蒂布里",
  "Nicolas Edet": "尼古拉·埃代特",
  "Tomo Vierendaal": "托莫·维伦道尔",
  "Tomasz Kwiatkowski": "托马兹·克维亚托科夫斯基",
  "Jonas Rickaert": "乔纳斯·里克阿尔特",
  "Bauke Mollema": "鲍克·莫勒马",
  "Romain Bardet": "罗曼·巴尔德",
  "Warren Barguil": "沃伦·巴尔吉",
  "Rui Costa": "鲁伊·科斯塔",
  "Évgenij Fedorov": "叶夫根尼·费奥多罗夫",
  "Nils Politt": "尼尔斯·波利特",
  "Tomasz Nowak": "托马什·诺瓦克",
  "Lukas Meissner": "卢卡斯·梅斯纳",
  "Kaden Groves": "卡登·格罗夫斯",
  "Ronaldo Acevedo": "罗纳尔多·阿塞韦多",
  "Richard Carapaz": "理查德·卡拉斯普",
  "Marc Hirschi": "马库斯·赫希",
  "Oliver Naesen": "奥利弗·纳森",
  "Julien Alaphilippe": "朱利安·阿拉菲利普",
  "Primož Roglič": "普里莫日·罗格里奇"
};

// 车队翻译（用于解析车手信息）
const teamTranslations = {
  "Team Jumbo-Visma": "荷兰杰波莫-维斯玛车队",
  "Soudal Quick-Step": "索达尔快步车队",
  "UAE Team Emirates": "阿联酋航空车队",
  "Visma-Lease a Bike": "维斯马车队",
  "Red Bull-BORA-hansgrohe": "红牛车队",
  "Movistar Team": "Movistar车队",
  "UAE Team Emirates-XRG": "阿联酋航空车队",
  "Deceuninck-Quick-Step": "Decuinch快步车队",
  "EF Education-EasyPost": "EF教育车队",
  "Groupama-FDJ": "欢腾车队",
  "Lidl-Trek": "Lidl车队",
  "Team TotalEnergies": "道达尔能源车队",
  "Trek-Segafredo": "捷豹车队",
  "Ineos Grenadiers": "英力士车队",
  "Team dsm-firmenich PostNL": "Dsm车队",
  "Bora-Hansgrohe": "博拉车队",
  "Inter Pro Cycling": "INTER车队",
  "Uno-X Mobility": "诺克西车队",
  "UAE Team Emirates AG",
  "Movistar Team Women": "Movistar女子车队",
  "Canyon-SRAM Racing": "峡谷-SRAM车队",
  "Team Jumbo-Visma Women": "荷兰杰波莫女子车队",
  "EF Education-Townsend": "EF教育女子车队",
  "Human Powered Health": "HPH车队",
  "Cofidis Womens Pro Cycling Team": "科菲迪斯女子车队",
  "Lidl-Trek Women": "Lidl女子车队",
  "DSM-Firmenich PostNL": "Dsm车队",
  "SD Worx-Pro cycling team": "Sd Worx车队",
  "Uno-X Mobility Women": "诺克西女子车队"
};

// 国家代码到中文
const countryMapping = {
  "NED": "荷兰",
  "BEL": "比利时",
  "CZE": "捷克",
  "ITA": "意大利",
  "ECU": "厄瓜多尔",
  "COL": "哥伦比亚",
  "FRA": "法国",
  "ESP": "西班牙",
  "GBR": "英国",
  "DNK": "丹麦",
  "SVK": "斯洛伐克",
  "SLO": "斯洛文尼亚",
  "TUR": "土耳其",
  "USA": "美国",
  "CAN": "加拿大",
  "AUS": "澳大利亚",
  "JPN": "日本",
  "KAZ": "哈萨克斯坦",
  "KOR": "韩国",
  "PHL": "菲律宾",
  "LUX": "卢森堡",
  "AUT": "奥地利",
  "FRA": "法国",
  "BLR": "白俄罗斯",
  "BRA": "巴西",
  "ARG": "阿根廷",
  "PER": "秘鲁",
  "GEO": "格鲁吉亚",
  "NZL": "新西兰",
  "ETH": "埃塞俄比亚",
  "UGA": "乌干达",
  "TTO": "特立尼达和多巴哥",
  "TUN": "突尼斯",
  "SYC": "塞舌尔",
  "MDA": "摩尔多瓦",
  "BMU": "百慕大",
  "BHR": "巴林",
  "IND": "印度",
  "IDN": "印尼",
  "THA": "泰国",
  "VNM": "越南",
  "LAO": "老挝",
  "MYS": "马来西亚",
  "KHM": "柬埔寨",
  "MMR": "缅甸",
  "NPL": "尼泊尔",
  "BGD": "孟加拉国",
  "MKD": "北马其顿",
  "HRV": "克罗地亚",
  "ROM": "罗马尼亚",
  "SWE": "瑞典",
  "NOR": "挪威",
  "FIN": "芬兰",
  "DEN": "丹麦",
  "ISL": "冰岛",
  "LIE": "列支敦士登",
  "POR": "葡萄牙",
  "IRL": "爱尔兰",
  "GRC": "希腊",
  "BUL": "保加利亚",
  "ALB": "阿尔巴尼亚",
  "MKD": "北马其顿",
  "BIH": "波黑",
  "KAZ": "哈萨克斯坦",
  "UZB": "乌兹别克斯坦",
  "KGZ": "吉尔吉斯斯坦",
  "TJK": "塔吉克斯坦",
  "TUR": "土耳其",
  "AZE": "阿塞拜疆",
  "GEO": "格鲁吉亚",
  "ARM": "亚美尼亚",
  "KWT": "科威特",
  "ARE": "阿联酋",
  "BAH": "巴林",
  "QAT": "卡塔尔",
  "OMN": "阿曼",
  "YEM": "也门",
  "JOR": "约旦",
  "LBN": "黎巴嫩",
  "SYR": "叙利亚",
  "ISR": "以色列",
  "LUX": "卢森堡",
  "MCO": "摩纳哥",
  "SMR": "圣马力诺",
  "VAT": "梵蒂冈"
};

async function translateName(name) {
  if (!name || name === '') return null;

  // 尝试直接匹配车手姓名
  if (riderTranslations[name]) {
    return riderTranslations[name];
  }

  // 尝试匹配车手姓名（去除特殊字符）
  const cleanName = name.trim().toLowerCase().replace(/[^\w\sáàâäéèêëïîôùûüç]/g, '');
  for (const [enName, zhName] of Object.entries(riderTranslations)) {
    const cleanEnName = enName.trim().toLowerCase().replace(/[^\w\sáàâäéèêëïîôùûüç]/g, '');
    if (cleanName === cleanEnName) {
      return zhName;
    }
    // 检查是否是车手姓名的子串
    if (cleanName.includes(cleanEnName.split(' ')[0]) || cleanEnName.split(' ')[0].includes(cleanName)) {
      return zhName;
    }
  }

  return null;
}

async function translateTeam(teamName) {
  if (!teamName) return null;

  // 尝试直接匹配车队
  if (teamTranslations[teamName]) {
    return teamTranslations[teamName];
  }

  // 尝试去除常见后缀
  if (teamTranslations[teamName.replace('Team', '')]) {
    return teamTranslations[teamName.replace('Team', '')];
  }

  if (teamTranslations[teamName.replace('Cycling Team', '')]) {
    return teamTranslations[teamName.replace('Cycling Team', '')];
  }

  if (teamTranslations[teamName.replace('Pro Cycling', '')]) {
    return teamTranslations[teamName.replace('Pro Cycling', '')];
  }

  if (teamTranslations[teamName.replace('Women', '')]) {
    return teamTranslations[teamName.replace('Women', '')];
  }

  return null;
}

// 解析车手信息并返回可能的中文名
function parseRiderInfo(filePath) {
  const parts = filePath.split(/[;谱]/); // 分隔符：分号或者a.in (ständ)

  for (const part of parts) {
    const translatedTeam = translateTeam(part.trim());
    if (translatedTeam) {
      return translatedTeam;
    }
  }

  return null;
}

async function checkAndTranslateRiderNames() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ 成功连接到数据库\n');

    // 开始事务
    await connection.beginTransaction();

    // 1. 检查当前数据
    console.log('📊 检查当前 riders 表中的数据...\n');

    const [riders] = await connection.query('''
      SELECT
        id,
        rider_name,
        rider_name_zh,
        nationality
      FROM riders
      ORDER BY rider_name
    ''');

    console.log(`总共 ${riders.length} 位车手\n`);

    const ridersWithoutZh = riders.filter(r => !r.rider_name_zh || r.rider_name_zh.trim() === '');
    console.log(`🔍 ${ridersWithoutZh.length} 位车手的中文姓名为空\n`);

    if (ridersWithoutZh.length === 0) {
      console.log('✅ 所有车手都已翻译中文姓名，无需更新\n');
      return;
    }

    // 2. 显示需要更新的车手
    console.log('📋 需要翻译的车手名单:\n');
    ridersWithoutZh.forEach((rider, index) => {
      console.log(`${index + 1}. ${rider.rider_name} (${rider.nationality || '未知'})`);
    });
    console.log('');

    // 3. 翻译并更新
    let updateCount = 0;
    let notFoundCount = 0;

    for (const rider of ridersWithoutZh) {
      const riderName = rider.rider_name.trim();
      let translatedName = null;

      // 方法1：直接翻译车手姓名
      translatedName = translateName(riderName);

      // 方法2：解析车手信息（车手+车队）
      if (!translatedName) {
        translatedName = parseRiderInfo(riderName);
      }

      if (!translatedName) {
        notFoundCount++;
        console.log(`\n❌ 未找到翻译: ${riderName} (${rider.nationality || '未知'})`);
      } else {
        // 更新数据库
        await connection.query(
          'UPDATE riders SET rider_name_zh = ? WHERE id = ?',
          [translatedName, rider.id]
        );
        updateCount++;
        console.log(`✅ ${riderName} → "${translatedName}"`);
      }
    }

    console.log(`\n📊 更新统计:`);
    console.log(`• 成功更新: ${updateCount} 位车手`);
    console.log(`• 未找到翻译: ${notFoundCount} 位车手`);

    // 4. 验证更新结果
    const [updatedRiders] = await connection.query('''
      SELECT
        COUNT(*) as count_all,
        SUM(CASE WHEN rider_name_zh IS NOT NULL AND rider_name_zh != '' THEN 1 ELSE 0 END) as count_translated
      FROM riders
    ''');

    console.log(`\n📊 更新后统计:`);
    console.log(`• 总车手数: ${updatedRiders[0].count_all}`);
    console.log(`• 已翻译: ${updatedRiders[0].count_translated}`);
    console.log(`• 翻译率: ${((updatedRiders[0].count_translated / updatedRiders[0].count_all) * 100).toFixed(1)}%`);

    // 提交事务
    await connection.commit();
    console.log('\n✅ 所有操作已成功提交');

  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('❌ 发生错误，已回滚事务:', error.message);
    } else {
      console.error('❌ 数据库连接错误:', error.message);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行脚本
checkAndTranslateRiderNames();
