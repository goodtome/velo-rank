const mysql = require('mysql2/promise');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const localConfig = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

const prodConfig = {
  host: process.env.DB_HOST_PROD,
  port: parseInt(process.env.DB_PORT_PROD) || 4000,
  user: process.env.DB_USER_PROD,
  password: process.env.DB_PASSWORD_PROD,
  database: process.env.DB_NAME_PROD,
  ssl: { rejectUnauthorized: true }
};

async function sync() {
  const localConn = await mysql.createConnection(localConfig);
  const prodConn = await mysql.createConnection(prodConfig);

  console.log('Connected to local and production databases.');

  const stageIds = [
    'c7783c90-c346-41c8-8799-9080da8b11ee', // Stage 19
    'f4ab60ad-2def-44ea-92de-48f1f85f409b'  // Stage 20
  ];

  const riderCache = new Map();
  const teamCache = new Map();

  try {
    for (const stageId of stageIds) {
      console.log(`\nSyncing stage: ${stageId}`);
      
      // Get results from local
      const [results] = await localConn.query(
        `SELECT r.*, rd.rider_name, rd.rider_name_zh, rd.rider_slug, rd.nationality as rd_nat, 
                t.team_name, t.team_name_en, t.team_name_zh, t.uci_code, t.team_slug
         FROM stage_results r
         JOIN riders rd ON r.rider_id = rd.id
         JOIN teams t ON r.team_id = t.id
         WHERE r.stage_id = ?`,
        [stageId]
      );

      console.log(`Found ${results.length} results in local.`);

      // Clean prod results for this stage
      await prodConn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);

      for (const res of results) {
        // Find or create rider in prod
        let riderId = riderCache.get(res.rider_slug);
        if (!riderId) {
          const [prodRiders] = await prodConn.query(
            'SELECT id FROM riders WHERE rider_slug = ?',
            [res.rider_slug]
          );

          if (prodRiders.length > 0) {
            riderId = prodRiders[0].id;
          } else {
            riderId = uuidv4();
            await prodConn.query(
              `INSERT INTO riders (id, rider_name, rider_name_zh, rider_slug, nationality, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              [riderId, res.rider_name, res.rider_name_zh, res.rider_slug, res.rd_nat]
            );
            console.log(`  Created rider in prod: ${res.rider_name}`);
          }
          riderCache.set(res.rider_slug, riderId);
        }

        // Find or create team in prod
        let teamId = teamCache.get(res.team_slug || res.team_name);
        if (!teamId) {
          const [prodTeams] = await prodConn.query(
            'SELECT id FROM teams WHERE team_slug = ? OR team_name = ?',
            [res.team_slug, res.team_name]
          );

          if (prodTeams.length > 0) {
            teamId = prodTeams[0].id;
          } else {
            teamId = uuidv4();
            await prodConn.query(
              `INSERT INTO teams (id, team_name, team_name_en, team_name_zh, uci_code, team_slug, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [teamId, res.team_name, res.team_name_en, res.team_name_zh, res.uci_code, res.team_slug]
            );
            console.log(`  Created team in prod: ${res.team_name}`);
          }
          teamCache.set(res.team_slug || res.team_name, teamId);
        }

        // Insert result in prod
        await prodConn.query(
          `INSERT INTO stage_results (id, stage_id, rider_id, team_id, rank_pos, time_gap, nationality, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), stageId, riderId, teamId, res.rank_pos, res.time_gap, res.nationality]
        );
      }
      console.log(`  Stage ${stageId} sync complete.`);
    }
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    await localConn.end();
    await prodConn.end();
    process.exit();
  }
}

sync();
