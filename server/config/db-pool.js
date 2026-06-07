const mysql = require('mysql2/promise');
const dbConfig = require('./database');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];
const isProd = env === 'production';

function readInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

if (!config) {
  throw new Error(`Unknown NODE_ENV: ${env}. Expected 'development' or 'production'`);
}

const poolConfig = {
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  charset: config.charset || 'utf8mb4',
  waitForConnections: true,
  connectionLimit: readInt('DB_POOL_CONNECTION_LIMIT', isProd ? 10 : 10),
  maxIdle: readInt('DB_POOL_MAX_IDLE', isProd ? 10 : 5),
  idleTimeout: readInt('DB_POOL_IDLE_TIMEOUT_MS', 60000),
  queueLimit: readInt('DB_POOL_QUEUE_LIMIT', isProd ? 100 : 0),
  connectTimeout: readInt('DB_CONNECT_TIMEOUT_MS', 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: readInt('DB_KEEPALIVE_INITIAL_DELAY_MS', 10000)
};

if (isProd) {
  poolConfig.ssl = {
    rejectUnauthorized: true
  };
}

const pool = mysql.createPool(poolConfig);

if (process.env.NODE_ENV !== 'test' && process.env.DB_SKIP_BOOT_CHECK !== '1') {
  pool.getConnection()
    .then(conn => {
      console.log(`MySQL 连接成功 [${env}] → ${config.host}:${config.port}/${config.database}`);
      conn.release();
    })
    .catch(err => {
      console.error(`MySQL 连接失败 [${env}]:`, err.message);
      console.log('请检查数据库配置和网络连接');
    });
}

module.exports = pool;
