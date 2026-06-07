/**
 * 数据库迁移脚本 - 初始化所有认证和关注相关的表
 *
 * 使用方法:
 * node server/scripts/migrate-auth-tables.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'jersey_db'
};

// SQL文件路径
const sqlDirectory = path.join(__dirname, '../sql');

// 表定义（应该与routes中的建表SQL保持同步）
const tablesSQL = `-- ============================================
-- 正一领骑 - 用户认证和关注功能数据表
-- ============================================
-- 创建时间: ${new Date().toISOString()}
-- 用途: 支持用户认证、token管理、关注车手等功能
-- ============================================

-- 1. 用户设置表
CREATE TABLE IF NOT EXISTS users_settings (
  user_id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  openid VARCHAR(100) UNIQUE,
  avatar TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账号表';

-- 2. 用户token表
CREATE TABLE IF NOT EXISTS user_tokens (
  id VARCHAR(36) PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  openid VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT FALSE,
  INDEX idx_token (token),
  INDEX idx_openid (openid),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户token表';

-- 3. 车手表（现有表，用于关注功能）
CREATE TABLE IF NOT EXISTS riders (
  id VARCHAR(36) PRIMARY KEY,
  rider_name VARCHAR(255) NOT NULL,
  rider_name_zh VARCHAR(255),
  nationality VARCHAR(50),
  birth_date DATE,
  country_code CHAR(2),
  photo_url TEXT,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车手表';

-- 4. 车两队（现有表）
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  team_name_zh VARCHAR(255),
  team_name_en VARCHAR(255),
  uci_code VARCHAR(50),
  country_code CHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车队表';

-- 5. 车关注表
CREATE TABLE IF NOT EXISTS riders_favorites (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_settings(user_id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_rider (user_id, rider_id),
  INDEX idx_user_id (user_id),
  INDEX idx_rider_id (rider_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车辆手关注表';

-- 6. 用户设置表
CREATE TABLE IF NOT EXISTS riders_settings (
  user_id VARCHAR(50) PRIMARY KEY,
  favorite_riders TEXT DEFAULT '[]',
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  theme VARCHAR(20) DEFAULT 'light',
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_settings(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户偏号设置表';

-- 7. 管理日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_action (user_id, action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理操作日志表';

-- 8. 同步日志表
CREATE TABLE IF NOT EXISTS sync_logs (
  id VARCHAR(36) PRIMARY KEY,
  race_id VARCHAR(36) NOT NULL,
  requested_by VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (race_id) REFERENCES stages(id) ON DELETE CASCADE,
  INDEX idx_race_id (race_id),
  INDEX idx_requested_by (requested_by),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据同步日志表';

-- 插入测试数据（可选）
INSERT IGNORE INTO users_settings (user_id, username, password, openid, is_admin)
VALUES
  ('test_user_001', 'testuser', '$2b$10$OQ7ZWn2EeqmQKcoGqLJvHeaxyhL7hQh7QhQh7Qh7Qh7Qh7Qh7Qh', 'test_openid_001', TRUE)
ON DUPLICATE KEY UPDATE user_id=user_id;

-- 验证表是否创建成功
SELECT
  'users_settings' as table_name,
  COUNT(*) as row_count
FROM users_settings
UNION ALL
SELECT
  'user_tokens',
  COUNT(*)
FROM user_tokens
UNION ALL
SELECT
  'riders_favorites',
  COUNT(*)
FROM riders_favorites
UNION ALL
SELECT
  'riders_settings',
  COUNT(*)
FROM riders_settings
UNION ALL
SELECT
  'admin_logs',
  COUNT(*)
FROM admin_logs
UNION ALL
SELECT
  'sync_logs',
  COUNT(*)
FROM sync_logs;
`;

/**
 * 执行数据库迁移
 */
async function migrate() {
  let connection;

  try {
    console.log('\n=================================');
    console.log(' 开始数据库迁移...');
    console.log('=================================\n');

    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('  ✓ 成功连接到数据库');

    // 解析并执行SQL
    console.log('  ✓ 读取SQL定义...');
    const sql = tablesSQL;

    console.log('  ✓ 执行建表语句...');
    await connection.query(sql);
    console.log('  ✓ 数据表创建成功');

    // 验证表
    console.log('\n正在验证数据表...');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME IN (
        'users_settings',
        'user_tokens',
        'riders_favorites',
        'riders_settings',
        'admin_logs',
        'sync_logs'
      )
      ORDER BY TABLE_NAME
    `, [dbConfig.database]);

    console.log('\n  ✓ 创建的数据表:');
    tables.forEach(row => {
      console.log(`    - ${row.TABLE_NAME}`);

      // 获取每个表的记录数
      const [counts] = await connection.query(
        `SELECT COUNT(*) as count FROM ${row.TABLE_NAME}`
      );
      console.log(`      记录数: ${counts[0].count}`);
    });

    console.log('\n=================================');
    console.log(' 数据库迁移完成！');
    console.log('=================================\n');

    console.log('提示:');
    console.log('  - 运行此脚本前，请确保.env文件中的数据库配置正确');
    console.log('  - 此脚本幂等性强，可以重复运行');
    console.log('  - 生产环境运行前请先备份数据库');
    console.log('  - 建议在非高峰期执行迁移');

  } catch (error) {
    console.error('\n=================================');
    console.error(' 数据库迁移失败！');
    console.error('=================================\n');
    console.error('错误详情:');
    console.error(`  查询: ${error.sql || error.message}`);
    console.error(`  代码: ${error.code}`);
    console.error(`  SQL状态: ${error.sqlMessage || error.sqlState || '未知'}`);
    console.error('\n建议:');
    console.error('  1. 检查数据库连接配置 (.env文件)');
    console.error('  2. 确认MySQL服务正在运行');
    console.error('  3. 确认数据库已创建');
    console.error('  4. 检查是否有足够的数据库权限');
    console.error('  5. 查看上面的详细错误信息');
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (connection) {
      await connection.end();
      console.log('---------------------------------\n');
    }
  }
}

// 检查是否在命令行直接运行此脚本
if (require.main === module) {
  migrate();
}

module.exports = migrate;
