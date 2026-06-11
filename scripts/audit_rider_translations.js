require('dotenv').config();

const mysql = require('mysql2/promise');

function hasHan(value) {
  return /[\u3400-\u9fff]/u.test(value || '');
}

function hasMojibake(value) {
  return /[\ufffd]|[\u00c0-\u00ff][\u0080-\uffff]?|[\u7edb\u951b\u9428\u93c2\u5b2a\u59af]/u.test(value || '');
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
  });

  try {
    const [rows] = await conn.query(`
      SELECT id, rider_name, rider_name_zh, rider_slug, nationality
      FROM riders
      ORDER BY rider_name
    `);

    const missing = [];
    const nonChinese = [];
    const mojibake = [];

    for (const row of rows) {
      const zh = (row.rider_name_zh || '').trim();
      if (!zh) {
        missing.push(row);
      } else if (hasMojibake(zh)) {
        mojibake.push(row);
      } else if (!hasHan(zh)) {
        nonChinese.push(row);
      }
    }

    console.log(JSON.stringify({
      total: rows.length,
      missing: missing.length,
      nonChinese: nonChinese.length,
      mojibake: mojibake.length,
      samples: {
        missing: missing.slice(0, 80),
        nonChinese: nonChinese.slice(0, 80),
        mojibake: mojibake.slice(0, 80)
      }
    }, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
