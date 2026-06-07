const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

(async () => {
  const c = await mysql.createConnection(dbConfig.development);
  const raceId = uuidv4();
  await c.query(
    `INSERT INTO races (id, race_code, race_name, race_name_en, category, gender, season, start_date, end_date, total_stages, is_active) 
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [raceId, 'tour-de-france-2025', '环法自行车赛 2025', 'Tour de France 2025', 'world-tour', 'men', 2025, '2025-07-05', '2025-07-27', 21, 0]
  );
  console.log('Race created:', raceId);

  const startDate = new Date('2025-07-05');
  for (let i = 1; i <= 21; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i - 1);
    const stageDate = d.toISOString().split('T')[0];
    const stageId = uuidv4();
    await c.query(
      'INSERT INTO stages (id, race_id, stage_number, stage_type, date, stage_code) VALUES (?,?,?,?,?,?)',
      [stageId, raceId, i, 'flat', stageDate, 'tdf2025-s' + i]
    );
  }
  console.log('21 stages created');

  const [cnt] = await c.query('SELECT COUNT(*) as cnt FROM stages WHERE race_id = ?', [raceId]);
  console.log('Stage count:', cnt[0].cnt);
  await c.end();
})();
