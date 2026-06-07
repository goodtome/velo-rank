const mysql = require('mysql2/promise');
require('dotenv').config();

const prodConfig = {
  host: process.env.DB_HOST_PROD,
  port: parseInt(process.env.DB_PORT_PROD) || 4000,
  user: process.env.DB_USER_PROD,
  password: process.env.DB_PASSWORD_PROD,
  database: process.env.DB_NAME_PROD,
  ssl: { rejectUnauthorized: true }
};

const ddl = `
CREATE TABLE team_classification (
  id char(36) NOT NULL,
  stage_id char(36) NOT NULL,
  \`rank\` int NOT NULL,
  team_id char(36) NOT NULL,
  total_time varchar(50) DEFAULT NULL,
  time_gap varchar(50) DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_team_stage_rank (stage_id, \`rank\`),
  KEY idx_team_stage (stage_id, \`rank\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function run() {
  try {
    const c = await mysql.createConnection(prodConfig);
    await c.query(ddl);
    console.log('Table created successfully');
    await c.end();
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
