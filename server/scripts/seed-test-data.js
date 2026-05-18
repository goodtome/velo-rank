const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const dbConfig = require('../config/database');

const IDS = {
  race1: 'aaaaaaaa-1111-1111-1111-111111111111',
  race2: 'bbbbbbbb-2222-2222-2222-222222222222',
  stage1_1: 'cccccccc-1111-1111-1111-111111111111',
  stage1_2: 'cccccccc-2222-2222-2222-222222222222',
  stage1_3: 'cccccccc-3333-3333-3333-333333333333',
  stage2_1: 'dddddddd-1111-1111-1111-111111111111',
  stage2_2: 'dddddddd-2222-2222-2222-222222222222',
  rider1: 'eeeeeeee-1111-1111-1111-111111111111',
  rider2: 'eeeeeeee-2222-2222-2222-222222222222',
  rider3: 'eeeeeeee-3333-3333-3333-333333333333',
  rider4: 'eeeeeeee-4444-4444-4444-444444444444',
  rider5: 'eeeeeeee-5555-5555-5555-555555555555',
  rider6: 'eeeeeeee-6666-6666-6666-666666666666',
  rider7: 'eeeeeeee-7777-7777-7777-777777777777',
  rider8: 'eeeeeeee-8888-8888-8888-888888888888',
  team1: 'ffffffff-1111-1111-1111-111111111111',
  team2: 'ffffffff-2222-2222-2222-222222222222',
  team3: 'ffffffff-3333-3333-3333-333333333333',
  team4: 'ffffffff-4444-4444-4444-444444444444',
};

