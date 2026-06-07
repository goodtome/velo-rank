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
  
  // 查询环意 Stage 1（Nessebar → Burgas）
  const [rows] = await conn.execute(`
    SELECT id, stage_number, stage_name, start_city, finish_city, 
           start_city_zh, finish_city_zh, stage_name_zh
    FROM stages 
    WHERE start_city = 'Nessebar' AND finish_city = 'Burgas'
    LIMIT 1
  `);
  
  if (rows.length > 0) {
    const s = rows[0];
    console.log('赛段ID:', s.id);
    console.log('赛段:', s.stage_number, s.stage_name);
    console.log('英文:', s.start_city, '→', s.finish_city);
    console.log('中文:', s.start_city_zh, '→', s.finish_city_zh);
    console.log('stage_name_zh:', s.stage_name_zh);
    console.log('start_city_zh 是否为空:', s.start_city_zh === null || s.start_city_zh === '');
    console.log('finish_city_zh 是否为空:', s.finish_city_zh === null || s.finish_city_zh === '');
  } else {
    console.log('未找到该赛段');
  }
  
  await conn.end();
}

main().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
