const mysql = require('mysql2/promise');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const localConfig = { host: 'localhost', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const prodConfig = {
  host: process.env.DB_HOST_PROD, port: parseInt(process.env.DB_PORT_PROD) || 4000,
  user: process.env.DB_USER_PROD, password: process.env.DB_PASSWORD_PROD, database: process.env.DB_NAME_PROD,
  ssl: { rejectUnauthorized: true }
};

const RACE_ID = '3fe9684c-2007-461d-9839-d35e254b39c3';

async function sync() {
  const localConn = await mysql.createConnection(localConfig);
  const prodConn = await mysql.createConnection(prodConfig);

  try {
    // 1. Sync Stages
    console.log('Syncing stages...');
    const [localStages] = await localConn.query('SELECT * FROM stages WHERE race_id = ?', [RACE_ID]);
    
    for (const s of localStages) {
      const [existing] = await prodConn.query('SELECT id FROM stages WHERE id = ?', [s.id]);
      if (existing.length > 0) {
        await prodConn.query(
          'UPDATE stages SET stage_name = ?, date = ?, distance_km = ?, stage_code = ? WHERE id = ?',
          [s.stage_name, s.date, s.distance_km, s.stage_code, s.id]
        );
      } else {
        await prodConn.query(
          'INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [s.id, s.race_id, s.stage_number, s.stage_name, s.date, s.distance_km, s.stage_code]
        );
      }
    }

    // 2. Sync Results and GC for S1, S2
    const stageIds = ['dae5a35c-7cc3-4f67-8cec-5249adfa381a', '6afcb9c4-762d-471a-8bda-90318970dd24'];
    
    for (const stageId of stageIds) {
      console.log(`\nSyncing stage results: ${stageId}`);
      
      const [results] = await localConn.query(
        `SELECT r.*, rd.rider_name, rd.rider_slug, rd.nationality as rd_nat, 
                t.team_name, t.uci_code, t.team_slug
         FROM stage_results r
         JOIN riders rd ON r.rider_id = rd.id
         JOIN teams t ON r.team_id = t.id
         WHERE r.stage_id = ?`,
        [stageId]
      );

      // Clean prod results
      await prodConn.query('DELETE FROM stage_results WHERE stage_id = ?', [stageId]);

      const riderMap = new Map();
      const teamMap = new Map();

      for (const res of results) {
        let rId;
        const [prodRiders] = await prodConn.query('SELECT id FROM riders WHERE rider_slug = ?', [res.rider_slug]);
        if (prodRiders.length > 0) rId = prodRiders[0].id;
        else {
          rId = uuidv4();
          await prodConn.query('INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())', [rId, res.rider_name, res.rider_slug, res.rd_nat]);
        }
        riderMap.set(res.rider_slug, rId);

        let tId;
        const [prodTeams] = await prodConn.query('SELECT id FROM teams WHERE team_slug = ? OR team_name = ?', [res.team_slug, res.team_name]);
        if (prodTeams.length > 0) tId = prodTeams[0].id;
        else {
          tId = uuidv4();
          await prodConn.query('INSERT INTO teams (id, team_name, team_slug, uci_code, created_at) VALUES (?, ?, ?, ?, NOW())', [tId, res.team_name, res.team_slug, res.uci_code]);
        }
        teamMap.set(res.team_slug || res.team_name, tId);

        await prodConn.query(
          'INSERT INTO stage_results (id, stage_id, rider_id, team_id, rank_pos, time_gap, nationality, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
          [uuidv4(), stageId, rId, tId, res.rank_pos, res.time_gap, res.nationality]
        );
      }

      console.log(`Syncing GC: ${stageId}`);
      const [gc] = await localConn.query(
        `SELECT g.*, rd.rider_slug, rd.rider_name, rd.nationality as rd_nat,
                t.team_slug, t.team_name
         FROM general_classification g
         JOIN riders rd ON g.rider_id = rd.id
         JOIN teams t ON g.team_id = t.id
         WHERE g.stage_id = ?`,
        [stageId]
      );

      await prodConn.query('DELETE FROM general_classification WHERE stage_id = ?', [stageId]);

      for (const g of gc) {
        const rId = riderMap.get(g.rider_slug);
        const tId = teamMap.get(g.team_slug || g.team_name);
        await prodConn.query(
          'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [uuidv4(), stageId, g.rank, rId, tId, g.nationality, g.total_time, g.time_gap]
        );
      }
    }

    console.log('\nSync completed.');
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    await localConn.end();
    await prodConn.end();
    process.exit();
  }
}

sync();