async function seed() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database,
      charset: 'utf8mb4'
    });

    console.log('清空旧数据...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE general_classification');
    await conn.query('TRUNCATE TABLE jerseys');
    await conn.query('TRUNCATE TABLE stage_results');
    await conn.query('TRUNCATE TABLE stages');
    await conn.query('TRUNCATE TABLE riders');
    await conn.query('TRUNCATE TABLE teams');
    await conn.query('TRUNCATE TABLE races');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('插入赛事数据...');
    await conn.query(`
      INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season, country, start_date, end_date, total_stages, total_distance, is_active) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      IDS.race1, '环意自行车赛', "Giro d'Italia", 'giro-ditalia-2026', 'GRAND_TOUR', 'MEN', 2026, 'Italy', '2026-05-09', '2026-05-31', 21, 3489.5, 1,
      IDS.race2, '环法自行车赛', 'Tour de France', 'tour-de-france-2026', 'GRAND_TOUR', 'MEN', 2026, 'France', '2026-07-01', '2026-07-23', 21, 3320.0, 1
    ]);

    console.log('插入赛段数据...');
    await conn.query(`
      INSERT INTO stages (id, race_id, stage_number, stage_name, stage_type, date, distance_km, start_city, finish_city, stage_code) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      IDS.stage1_1, IDS.race1, 1, 'Nessebar → Burgas', 'FLAT', '2026-05-09', 140.0, 'Nessebar', 'Burgas', 'giro-ditalia-2026-s1',
      IDS.stage1_2, IDS.race1, 2, 'Naples → Naples', 'ITT', '2026-05-10', 13.7, 'Naples', 'Naples', 'giro-ditalia-2026-s2',
      IDS.stage1_3, IDS.race1, 3, 'Plovdiv → Sofia', 'MOUNTAIN', '2026-05-12', 203.0, 'Plovdiv', 'Sofia', 'giro-ditalia-2026-s3',
      IDS.stage2_1, IDS.race2, 1, 'Lille → Lille', 'FLAT', '2026-07-01', 185.0, 'Lille', 'Lille', 'tour-de-france-2026-s1',
      IDS.stage2_2, IDS.race2, 2, 'Lille → Arras', 'HILLY', '2026-07-02', 170.0, 'Lille', 'Arras', 'tour-de-france-2026-s2'
    ]);

    console.log('插入车队数据...');
    await conn.query(`
      INSERT INTO teams (id, uci_code, team_name, team_name_zh, team_name_en, country) VALUES
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?)
    `, [
      IDS.team1, 'UAD', 'UAE Team Emirates', '阿联酋航空车队', 'UAE Team Emirates', 'UAE',
      IDS.team2, 'TVL', 'Team Visma | Lease a Bike', '维斯马车队', 'Team Visma | Lease a Bike', 'NED',
      IDS.team3, 'SOQ', 'Soudal Quick-Step', '快步车队', 'Soudal Quick-Step', 'BEL',
      IDS.team4, 'RBH', 'Red Bull - BORA - hansgrohe', '红牛车队', 'Red Bull - BORA - hansgrohe', 'GER'
    ]);

    console.log('插入车手数据...');
    await conn.query(`
      INSERT INTO riders (id, rider_name, rider_name_zh, nationality) VALUES
      (?, ?, ?, ?),
      (?, ?, ?, ?),
      (?, ?, ?, ?),
      (?, ?, ?, ?),
      (?, ?, ?, ?),
      (?, ?, ?, ?),
      (?, ?, ?, ?),
      (?, ?, ?, ?)
    `, [
      IDS.rider1, 'Tadej Pogacar', '塔代伊·波加查', 'SLO',
      IDS.rider2, 'Jonas Vingegaard', '乔纳斯·温格高', 'DEN',
      IDS.rider3, 'Remco Evenepoel', '雷姆科·埃菲内普尔', 'BEL',
      IDS.rider4, 'Primoz Roglic', '普里莫兹·罗格利奇', 'SLO',
      IDS.rider5, 'Paul Magnier', '保罗·马格尼耶', 'FRA',
      IDS.rider6, 'Giulio Ciccone', '朱利奥·西科内', 'ITA',
      IDS.rider7, 'Carlos Rodriguez', '卡洛斯·罗德里格斯', 'ESP',
      IDS.rider8, 'Egan Bernal', '埃甘·贝尔纳尔', 'COL'
    ]);

    console.log('插入赛段成绩 (Stage 1 of Giro)...');
    await conn.query(`
      INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap) VALUES
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), IDS.stage1_1, 1, IDS.rider5, IDS.team3, 'FRA', "3h 45' 12\"",
      uuidv4(), IDS.stage1_1, 2, IDS.rider1, IDS.team1, 'SLO', '+0:00',
      uuidv4(), IDS.stage1_1, 3, IDS.rider6, IDS.team2, 'ITA', '+0:00',
      uuidv4(), IDS.stage1_1, 4, IDS.rider3, IDS.team3, 'BEL', '+0:04',
      uuidv4(), IDS.stage1_1, 5, IDS.rider4, IDS.team4, 'SLO', '+0:21',
      uuidv4(), IDS.stage1_1, 6, IDS.rider2, IDS.team2, 'DEN', '+0:21',
      uuidv4(), IDS.stage1_1, 7, IDS.rider7, IDS.team1, 'ESP', '+0:35',
      uuidv4(), IDS.stage1_1, 8, IDS.rider8, IDS.team1, 'COL', '+0:42'
    ]);

    console.log('插入赛段成绩 (Stage 3 of Giro)...');
    await conn.query(`
      INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap) VALUES
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), IDS.stage1_3, 1, IDS.rider1, IDS.team1, 'SLO', "5h 07' 51\"",
      uuidv4(), IDS.stage1_3, 2, IDS.rider2, IDS.team2, 'DEN', '+0:12',
      uuidv4(), IDS.stage1_3, 3, IDS.rider3, IDS.team3, 'BEL', '+0:28',
      uuidv4(), IDS.stage1_3, 4, IDS.rider4, IDS.team4, 'SLO', '+0:45',
      uuidv4(), IDS.stage1_3, 5, IDS.rider7, IDS.team1, 'ESP', '+1:03'
    ]);

    console.log('插入赛段成绩 (Stage 1 of Tour)...');
    await conn.query(`
      INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap) VALUES
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), IDS.stage2_1, 1, IDS.rider2, IDS.team2, 'DEN', "4h 12' 33\"",
      uuidv4(), IDS.stage2_1, 2, IDS.rider1, IDS.team1, 'SLO', '+0:00',
      uuidv4(), IDS.stage2_1, 3, IDS.rider3, IDS.team3, 'BEL', '+0:05'
    ]);

    console.log('插入领骑衫 (Stage 3 of Giro)...');
    await conn.query(`
      INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?)
    `, [
      uuidv4(), IDS.stage1_3, 'PINK', IDS.rider1, IDS.team1,
      uuidv4(), IDS.stage1_3, 'PURPLE', IDS.rider5, IDS.team3,
      uuidv4(), IDS.stage1_3, 'BLUE', IDS.rider4, IDS.team4,
      uuidv4(), IDS.stage1_3, 'WHITE', IDS.rider7, IDS.team1
    ]);

    console.log('插入GC总成绩 (Giro - after Stage 3)...');
    await conn.query(`
      INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), IDS.stage1_3, 1, IDS.rider1, IDS.team1, 'SLO', "15h 23' 45\"", '',
      uuidv4(), IDS.stage1_3, 2, IDS.rider2, IDS.team2, 'DEN', "15h 24' 10\"", '+0:25',
      uuidv4(), IDS.stage1_3, 3, IDS.rider3, IDS.team3, 'BEL', "15h 25' 12\"", '+1:27',
      uuidv4(), IDS.stage1_3, 4, IDS.rider4, IDS.team4, 'SLO', "15h 25' 35\"", '+1:50',
      uuidv4(), IDS.stage1_3, 5, IDS.rider7, IDS.team1, 'ESP', "15h 26' 01\"", '+2:16'
    ]);

    console.log('插入GC总成绩 (Tour - after Stage 1)...');
    await conn.query(`
      INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), IDS.stage2_1, 1, IDS.rider2, IDS.team2, 'DEN', "4h 12' 33\"", '',
      uuidv4(), IDS.stage2_1, 2, IDS.rider1, IDS.team1, 'SLO', "4h 12' 33\"", '+0:00',
      uuidv4(), IDS.stage2_1, 3, IDS.rider3, IDS.team3, 'BEL', "4h 12' 38\"", '+0:05'
    ]);

    console.log('\n测试数据插入完成！');
    console.log('\n测试用 ID 对照表：');
    console.log('============================================================');
    console.log('赛事:');
    console.log('  环意 (进行中):  ' + IDS.race1);
    console.log('  环法 (即将开始): ' + IDS.race2);
    console.log('赛段:');
    console.log('  环意 S1 (Flat):     ' + IDS.stage1_1);
    console.log('  环意 S2 (ITT):      ' + IDS.stage1_2);
    console.log('  环意 S3 (Mountain): ' + IDS.stage1_3);
    console.log('  环法 S1 (Flat):     ' + IDS.stage2_1);
    console.log('  环法 S2 (Hilly):    ' + IDS.stage2_2);
    console.log('============================================================');
    console.log('\n可测试的API端点：');
    console.log('  GET http://localhost:3000/api/v1/races');
    console.log('  GET http://localhost:3000/api/v1/races/' + IDS.race1);
    console.log('  GET http://localhost:3000/api/v1/races/' + IDS.race1 + '/stages');
    console.log('  GET http://localhost:3000/api/v1/races/' + IDS.race1 + '/gc');
    console.log('  GET http://localhost:3000/api/v1/stages/' + IDS.stage1_1);
    console.log('  GET http://localhost:3000/api/v1/stages/' + IDS.stage1_1 + '/results');
    console.log('  GET http://localhost:3000/api/v1/stages/' + IDS.stage1_3 + '/jerseys');
    console.log('  GET http://localhost:3000/api/v1/search/riders?q=pogacar');
    console.log('\n小程序跳转测试URL：');
    console.log('  /pages/race-detail/race-detail?id=' + IDS.race1);
    console.log('  /pages/stage-results/stage-results?stageId=' + IDS.stage1_1 + '&stageNumber=1&raceId=' + IDS.race1);
    console.log('  /pages/stage-results/stage-results?type=gc&raceId=' + IDS.race1);

    await conn.end();
  } catch (err) {
    console.error('种子数据插入失败:', err);
    process.exit(1);
  }
}

seed();
