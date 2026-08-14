const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

const isProd = process.env.NODE_ENV === 'production';

const dbConfig = isProd
  ? {
      host: process.env.DB_HOST_PROD || process.env.DB_HOST,
      port: Number(process.env.DB_PORT_PROD || process.env.DB_PORT || 4000),
      user: process.env.DB_USER_PROD || process.env.DB_USER,
      password: process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME_PROD || process.env.DB_NAME || 'jersey_db',
      ssl: { rejectUnauthorized: true },
      multipleStatements: true
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 13306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'jersey_db',
      multipleStatements: true
    };

async function runMigration() {
  let conn;
  try {
    console.log(`Running database migrations [${isProd ? 'production' : 'development'}]...`);
    conn = await mysql.createConnection(dbConfig);

    const migrationsDir = path.join(__dirname, '../db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationFile = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationFile, 'utf8').trim();
      if (!sql) continue;

      console.log(`Executing ${file}`);
      await conn.query(sql);
    }

    console.log(`Migrations complete (${migrationFiles.length} file(s)).`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

runMigration();
