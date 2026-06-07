require('dotenv').config();
const mysql = require('mysql2/promise');

// 简化的中文姓名映射（示例数据）
const riderNameTranslation = {
  //男子职业队名称
  "Team Jumbo-Visma": "荷兰杰波莫-维斯玛车队",
  "Soudal Quick-Step": "索达尔快步车队",
  "UAE Team Emirates": "阿联酋航空车队",
  "Visma-Lease a Bike": "维斯玛车队",
  "Red Bull-BORA-hansgrohe": "红牛车队",
  "Movistar Team": " Movistar 车队",
  "EF Education-EasyPost": "EF教育车队",
  "Groupama-FDJ": "欢腾车队",
  "Lidl-Trek": "Lidl车队能量车队", // 或者其他中文缩写
  "Inverse-SQL": "Inverse车队", // 假设的翻译

  //女子职业队名称
  "Uno-X Mobility": "诺克西移动车队",
  "Canyon-SRAM Racing": "峡谷-SRAM车队",
  "DSM-Firmenich PostNL": "DSM车队",
  "AG Insurance-Soudal Quick-Step": "AG保险车队",
  "Cofidis": "科菲迪斯车队",
  "Uno-X Women": "诺克西女子车队",
  "Fenix-Deceuninck": "冯尼斯车队",
  "Liv Racing AlUla": "Liv车队",
  "CTT Climas Loewe": "CTT车队",
  "Team Jumbo-Visma Women": "荷兰杰波莫女子车队",
  "EF Education-Townsend": "EF教育女子车队",
  "Human Powered Health": "HPH车队",

  //常见车手名字（部分示例）
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

  // 其他常见翻译
  "Juan Jose Cobo":"何塞·胡安·科沃",
  "Rigoberto Uran":"里戈贝托·乌兰",
  "Nairo Quintana":"纳伊罗·昆塔纳",
  "Iván Sosa":"伊万·罗萨",
  "Richard Carapaz":"理查德·卡拉斯普",
  "Mikel Landa":"米克尔·兰达",
  "Enric Mas":"埃里克·马斯",
  "Marc Soler":"马克·索列尔",
  "Albedo":"阿尔贝多",
  "Pogačar":"波加查"
};

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

    console.log(`总共 ${riders.length} 位车手:\n`);

    const ridersWithoutZh = riders.filter(r => !r.rider_name_zh || r.rider_name_zh === '');
    console.log(`🔍 ${ridersWithoutZh.length} 位车手的中文姓名为空\n`);

    if (ridersWithoutZh.length === 0) {
      console.log('✅ 所有车手都已翻译中文姓名，无需更新\n');
      return;
    }

    // 2. 显示需要更新的车手
    console.log('📋 需要翻译的车手名单:');
    ridersWithoutZh.forEach(rider => {
      console.log(`  • ${rider.rider_name} (${rider.nationality || '未知'})`);
    });
    console.log('');

    // 3. 翻译并更新
    let updateCount = 0;
    let notFoundCount = 0;

    for (const rider of ridersWithoutZh) {
      const riderName = rider.rider_name;
      const riderNameClean = riderName.trim();

      // 查找翻译
      let translatedName = riderNameTranslation[riderNameClean];

      if (!translatedName) {
        // 尝试提取车队名称进行翻译（通常车手名称格式为 "车队名称; 车手姓名"）
        const parts = riderName.split(';');
        if (parts.length >= 2) {
          const teamName = parts[0].trim();
          translatedName = riderNameTranslation[teamName];
        }

        if (!translatedName) {
          notFoundCount++;
          console.log(`❌ 未找到 "${riderName}" 的翻译`);
          continue;
        }
      }

      // 更新数据库
      await connection.query(
        'UPDATE riders SET rider_name_zh = ? WHERE id = ?',
        [translatedName, rider.id]
      );

      updateCount++;
      console.log(`✅ 已更新: ${riderName} → "${translatedName}"`);
    }

    console.log(`\n📊 更新统计:`);
    console.log(`• 成功更新: ${updateCount} 位车手`);
    console.log(`• 未找到翻译: ${notFoundCount} 位车手`);

    // 4. 验证更新结果
    const [updatedRiders] = await connection.query('''
      SELECT COUNT(*) as count
      FROM riders
      WHERE rider_name_zh IS NOT NULL AND rider_name_zh != ''
    ''');

    console.log(`\n✅ 当前有 ${updatedRiders[0].count} 位车手拥有中文姓名`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 运行脚本
checkAndTranslateRiderNames();
