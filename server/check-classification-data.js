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
    
    console.log('🔍 检查 Stage 1 各 classification 数据...\n');
    
    // 检查 GC
    const [gc] = await connection.execute(`
      SELECT r.rider_name, gc.\`rank\`
      FROM general_classification gc
      JOIN stages s ON gc.stage_id = s.id
      JOIN riders r ON gc.rider_id = r.id
      WHERE s.stage_number = 1 AND gc.\`rank\` = 1
      LIMIT 1
    `);
    console.log('GC 第一名:', gc.length > 0 ? gc[0].rider_name : '未找到');
    
    // 检查 Points
    const [points] = await connection.execute(`
      SELECT r.rider_name, pc.\`rank\`
      FROM points_classification pc
      JOIN stages s ON pc.stage_id = s.id
      JOIN riders r ON pc.rider_id = r.id
      WHERE s.stage_number = 1 AND pc.\`rank\` = 1
      LIMIT 1
    `);
    console.log('Points 第一名:', points.length > 0 ? points[0].rider_name : '未找到');
    
    // 检查 Mountains
    const [mountains] = await connection.execute(`
      SELECT r.rider_name, mc.\`rank\`
      FROM mountains_classification mc
      JOIN stages s ON mc.stage_id = s.id
      JOIN riders r ON mc.rider_id = r.id
      WHERE s.stage_number = 1 AND mc.\`rank\` = 1
      LIMIT 1
    `);
    console.log('Mountains 第一名:', mountains.length > 0 ? mountains[0].rider_name : '未找到');
    
    // 检查 Youth
    const [youth] = await connection.execute(`
      SELECT r.rider_name, yc.\`rank\`
      FROM youth_classification yc
      JOIN stages s ON yc.stage_id = s.id
      JOIN riders r ON yc.rider_id = r.id
      WHERE s.stage_number = 1 AND yc.\`rank\` = 1
      LIMIT 1
    `);
    console.log('Youth 第一名:', youth.length > 0 ? youth[0].rider_name : '未找到');
    
    // 检查 points_classification 表中有多少条 rank=1 的记录
    console.log('\n🔍 检查数据重复问题...');
    const [duplicates] = await connection.execute(`
      SELECT s.stage_number, COUNT(*) as count
      FROM points_classification pc
      JOIN stages s ON pc.stage_id = s.id
      WHERE pc.\`rank\` = 1
      GROUP BY s.stage_number
      HAVING count > 1
    `);
    
    if (duplicates.length > 0) {
      console.log('⚠️  发现重复的 rank=1 记录:');
      duplicates.forEach(d => {
        console.log(`  Stage ${d.stage_number}: ${d.count} 条记录`);
      });
    } else {
      console.log('✅ 没有发现重复记录');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

main();
