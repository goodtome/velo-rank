const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/config/.env' });

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS team_classification (
      id CHAR(36) PRIMARY KEY,
      stage_id CHAR(36) NOT NULL,
      \`rank\` INT NOT NULL,
      team_id CHAR(36) NOT NULL,
      total_time VARCHAR(50),
      time_gap VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_team_stage_rank (stage_id, \`rank\`),
      INDEX idx_team_stage (stage_id, \`rank\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await conn.query(sql);
  console.log("✅ team_classification 表创建成功");
  await conn.end();
}

migrate().catch(console.error);
