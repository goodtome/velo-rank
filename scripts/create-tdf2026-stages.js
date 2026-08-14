/**
 * Quick script: 为 tdf-2026 创建 21 个赛段
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const STAGES = [
  { n: 1, d: '2026-07-04', start: 'Barcelona', finish: 'Barcelona', km: 19, type: 'TTT', zh: '巴塞罗那团队计时赛' },
  { n: 2, d: '2026-07-05', start: 'Tarragona', finish: 'Barcelona', km: 182, type: 'HILLS', zh: '塔拉戈纳 → 巴塞罗那' },
  { n: 3, d: '2026-07-06', start: 'Granollers', finish: 'Les Angles', km: 196, type: 'MOUNTAIN', zh: '格拉诺列尔斯 → 莱桑格勒' },
  { n: 4, d: '2026-07-07', start: 'Carcassonne', finish: 'Foix', km: 182, type: 'HILLS', zh: '卡尔卡松 → 富瓦' },
  { n: 5, d: '2026-07-08', start: 'Lannemezan', finish: 'Pau', km: 158, type: 'FLAT', zh: '拉讷默藏 → 波城' },
  { n: 6, d: '2026-07-09', start: 'Pau', finish: 'Gavarnie-Gedre', km: 186, type: 'MOUNTAIN', zh: '波城 → 加瓦尔尼-热德爾' },
  { n: 7, d: '2026-07-10', start: 'Hagetmau', finish: 'Bordeaux', km: 175, type: 'FLAT', zh: '阿热莫 → 波尔多' },
  { n: 8, d: '2026-07-11', start: 'Perigueux', finish: 'Bergerac', km: 182, type: 'FLAT', zh: '佩里格 → 贝尔热拉克' },
  { n: 9, d: '2026-07-12', start: 'Malemort', finish: 'Ussel', km: 185, type: 'HILLS', zh: '马勒莫尔 → 于塞勒' },
  { n: 10, d: '2026-07-14', start: 'Aurillac', finish: 'Le Lioran', km: 167, type: 'MOUNTAIN', zh: '欧里亚克 → 勒利奥朗' },
  { n: 11, d: '2026-07-15', start: 'Vichy', finish: 'Nevers', km: 161, type: 'FLAT', zh: '维希 → 讷韦尔' },
  { n: 12, d: '2026-07-16', start: 'Circuit Nevers Magny-Cours', finish: 'Chalon-sur-Saone', km: 181, type: 'FLAT', zh: '讷韦尔赛道 → 索恩河畔沙隆' },
  { n: 13, d: '2026-07-17', start: 'Dole', finish: 'Belfort', km: 205, type: 'HILLS', zh: '多勒 → 贝尔福' },
  { n: 14, d: '2026-07-18', start: 'Mulhouse', finish: 'Le Markstein Fellering', km: 155, type: 'MOUNTAIN', zh: '米卢斯 → 勒马克斯坦' },
  { n: 15, d: '2026-07-19', start: 'Champagnole', finish: 'Plateau de Solaison', km: 184, type: 'MOUNTAIN', zh: '尚帕尼奥勒 → 索莱松高原' },
  { n: 16, d: '2026-07-21', start: 'Evian-les-Bains', finish: 'Thonon-les-Bains', km: 26, type: 'ITT', zh: '埃维昂个人计时赛' },
  { n: 17, d: '2026-07-22', start: 'Chambery', finish: 'Voiron', km: 175, type: 'FLAT', zh: '尚贝里 → 瓦龙' },
  { n: 18, d: '2026-07-23', start: 'Voiron', finish: 'Orcieres-Merlette', km: 185, type: 'MOUNTAIN', zh: '瓦龙 → 奥尔西耶尔-梅莱特' },
  { n: 19, d: '2026-07-24', start: 'Gap', finish: 'Alpe d\'Huez', km: 128, type: 'MOUNTAIN', zh: '加普 → 阿尔普迪埃' },
  { n: 20, d: '2026-07-25', start: 'Le Bourg-d\'Oisans', finish: 'Alpe d\'Huez', km: 171, type: 'MOUNTAIN', zh: '布尔杜瓦桑 → 阿尔普迪埃' },
  { n: 21, d: '2026-07-26', start: 'Thoiry', finish: 'Paris Champs-Elysees', km: 130, type: 'FLAT', zh: '图瓦里 → 巴黎香榭丽舍' }
];

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db'
  });

  const [races] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  if (!races.length) { console.error('tdf-2026 not found'); process.exit(1); }
  const raceId = races[0].id;

  // 更新 race 基本信息
  await conn.query(
    "UPDATE races SET start_date='2026-07-04', end_date='2026-07-26', total_stages=21, total_distance=3333 WHERE id=?",
    [raceId]
  );

  let created = 0, updated = 0;
  for (const s of STAGES) {
    const code = 'tdf-2026-s' + String(s.n).padStart(2, '0');
    const name = s.start + ' -> ' + s.finish;
    const [exist] = await conn.query(
      'SELECT id FROM stages WHERE race_id=? AND stage_number=?', [raceId, s.n]
    );
    if (exist.length) {
      await conn.query(
        'UPDATE stages SET stage_name=?,stage_name_zh=?,stage_type=?,date=?,distance_km=?,start_city=?,finish_city=?,stage_code=? WHERE id=?',
        [name, s.zh, s.type, s.d, s.km, s.start, s.finish, code, exist[0].id]
      );
      updated++;
    } else {
      await conn.query(
        'INSERT INTO stages(id,race_id,stage_number,stage_name,stage_name_zh,stage_type,date,distance_km,start_city,finish_city,stage_code) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [uuidv4(), raceId, s.n, name, s.zh, s.type, s.d, s.km, s.start, s.finish, code]
      );
      created++;
    }
  }
  console.log('Stages: ' + created + ' created, ' + updated + ' updated');
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
