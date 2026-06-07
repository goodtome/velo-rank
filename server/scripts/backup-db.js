/**
 * 数据库备份脚本（纯 Node.js 实现）
 * 
 * 功能：
 * - 导出所有表结构和数据为 SQL 文件
 * - 自动 gzip 压缩
 * - 保留最近 N 天备份，自动清理旧文件
 * 
 * 用法：
 *   node server/scripts/backup-db.js
 * 
 * 环境变量：
 *   BACKUP_DIR    - 备份目录，默认 ./backups
 *   BACKUP_DAYS   - 保留天数，默认 7
 */

require('dotenv').config({ path: `${__dirname}/../config/.env` });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { taskLogger } = require('../middleware/requestLogger');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const BACKUP_RETAIN_DAYS = parseInt(process.env.BACKUP_DAYS) || 7;

/**
 * 获取数据库连接（每次备份独立创建，用完释放）
 */
async function getPool() {
  const mysql = require('mysql2/promise');
  const dbConfig = require('../config/database');
  const env = process.env.NODE_ENV || 'development';
  const config = dbConfig[env];

  const poolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
  };

  if (env === 'production') {
    poolConfig.ssl = { rejectUnauthorized: true };
  }

  return mysql.createPool(poolConfig);
}

/**
 * 转义 SQL 值
 */
function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (Buffer.isBuffer(val)) {
    return `X'${val.toString('hex')}'`;
  }
  // 字符串转义
  const escaped = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '\\0');
  return `'${escaped}'`;
}

/**
 * 导出单个表
 */
async function dumpTable(pool, tableName) {
  const lines = [];

  // 1. 获取建表语句
  const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
  if (createRows.length > 0) {
    const createSQL = createRows[0]['Create Table'];
    lines.push(`-- Table: ${tableName}`);
    lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    lines.push(`${createSQL};`);
    lines.push('');
  }

  // 2. 获取数据（分批读取，避免大表 OOM）
  const BATCH_SIZE = 500;
  let offset = 0;
  let totalRows = 0;

  while (true) {
    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\` LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    );
    if (rows.length === 0) break;

    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `\`${c}\``).join(', ');

    for (const row of rows) {
      const values = columns.map(c => escapeValue(row[c])).join(', ');
      lines.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES (${values});`);
    }

    totalRows += rows.length;
    offset += BATCH_SIZE;

    if (rows.length < BATCH_SIZE) break;
  }

  if (totalRows > 0) {
    lines.push('');
  }

  return { sql: lines.join('\n'), rows: totalRows };
}

/**
 * 执行完整备份
 */
async function runBackup() {
  const log = taskLogger('db-backup');
  log.start();

  let pool;

  try {
    pool = await getPool();

    // 获取所有表
    const [tables] = await pool.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableKey]);

    log.progress('tables_loaded', { count: tableNames.length });

    // 确保备份目录存在
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 生成文件名
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
    const fileName = `backup_${dateStr}_${timeStr}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);
    const gzPath = `${filePath}.gz`;

    // 构建 SQL 文件内容
    const header = [
      `-- 正一领骑数据库备份`,
      `-- Date: ${now.toISOString()}`,
      `-- Environment: ${process.env.NODE_ENV || 'development'}`,
      `-- Tables: ${tableNames.length}`,
      '',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      ''
    ].join('\n');

    let sqlContent = header;
    let totalRows = 0;

    for (const tableName of tableNames) {
      const result = await dumpTable(pool, tableName);
      sqlContent += result.sql + '\n';
      totalRows += result.rows;
    }

    sqlContent += 'SET FOREIGN_KEY_CHECKS = 1;\n';

    // Gzip 压缩
    const gzBuffer = zlib.gzipSync(Buffer.from(sqlContent, 'utf8'));
    fs.writeFileSync(gzPath, gzBuffer);

    const fileSizeKB = (gzBuffer.length / 1024).toFixed(1);

    log.success({
      file: gzPath,
      sizeKB: fileSizeKB,
      tables: tableNames.length,
      rows: totalRows
    });

    // 清理旧备份
    cleanupOldBackups();

    return { file: gzPath, sizeKB: fileSizeKB, tables: tableNames.length, rows: totalRows };

  } catch (err) {
    log.fail(err);
    throw err;
  } finally {
    if (pool) await pool.end();
  }
}

/**
 * 清理超过保留天数的旧备份
 */
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const cutoff = Date.now() - (BACKUP_RETAIN_DAYS * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (const file of files) {
      if (!file.startsWith('backup_') || !file.endsWith('.sql.gz')) continue;

      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        type: 'task',
        task: 'db-backup',
        action: 'cleanup',
        deleted,
        retainDays: BACKUP_RETAIN_DAYS
      }));
    }
  } catch (err) {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'warn',
      type: 'task',
      task: 'db-backup',
      action: 'cleanup_failed',
      error: err.message
    }));
  }
}

// 直接运行时执行备份
if (require.main === module) {
  runBackup()
    .then(result => {
      console.log(`备份完成: ${result.file} (${result.sizeKB}KB, ${result.tables}表, ${result.rows}行)`);
      process.exit(0);
    })
    .catch(err => {
      console.error(`备份失败: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { runBackup };
