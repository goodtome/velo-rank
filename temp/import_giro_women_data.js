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

const RACE_ID = '3fe9684c-2007-461d-9839-d35e254b39c3';
const RACE_CODE = 'giro-women-2026';

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  console.log('Connected to local DB.');

  try {
    // 1. Import Stages
    console.log('\nImporting stages...');
    const stagesData = JSON.parse(fs.readFileSync('giro_women_stages.json', 'utf8'));
    
    // Check existing stages
    const [existingStages] = await conn.query('SELECT stage_number FROM stages WHERE race_id = ?', [RACE_ID]);
    const existingNums = new Set(existingStages.map(s => s.stage_number));

    for (const s of stagesData) {
      const stageCode = `${RACE_CODE}-stage-${s.stageNumber}`;
      if (existingNums.has(s.stageNumber)) {
        console.log(`  Stage ${s.stageNumber} already exists, updating...`);
        await conn.query(
          'UPDATE stages SET stage_name = ?, date = ?, distance_km = ?, stage_code = ? WHERE race_id = ? AND stage_number = ?',
          [s.stageName, s.startDate, s.distance, stageCode, RACE_ID, s.stageNumber]
        );
      } else {
        console.log(`  Creating stage ${s.stageNumber}...`);
        await conn.query(
          'INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), RACE_ID, s.stageNumber, s.stageName, s.startDate, s.distance, stageCode]
        );
      }
    }

    // 2. Import Teams and Riders
    console.log('\nImporting teams and riders from startlist...');
    const teamsData = JSON.parse(fs.readFileSync('giro_women_startlist.json', 'utf8'));

    for (const t of teamsData) {
      let teamId;
      const normalizedTeamSlug = t.teamSlug.replace(/-20\d{2}$/, '');
      
      const [teams] = await conn.query('SELECT id FROM teams WHERE team_slug = ? OR team_name = ?', [normalizedTeamSlug, t.teamName]);
      
      if (teams.length > 0) {
        teamId = teams[0].id;
        // Update slug if missing
        await conn.query('UPDATE teams SET team_slug = ? WHERE id = ?', [normalizedTeamSlug, teamId]);
      } else {
        teamId = uuidv4();
        await conn.query(
          'INSERT INTO teams (id, team_name, team_slug, created_at) VALUES (?, ?, ?, NOW())',
          [teamId, t.teamName, normalizedTeamSlug]
        );
        console.log(`  Created team: ${t.teamName}`);
      }

      for (const r of t.riders) {
        let riderId;
        const [riders] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [r.riderSlug]);
        
        if (riders.length > 0) {
          riderId = riders[0].id;
          // Update nationality if needed
          await conn.query('UPDATE riders SET nationality = ? WHERE id = ?', [r.nationality, riderId]);
        } else {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [riderId, r.riderName, r.riderSlug, r.nationality]
          );
          console.log(`  Created rider: ${r.riderName}`);
        }
      }
    }

    console.log('\nImport completed.');
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await conn.end();
    process.exit();
  }
}

run();
