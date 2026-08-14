const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const RACES = [
  {
    code: 'tour-pologne-2026',
    stages: [
      { n: 1, d: '2026-08-03', start: 'Gdynia', finish: 'Koszalin', km: 234.2, type: 'FLAT', zh: '格丁尼亚 → 科沙林' },
      { n: 2, d: '2026-08-04', start: 'Miedzyzdroje', finish: 'Szczecin', km: 150.1, type: 'FLAT', zh: '米兹多罗耶 → 什切青' },
      { n: 3, d: '2026-08-05', start: 'Gorzow Wielkopolski', finish: 'Zielona Gora', km: 193.5, type: 'FLAT', zh: '大波兰地区戈茹夫 → 绿山城' },
      { n: 4, d: '2026-08-06', start: 'Zagan', finish: 'Karpacz', km: 176, type: 'HILLS', zh: '扎甘 → 卡尔帕奇' },
      { n: 5, d: '2026-08-07', start: 'Opole', finish: 'Kocierz Resort', km: 218.9, type: 'MOUNTAIN', zh: '奥波莱 → 科切日度假村' },
      { n: 6, d: '2026-08-08', start: 'Bukovina Resort', finish: 'Bukowina Tatrzanska', km: 125.5, type: 'MOUNTAIN', zh: '布科维纳度假村 → 塔特拉山布科维纳' },
      { n: 7, d: '2026-08-09', start: 'Wieliczka', finish: 'Wieliczka', km: 12.5, type: 'ITT', zh: '维利奇卡个人计时赛' },
    ],
  },
  {
    code: 'tour-pologne-women-2026',
    stages: [
      { n: 1, d: '2026-07-24', start: 'Tomaszow Lubelski', finish: 'Zamosc', km: 138.4, type: 'FLAT', zh: '卢布林地区托马舒夫 → 扎莫希奇' },
      { n: 2, d: '2026-07-25', start: 'Wlodawa', finish: 'Lubartow', km: 117.8, type: 'FLAT', zh: '沃达瓦 → 卢巴尔图夫' },
      { n: 3, d: '2026-07-26', start: 'Janowiec', finish: 'Lublin', km: 101.3, type: 'FLAT', zh: '亚诺维茨 → 卢布林' },
    ],
  },
];

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' });
  for (const race of RACES) {
    const [r] = await conn.query('SELECT id FROM races WHERE race_code=?', [race.code]);
    if (!r.length) { console.log(race.code, 'NOT FOUND'); continue; }
    const raceId = r[0].id;
    let created = 0, updated = 0;
    for (const s of race.stages) {
      const code = `${race.code}-s${String(s.n).padStart(2, '0')}`;
      const name = `${s.start} -> ${s.finish}`;
      const [exist] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [raceId, s.n]);
      if (exist.length) {
        await conn.query('UPDATE stages SET stage_name=?,stage_name_zh=?,stage_type=?,date=?,distance_km=?,start_city=?,finish_city=?,stage_code=? WHERE id=?', [name, s.zh, s.type, s.d, s.km, s.start, s.finish, code, exist[0].id]);
        updated++;
      } else {
        await conn.query('INSERT INTO stages(id,race_id,stage_number,stage_name,stage_name_zh,stage_type,date,distance_km,start_city,finish_city,stage_code) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [uuidv4(), raceId, s.n, name, s.zh, s.type, s.d, s.km, s.start, s.finish, code]);
        created++;
      }
    }
    console.log(`${race.code}: ${created} created, ${updated} updated`);
  }
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
