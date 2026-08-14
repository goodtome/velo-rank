const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', 'server', 'config', '.env') });

function localDbConfig(overrides = {}) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 13306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jersey_db',
    charset: 'utf8mb4',
    ...overrides
  };
}

function prodDbConfig(overrides = {}) {
  return {
    host: process.env.DB_HOST_PROD || process.env.DB_HOST,
    port: Number(process.env.DB_PORT_PROD || process.env.DB_PORT || 4000),
    user: process.env.DB_USER_PROD || process.env.DB_USER,
    password: process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME_PROD || process.env.DB_NAME || 'jersey_db',
    charset: 'utf8mb4',
    ssl: { rejectUnauthorized: true },
    ...overrides
  };
}

module.exports = {
  localDbConfig,
  prodDbConfig
};
