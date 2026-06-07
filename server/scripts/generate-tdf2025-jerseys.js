/**
 * 为 TdF 2025 所有赛段生成 jerseys 记录
 */
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

(async () => {
  const conn = await mysql.createConnection(dbConfig.development);
  const raceId = '24a6d4ef-797b-42cb-b23b-ec18732e3d6d';

  const [stages] = await conn.query(
    'SELECT id, stage_number FROM stages WHERE race_id = ? ORDER BY stage_number', [raceId]
  );
  console.log(`Processing ${stages.length} stages...`);

  const jerseyMap = [
    { type: 'YELLOW',    table: 'general_classification' },
    { type: 'GREEN',     table: 'points_classification' },
    { type: 'POLKA_DOT', table: 'mountains_classification' },
    { type: 'WHITE',     table: 'youth_classification' },
  ];

  let totalInserted = 0;

  for (const stage of stages) {
    let stageCount = 0;
    for (const jm of jerseyMap) {
      const [rows] = await conn.query(
        `SELECT rider_id FROM ${jm.table} WHERE stage_id = ? AND \`rank\` = 1 LIMIT 1`,
        [stage.id]
      );
      if (rows.length === 0) continue;
      const riderId = rows[0].rider_id;
      
      // 从 stage_results 获取 team_id
      const [teamRows] = await conn.query(
        'SELECT team_id FROM stage_results WHERE stage_id = ? AND rider_id = ? LIMIT 1',
        [stage.id, riderId]
      );
      const teamId = teamRows.length ? teamRows[0].team_id : null;

      const [existing] = await conn.query(
        'SELECT id FROM jerseys WHERE stage_id = ? AND jersey_type = ?',
        [stage.id, jm.type]
      );
      if (existing.length > 0) {
        await conn.query(
          'UPDATE jerseys SET rider_id = ?, team_id = ? WHERE id = ?',
          [riderId, teamId, existing[0].id]
        );
      } else {
        await conn.query(
          'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), stage.id, jm.type, riderId, teamId]
        );
        totalInserted++;
      }
      stageCount++;
    }
    if (stageCount > 0) {
      // Show who wears yellow after this stage
      const [yellow] = await conn.query(
        `SELECT r.rider_name FROM jerseys j JOIN riders r ON j.rider_id = r.id WHERE j.stage_id = ? AND j.jersey_type = 'YELLOW'`,
        [stage.id]
      );
      const name = yellow.length ? yellow[0].rider_name : '?';
      console.log(`Stage ${String(stage.stage_number).padStart(2)}: ${stageCount} jerseys, yellow=${name}`);
    }
  }

  console.log(`\nTotal new jerseys inserted: ${totalInserted}`);
  
  // Final count
  const [cnt] = await conn.query('SELECT COUNT(*) as cnt FROM jerseys j JOIN stages s ON j.stage_id = s.id WHERE s.race_id = ?', [raceId]);
  console.log(`Total jersey records for TdF 2025: ${cnt[0].cnt}`);
  
  await conn.end();
})();
