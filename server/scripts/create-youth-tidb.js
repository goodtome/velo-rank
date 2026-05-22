const mysql = require('mysql2/promise');
(async () => {
  const tidb = await mysql.createConnection({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2A7GiKTCf4sRJLw.root',
    password: 'JkDXt0GyOnhMIagc',
    database: 'jersey_db',
    ssl: { rejectUnauthorized: true }
  });

  await tidb.execute(`
    CREATE TABLE IF NOT EXISTS youth_classification (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      stage_id varchar(36) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      rider_id varchar(36) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      \`rank\` int NOT NULL,
      \`time\` varchar(20) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      time_gap varchar(20) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      jersey_type varchar(20) COLLATE utf8mb4_0900_ai_ci DEFAULT 'WHITE',
      created_at timestamp DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_stage_rider (stage_id, rider_id),
      KEY idx_stage (stage_id),
      KEY idx_rider (rider_id)
    )
  `);
  console.log('youth_classification ok');

  const [result] = await tidb.query('SHOW TABLES');
  const tables = result.map(t => Object.values(t)[0]).sort();
  console.log('TiDB 表 (' + tables.length + '):', tables.join(', '));
  await tidb.end();
})();
