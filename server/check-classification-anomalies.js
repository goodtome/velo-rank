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
    
    console.log('🔍 检查所有赛段的 classification 数据是否异常...\n');
    
    // 检查每个赛段
    for (let stageNum = 1; stageNum <= 9; stageNum++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 Stage ${stageNum}`);
      console.log('='.repeat(60));
      
      // 获取该赛段的 points 和 mountains 第一名
      const [points] = await connection.execute(`
        SELECT r.rider_name, pc.points
        FROM points_classification pc
        JOIN stages s ON pc.stage_id = s.id
        JOIN riders r ON pc.rider_id = r.id
        WHERE s.stage_number = ?
        AND pc.rank = 1
        LIMIT 1
      `, [stageNum]);
      
      const [mountains] = await connection.execute(`
        SELECT r.rider_name, mc.points
        FROM mountains_classification mc
        JOIN stages s ON mc.stage_id = s.id
        JOIN riders r ON mc.rider_id = r.id
        WHERE s.stage_number = ?
        AND mc.rank = 1
        LIMIT 1
      `, [stageNum]);
      
      const [youth] = await connection.execute(`
        SELECT r.rider_name
        FROM youth_classification yc
        JOIN stages s ON yc.stage_id = s.id
        JOIN riders r ON yc.rider_id = r.id
        WHERE s.stage_number = ?
        AND yc.rank = 1
        LIMIT 1
      `, [stageNum]);
      
      console.log(`  Points 第一名: ${points.length > 0 ? points[0].rider_name + ' (' + points[0].points + '分)' : '未找到'}`);
      console.log(`  Mountains 第一名: ${mountains.length > 0 ? mountains[0].rider_name + ' (' + mountains[0].points + '分)' : '未找到'}`);
      console.log(`  Youth 第一名: ${youth.length > 0 ? youth[0].rider_name : '未找到'}`);
      
      // 检查是否同一个人
      if (points.length > 0 && mountains.length > 0 && points[0].rider_name === mountains[0].rider_name) {
        console.log(`  ⚠️  异常: Points 和 Mountains 第一名是同一个人！`);
      }
    }
    
    // 统计异常赛段数量
    console.log('\n' + '='.repeat(60));
    console.log('📊 异常数据统计');
    console.log('='.repeat(60) + '\n');
    
    const [anomalies] = await connection.execute(`
      SELECT 
        s.stage_number,
        COUNT(*) as anomaly_count
      FROM points_classification pc
      JOIN mountains_classification mc ON pc.stage_id = mc.stage_id AND pc.rider_id = mc.rider_id
      JOIN stages s ON pc.stage_id = s.id
      WHERE s.stage_number BETWEEN 1 AND 9
      AND pc.rank = 1 AND mc.rank = 1
      GROUP BY s.stage_number
    `);
    
    if (anomalies.length > 0) {
      console.log('⚠️  发现异常赛段（Points 和 Mountains 第一名相同）:');
      anomalies.forEach(a => {
        console.log(`  Stage ${a.stage_number}: ${a.anomaly_count} 条异常记录`);
      });
    } else {
      console.log('✅ 没有发现异常');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

main();
