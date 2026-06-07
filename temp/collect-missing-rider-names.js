require('dotenv').config();
const mysql = require('mysql2/promise');

// 收集所有没有中文姓名的车手
const unknownRiders = new Set();

async function collectUnknownRiders() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('📊 正在检查数据库...\n');

    // 获取所有字段不为空的车手
    const [riders] = await connection.query('''
      SELECT id, rider_name, rider_name_zh, nationality
      FROM riders
      WHERE rider_name_zh IS NULL OR rider_name_zh = ''
      ORDER BY rider_name
    ''');

    console.log(`找到 ${riders.length} 位缺少中文姓名的车手:\n`);

    // 显示前20位样本
    const sampleSize = Math.min(riders.length, 20);
    console.log('样本车手（前20位）:\n');

    for (let i = 0; i < sampleSize; i++) {
      const rider = riders[i];
      console.log(`${i + 1}. ${rider.rider_name} (${rider.nationality || '未知'})`);
      unknownRiders.add(rider.rider_name);
    }

    if (riders.length > sampleSize) {
      console.log(`\n... 还有 ${riders.length - sampleSize} 位车手未显示`);
    }

    console.log(`\n✅ 数据库检查完成，共 ${riders.length} 位车手需要翻译`);

    // 保存到文件以备后续处理
    const fs = require('fs');
    const outputPath = './missing-rider-names.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      total: riders.length,
      bicycles: Array.from(unknownRiders),
      generatedAt: new Date().toISOString()
    }, null, 2));

    console.log(`\n💾 日志已保存到: ${outputPath}`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

collectUnknownRiders();
