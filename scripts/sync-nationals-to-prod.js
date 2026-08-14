/**
 * Sync Italian & French Nationals data fixes to production
 */

const mysql = require('mysql2/promise');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const PROD = { host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000, user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc', database: 'jersey_db', ssl: { rejectUnauthorized: true }, connectTimeout: 10000 };

async function syncTable(localConn, prodConn, table, whereClause) {
  const [localRows] = await localConn.query(`SELECT * FROM ${table} WHERE ${whereClause}`);
  if (!localRows.length) return 0;

  const ids = localRows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const [prodRows] = await prodConn.query(`SELECT id FROM ${table} WHERE id IN (${placeholders})`, ids);
  const existingIds = new Set(prodRows.map(r => r.id));

  const [columns] = await prodConn.query(`SHOW COLUMNS FROM ${table}`);
  const prodCols = new Set(columns.map(c => c.Field));

  let inserted = 0, updated = 0;
  for (const row of localRows) {
    const filtered = {};
    for (const [k, v] of Object.entries(row)) {
      if (prodCols.has(k)) filtered[k] = v;
    }

    const cols = Object.keys(filtered);
    const vals = cols.map(c => filtered[c]);

    if (existingIds.has(row.id)) {
      const setClause = cols.filter(c => c !== 'id').map(c => '`' + c + '` = ?').join(', ');
      const updateVals = cols.filter(c => c !== 'id').map(c => filtered[c]);
      updateVals.push(row.id);
      await prodConn.query(`UPDATE ${table} SET ${setClause} WHERE id = ?`, updateVals);
      updated++;
    } else {
      const ph = cols.map(() => '?').join(',');
      const cn = cols.map(c => '`' + c + '`').join(',');
      await prodConn.query(`INSERT INTO ${table} (${cn}) VALUES (${ph})`, vals);
      inserted++;
    }
  }
  return { inserted, updated };
}

async function main() {
  console.log('=== Sync Nationals Fixes to Production ===\n');
  const l = await mysql.createConnection(LOCAL);
  const p = await mysql.createConnection(PROD);

  // Italian NC stages
  const [itaStages] = await l.query(
    "SELECT s.id, s.stage_number, s.stage_name_zh FROM stages s JOIN races r ON s.race_id=r.id WHERE r.race_code='italian-nationals-2026' ORDER BY s.stage_number"
  );

  for (const s of itaStages) {
    // Check if stage exists in prod
    const [prodS] = await p.query('SELECT id FROM stages WHERE id=?', [s.id]);
    if (!prodS.length) {
      // Insert stage
      const [localS] = await l.query('SELECT * FROM stages WHERE id=?', [s.id]);
      if (localS.length) {
        const [cols] = await p.query('SHOW COLUMNS FROM stages');
        const pc = new Set(cols.map(c => c.Field));
        const f = {};
        for (const [k,v] of Object.entries(localS[0])) { if(pc.has(k)) f[k]=v; }
        const cn=Object.keys(f), cv=cn.map(c=>f[c]);
        await p.query(`INSERT INTO stages (${cn.map(c=>'`'+c+'`').join(',')}) VALUES (${cn.map(()=>'?').join(',')})`, cv);
        console.log(`  + Stage S${s.stage_number} (${s.stage_name_zh}) created`);
      }
    }

    // Sync stage_results
    const [cnt] = await l.query('SELECT COUNT(*) as c FROM stage_results WHERE stage_id=?', [s.id]);
    if (cnt[0].c > 0) {
      const r = await syncTable(l, p, 'stage_results', `stage_id='${s.id}'`);
      if (r && (r.inserted + r.updated) > 0) {
        console.log(`  S${s.stage_number} stage_results: ${r.inserted} ins, ${r.updated} upd`);
      }
    }
  }

  // French NC stages (fix nationality + time_gap in existing records)
  const [fraStages] = await l.query(
    "SELECT s.id, s.stage_number, s.stage_name_zh FROM stages s JOIN races r ON s.race_id=r.id WHERE r.race_code='french-nationals-2026' ORDER BY s.stage_number"
  );

  for (const s of fraStages) {
    const r = await syncTable(l, p, 'stage_results', `stage_id='${s.id}'`);
    if (r && (r.inserted + r.updated) > 0) {
      console.log(`  FR S${s.stage_number} stage_results: ${r.inserted} ins, ${r.updated} upd`);
    }
  }

  // Update race total_stages for Italian NC
  await p.query("UPDATE races SET total_stages=3, end_date='2026-06-28' WHERE race_code='italian-nationals-2026'");

  // Verify
  console.log('\n=== Final Verification ===');
  const checks = [
    ['Italian NC S3 WRR', "SELECT COUNT(*) as c FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='italian-nationals-2026' AND s.stage_number=3"],
    ['Italian NC S2 nationality', "SELECT COUNT(*) as c FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='italian-nationals-2026' AND s.stage_number=2 AND sr.nationality='ITA'"],
    ['French NC S4 nationality', "SELECT COUNT(*) as c FROM stage_results sr JOIN stages s ON sr.stage_id=s.id JOIN races r ON s.race_id=r.id WHERE r.race_code='french-nationals-2026' AND s.stage_number=4 AND sr.nationality='FRA'"],
  ];
  
  for (const [label, sql] of checks) {
    const [lr] = await l.query(sql);
    const [pr] = await p.query(sql);
    console.log(`  ${label}: local=${lr[0].c} prod=${pr[0].c} ${lr[0].c===pr[0].c?'✅':'⚠️'}`);
  }

  await l.end(); await p.end();
  console.log('\n✅ Sync complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
