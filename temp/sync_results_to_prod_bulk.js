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

  try {
    for (const stageId of stageIds) {
      console.log(`\nSyncing stage: ${stageId}`);
      
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

      // 1. Collect all rider slugs and team slugs/names
      const riderSlugs = [...new Set(results.map(r => r.rider_slug))];
      const teamSlugs = [...new Set(results.map(r => r.team_slug).filter(s => s))];
      const teamNames = [...new Set(results.map(r => r.team_name))];

      // 2. Fetch existing riders and teams from prod
      const [prodRiders] = await prodConn.query('SELECT id, rider_slug FROM riders WHERE rider_slug IN (?)', [riderSlugs]);
      const riderMap = new Map(prodRiders.map(r => [r.rider_slug, r.id]));

      const [prodTeams] = await prodConn.query('SELECT id, team_slug, team_name FROM teams WHERE team_slug IN (?) OR team_name IN (?)', [teamSlugs.length ? teamSlugs : [''], teamNames]);
      const teamMap = new Map();
      prodTeams.forEach(t => {
        if (t.team_slug) teamMap.set(t.team_slug, t.id);
        teamMap.set(t.team_name, t.id);
      });

      // 3. Create missing riders and teams
      for (const res of results) {
        if (!riderMap.has(res.rider_slug)) {
          const id = uuidv4();
          await prodConn.query(
            'INSERT INTO riders (id, rider_name, rider_name_zh, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [id, res.rider_name, res.rider_name_zh, res.rider_slug, res.rd_nat]
          );
          riderMap.set(res.rider_slug, id);
          console.log(`  Created rider: ${res.rider_name}`);
        }
        
        const teamKey = res.team_slug || res.team_name;
        if (!teamMap.has(teamKey)) {
          const id = uuidv4();
          await prodConn.query(
            'INSERT INTO teams (id, team_name, team_name_en, team_name_zh, uci_code, team_slug, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [id, res.team_name, res.team_name_en, res.team_name_zh, res.uci_code, res.team_slug]
          );
          teamMap.set(teamKey, id);
          console.log(`  Created team: ${res.team_name}`);
        }
      }

      // 4. Bulk insert results
      await prodConn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);
      
      const bulkValues = results.map(res => [
        uuidv4(),
        stageId,
        riderMap.get(res.rider_slug),
        teamMap.get(res.team_slug || res.team_name),
        res.rank_pos,
        res.time_gap,
        res.nationality,
        new Date()
      ]);

      await prodConn.query(
        'INSERT INTO stage_results (id, stage_id, rider_id, team_id, rank_pos, time_gap, nationality, created_at) VALUES ?',
        [bulkValues]
      );
      
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
