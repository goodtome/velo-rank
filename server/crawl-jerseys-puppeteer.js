const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db',
  charset: 'utf8mb4'
};

// PCS 基础URL
const PCS_BASE = 'https://www.procyclingstats.com';

// 解析领骑衫数据
async function parseJerseys(page, stageId) {
  try {
    console.log(`  🔍 正在解析领骑衫数据...`);
    
    const jerseys = await page.evaluate(() => {
      const results = [];
      
      // 方法1: 查找 .jerseycontainer 或类似容器
      const jerseyContainer = document.querySelector('.jerseycontainer, .jerseys, .classification-jerseys');
      
      if (jerseyContainer) {
        const jerseyItems = jerseyContainer.querySelectorAll('.jerseyitem, .jersey, li');
        
        jerseyItems.forEach(item => {
          const img = item.querySelector('img');
          if (!img) return;
          
          const imgSrc = img.src.toLowerCase();
          let jerseyType = '';
          
          if (imgSrc.includes('pink') || imgSrc.includes('rosa') || imgSrc.includes('maglia_pink')) {
            jerseyType = 'pink';
          } else if (imgSrc.includes('purple') || imgSrc.includes('ciclamino') || imgSrc.includes('maglia_purple')) {
            jerseyType = 'purple';
          } else if (imgSrc.includes('blue') || imgSrc.includes('azzurra') || imgSrc.includes('maglia_blue')) {
            jerseyType = 'blue';
          } else if (imgSrc.includes('white') || imgSrc.includes('bianca') || imgSrc.includes('maglia_white')) {
            jerseyType = 'white';
          }
          
          if (jerseyType) {
            const riderLink = item.querySelector('a[href*="/rider/"]');
            const teamLink = item.querySelector('a[href*="/team/"]');
            
            if (riderLink) {
              results.push({
                jersey_type: jerseyType,
                rider_name: riderLink.textContent.trim(),
                rider_url: riderLink.href,
                team_name: teamLink ? teamLink.textContent.trim() : ''
              });
            }
          }
        });
      }
      
      // 方法2: 如果上面没找到，尝试查找页面上所有领骑衫相关元素
      if (results.length === 0) {
        const allImages = document.querySelectorAll('img[src*="jersey"], img[src*="maglia"]');
        
        allImages.forEach(img => {
          const imgSrc = img.src.toLowerCase();
          let jerseyType = '';
          
          if (imgSrc.includes('pink') || imgSrc.includes('rosa')) jerseyType = 'pink';
          else if (imgSrc.includes('purple') || imgSrc.includes('ciclamino')) jerseyType = 'purple';
          else if (imgSrc.includes('blue') || imgSrc.includes('azzurra')) jerseyType = 'blue';
          else if (imgSrc.includes('white') || imgSrc.includes('bianca')) jerseyType = 'white';
          
          if (jerseyType) {
            // 向上查找包含车手链接的父元素
            let parent = img.closest('div, li, tr');
            if (parent) {
              const riderLink = parent.querySelector('a[href*="/rider/"]');
              const teamLink = parent.querySelector('a[href*="/team/"]');
              
              if (riderLink) {
                results.push({
                  jersey_type: jerseyType,
                  rider_name: riderLink.textContent.trim(),
                  rider_url: riderLink.href,
                  team_name: teamLink ? teamLink.textContent.trim() : ''
                });
              }
            }
          }
        });
      }
      
      return results;
    });
    
    if (jerseys.length > 0) {
      console.log(`  ✅ 找到 ${jerseys.length} 件领骑衫`);
      jerseys.forEach(j => {
        console.log(`     - ${j.jersey_type}: ${j.rider_name} (${j.team_name || '未知车队'})`);
      });
    } else {
      console.log(`  ⚠️  未找到领骑衫数据`);
    }
    
    // 添加 stage_id
    return jerseys.map(j => ({
      ...j,
      stage_id: stageId
    }));
    
  } catch (error) {
    console.error(`  ❌ 解析领骑衫数据失败:`, error.message);
    return [];
  }
}

// 获取或创建车队
async function getOrCreateTeam(connection, teamName) {
  if (!teamName) {
    // 如果车队名称为空，返回一个默认车队ID或创建占位车队
    const [defaultTeams] = await connection.execute(
      'SELECT id FROM teams WHERE team_name = ? LIMIT 1',
      ['Unknown Team']
    );
    
    if (defaultTeams.length > 0) {
      return defaultTeams[0].id;
    } else {
      const uuid = require('crypto').randomUUID();
      await connection.execute(
        'INSERT INTO teams (id, team_name, team_name_en, team_name_zh) VALUES (?, ?, ?, ?)',
        [uuid, 'Unknown Team', 'Unknown Team', '未知车队']
      );
      return uuid;
    }
  }
  
  // 查找车队
  const [teams] = await connection.execute(
    'SELECT id FROM teams WHERE team_name = ? OR team_name_en = ? LIMIT 1',
    [teamName, teamName]
  );
  
  if (teams.length > 0) {
    return teams[0].id;
  }
  
  // 创建新车队
  const uuid = require('crypto').randomUUID();
  await connection.execute(
    'INSERT INTO teams (id, team_name, team_name_en, team_name_zh) VALUES (?, ?, ?, ?)',
    [uuid, teamName, teamName, teamName]
  );
  console.log(`    ✓ 创建新车队: ${teamName}`);
  return uuid;
}

