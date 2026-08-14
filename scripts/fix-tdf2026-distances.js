/**
 * TdF 2026 赛段数据修正 — 精确到一位小数
 * 
 * 数据来源: PCS route/stage-profiles (2026-07-03)
 * 总距离: 3321.2 km (之前错误使用了 3333 km)
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: '127.0.0.1', port: 13306, user: 'root',
  password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4'
};

// PCS 精确数据 (距离一位小数, 爬升米)
const STAGES = [
  { n: 1,  date: '2026-07-04', start: 'Barcelona', finish: 'Barcelona', km: 19.6, elv: 220,  type: 'TTT',
    zh: '巴塞罗那团队计时赛', name: 'Barcelona → Barcelona (TTT)' },
  { n: 2,  date: '2026-07-05', start: 'Tarragona', finish: 'Barcelona', km: 168.5, elv: 2049, type: 'HILLS',
    zh: '塔拉戈纳 → 巴塞罗那', name: 'Tarragona → Barcelona' },
  { n: 3,  date: '2026-07-06', start: 'Granollers', finish: 'Les Angles', km: 195.9, elv: 3940, type: 'MOUNTAIN',
    zh: '格拉诺列尔斯 → 莱桑格勒', name: 'Granollers → Les Angles' },
  { n: 4,  date: '2026-07-07', start: 'Carcassonne', finish: 'Foix', km: 181.9, elv: 2784, type: 'HILLS',
    zh: '卡尔卡松 → 富瓦', name: 'Carcassonne → Foix' },
  { n: 5,  date: '2026-07-08', start: 'Lannemezan', finish: 'Pau', km: 158.3, elv: 1395, type: 'HILLS',
    zh: '拉讷默藏 → 波城', name: 'Lannemezan → Pau' },
  { n: 6,  date: '2026-07-09', start: 'Pau', finish: 'Gavarnie-Gèdre', km: 186.2, elv: 4149, type: 'MOUNTAIN',
    zh: '波城 → 加瓦尔尼-热德尔', name: 'Pau → Gavarnie-Gèdre' },
  { n: 7,  date: '2026-07-10', start: 'Hagetmau', finish: 'Bordeaux', km: 175.1, elv: 701,  type: 'FLAT',
    zh: '阿热莫 → 波尔多', name: 'Hagetmau → Bordeaux' },
  { n: 8,  date: '2026-07-11', start: 'Périgueux', finish: 'Bergerac', km: 180.4, elv: 1353, type: 'FLAT',
    zh: '佩里格 → 贝尔热拉克', name: 'Périgueux → Bergerac' },
  { n: 9,  date: '2026-07-12', start: 'Malemort', finish: 'Ussel', km: 185.5, elv: 3244, type: 'HILLS',
    zh: '马勒莫尔 → 于塞勒', name: 'Malemort → Ussel' },
  // 7/13 休息日
  { n: 10, date: '2026-07-14', start: 'Aurillac', finish: 'Le Lioran', km: 166.6, elv: 3791, type: 'MOUNTAIN',
    zh: '欧里亚克 → 勒利奥朗', name: 'Aurillac → Le Lioran' },
  { n: 11, date: '2026-07-15', start: 'Vichy', finish: 'Nevers', km: 161.3, elv: 1107, type: 'FLAT',
    zh: '维希 → 讷韦尔', name: 'Vichy → Nevers' },
  { n: 12, date: '2026-07-16', start: 'Circuit Nevers Magny-Cours', finish: 'Chalon-sur-Saône', km: 179.1, elv: 1412, type: 'FLAT',
    zh: '讷韦尔赛道 → 索恩河畔沙隆', name: 'Nevers Magny-Cours → Chalon-sur-Saône' },
  { n: 13, date: '2026-07-17', start: 'Dole', finish: 'Belfort', km: 205.8, elv: 2309, type: 'HILLS',
    zh: '多勒 → 贝尔福', name: 'Dole → Belfort' },
  { n: 14, date: '2026-07-18', start: 'Mulhouse', finish: 'Le Markstein', km: 155.3, elv: 3941, type: 'MOUNTAIN',
    zh: '米卢斯 → 勒马克斯坦', name: 'Mulhouse → Le Markstein' },
  { n: 15, date: '2026-07-19', start: 'Champagnole', finish: 'Plateau de Solaison', km: 183.9, elv: 4098, type: 'MOUNTAIN',
    zh: '尚帕尼奥勒 → 索莱松高原', name: 'Champagnole → Plateau de Solaison' },
  // 7/20 休息日
  { n: 16, date: '2026-07-21', start: 'Évian-les-Bains', finish: 'Thonon-les-Bains', km: 26.1, elv: 470,  type: 'ITT',
    zh: '埃维昂个人计时赛', name: 'Évian-les-Bains → Thonon-les-Bains (ITT)' },
  { n: 17, date: '2026-07-22', start: 'Chambéry', finish: 'Voiron', km: 174.7, elv: 2362, type: 'HILLS',
    zh: '尚贝里 → 瓦龙', name: 'Chambéry → Voiron' },
  { n: 18, date: '2026-07-23', start: 'Voiron', finish: 'Orcières-Merlette', km: 185.2, elv: 3944, type: 'MOUNTAIN',
    zh: '瓦龙 → 奥尔西耶尔-梅莱特', name: 'Voiron → Orcières-Merlette' },
  { n: 19, date: '2026-07-24', start: 'Gap', finish: "Alpe d'Huez", km: 127.9, elv: 3572, type: 'MOUNTAIN',
    zh: '加普 → 阿尔普迪埃', name: "Gap → Alpe d'Huez" },
  { n: 20, date: '2026-07-25', start: "Le Bourg d'Oisans", finish: "Alpe d'Huez", km: 170.9, elv: 5624, type: 'MOUNTAIN',
    zh: '布尔杜瓦桑 → 阿尔普迪埃', name: "Le Bourg d'Oisans → Alpe d'Huez" },
  { n: 21, date: '2026-07-26', start: 'Thoiry', finish: 'Paris (Champs-Élysées)', km: 133.0, elv: 1295, type: 'FLAT',
    zh: '图瓦里 → 巴黎香榭丽舍', name: 'Thoiry → Paris Champs-Élysées' }
];

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  
  const [races] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  if (!races.length) { console.error('tdf-2026 not found'); process.exit(1); }
  const raceId = races[0].id;

  // 更新 race total_distance: 3333 → 3321.2
  const totalKm = STAGES.reduce((s, x) => s + x.km, 0);
  await conn.query(
    "UPDATE races SET total_distance = ?, total_stages = 21 WHERE id = ?",
    [totalKm, raceId]
  );
  console.log(`Race updated: total_distance ${totalKm} km`);

  let updated = 0;
  for (const s of STAGES) {
    const [exist] = await conn.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?', [raceId, s.n]
    );
    if (exist.length) {
      await conn.query(
        `UPDATE stages SET
          stage_name = ?, stage_name_zh = ?, stage_type = ?, date = ?,
          distance_km = ?, elevation_m = ?, start_city = ?, finish_city = ?
         WHERE id = ?`,
        [s.name, s.zh, s.type, s.date, s.km, s.elv, s.start, s.finish, exist[0].id]
      );
      updated++;
    } else {
      console.log(`  S${s.n} not found, skipping`);
    }
  }

  // 验证
  console.log(`\n${updated}/21 stages updated\n`);
  const [stages] = await conn.query(
    'SELECT stage_number, date, stage_name_zh, stage_type, distance_km, elevation_m FROM stages WHERE race_id = ? ORDER BY stage_number',
    [raceId]
  );
  let verifyTotal = 0;
  stages.forEach(s => {
    const d = parseFloat(s.distance_km) || 0;
    verifyTotal += d;
    const dateStr = String(s.date).substring(0, 10);
    console.log(`  S${String(s.stage_number).padStart(2,'0')} | ${dateStr} | ${s.stage_name_zh.padEnd(18)} | ${String(d).padEnd(6)}km | ${String(s.elevation_m).padStart(5)}m | ${s.stage_type}`);
  });
  console.log(`\n  Total: ${verifyTotal.toFixed(1)} km (expected ${totalKm.toFixed(1)})`);
  console.log(`  Match: ${Math.abs(verifyTotal - totalKm) < 0.1 ? '✅' : '❌ MISMATCH!'}`);

  await conn.end();
  console.log('\n✅ TDF 2026 stage distances updated to PCS-sourced values.');
}

main().catch(e => { console.error(e); process.exit(1); });
