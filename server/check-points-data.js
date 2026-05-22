const mysql = require('mysql2/promise');

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 13306,
      user: 'root',
      password: 'mysql123456',
      database: 'jersey_db'
    });
    
    console.log('🔍 检查 points_classification 表 (Stage 1, top 10):\n');
    
    const [rows] = await connection.execute(`
      SELECT pc.rider_id, r.rider_name, pc.rank, pc.points
      FROM points_classification pc
      JOIN stages s ON pc.stage_id = s.id
      JOIN riders r ON pc.rider_id = r.id
      WHERE s.stage_number = 1
      ORDER BY pc.rank ASC
      LIMIT 10
    `);
    
    rows.forEach(r => {
      console.log(`  ${r.rider_name}: rank=${r.rank}, points=${r.points}`);
    });
    
    console.log('\n🔍 检查 mountains_classification 表 (Stage 1, top 10):\n');
    
    const [rows2] = await connection.execute(`
      SELECT mc.rider_id, r.rider_name, mc.rank, mc.points
      FROM mountains_classification mc
      JOIN stages s ON mc.stage_id = s.id
      JOIN riders r ON mc.rider_id = r.id
      WHERE s.stage_number = 1
      ORDER BY mc.rank ASC
      LIMIT 10
    `);
    
    rows2.forEach(r => {
      console.log(`  ${r.rider_name}: rank=${r.rank}, points=${r.points}`);
    });
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

main();
