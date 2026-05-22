const mysql = require('mysql2/promise');
const dbConfig = require('./database');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

if (!config) {
  throw new Error(`Unknown NODE_ENV: ${env}. Expected 'development' or 'production'`);
}

// TiDB Cloud (production) 需要 SSL
const poolConfig = {
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  charset: config.charset || 'utf8mb4',
  waitForConnections: true,
  connectionLimit: env === 'production' ? 5 : 10,
  queueLimit: 0
};

// 生产环境 TiDB Cloud 需要 SSL 连接
if (env === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: true
  };
}

const pool = mysql.createPool(poolConfig);

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log(`MySQL 连接成功 [${env}] → ${config.host}:${config.port}/${config.database}`);
    conn.release();
  })
  .catch(err => {
    console.error(`MySQL 连接失败 [${env}]:`, err.message);
    console.log('请检查数据库配置和网络连接');
  });

module.exports = pool;
