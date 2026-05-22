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
    
    console.log('🔍 验证领骑衫数据...\n');
    
    // 验证 Stage 1
    console.log('📍 Stage 1 领骑衫数据:');
    const [jerseys] = await connection.execute(`
      SELECT j.jersey_type, r.rider_name, t.team_name
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN riders r ON j.rider_id = r.id
      JOIN teams t ON j.team_id = t.id
      WHERE s.stage_number = 1
      ORDER BY j.jersey_type
    `);
    
    jerseys.forEach(j => {
      console.log(`  ${j.jersey_type} = ${j.rider_name} (${j.team_name})`);
    });
    
    console.log('\n🔍 验证各 classification 第一名 (Stage 1):\n');
    
    // 检查 GC 第一名
    const [gc] = await connection.execute(`
      SELECT r.rider_name, t.team_name
      FROM general_classification gc
      JOIN stages s ON gc.stage_id = s.id
      JOIN riders r ON gc.rider_id = r.id
      JOIN teams t ON gc.team_id = t.id
      WHERE s.stage_number = 1 AND gc.\`rank\` = 1
      LIMIT 1
    `);
    console.log(`  GC 第一名: ${gc.length > 0 ? gc[0].rider_name : '未找到'}`);
    
    // 检查 Points 第一名
    const [points] = await connection.execute(`
      SELECT r.rider_name, sr.team_id
      FROM points_classification pc
      JOIN stages s ON pc.stage_id = s.id
      JOIN riders r ON pc.rider_id = r.id
      JOIN stage_results sr ON pc.stage_id = sr.stage_id AND pc.rider_id = sr.rider_id
      WHERE s.stage_number = 1 AND pc.\`rank\` = 1
      LIMIT 1
    `);
    console.log(`  Points 第一名: ${points.length > 0 ? points[0].rider_name : '未找到'}`);
    
    // 检查 Mountains 第一名
    const [mountains] = await connection.execute(`
      SELECT r.rider_name, sr.team_id
      FROM mountains_classification mc
      JOIN stages s ON mc.stage_id = s.id
      JOIN riders r ON mc.rider_id = r.id
      JOIN stage_results sr ON mc.stage_id = sr.stage_id AND mc.rider_id = sr.rider_id
      WHERE s.stage_number = 1 AND mc.\`rank\` = 1
      LIMIT 1
    `);
    console.log(`  Mountains 第一名: ${mountains.length > 0 ? mountains[0].rider_name : '未找到'}`);
    
    // 检查 Youth 第一名
    const [youth] = await connection.execute(`
      SELECT r.rider_name, sr.team_id
      FROM youth_classification yc
      JOIN stages s ON yc.stage_id = s.id
      JOIN riders r ON yc.rider_id = r.id
      JOIN stage_results sr ON yc.stage_id = sr.stage_id AND yc.rider_id = sr.rider_id
      WHERE s.stage_number = 1 AND yc.\`rank\` = 1
      LIMIT 1
    `);
    console.log(`  Youth 第一名: ${youth.length > 0 ? youth[0].rider_name : '未找到'}`);
    
    // 检查是否有同一个车手持有多件领骑衫
    console.log('\n🔍 检查是否有同一个车手持有多件领骑衫 (所有赛段):\n');
    
    const [duplicates] = await connection.execute(`
      SELECT 
        s.stage_number,
        j1.jersey_type as jersey1,
        j2.jersey_type as jersey2,
        r.rider_name
      FROM jerseys j1
      JOIN jerseys j2 ON j1.stage_id = j2.stage_id AND j1.rider_id = j2.rider_id
      JOIN stages s ON j1.stage_id = s.id
      JOIN riders r ON j1.rider_id = r.id
      WHERE j1.jersey_type < j2.jersey_type
      ORDER BY s.stage_number, r.rider_name, j1.jersey_type
    `);
    
    if (duplicates.length > 0) {
      console.log('⚠️  发现同一个车手持有多件领骑衫:');
      duplicates.forEach(d => {
        console.log(`  Stage ${d.stage_number}: ${d.rider_name} 持有 ${d.jersey1} 和 ${d.jersey2}`);
      });
    } else {
      console.log('✅ 没有发现异常（每个领骑衫都是不同车手）');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

main();
