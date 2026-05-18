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
        race_name_en VARCHAR(200),
        race_code VARCHAR(50) UNIQUE NOT NULL,
        category VARCHAR(20) NOT NULL,
        gender VARCHAR(10) NOT NULL,
        season INT NOT NULL,
        country VARCHAR(100),
        start_date DATE,
        end_date DATE,
        total_stages INT,
        total_distance DECIMAL(8,1),
        logo_url VARCHAR(500),
        official_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_races_category (category, gender, season),
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
        stage_type VARCHAR(50),
        date DATE NOT NULL,
        start_time TIME,
        distance_km DECIMAL(5,1),
        elevation_m INT,
        start_city VARCHAR(100),
        finish_city VARCHAR(100),
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
        logo_url VARCHAR(500),
        bike_brand VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ teams 表创建成功');
    
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
    
    await dbConn.end();
    console.log('\n🎉 所有数据表创建完成！');
    console.log('接下来请运行 npm install 安装依赖，然后配置 .env 文件');
    
  } catch (err) {
    console.error('初始化数据库失败:', err);
    process.exit(1);
  }
}

initDatabase();
