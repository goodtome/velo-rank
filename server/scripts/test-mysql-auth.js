/**
 * 尝试不同的MySQL连接方式
 */
const mysql = require('mysql2/promise');

async function tryConnect() {
  // 尝试1: 无密码无数据库
  console.log('尝试1: 无密码，不指定数据库');
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 13306,
      user: 'root',
      password: ''
    });
    console.log('✅ 连接成功！');
    await conn.end();
  } catch (err) {
    console.log('❌ 失败:', err.message);
  }
  
  // 尝试2: 空密码字符串
  console.log('\n尝试2: 空密码字符串');
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 13306,
      user: 'root',
      password: ''
    });
    console.log('✅ 连接成功！');
    await conn.end();
  } catch (err) {
    console.log('❌ 失败:', err.message);
  }
  
  // 尝试3: 不指定密码（undefined）
  console.log('\n尝试3: 不指定密码');
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 13306,
      user: 'root'
    });
    console.log('✅ 连接成功！');
    await conn.end();
  } catch (err) {
    console.log('❌ 失败:', err.message);
  }
}

tryConnect();
