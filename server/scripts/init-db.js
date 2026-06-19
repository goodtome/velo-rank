const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

async function initDatabase() {
  let conn;
  try {
    // 先连接不带数据库名，创建数据库
    conn = await mysql.createConnection({
      host: dbConfig.development.host,
      port: dbConfig.development.port,
      user: dbConfig.development.user,
      password: dbConfig.development.password
    });
    
    console.log('连接到MySQL服务器成功');
    
    // 创建数据库
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.development.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`数据库 ${dbConfig.development.database} 创建/确认成功`);
    
    await conn.end();
    
    // 连接到新数据库，创建表
    const dbConn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });
    
    console.log('开始创建数据表...');
    
    // 赛事主表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS races (
        id CHAR(36) PRIMARY KEY,
        race_name VARCHAR(200) NOT NULL,
        race_name_zh VARCHAR(200),
        race_name_en VARCHAR(200),
        race_code VARCHAR(50) UNIQUE NOT NULL,
        category VARCHAR(20) NOT NULL,
        category_zh VARCHAR(50),
        gender VARCHAR(10) NOT NULL,
        season INT NOT NULL,
        country VARCHAR(100),
        start_date DATE,
        end_date DATE,
        total_stages INT,
        total_distance DECIMAL(8,1),
        logo_url MEDIUMTEXT,
        official_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_races_category (category, gender, season),
        INDEX idx_start_date (start_date),
        INDEX idx_races_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ races 表创建成功');
    
    // 赛段表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS stages (
        id CHAR(36) PRIMARY KEY,
        race_id CHAR(36) NOT NULL,
        stage_number INT NOT NULL,
        stage_name VARCHAR(200),
        stage_name_zh VARCHAR(200),
        stage_type VARCHAR(50),
        date DATE NOT NULL,
        start_time TIME,
        distance_km DECIMAL(5,1),
        elevation_m INT,
        start_city VARCHAR(100),
        finish_city VARCHAR(100),
        start_city_zh VARCHAR(100),
        finish_city_zh VARCHAR(100),
        weather_summary VARCHAR(200),
        stage_code VARCHAR(100) UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_race_stage (race_id, stage_number),
        INDEX idx_stages_race (race_id, stage_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ stages 表创建成功');
    
    // 车手表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS riders (
        id CHAR(36) PRIMARY KEY,
        uci_id VARCHAR(20) UNIQUE,
        rider_name VARCHAR(100) NOT NULL,
        rider_name_zh VARCHAR(100),
        nationality VARCHAR(3) NOT NULL,
        birth_date DATE,
        height_cm INT,
        weight_kg DECIMAL(4,1),
        is_retired BOOLEAN DEFAULT false,
        photo_url VARCHAR(500),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_riders_nationality (nationality)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ riders 表创建成功');
    
    // 车队表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id CHAR(36) PRIMARY KEY,
        uci_code VARCHAR(10) UNIQUE,
        team_name VARCHAR(200) NOT NULL,
        team_name_zh VARCHAR(200),
        team_name_en VARCHAR(200),
        category VARCHAR(50),
        country VARCHAR(100),
        logo_url MEDIUMTEXT,
        bike_brand VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ teams 表创建成功');
    
    // 用户设置表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS users_settings (
        user_id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        password VARCHAR(255),
        openid VARCHAR(100) UNIQUE,
        avatar TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_openid (openid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ users_settings 表创建成功');

    // 管理/用户操作日志表
    await dbConn.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ admin_logs 表创建成功');

    // 车手关注表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS riders_favorites (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        rider_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_rider (user_id, rider_id),
        INDEX idx_user_id (user_id),
        INDEX idx_rider_id (rider_id),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_riders_favorites_rider_id FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ riders_favorites 表创建成功');

    // 赛段成绩表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS stage_results (
        id CHAR(36) PRIMARY KEY,
        stage_id CHAR(36) NOT NULL,
        \`rank\` INT NOT NULL,
        rider_id CHAR(36) NOT NULL,
        team_id CHAR(36) NOT NULL,
        nationality VARCHAR(3) NOT NULL,
        time_gap VARCHAR(50),
        is_same_time BOOLEAN DEFAULT false,
        sprint_points INT DEFAULT 0,
        mountain_points INT DEFAULT 0,
        youth_eligible BOOLEAN DEFAULT false,
        jersey_earned JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_stage_rank (stage_id, \`rank\`),
        INDEX idx_results_stage (stage_id, \`rank\`),
        INDEX idx_results_rider (rider_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ stage_results 表创建成功');
    
    // 领骑衫持有表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS jerseys (
        id CHAR(36) PRIMARY KEY,
        stage_id CHAR(36) NOT NULL,
        jersey_type VARCHAR(30) NOT NULL,
        rider_id CHAR(36) NOT NULL,
        team_id CHAR(36) NOT NULL,
        time_gap VARCHAR(50),
        points INT,
        jersey_image VARCHAR(500),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_stage_jersey (stage_id, jersey_type),
        INDEX idx_jerseys_stage (stage_id, jersey_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ jerseys 表创建成功');
    
    // 总成绩榜GC
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS general_classification (
        id CHAR(36) PRIMARY KEY,
        stage_id CHAR(36) NOT NULL,
        \`rank\` INT NOT NULL,
        rider_id CHAR(36) NOT NULL,
        team_id CHAR(36) NOT NULL,
        nationality VARCHAR(3) NOT NULL,
        total_time VARCHAR(50),
        time_gap VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_gc_stage_rank (stage_id, \`rank\`),
        INDEX idx_gc_stage (stage_id, \`rank\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ general_classification 表创建成功');
    
    // 冲刺积分榜
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS points_classification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stage_id VARCHAR(36) NOT NULL,
        rider_id VARCHAR(36) NOT NULL,
        \`rank\` INT NOT NULL,
        points INT NOT NULL DEFAULT 0,
        jersey_type VARCHAR(20) DEFAULT 'PURPLE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_stage_rider (stage_id, rider_id, jersey_type),
        INDEX idx_stage (stage_id),
        INDEX idx_rider (rider_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ points_classification 表创建成功');

    // 爬坡积分榜
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS mountains_classification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stage_id VARCHAR(36) NOT NULL,
        rider_id VARCHAR(36) NOT NULL,
        \`rank\` INT NOT NULL,
        points INT NOT NULL DEFAULT 0,
        jersey_type VARCHAR(20) DEFAULT 'BLUE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_stage_rider (stage_id, rider_id, jersey_type),
        INDEX idx_stage (stage_id),
        INDEX idx_rider (rider_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ mountains_classification 表创建成功');

    // 青年成绩榜
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS youth_classification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stage_id VARCHAR(36) NOT NULL,
        rider_id VARCHAR(36) NOT NULL,
        \`rank\` INT NOT NULL,
        time VARCHAR(20),
        time_gap VARCHAR(20),
        jersey_type VARCHAR(20) DEFAULT 'WHITE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_stage_rider (stage_id, rider_id),
        INDEX idx_stage (stage_id),
        INDEX idx_rider (rider_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ youth_classification 表创建成功');

    // 车队成绩榜
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS team_classification (
        id CHAR(36) PRIMARY KEY,
        stage_id CHAR(36) NOT NULL,
        \`rank\` INT NOT NULL,
        team_id CHAR(36) NOT NULL,
        total_time VARCHAR(50),
        time_gap VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_team_stage_rank (stage_id, \`rank\`),
        INDEX idx_team_stage (stage_id, \`rank\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ team_classification 表创建成功');
    
    // 用户登录 token
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        token VARCHAR(36) PRIMARY KEY,
        openid VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_openid (openid),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ user_tokens 表创建成功');

    // 用户推送设置表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS user_push_settings (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        openid VARCHAR(128) NOT NULL,
        push_enabled TINYINT(1) DEFAULT 1,
        notify_race_start TINYINT(1) DEFAULT 1,
        notify_stage_end TINYINT(1) DEFAULT 1,
        notify_rider_change TINYINT(1) DEFAULT 1,
        notify_key_events TINYINT(1) DEFAULT 0,
        dnd_enabled TINYINT(1) DEFAULT 0,
        dnd_start VARCHAR(10) DEFAULT '22:00',
        dnd_end VARCHAR(10) DEFAULT '07:00',
        push_frequency VARCHAR(20) DEFAULT 'realtime',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_openid (openid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ user_push_settings 表创建成功');

    // 用户推送订阅记录表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS user_push_subscriptions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        openid VARCHAR(128) NOT NULL,
        template_id VARCHAR(255),
        subscribe_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_valid TINYINT(1) DEFAULT 1,
        UNIQUE KEY uk_openid_template (openid, template_id),
        INDEX idx_openid (openid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ user_push_subscriptions 表创建成功');

    // 推送历史记录表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS push_history (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        openid VARCHAR(128),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50),
        race_id VARCHAR(36),
        stage_id VARCHAR(36),
        send_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'sent',
        error_msg TEXT,
        INDEX idx_openid (openid),
        INDEX idx_send_time (send_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ push_history 表创建成功');

    // 数据同步日志表
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id VARCHAR(36) PRIMARY KEY,
        race_id VARCHAR(36) NOT NULL,
        requested_by VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_race_id (race_id),
        INDEX idx_requested_by (requested_by),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_sync_logs_race_id FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ sync_logs 表创建成功');
    
    await dbConn.end();
    console.log('\n🎉 所有数据表创建完成！');
    console.log('接下来请运行 npm install 安装依赖，然后配置 .env 文件');
    
  } catch (err) {
    console.error('初始化数据库失败:', err);
    process.exit(1);
  }
}

initDatabase();
