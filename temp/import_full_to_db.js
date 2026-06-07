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

const STAGE_MAP = {
  'stage19_full.json': 'c7783c90-c346-41c8-8799-9080da8b11ee',
  'stage20_full.json': 'f4ab60ad-2def-44ea-92de-48f1f85f409b'
};

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  console.log('Connected to local DB.');

  try {
    for (const [file, stageId] of Object.entries(STAGE_MAP)) {
      console.log(`\nImporting ${file} to stage ${stageId}...`);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Delete existing
      await conn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
      
      let winnerTime = '';

      for (const entry of data) {
        let { rank, riderName, riderSlug, teamName, teamSlug, nationality, time } = entry;
        
        // Normalize time
        let timeGap = time;
        if (rank === "1") {
          winnerTime = time;
        } else if (!time || time === ',,') {
          timeGap = 's.t.';
        } else if (time.includes(':')) {
          timeGap = `+ ${time}`;
        } else {
          timeGap = `+ ${time}`;
        }

        // Find or create rider
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
          console.log(`  Created rider: ${riderName}`);
        }

        // Find or create team
        let teamId;
        // Strip year from teamSlug
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
          console.log(`  Created team: ${teamName}`);
        }

        // Skip non-numeric ranks
        if (isNaN(parseInt(rank))) {
          console.log(`  Skipping non-numeric rank: ${rank} for ${riderName}`);
          continue;
        }

        // Insert result
        await conn.query(
          `INSERT INTO stage_results (id, stage_id, rider_id, team_id, rank_pos, time_gap, nationality, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), stageId, riderId, teamId, parseInt(rank), timeGap, nationality]
        );
      }
      console.log(`  Imported ${data.length} results.`);
    }
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await conn.end();
    process.exit();
  }
}

run();
