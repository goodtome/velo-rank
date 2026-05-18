const mysql = require('mysql2/promise');
const dbConfig = require('./config/database');

async function checkRidersTable() {
  try {
    const conn = await mysql.createConnection({
      host: dbConfig.development.host,
      port: dbConfig.development.port,
      user: dbConfig.development.user,
      password: dbConfig.development.password,
      database: dbConfig.development.database
    });
    
    const [rows] = await conn.query('SHOW COLUMNS FROM riders');
    console.log('riders表的列：');
    rows.forEach(row => {
      console.log(`  - ${row.Field} (${row.Type})`);
    });
    
    await conn.end();
  } catch (err) {
    console.error('错误:', err.message);
  }
}

checkRidersTable();