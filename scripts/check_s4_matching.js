/** Diagnose which S4 classification riders failed to match stage_results. */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4' };
const RACE_CODE = 'tdf-2026';

const normTokens = (s) => {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(n.split(/[^a-z0-9]+/).filter(Boolean));
};
const keyOf = (s) => [...normTokens(s)].sort().join('|');

async function getStageId(conn, num) {
  const [race] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  const [s] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [race[0].id, num]);
  return s[0].id;
}

function bestNearMatch(name, candidates) {
  const key = keyOf(name);
  const ka = key.split('|');
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const ck = keyOf(c.rider_name).split('|');
    const inter = ka.filter(x => ck.includes(x)).length;
    const score = inter / Math.max(ka.length, ck.length);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best ? { name: best.rider_name, score: bestScore.toFixed(2) } : null;
}

async function run() {
  const conn = await mysql.createConnection(LOCAL);
  const sid = await getStageId(conn, 4);
  const [sr] = await conn.query(
    'SELECT sr.rider_id, rd.rider_name FROM stage_results sr JOIN riders rd ON sr.rider_id=rd.id WHERE sr.stage_id=?', [sid]);
  const riderMap = new Map(sr.map(r => [keyOf(r.rider_name), r.rider_id]));
  const candidates = sr.map(r => ({ rider_name: r.rider_name, id: r.rider_id }));

  const dataFile = process.env.TDF_DATA_DIR
    ? path.join(path.resolve(process.env.TDF_DATA_DIR), 'tdf_s4_data.json')
    : path.join(__dirname, '..', 'archive', 'generated', '2026-tdf', 'classifications', 'tdf_s4_data.json');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  const missingByTable = {
    points: [25, 36, 39],
    mountains_classification: [17],
    youth: [18],
  };
  for (const [table, ranks] of Object.entries(missingByTable)) {
    const key = table === 'points' ? 'points' : table === 'mountains_classification' ? 'kom' : 'youth';
    console.log(`\n=== ${table} (ranks ${ranks.join(',')}) ===`);
    for (const rank of ranks) {
      const row = data[key].find(r => r.rank == rank);
      if (!row) { console.log(`  rank ${rank}: NOT in JSON`); continue; }
      const k = keyOf(row.rider);
      const matched = riderMap.has(k);
      const near = !matched ? bestNearMatch(row.rider, candidates) : null;
      console.log(`  rank ${rank}: "${row.rider}" (pc: ${row.points || row.time_gap}) matched=${matched} near=${JSON.stringify(near)}`);
    }
  }
  await conn.end();
}
run().catch(e => { console.error(e); process.exit(1); });