// 插入领骑衫数据到数据库
async function insertJerseys(connection, jerseys) {
  let insertedCount = 0;
  
  for (const jersey of jerseys) {
    try {
      // 查找或创建车手
      let riderId = null;
      const [riders] = await connection.execute(
        'SELECT id FROM riders WHERE name = ? OR name_en = ? LIMIT 1',
        [jersey.rider_name, jersey.rider_name]
      );
      
      if (riders.length > 0) {
        riderId = riders[0].id;
      } else {
        // 创建新车手
        riderId = require('crypto').randomUUID();
        await connection.execute(
          'INSERT INTO riders (id, name, name_en, name_zh) VALUES (?, ?, ?, ?)',
          [riderId, jersey.rider_name, jersey.rider_name, jersey.rider_name]
        );
        console.log(`    ✓ 创建新车手: ${jersey.rider_name}`);
      }
      
      // 获取或创建车队
      const teamId = await getOrCreateTeam(connection, jersey.team_name);
      
      // 插入领骑衫记录
      const jerseyId = require('crypto').randomUUID();
      await connection.execute(`
        INSERT IGNORE INTO jerseys 
        (id, stage_id, jersey_type, rider_id, team_id) 
        VALUES (?, ?, ?, ?, ?)
      `, [jerseyId, jersey.stage_id, jersey.jersey_type, riderId, teamId]);
      
      insertedCount++;
      
    } catch (error) {
      console.error(`  ❌ 插入领骑衫数据失败:`, error.message);
    }
  }
  
  return insertedCount;
}

// 主函数
async function main() {
  let browser;
  let connection;
  
  try {
    console.log('🚴 开始爬取领骑衫数据...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 获取赛段信息
    const [stages] = await connection.execute(`
      SELECT s.id, s.stage_number, s.stage_code, r.id as race_id
      FROM stages s
      JOIN races r ON s.race_id = r.id
      WHERE r.race_name LIKE ? AND r.season = ?
      AND s.stage_number BETWEEN 1 AND 9
      ORDER BY s.stage_number
    `, ['%Giro d\'Italia%', 2026]);
    
    console.log(`📊 找到 ${stages.length} 个赛段需要爬取\n`);
    
    // 启动浏览器
    console.log('🌐 启动浏览器...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ 浏览器启动成功\n');
    
    // 遍历每个赛段
    for (const stage of stages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 处理赛段 ${stage.stage_number} (${stage.stage_code})`);
      console.log('='.repeat(60));
      
      // 检查是否已有领骑衫数据
      const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM jerseys WHERE stage_id = ?',
        [stage.id]
      );
      
      if (existing[0].count > 0) {
        console.log(`⏭️  赛段 ${stage.stage_number} 已有 ${existing[0].count} 条领骑衫数据，跳过`);
        continue;
      }
      
      // 构建PCS URL
      const pcsUrl = `${PCS_BASE}/race/giro-d-italia/2026/stage-${stage.stage_number}`;
      console.log(`🔗 访问: ${pcsUrl}`);
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      try {
        await page.goto(pcsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 等待页面加载 - 使用 setTimeout 替代 waitForTimeout
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 调试：保存页面HTML
        const htmlContent = await page.content();
        const fs = require('fs');
        fs.writeFileSync(`debug-stage-${stage.stage_number}.html`, htmlContent);
        console.log(`  💾 已保存页面HTML: debug-stage-${stage.stage_number}.html`);
        
        // 调试：截图
        await page.screenshot({ path: `debug-stage-${stage.stage_number}.png` });
        console.log(`  📷 已保存截图: debug-stage-${stage.stage_number}.png`);
        
        // 解析领骑衫数据
        const jerseys = await parseJerseys(page, stage.id);
        
        if (jerseys.length > 0) {
          // 插入数据库
          const inserted = await insertJerseys(connection, jerseys);
          console.log(`💾 成功插入 ${inserted} 条记录`);
        }
        
      } catch (error) {
        console.error(`❌ 处理赛段 ${stage.stage_number} 失败:`, error.message);
      } finally {
        await page.close();
      }
      
      // 延迟避免被封
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 领骑衫数据爬取完成！');
    console.log('='.repeat(60));
    
    // 显示统计
    const [stats] = await connection.execute(`
      SELECT 
        s.stage_number,
        j.jersey_type,
        COUNT(*) as count
      FROM jerseys j
      JOIN stages s ON j.stage_id = s.id
      JOIN races r ON s.race_id = r.id
      WHERE r.race_name LIKE '%Giro d%Italia%2026%'
      GROUP BY s.stage_number, j.jersey_type
      ORDER BY s.stage_number, j.jersey_type
    `);
    
    console.log('\n📊 领骑衫数据统计:');
    console.table(stats);
    
  } catch (error) {
    console.error('\n❌ 程序执行失败:', error);
  } finally {
    if (connection) await connection.end();
    if (browser) await browser.close();
  }
}

// 执行主函数
main().catch(console.error);
