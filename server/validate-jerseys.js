const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// 领骑衫类型映射（PCS 网站 → 数据库）
const JERSEY_TYPE_MAP = {
  'pink': 'pink',
  'purple': 'purple',
  'blue': 'blue',
  'white': 'white'
};

/**
 * 从 PCS 网站爬取领骑衫数据
 */
async function crawlJerseysFromPCS(stageNumber) {
  const url = `https://www.procyclingstats.com/race/giro-d-italia/2026/stage-${stageNumber}`;
  console.log(`  📡 爬取 PCS 数据: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 提取领骑衫数据
    const jerseys = await page.evaluate(() => {
      const results = [];
      
      // 查找领骑衫区域（通常在页面顶部）
      // PCS 页面上领骑衫信息可能在多个位置
      
      // 方法1：查找包含 "Maglia" 或 "Jersey" 的元素
      const jerseyElements = document.querySelectorAll('.jersey-holder, .classification-leaders, .jerseytable');
      
      jerseyElements.forEach(element => {
        const text = element.textContent;
        
        // 提取粉衫持有者
        const pinkMatch = text.match(/Maglia Rosa[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
        if (pinkMatch) {
          results.push({ type: 'pink', name: pinkMatch[1] });
        }
        
        // 提取紫衫持有者
        const purpleMatch = text.match(/(Maglia Ciclamino|Points)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
        if (purpleMatch) {
          results.push({ type: 'purple', name: purpleMatch[2] });
        }
        
        // 提取蓝衫持有者
        const blueMatch = text.match(/(Maglia Azzurra|Mountains)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
        if (blueMatch) {
          results.push({ type: 'blue', name: blueMatch[2] });
        }
        
        // 提取白衫持有者
        const whiteMatch = text.match(/(Maglia Bianca|Youth)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
        if (whiteMatch) {
          results.push({ type: 'white', name: whiteMatch[2] });
        }
      });
      
      // 如果方法1没找到，尝试方法2：解析页面表格
      if (results.length === 0) {
        // 查找所有表格
        const tables = document.querySelectorAll('table');
        
        tables.forEach(table => {
          const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
          
          // 检查是否是领骑衫表格
          if (headers.some(h => h.includes('Jersey') || h.includes('Leader'))) {
            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 2) {
                const jerseyType = cells[0].textContent.trim();
                const riderName = cells[1].textContent.trim();
                
                // 映射领骑衫类型
                let type = null;
                if (jerseyType.includes('Pink') || jerseyType.includes('Pink')) type = 'pink';
                else if (jerseyType.includes('Purple') || jerseyType.includes('Ciclamino')) type = 'purple';
                else if (jerseyType.includes('Blue') || jerseyType.includes('Azzurra')) type = 'blue';
                else if (jerseyType.includes('White') || jerseyType.includes('Bianca')) type = 'white';
                
                if (type && riderName) {
                  results.push({ type, name: riderName });
                }
              }
            });
          }
        });
      }
      
      return results;
    });
    
    console.log(`  ✅ 爬取完成，找到 ${jerseys.length} 条领骑衫记录`);
    return jerseys;
    
  } finally {
    await browser.close();
  }
}

/**
 * 从数据库查询领骑衫数据
 */
async function getJerseysFromDB(connection, stageNumber) {
  const [rows] = await connection.execute(`
    SELECT j.jersey_type, r.rider_name
    FROM jerseys j
    JOIN stages s ON j.stage_id = s.id
    JOIN riders r ON j.rider_id = r.id
    WHERE s.stage_number = ?
    ORDER BY j.jersey_type
  `, [stageNumber]);
  
  return rows;
}

/**
 * 对比数据并生成验证报告
 */
function generateValidationReport(stageNumber, pcsData, dbData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 赛段 ${stageNumber} 领骑衫数据验证`);
  console.log('='.repeat(60));
  
  const issues = [];
  
  // 创建映射便于对比
  const pcsMap = {};
  pcsData.forEach(item => {
    pcsMap[item.type] = item.name;
  });
  
  const dbMap = {};
  dbData.forEach(item => {
    dbMap[item.jersey_type] = item.rider_name;
  });
  
  // 对比每种领骑衫
  const jerseyTypes = ['pink', 'purple', 'blue', 'white'];
  
  for (const type of jerseyTypes) {
    const pcsRider = pcsMap[type];
    const dbRider = dbMap[type];
    
    console.log(`\n📍 ${type} 领骑衫:`);
    console.log(`  PCS: ${pcsRider || '(未找到)'}`);
    console.log(`  DB:  ${dbRider || '(未找到)'}`);
    
    if (!pcsRider && !dbRider) {
      console.log(`  ⚠️  两边都未找到`);
    } else if (!pcsRider) {
      issues.push(`  ❌ PCS 未找到 ${type} 领骑衫数据`);
      console.log(`  ❌ PCS 数据缺失`);
    } else if (!dbRider) {
      issues.push(`  ❌ 数据库未找到 ${type} 领骑衫数据`);
      console.log(`  ❌ 数据库数据缺失`);
    } else if (pcsRider !== dbRider) {
      issues.push(`  ❌ 数据不匹配: PCS="${pcsRider}", DB="${dbRider}"`);
      console.log(`  ❌ 数据不匹配`);
    } else {
      console.log(`  ✅ 数据匹配`);
    }
  }
  
  return issues;
}

/**
 * 主函数
 */
async function main() {
  let connection;
  
  try {
    console.log('🚴 开始领骑衫数据验证...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    const allIssues = [];
    
    // 验证赛段 1-9
    for (let stageNumber = 1; stageNumber <= 9; stageNumber++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📍 验证赛段 ${stageNumber}`);
      console.log('='.repeat(60));
      
      // 从 PCS 爬取数据
      const pcsData = await crawlJerseysFromPCS(stageNumber);
      
      // 从数据库查询数据
      const dbData = await getJerseysFromDB(connection, stageNumber);
      
      // 对比并生成报告
      const issues = generateValidationReport(stageNumber, pcsData, dbData);
      allIssues.push(...issues.map(issue => `赛段 ${stageNumber}: ${issue}`));
      
      // 避免请求过快
      if (stageNumber < 9) {
        console.log('\n⏳ 等待 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 输出总结
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 验证总结');
    console.log('='.repeat(60));
    
    if (allIssues.length === 0) {
      console.log('\n✅ 所有赛段的领骑衫数据均正确！');
    } else {
      console.log(`\n❌ 发现 ${allIssues.length} 个问题:\n`);
      allIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 验证失败:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// 执行主函数
main().catch(console.error);
