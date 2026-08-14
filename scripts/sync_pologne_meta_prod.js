const mysql = require('mysql2/promise');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 30000,
};
const RACE_CODES = ['tour-pologne-2026', 'tour-pologne-women-2026'];

async function q(conn, sql, params, ms = 25000) {
  return Promise.race([
    conn.query(sql, params),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

(async () => {
  const l = await mysql.createConnection(LOCAL);
  const p = await mysql.createConnection(PROD);
  p.on('error', () => {});

  // 1. Replace PROD stages with LOCAL copies (same UUIDs)
  for (const code of RACE_CODES) {
    const [race] = await q(l, 'SELECT id FROM races WHERE race_code=?', [code]);
    const raceId = race[0].id;
    const [stages] = await q(l, 'SELECT * FROM stages WHERE race_id=? ORDER BY stage_number', [raceId]);
    await q(p, 'DELETE FROM stage_results WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM general_classification WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM points_classification WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM mountains_classification WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM youth_classification WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM team_classification WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM jerseys WHERE stage_id IN (SELECT id FROM stages WHERE race_id=?)', [raceId]);
    await q(p, 'DELETE FROM stages WHERE race_id=?', [raceId]);
    for (const s of stages) {
      await q(p, `INSERT INTO stages (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date,
        start_time, distance_km, elevation_m, start_city, start_city_zh, finish_city, finish_city_zh,
        weather_summary, stage_code, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [s.id, s.race_id, s.stage_number, s.stage_name, s.stage_name_zh, s.stage_type, s.date,
         s.start_time, s.distance_km, s.elevation_m, s.start_city, s.start_city_zh, s.finish_city,
         s.finish_city_zh, s.weather_summary, s.stage_code, s.created_at, s.updated_at]);
    }
    console.log(`${code}: PROD stages synced (${stages.length})`);
  }

  // 2. Sync missing riders (local-only) to PROD
  const [lr] = await q(l, 'SELECT id, rider_name, nationality, rider_slug FROM riders');
  const [pr] = await q(p, 'SELECT id FROM riders');
  const prodIds = new Set(pr.map(x => x.id));
  let added = 0;
  for (const r of lr) {
    if (!prodIds.has(r.id)) {
      await q(p, 'INSERT INTO riders (id, rider_name, nationality, rider_slug) VALUES (?,?,?,?)',
        [r.id, r.rider_name, r.nationality || 'UNK', r.rider_slug || null]);
      added++;
    }
  }
  console.log(`riders synced to PROD: ${added}`);

  // 3. Sync missing teams (local-only) to PROD
  const [lt] = await q(l, 'SELECT id, team_name, team_name_zh, team_name_en, category, country, uci_code FROM teams');
  const [pt] = await q(p, 'SELECT id FROM teams');
  const prodTeamIds = new Set(pt.map(x => x.id));
  let tAdded = 0;
  for (const t of lt) {
    if (!prodTeamIds.has(t.id)) {
      await q(p, 'INSERT INTO teams (id, team_name, team_name_zh, team_name_en, category, country, uci_code) VALUES (?,?,?,?,?,?,?)',
        [t.id, t.team_name, t.team_name_zh, t.team_name_en, t.category, t.country, t.uci_code]);
      tAdded++;
    }
  }
  console.log(`teams synced to PROD: ${tAdded}`);

  await l.end();
  await p.end();
  console.log('done');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
