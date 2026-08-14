require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', 'config', '.env') });

const mysql = require('mysql2/promise');

function normalizeToken(token) {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
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
      SELECT rider_name
      FROM riders
      WHERE rider_name_zh IS NULL OR rider_name_zh = ''
    `);
    const counts = new Map();
    for (const row of rows) {
      for (const token of row.rider_name.replace(/[']/g, ' ').split(/[\s-]+/).filter(Boolean)) {
        const normalized = normalizeToken(token);
        if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }

    for (const [token, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300)) {
      console.log(`${token}: ${count}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
