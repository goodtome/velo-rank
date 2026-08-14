/**
 * Sync TDF 2026 data from local MySQL to production TiDB
 * 
 * Syncs: races, stages, riders, teams, stage_results, general_classification, jerseys
 * Only for tdf-2026
 */

const mysql = require('mysql2/promise');

const LOCAL = {
  host: '127.0.0.1', port: 13306, user: 'root',
  password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4'
};

const PROD = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2A7GiKTCf4sRJLw.root',
  password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db',
  charset: 'utf8mb4',
  ssl: { rejectUnauthorized: true },
  connectTimeout: 15000
};

const SYNC_TABLES = [
  'races',
  'stages', 
  'stage_results',
  'general_classification',
  'jerseys'
];

async function syncTable(localConn, prodConn, table, whereClause, keyField = 'id') {
  // Get local data
  const [localRows] = await localConn.query(
    `SELECT * FROM ${table} WHERE ${whereClause}`
  );
  if (!localRows.length) {
    console.log(`  ${table}: 0 local rows, skipping`);
    return { inserted: 0, updated: 0 };
  }

  // Get existing production IDs
  const ids = localRows.map(r => r[keyField]);
  const placeholders = ids.map(() => '?').join(',');
  
  let existingIds = new Set();
  try {
    const [prodRows] = await prodConn.query(
      `SELECT ${keyField} FROM ${table} WHERE ${keyField} IN (${placeholders})`,
      ids
    );
    prodRows.forEach(r => existingIds.add(r[keyField]));
  } catch (e) {
    // Key field might not exist — fall through
  }

  // Get production column names to filter INSERT columns
  const [columns] = await prodConn.query(`SHOW COLUMNS FROM ${table}`);
  const prodCols = new Set(columns.map(c => c.Field));

  let inserted = 0, updated = 0;
  for (const row of localRows) {
    const sid = row[keyField];
    
    // Filter to only include columns that exist in production
    const filteredRow = {};
    for (const [k, v] of Object.entries(row)) {
      if (prodCols.has(k)) filteredRow[k] = v;
    }
    
    const colNames = Object.keys(filteredRow);
    const values = colNames.map(c => filteredRow[c]);
    const placeholders = colNames.map(() => '?').join(',');
    const joinedCols = colNames.map(c => '`' + c + '`').join(',');

    if (existingIds.has(sid)) {
      // UPDATE
      const setClause = colNames
        .filter(c => c !== keyField)
        .map(c => '`' + c + '` = ?')
        .join(', ');
      const updateValues = colNames
        .filter(c => c !== keyField)
        .map(c => filteredRow[c]);
      updateValues.push(sid);
      
      await prodConn.query(
        `UPDATE ${table} SET ${setClause} WHERE \`${keyField}\` = ?`,
        updateValues
      );
      updated++;
    } else {
      // INSERT
      try {
        await prodConn.query(
          `INSERT INTO ${table} (${joinedCols}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      } catch (e) {
        console.log(`    ⚠️ INSERT ${table} ${sid}: ${e.message.substring(0, 80)}`);
      }
    }
  }

  const action = inserted > 0 || updated > 0 ? 
    `${inserted} inserted, ${updated} updated` : 'no changes';
  console.log(`  ${table}: ${localRows.length} local → ${action}`);
  return { inserted, updated };
}

async function main() {
  console.log('=== Sync TDF 2026: Local → TiDB ===\n');

  const localConn = await mysql.createConnection(LOCAL);
  const prodConn = await mysql.createConnection(PROD);
  console.log('Connected to both databases.\n');

  // Get race ID
  const [localRace] = await localConn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  if (!localRace.length) { console.error('tdf-2026 not found locally'); return; }
  const raceId = localRace[0].id;

  const [localStages] = await localConn.query(
    'SELECT id FROM stages WHERE race_id = ?', [raceId]
  );
  const stageIds = localStages.map(s => s.id);

  console.log(`Race: ${raceId}, Stages: ${stageIds.length}\n`);

  // 1. Sync race
  await syncTable(localConn, prodConn, 'races', `race_code='tdf-2026'`, 'race_code');

  // 2. Sync stages
  await syncTable(localConn, prodConn, 'stages', `race_id='${raceId}'`, 'id');

  // 3. Sync stage_results
  for (const sid of stageIds) {
    const [cnt] = await localConn.query('SELECT COUNT(*) as c FROM stage_results WHERE stage_id=?', [sid]);
    if (cnt[0].c === 0) continue;
    await syncTable(localConn, prodConn, 'stage_results', `stage_id='${sid}'`, 'id');
  }

  // 4. Sync GC
  for (const sid of stageIds) {
    const [cnt] = await localConn.query('SELECT COUNT(*) as c FROM general_classification WHERE stage_id=?', [sid]);
    if (cnt[0].c === 0) continue;
    await syncTable(localConn, prodConn, 'general_classification', `stage_id='${sid}'`, 'id');
  }

  // 5. Sync jerseys
  for (const sid of stageIds) {
    const [cnt] = await localConn.query('SELECT COUNT(*) as c FROM jerseys WHERE stage_id=?', [sid]);
    if (cnt[0].c === 0) continue;
    await syncTable(localConn, prodConn, 'jerseys', `stage_id='${sid}'`, 'id');
  }

  // Also sync riders that are in TDF but missing from prod
  console.log('\n--- Riders ---');
  const [localRiders] = await localConn.query(`
    SELECT DISTINCT rd.* FROM riders rd
    JOIN stage_results sr ON sr.rider_id = rd.id
    JOIN stages s ON s.id = sr.stage_id
    WHERE s.race_id = ?
  `, [raceId]);
  
  const riderIds = localRiders.map(r => r.id);
  if (riderIds.length > 0) {
    const placeholders = riderIds.map(() => '?').join(',');
    const [prodRiders] = await prodConn.query(
      `SELECT id FROM riders WHERE id IN (${placeholders})`, riderIds
    );
    const existingRiderIds = new Set(prodRiders.map(r => r.id));
    
    const [prodCols] = await prodConn.query('SHOW COLUMNS FROM riders');
    const riderProdCols = new Set(prodCols.map(c => c.Field));

    let riderInserted = 0;
    for (const rider of localRiders) {
      if (existingRiderIds.has(rider.id)) continue;
      
      const filtered = {};
      for (const [k, v] of Object.entries(rider)) {
        if (riderProdCols.has(k)) filtered[k] = v;
      }
      
      const cols = Object.keys(filtered);
      try {
        await prodConn.query(
          `INSERT INTO riders (${cols.map(c => '`'+c+'`').join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          cols.map(c => filtered[c])
        );
        riderInserted++;
      } catch (e) {
        console.log(`  ⚠️ Rider ${rider.rider_name}: ${e.message.substring(0, 60)}`);
      }
    }
    console.log(`  riders: ${localRiders.length} local, ${riderInserted} new inserted, ${existingRiderIds.size} existing`);
  }

  // Verification
  console.log('\n=== Verification ===');
  const [prodS1] = await prodConn.query(
    'SELECT COUNT(*) as c FROM stage_results sr JOIN stages s ON sr.stage_id=s.id WHERE s.race_id=? AND s.stage_number=1',
    [raceId]
  );
  console.log(`Production TDF S1 results: ${prodS1[0].c}`);
  
  const [prodJerseys] = await prodConn.query(
    'SELECT COUNT(*) as c FROM jerseys j JOIN stages s ON j.stage_id=s.id WHERE s.race_id=?',
    [raceId]
  );
  console.log(`Production TDF jerseys: ${prodJerseys[0].c}`);

  await localConn.end();
  await prodConn.end();
  console.log('\n✅ Sync complete!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
