/**
 * 简单数据库连接测试
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/config/.env' });

console.log('环境变量:');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('');

mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 13306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jersey_db'
})
.then(conn => {
  console.log('✅ 数据库连接成功！');
  return conn.query('SELECT 1+1 AS test');
})
.then(([rows]) => {
  console.log('✅ 查询测试通过:', rows[0]);
  process.exit(0);
})
.catch(err => {
  console.error('❌ 连接失败:', err.message);
  console.error('错误代码:', err.code);
  process.exit(1);
});
