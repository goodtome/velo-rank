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
  
  const [rows] = await conn.execute(`
    SELECT * FROM stages WHERE start_city = 'Nessebar' AND finish_city = 'Burgas' LIMIT 1
  `);
  
  if (rows.length > 0) {
    // 模拟 res.json({ code: 200, data: rows[0] }) 的行为
    const response = { code: 200, data: rows[0] };
    const jsonStr = JSON.stringify(response, null, 2);
    console.log('=== JSON 响应 ===');
    console.log(jsonStr);
    
    // 检查字段名
    console.log('\n=== data 中的字段 ===');
    console.log(Object.keys(response.data));
    
    // 检查 start_city_zh 的值
    console.log('\n=== start_city_zh 的值 ===');
    console.log('值:', response.data.start_city_zh);
    console.log('类型:', typeof response.data.start_city_zh);
    console.log('是否为空字符串:', response.data.start_city_zh === '');
    console.log('是否为 null:', response.data.start_city_zh === null);
    console.log('是否为 undefined:', response.data.start_city_zh === undefined);
  }
  
  await conn.end();
}

main().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
