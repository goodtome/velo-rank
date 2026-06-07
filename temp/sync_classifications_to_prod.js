const mysql = require('mysql2/promise');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const localConfig = { host: 'localhost', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const prodConfig = {
  host: process.env.DB_HOST_PROD, port: parseInt(process.env.DB_PORT_PROD) || 4000,
  user: process.env.DB_USER_PROD, password: process.env.DB_PASSWORD_PROD, database: process.env.DB_NAME_PROD,
  ssl: { rejectUnauthorized: true }
};

const STAGE_IDS = [
  "25173cfa-0a4c-4316-9964-c0dc85c1bf0d", "11bf5587-e1c2-4048-99cd-1994350eddf7", "8d102737-3141-4fac-b95a-f52b23b4045c",
  "416a491a-936f-49c0-aa74-009eda27cd17", "26f94f11-7c98-4ab5-a14c-36f97b363917", "fda90417-0279-4f83-a6f8-21b77cc119ee",
  "a4ff39ee-3a68-4c03-938c-e4f365cad6ee", "15401963-befe-4765-bc3e-527f0e742171", "6d53cdd1-f51c-4b5a-8edc-6b50ece7fc10",
  "ab4d70b3-b05a-4229-85d0-5f64e0ddf7a1", "c6b91874-dc4b-48c0-8f5c-aa8de746e988", "f67aba14-54b6-4ca9-9979-75eebdea1094",
  "48925f65-7809-4d2d-b56b-d0afce170c51", "a95eb43d-e2c0-4311-80c0-527fc965c95f", "aa458ebe-1ac6-47ec-b558-b884d1695a65",
  "c60c9527-6f86-4ef5-a9a0-7571ea890be4", "fe6ae4b2-f6fd-4b26-8ac8-1c65b187df52", "9376b9fa-da48-4bf4-9f39-709b4baea9d0",
  "c7783c90-c346-41c8-8799-9080da8b11ee", "f4ab60ad-2def-44ea-92de-48f1f85f409b", "3284bc70-8a33-4c0d-adb2-e1f14d22b7fb"
];

async function syncTable(localConn, prodConn, table, stageId, riderBased = true) {
  const hasTeamId = table === 'general_classification' || table === 'team_classification';
  const query = `
    SELECT t.* ${riderBased ? ', rd.rider_slug, rd.rider_name, rd.rider_name_zh, rd.nationality as rd_nat' : ''}
           ${hasTeamId ? ', tm.team_slug, tm.team_name, tm.team_name_en, tm.uci_code' : ''}
    FROM ${table} t
    ${riderBased ? 'LEFT JOIN riders rd ON t.rider_id = rd.id' : ''}
    ${hasTeamId ? 'LEFT JOIN teams tm ON t.team_id = tm.id' : ''}
    WHERE t.stage_id = ?`;
  
  const [localRows] = await localConn.query(query, [stageId]);

  if (localRows.length === 0) return;

  await prodConn.query(`DELETE FROM ${table} WHERE stage_id = ?`, [stageId]);

  const riderSlugs = [...new Set(localRows.filter(r => r.rider_slug).map(r => r.rider_slug))];
  const teamSlugs = [...new Set(localRows.filter(r => r.team_slug).map(r => r.team_slug))];
  const teamNames = [...new Set(localRows.filter(r => r.team_name).map(r => r.team_name))];

  const riderMap = new Map();
  if (riderSlugs.length > 0) {
    const [prodRiders] = await prodConn.query('SELECT id, rider_slug FROM riders WHERE rider_slug IN (?)', [riderSlugs]);
    prodRiders.forEach(r => riderMap.set(r.rider_slug, r.id));
    for (const row of localRows) {
      if (row.rider_slug && !riderMap.has(row.rider_slug)) {
        const id = uuidv4();
        await prodConn.query('INSERT INTO riders (id, rider_name, rider_name_zh, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', [id, row.rider_name, row.rider_name_zh, row.rider_slug, row.rd_nat]);
        riderMap.set(row.rider_slug, id);
      }
    }
  }

  const teamMap = new Map();
  if (teamNames.length > 0 || teamSlugs.length > 0) {
    const [prodTeams] = await prodConn.query('SELECT id, team_slug, team_name FROM teams WHERE team_slug IN (?) OR team_name IN (?)', [teamSlugs.length ? teamSlugs : [''], teamNames.length ? teamNames : ['']]);
    prodTeams.forEach(t => { if (t.team_slug) teamMap.set(t.team_slug, t.id); teamMap.set(t.team_name, t.id); });
    for (const row of localRows) {
      const key = row.team_slug || row.team_name;
      if (key && !teamMap.has(key)) {
        const id = uuidv4();
        await prodConn.query('INSERT INTO teams (id, team_name, team_name_en, uci_code, team_slug, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [id, row.team_name, row.team_name_en, row.uci_code, row.team_slug]);
        teamMap.set(key, id);
      }
    }
  }

  const bulkValues = localRows.map(r => {
    if (table === 'general_classification') {
      return [uuidv4(), stageId, r.rank, riderMap.get(r.rider_slug), teamMap.get(r.team_slug || r.team_name), r.nationality, r.total_time, r.time_gap, new Date()];
    } else if (table === 'team_classification') {
      return [uuidv4(), stageId, r.rank, teamMap.get(r.team_slug || r.team_name), r.total_time, r.time_gap, new Date()];
    } else if (table === 'points_classification' || table === 'mountains_classification') {
      return [stageId, riderMap.get(r.rider_slug), r.rank, r.points, r.jersey_type, new Date()];
    } else if (table === 'youth_classification') {
      return [stageId, riderMap.get(r.rider_slug), r.rank, r.time, r.time_gap, r.jersey_type, new Date()];
    }
  });

  const columns = {
    'general_classification': '(id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap, created_at)',
    'team_classification': '(id, stage_id, `rank`, team_id, total_time, time_gap, created_at)',
    'points_classification': '(stage_id, rider_id, `rank`, points, jersey_type, created_at)',
    'mountains_classification': '(stage_id, rider_id, `rank`, points, jersey_type, created_at)',
    'youth_classification': '(stage_id, rider_id, `rank`, `time`, time_gap, jersey_type, created_at)'
  };

  await prodConn.query(`INSERT INTO ${table} ${columns[table]} VALUES ?`, [bulkValues]);
  console.log(`  Synced ${localRows.length} rows for ${table} in stage ${stageId}`);
}

const STAGE_IDS_TO_SYNC = [
  "ab4d70b3-b05a-4229-85d0-5f64e0ddf7a1", "c6b91874-dc4b-48c0-8f5c-aa8de746e988", "f67aba14-54b6-4ca9-9979-75eebdea1094",
  "48925f65-7809-4d2d-b56b-d0afce170c51", "a95eb43d-e2c0-4311-80c0-527fc965c95f", "aa458ebe-1ac6-47ec-b558-b884d1695a65",
  "c60c9527-6f86-4ef5-a9a0-7571ea890be4", "fe6ae4b2-f6fd-4b26-8ac8-1c65b187df52", "9376b9fa-da48-4bf4-9f39-709b4baea9d0",
  "c7783c90-c346-41c8-8799-9080da8b11ee", "f4ab60ad-2def-44ea-92de-48f1f85f409b"
];

async function run() {
  const localConn = await mysql.createConnection(localConfig);
  const prodConn = await mysql.createConnection(prodConfig);
  const tables = ['general_classification', 'team_classification', 'points_classification', 'mountains_classification', 'youth_classification'];

  for (const stageId of STAGE_IDS_TO_SYNC) {
    for (const table of tables) {
      await syncTable(localConn, prodConn, table, stageId, table !== 'team_classification');
    }
  }

  await localConn.end(); await prodConn.end(); process.exit();
}
run();
