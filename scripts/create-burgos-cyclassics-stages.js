const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// 元数据来源：PCS（temp/fetch_race_stages.py 抓取）
const RACES = [
  {
    code: 'vuelta-burgos-2026',
    stages: [
      { n: 1, d: '2026-08-04', start: 'Gumiel de Izán', finish: 'Burgos (Alto del Castillo)', km: 165, type: 'HILLS', zh: '古米耶尔德伊桑 → 布尔戈斯' },
      { n: 2, d: '2026-08-05', start: 'Arcos de la Llana', finish: 'Pineda de la Sierra (Valle del Sol)', km: 178, type: 'MOUNTAIN', zh: '阿尔科斯德拉亚纳 → 皮内达德拉谢拉' },
      { n: 3, d: '2026-08-06', start: 'Merindad de Montija', finish: 'Balneario de Corconte', km: 184, type: 'HILLS', zh: '梅林达德蒙蒂哈 → 巴尔内阿里奥德科尔孔特' },
      { n: 4, d: '2026-08-07', start: 'Palazuelos de Muñó', finish: 'Briviesca', km: 178, type: 'FLAT', zh: '帕拉苏埃洛斯德穆尼奥 → 布里维耶斯卡' },
      { n: 5, d: '2026-08-08', start: 'Caleruega', finish: 'Lagunas de Neila', km: 137, type: 'MOUNTAIN', zh: '卡莱鲁埃加 → 拉古纳斯德内拉' },
    ],
  },
  {
    code: 'cyclassics-hamburg-2026',
    stages: [
      { n: 1, d: '2026-08-16', start: 'Hamburg', finish: 'Hamburg', km: 205.3, type: 'HILLS', zh: '汉堡（单日赛）' },
    ],
  },
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 13306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jersey_db',
  });
  for (const race of RACES) {
    const [r] = await conn.query('SELECT id, total_stages FROM races WHERE race_code=?', [race.code]);
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
