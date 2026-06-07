require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTables() {
  const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const connection = await conn;
    const [rows] = await connection.query('SHOW TABLES');
    console.log('All tables in database:');
    rows.forEach(row => {
      console.log(JSON.stringify(row));
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
}

checkTables();
