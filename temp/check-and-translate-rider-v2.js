require('dotenv').config();
const mysql = require('mysql2/promise');
const https = require('https');
const http = require('http');
const fs = require('fs');

// 从网络获取车手中文姓名
async function fetchRiderNamesFromAPI(riderName) {
  try {
    // 尝试使用百度翻译API或其他翻译服务
    // 这里使用百度翻译API的示例（需要API Key）
    // 由于没有真实的API Key，我们先尝试一些常见的翻译渠道

    return null;
  } catch (error) {
    console.error(`获取翻译失败: ${riderName}`, error.message);
    return null;
  }
}

// 使用简单的字典映射作为临时方案
const genderNameMapping = {
  "Team Jumbo-Visma": "荷兰杰波莫-维斯玛车队",
  "Soudal Quick-Step": "索达尔快步车队",
  "UAE Team Emirates": "阿联酋航空车队",
  "Visma-Lease a Bike": "维斯马车队",
  "Red Bull-BORA-hansgrohe": "红牛车队",
  "Movistar Team": "Movistar 车队",
  "AG Insurance-Soudal Quick-Step": "AG保险车队",
  "dea":"戴尔",
  "Alpecin-Deceuninck": "阿佩辛",
  "EF Education-EasyPost": "EF教育车队",
  "Groupama-FDJ": "欢腾车队",
  "Lidl-Trek": "Lidl车队",
  "Bora-Hansgrohe": "博拉车队",
  "Cofidis": "科菲迪斯",
  "DSM-Firmenich PostNL": "DSM车队",
  "UAE Team Emirates-XRG": "阿联酋航空车队",
  "Uno-X Mobility": "诺克西车队",
  "Team TotalEnergies": "道达尔能源车队",
  "Trek-Segafredo": "捷豹车队",
  "Team Visma-Lease a Bike": "维斯马车队",
  "Soudal Quick-Step": "索达尔快步车队",
  "Inter Marc VDB": "INTER车队",
  "Team Jayco AlUla": "Jayco车队",
  "Team Picnic PostNL": "Picnic车队",
  "iltink Cycling Quick-Step": "iltink快步车队",
  "Israel-Premier Tech": "以色列先锋车队",
  "EF Education-EasyPost": "EF教育车队",
  "Uno-X Mobility Women": "诺克西女子车队",
  "Canyon-SRAM Racing": "峡谷车队",
  "Team Jumbo-Visma Women": "荷兰杰波莫女子车队",
  "EF Education-Townsend": "EF教育女子车队",
  "Human Powered Health": "HPH车队",
  "Cofidis Womens Pro Cycling Team": "科菲迪斯女子车队",
  "DSM-Firmenich PostNL":"DSM车队"
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

    // 记录需要额外翻译的车手
    const additionalTranslations = [];

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
    let extraFoundCount = 0;

    for (const rider of ridersWithoutZh) {
      const riderName = rider.rider_name.trim();
      let translatedName = genderNameMapping[riderName];

      if (!translatedName) {
        // 尝试解析车手信息
        // 通常格式为 "Team Name; Rider Name" 或 "Team Name Rider Name"
        const teamRiderParts = riderName.split(/[:;竞as，]/);

        if (teamRiderParts.length >= 2) {
          const teamName = teamRiderParts[0]?.trim() || '';
          translatedName = genderNameMapping[teamName];
        }
      }

      if (!translatedName) {
        notFoundCount++;
        additionalTranslations.push(riderName);
        console.log(`❌ 未找到翻译: ${riderName}`);
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
    console.log(`• 自动更新: ${updateCount} 位车手`);
    console.log(`• 未找到翻译: ${notFoundCount} 位车手`);

    // 4. 保存需要额外翻译的车手到文件
    if (additionalTranslations.length > 0) {
      const outputPath = './translations-needed.json';
      fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalNeeded: additionalTranslations.length,
        riders: additionalTranslations
      }, null, 2));

      console.log(`\n📝 需要额外翻译的车手已保存到: ${outputPath}`);
      console.log('🔍 建议后续处理这些车手的翻译');
    }

    // 5. 验证更新结果
    const [updatedRiders] = await connection.query('''
      SELECT
        COUNT(*) as count_all,
        SUM(CASE WHEN rider_name_zh IS NOT NULL AND rider_name_zh != '' THEN 1 ELSE 0 END) as count_translated
      FROM riders
    ''');

    console.log(`\n📊 当前数据库状态:`);
    console.log(`• 总车手数: ${updatedRiders[0].count_all}`);
    console.log(`• 已翻译: ${updatedRiders[0].count_translated}`);
    console.log(`• 翻译率: ${((updatedRiders[0].count_translated / updatedRiders[0].count_all) * 100).toFixed(1)}%`);

    // 提交事务
    await connection.commit();
    console.log('\n✅ 所有操作已成功提交');

    // 6. 显示翻译覆盖率
    const coverage = ((updatedRiders[0].count_translated / updatedRiders[0].count_all) * 100).toFixed(1);
    console.log(`\n📈 翻译覆盖率: ${coverage}%`);

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
