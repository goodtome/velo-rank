const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const STAGES = [
  { n: 1, d: '2026-08-01', start: 'Lausanne', finish: 'Lausanne', km: 138, type: 'HILLS', zh: '洛桑 → 洛桑' },
  { n: 2, d: '2026-08-02', start: 'Aigle', finish: 'Geneva', km: 147.9, type: 'FLAT', zh: '艾格勒 → 日内瓦' },
  { n: 3, d: '2026-08-03', start: 'Geneva', finish: 'Poligny', km: 156.5, type: 'HILLS', zh: '日内瓦 → 波利尼' },
  { n: 4, d: '2026-08-04', start: 'Gevrey-Chambertin', finish: 'Dijon', km: 21, type: 'ITT', zh: '热夫雷-香贝丹 → 第戎' },
  { n: 5, d: '2026-08-05', start: 'Macon', finish: 'Belleville-en-Beaujolais', km: 140, type: 'HILLS', zh: '马孔 → 博若莱地区贝尔维尔' },
  { n: 6, d: '2026-08-06', start: 'Montbrison', finish: 'Tournon-sur-Rhone', km: 153.4, type: 'HILLS', zh: '蒙布里松 → 罗讷河畔图尔农' },
  { n: 7, d: '2026-08-07', start: 'La Voulte-sur-Rhone', finish: 'Mont Ventoux', km: 146.8, type: 'MOUNTAIN', zh: '罗讷河畔拉武尔特 → 旺图山' },
  { n: 8, d: '2026-08-08', start: 'Sisteron', finish: 'Nice', km: 171.9, type: 'HILLS', zh: '锡斯特龙 → 尼斯' },
  { n: 9, d: '2026-08-09', start: 'Nice', finish: 'Nice', km: 99.2, type: 'HILLS', zh: '尼斯 → 尼斯' },
];

(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' });
  const [races] = await conn.query("SELECT id FROM races WHERE race_code='tdf-women-2026'");
  if (!races.length) throw new Error('tdf-women-2026 not found');
  const raceId = races[0].id;
  await conn.query("UPDATE races SET start_date='2026-08-01', end_date='2026-08-09', total_stages=9, total_distance=1174.7 WHERE id=?", [raceId]);
  let created = 0, updated = 0;
  for (const s of STAGES) {
    const code = `tdf-women-2026-s${String(s.n).padStart(2, '0')}`;
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
  console.log(`Women TDF stages: ${created} created, ${updated} updated`);
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
