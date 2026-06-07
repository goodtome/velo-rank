const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dbConfig = {
  host: 'localhost', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db'
};

const STAGE_ID_MAP = {
  "1": "25173cfa-0a4c-4316-9964-c0dc85c1bf0d", "2": "11bf5587-e1c2-4048-99cd-1994350eddf7", "3": "8d102737-3141-4fac-b95a-f52b23b4045c",
  "4": "416a491a-936f-49c0-aa74-009eda27cd17", "5": "26f94f11-7c98-4ab5-a14c-36f97b363917", "6": "fda90417-0279-4f83-a6f8-21b77cc119ee",
  "7": "a4ff39ee-3a68-4c03-938c-e4f365cad6ee", "8": "15401963-befe-4765-bc3e-527f0e742171", "9": "6d53cdd1-f51c-4b5a-8edc-6b50ece7fc10",
  "10": "ab4d70b3-b05a-4229-85d0-5f64e0ddf7a1", "11": "c6b91874-dc4b-48c0-8f5c-aa8de746e988", "12": "f67aba14-54b6-4ca9-9979-75eebdea1094",
  "13": "48925f65-7809-4d2d-b56b-d0afce170c51", "14": "a95eb43d-e2c0-4311-80c0-527fc965c95f", "15": "aa458ebe-1ac6-47ec-b558-b884d1695a65",
  "16": "c60c9527-6f86-4ef5-a9a0-7571ea890be4", "17": "fe6ae4b2-f6fd-4b26-8ac8-1c65b187df52", "18": "9376b9fa-da48-4bf4-9f39-709b4baea9d0",
  "19": "c7783c90-c346-41c8-8799-9080da8b11ee", "20": "f4ab60ad-2def-44ea-92de-48f1f85f409b", "21": "3284bc70-8a33-4c0d-adb2-e1f14d22b7fb"
};

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  const riderCache = new Map();
  const teamCache = new Map();

  const getRiderId = async (name, slug, nat) => {
    if (riderCache.has(slug)) return riderCache.get(slug);
    const [rows] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [slug]);
    if (rows.length > 0) {
      riderCache.set(slug, rows[0].id);
      return rows[0].id;
    }
    const id = uuidv4();
    await conn.query('INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())', [id, name, slug, nat]);
    riderCache.set(slug, id);
    return id;
  };

  const getTeamId = async (name, slug) => {
    const key = slug || name;
    if (teamCache.has(key)) return teamCache.get(key);
    const normalizedSlug = slug?.replace(/-20\d{2}$/, '');
    const [rows] = await conn.query('SELECT id FROM teams WHERE team_slug = ? OR team_name = ?', [normalizedSlug, name]);
    if (rows.length > 0) {
      teamCache.set(key, rows[0].id);
      return rows[0].id;
    }
    const id = uuidv4();
    await conn.query('INSERT INTO teams (id, team_name, team_slug, created_at) VALUES (?, ?, ?, NOW())', [id, name, normalizedSlug]);
    teamCache.set(key, id);
    return id;
  };

  const files = fs.readdirSync('.').filter(f => f.startsWith('giro2026_stage') && f.endsWith('.json'));

  for (const file of files) {
    const match = file.match(/stage(\d+)_(\w+)\.json/);
    if (!match) continue;
    const stageNum = match[1];
    const type = match[2];
    const stageId = STAGE_ID_MAP[stageNum];
    if (!stageId) continue;

    console.log(`Processing ${file}...`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));

    if (type === 'gc') {
      await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);
      for (const r of data) {
        const rId = await getRiderId(r.riderName, r.riderSlug, r.nationality);
        const tId = await getTeamId(r.teamName, r.teamSlug);
        await conn.query('INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [uuidv4(), stageId, r.rank, rId, tId, r.nationality, r.time, r.gap]);
      }
    } else if (type === 'points') {
      await conn.query('DELETE FROM points_classification WHERE stage_id = ?', [stageId]);
      for (const r of data) {
        const rId = await getRiderId(r.riderName, r.riderSlug, r.nationality);
        await conn.query('INSERT INTO points_classification (stage_id, rider_id, `rank`, points, jersey_type) VALUES (?, ?, ?, ?, ?)', [stageId, rId, r.rank, parseInt(r.value) || 0, 'PURPLE']);
      }
    } else if (type === 'mountains') {
      await conn.query('DELETE FROM mountains_classification WHERE stage_id = ?', [stageId]);
      for (const r of data) {
        const rId = await getRiderId(r.riderName, r.riderSlug, r.nationality);
        await conn.query('INSERT INTO mountains_classification (stage_id, rider_id, `rank`, points, jersey_type) VALUES (?, ?, ?, ?, ?)', [stageId, rId, r.rank, parseInt(r.value) || 0, 'BLUE']);
      }
    } else if (type === 'youth') {
      await conn.query('DELETE FROM youth_classification WHERE stage_id = ?', [stageId]);
      for (const r of data) {
        const rId = await getRiderId(r.riderName, r.riderSlug, r.nationality);
        await conn.query('INSERT INTO youth_classification (stage_id, rider_id, `rank`, time, time_gap, jersey_type) VALUES (?, ?, ?, ?, ?, ?)', [stageId, rId, r.rank, r.value, r.gap, 'WHITE']);
      }
    } else if (type === 'teams') {
      await conn.query('DELETE FROM team_classification WHERE stage_id = ?', [stageId]);
      for (const r of data) {
        const tId = await getTeamId(r.teamName, r.teamSlug);
        await conn.query('INSERT INTO team_classification (id, stage_id, `rank`, team_id, total_time, time_gap) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), stageId, r.rank, tId, r.time, r.gap]);
      }
    }
  }

  await conn.end();
  process.exit();
}

run();
