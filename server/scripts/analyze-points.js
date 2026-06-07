const mysql = require('mysql2/promise');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HTML_DIR = path.join(__dirname, 'pcs_html');

(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  // 1. Current points data per stage
  console.log('=== 当前 points_classification 数据 ===');
  const [ptsPerStage] = await c.query(
    `SELECT s.stage_number, COUNT(pc.rider_id) as cnt 
     FROM stages s LEFT JOIN points_classification pc ON s.id = pc.stage_id
     WHERE s.race_id = (SELECT id FROM races WHERE race_code = 'giro-ditalia-2026')
     GROUP BY s.stage_number ORDER BY s.stage_number`
  );
  ptsPerStage.forEach(r => console.log(`  S${String(r.stage_number).padStart(2,'0')}: ${r.cnt} 条`));

  await c.end();

  // 2. Analyze ALL tables in each HTML to find points-like tables
  console.log('\n=== PCS HTML 表格分析 ===');
  for (let stageNum = 1; stageNum <= 21; stageNum++) {
    const htmlFile = path.join(HTML_DIR, `giro_s${stageNum}.html`);
    if (!fs.existsSync(htmlFile)) {
      console.log(`  S${String(stageNum).padStart(2,'0')}: 文件不存在`);
      continue;
    }
    const html = fs.readFileSync(htmlFile, 'utf8');
    const $ = cheerio.load(html);

    const tableInfo = [];
    $('table').each((idx, table) => {
      const $table = $(table);
      const headers = [];
      $table.find('tr').first().find('th, td').each((_, cell) => {
        headers.push($(cell).text().trim());
      });
      const rowCount = $table.find('tr').length;
      const headerStr = headers.join('|');
      
      // Look for tables that might be points-related
      if (headerStr.includes('Pnt') || headerStr.includes('Today') || headerStr.includes('Points') || headerStr.includes('Sprint')) {
        tableInfo.push({ idx, headers: headerStr, rows: rowCount });
      }
    });

    if (tableInfo.length > 0) {
      console.log(`  S${String(stageNum).padStart(2,'0')}:`);
      tableInfo.forEach(t => console.log(`    T${t.idx} (${t.rows} rows): ${t.headers.substring(0, 120)}`));
    } else {
      console.log(`  S${String(stageNum).padStart(2,'0')}: 无 Pnt/Points/Sprint 相关表格`);
    }
  }
})();
