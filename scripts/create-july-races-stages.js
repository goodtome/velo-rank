const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const RACES = [
  {
    code: 'tour-qinghai-2026',
    totalStages: 8,
    endDate: '2026-07-18',
    stages: [
      { n: 1, d: '2026-07-11', start: 'Xining', finish: 'Xining', km: 0, type: 'FLAT', zh: '西宁 → 西宁' },
      { n: 2, d: '2026-07-12', start: 'Huangyuan', finish: 'Menyuan', km: 0, type: 'MOUNTAIN', zh: '湟源 → 门源' },
      { n: 3, d: '2026-07-13', start: 'Menyuan', finish: 'Huzhu', km: 0, type: 'HILLS', zh: '门源 → 互助' },
      { n: 4, d: '2026-07-14', start: 'Huzhu', finish: 'Guide', km: 0, type: 'MOUNTAIN', zh: '互助 → 贵德' },
      { n: 5, d: '2026-07-15', start: 'Guide', finish: 'Gonghe', km: 0, type: 'HILLS', zh: '贵德 → 共和' },
      { n: 6, d: '2026-07-16', start: 'Gonghe', finish: 'Gangcha', km: 0, type: 'FLAT', zh: '共和 → 刚察' },
      { n: 7, d: '2026-07-17', start: 'Gangcha', finish: 'Xihaizhen', km: 0, type: 'HILLS', zh: '刚察 → 西海镇' },
      { n: 8, d: '2026-07-18', start: 'Xihaizhen', finish: 'Qinghai Lake Scenic Area', km: 0, type: 'FLAT', zh: '西海镇 → 青海湖景区' },
    ],
  },
  {
    code: 'tour-denmark-2026',
    totalStages: 5,
    endDate: '2026-08-01',
    stages: [
      { n: 1, d: '2026-07-28', start: 'TBA', finish: 'TBA', km: 0, type: 'FLAT', zh: '待定' },
      { n: 2, d: '2026-07-29', start: 'TBA', finish: 'TBA', km: 0, type: 'FLAT', zh: '待定' },
      { n: 3, d: '2026-07-30', start: 'TBA', finish: 'TBA', km: 0, type: 'HILLS', zh: '待定' },
      { n: 4, d: '2026-07-31', start: 'TBA', finish: 'TBA', km: 0, type: 'HILLS', zh: '待定' },
      { n: 5, d: '2026-08-01', start: 'TBA', finish: 'TBA', km: 0, type: 'FLAT', zh: '待定' },
    ],
  },
];

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' });
  for (const race of RACES) {
    const [r] = await conn.query('SELECT id FROM races WHERE race_code=?', [race.code]);
    if (!r.length) { console.log(race.code, 'NOT FOUND'); continue; }
    const raceId = r[0].id;
    await conn.query('UPDATE races SET total_stages=?, end_date=? WHERE id=?', [race.totalStages, race.endDate, raceId]);
    await conn.query('DELETE FROM stages WHERE race_id=?', [raceId]);
    let created = 0;
    for (const s of race.stages) {
      const code = `${race.code}-s${String(s.n).padStart(2, '0')}`;
      const name = `${s.start} -> ${s.finish}`;
      await conn.query('INSERT INTO stages(id,race_id,stage_number,stage_name,stage_name_zh,stage_type,date,distance_km,start_city,finish_city,stage_code) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [uuidv4(), raceId, s.n, name, s.zh, s.type, s.d, s.km, s.start, s.finish, code]);
      created++;
    }
    console.log(`${race.code}: stages created ${created}, total_stages=${race.totalStages}`);
  }
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
