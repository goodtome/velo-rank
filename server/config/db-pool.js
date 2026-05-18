const mysql = require('mysql2/promise');
const dbConfig = require('./database');

const pool = mysql.createPool({
  host: dbConfig.development.host,
  port: dbConfig.development.port,
  user: dbConfig.development.user,
  password: dbConfig.development.password,
  database: dbConfig.development.database,
  charset: dbConfig.development.charset,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('MySQL数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL数据库连接失败:', err.message);
    console.log('请确保MySQL服务已启动，或先运行 npm run init-db 初始化数据库');
  });

module.exports = pool;
