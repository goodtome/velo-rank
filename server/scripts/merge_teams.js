const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/config/.env' });

const merges = [
  { slave: 'e697cd81-5b77-47c2-b20d-c741ff6e232c', master: '3f06a960-172f-4568-b732-ac4fa83384a1', name: 'Alpecin' },
  { slave: 'b97a96e2-0d3c-494b-baa0-f7ae8c3ba2cc', master: 'b4b09d07-14cf-4374-933e-5142a3a627d4', name: 'Ineos' },
  { slave: 'dfc1fbb8-7116-45b1-ac5a-60316aa16b5b', master: '1e2547e7-4125-4a93-ae02-c0a89d556164', name: 'PostNL' }
];

const tables = ['general_classification', 'jerseys', 'stage_results', 'team_classification'];

async function mergeTeams() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    for (const { slave, master, name } of merges) {
      console.log(`Merging ${name}: ${slave} -> ${master}`);

      for (const table of tables) {
        // 检查 master 是否已经存在于该位置，以防更新后产生重复
        // 主要是检查涉及 (stage_id, team_id) 的唯一索引（如果有的话）
        // 针对 stage_results, general_classification, jerseys, team_classification 
        // 它们大部分是针对 (stage_id, rank) 或 (stage_id, rider_id) 的唯一索引
        // 所以直接更新 team_id 通常是安全的，除非同一个赛段同一个车队出现了两次记录
        
        const [result] = await conn.query(`UPDATE ${table} SET team_id = ? WHERE team_id = ?`, [master, slave]);
        console.log(`  Updated ${table}: ${result.affectedRows} rows`);
      }

      // 删除 Slave
      await conn.query('DELETE FROM teams WHERE id = ?', [slave]);
      console.log(`  Deleted slave team record.`);
    }

    console.log('✅ Team merge completed.');
  } catch (err) {
    console.error('Error merging teams:', err);
  } finally {
    await conn.end();
  }
}

mergeTeams();
