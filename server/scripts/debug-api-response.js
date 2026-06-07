const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  
  // 查询环意 Stage 1 的完整字段
  const [rows] = await conn.execute(`
    SELECT * FROM stages WHERE start_city = 'Nessebar' AND finish_city = 'Burgas' LIMIT 1
  `);
  
  if (rows.length > 0) {
    const s = rows[0];
    console.log('=== 完整字段 ===');
    for (const [key, value] of Object.entries(s)) {
      console.log(`${key}: ${value === null ? 'null' : value}`);
    }
  }
  
  await conn.end();
}

main().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
