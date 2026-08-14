const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const RACES = [
  {
    code: 'arctic-norway-2026',
    stages: [
      { n: 1, d: '2026-08-13', start: 'Evenes', finish: 'Myre', km: 181.9, type: 'HILLS', zh: '埃韦内斯 → 米雷' },
      { n: 2, d: '2026-08-14', start: 'Bø i Vesterålen', finish: 'Andenes', km: 180, type: 'FLAT', zh: '韦斯特罗伦岛伯 → 安岛' },
      { n: 3, d: '2026-08-15', start: 'Stokmarknes', finish: 'Storheia Summit (Melbu)', km: 146.5, type: 'MOUNTAIN', zh: '斯托克马克内斯 → 斯托黑亚山顶' },
      { n: 4, d: '2026-08-16', start: 'Sortland', finish: 'Narvik', km: 190.5, type: 'HILLS', zh: '苏特兰 → 纳尔维克' },
    ],
  },
  {
    code: 'czech-tour-2026',
    stages: [
      { n: 1, d: '2026-08-13', start: 'Prague', finish: 'Karlovy Vary', km: 163.2, type: 'HILLS', zh: '布拉格 → 卡罗维发利' },
      { n: 2, d: '2026-08-14', start: 'Mladá Boleslav', finish: 'Ještěd', km: 155, type: 'HILLS', zh: '姆拉达博莱斯拉夫 → 耶什捷德' },
      { n: 3, d: '2026-08-15', start: 'Pardubice', finish: 'Dlouhé stráně', km: 170.9, type: 'MOUNTAIN', zh: '帕尔杜比采 → 德洛乌埃斯特拉内' },
      { n: 4, d: '2026-08-16', start: 'Kroměříž', finish: 'Pustevny', km: 160.2, type: 'MOUNTAIN', zh: '克罗梅日什 → 普斯特夫尼' },
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
