const mysql = require('mysql2/promise');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dbConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

const STAGE_ID_MAP = {
  10: "ab4d70b3-b05a-4229-85d0-5f64e0ddf7a1",
  11: "c6b91874-dc4b-48c0-8f5c-aa8de746e988",
  12: "f67aba14-54b6-4ca9-9979-75eebdea1094",
  13: "48925f65-7809-4d2d-b56b-d0afce170c51",
  14: "a95eb43d-e2c0-4311-80c0-527fc965c95f",
  15: "aa458ebe-1ac6-47ec-b558-b884d1695a65",
  19: "c7783c90-c346-41c8-8799-9080da8b11ee",
  20: "f4ab60ad-2def-44ea-92de-48f1f85f409b"
};

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  console.log('Connected to local DB.');

  try {
    for (const [stageNum, stageId] of Object.entries(STAGE_ID_MAP)) {
      const file = `giro2026_stage${stageNum}_gc.json`;
      if (!fs.existsSync(file)) continue;

      console.log(`\nImporting GC for stage ${stageNum} (${stageId})...`);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Delete existing GC for this stage
      await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);
      
      const riderCache = new Map();
      const teamCache = new Map();

      for (const entry of data) {
        let { rank, riderName, riderSlug, teamName, teamSlug, nationality, time, gap } = entry;
        
        // Find rider
        let riderId;
        const [riders] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [riderSlug]);
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [riderId, riderName, riderSlug, nationality]
          );
        }

        // Find team
        let teamId;
        const normalizedTeamSlug = teamSlug?.replace(/-20\d{2}$/, '');
        const [teams] = await conn.query('SELECT id FROM teams WHERE team_slug = ? OR team_name = ?', [normalizedTeamSlug, teamName]);
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await conn.query(
            'INSERT INTO teams (id, team_name, team_slug, created_at) VALUES (?, ?, ?, NOW())',
            [teamId, teamName, normalizedTeamSlug]
          );
        }

        // Insert GC
        await conn.query(
          `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), stageId, parseInt(rank), riderId, teamId, nationality, time, gap]
        );
      }
      console.log(`  Imported ${data.length} GC entries.`);
    }
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await conn.end();
    process.exit();
  }
}

run();
