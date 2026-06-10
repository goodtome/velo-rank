#!/usr/bin/env node
/**
 * 更新2026年环弗兰德斯赛（Ronde van Vlaanderen / Tour of Flanders）赛段数据
 * 数据来源：CyclingNews, CyclingStage, Sina, 163.com, Baidu Baike, Biketo, Sohu 等
 * 交叉验证后的准确数据
 *
 * 赛事信息：
 *   - 日期：2026年4月5日（周日）
 *   - 距离：278.2 km
 *   - 起点：Antwerp（安特卫普，Linkeroever）
 *   - 终点：Oudenaarde（奥德纳尔德）
 *   - 类型：Hills（石板路古典赛/纪念碑赛，16个计分爬坡 + 7段石板路）
 *   - 累计爬升：2,250 m
 *   - 冠军：Tadej Pogačar (UAE Team Emirates-XRG), 6h20'07"
 *   - 亚军：Mathieu van der Poel (Alpecin-Deceunck), +34"
 *   - 季军：Remco Evenepoel (Red Bull-BORA-hansgrohe), +1'11"
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db',
  dateStrings: true
};

async function main() {
  console.log('=== Updating Ronde van Vlaanderen 2026 ===\n');

  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('DB connected.\n');

  try {
    const raceId = '435e208c-caff-4f33-9e2e-8f5e2496540c';

    // 1. Verify the race exists
    const [races] = await conn.query('SELECT * FROM races WHERE id = ?', [raceId]);
    if (races.length === 0) {
      console.error('ERROR: Race not found!');
      return;
    }
    const race = races[0];
    console.log(`Race: ${race.race_name} (${race.category}, ${race.gender})`);
    console.log(`Current: total_stages=${race.total_stages}, total_distance=${race.total_distance}`);
    console.log(`Date: ${race.start_date}\n`);

    // 2. Update races table
    console.log('--- Updating races table ---');
    await conn.query(
      `UPDATE races SET 
        total_stages = 1, 
        total_distance = 278.2,
        official_url = 'https://www.rondevanvlaanderen.be/'
      WHERE id = ?`,
      [raceId]
    );
    console.log('  total_stages: null -> 1');
    console.log('  total_distance: null -> 278.2 km');
    console.log('  official_url: set\n');

    // 3. Create or update the single stage entry
    console.log('--- Updating stages table ---');

    const [existingStages] = await conn.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = 1',
      [raceId]
    );

    const stageData = {
      stage_number: 1,
      stage_name: 'Antwerp - Oudenaarde',
      stage_type: 'Hills',
      date: '2026-04-05',
      distance_km: 278.2,
      elevation_m: 2250,
      start_city: 'Antwerp',
      finish_city: 'Oudenaarde',
      stage_code: 'ronde-vlaanderen-2026-s1'
    };

    if (existingStages.length > 0) {
      console.log('  Stage exists, updating...');
      await conn.query(
        `UPDATE stages SET 
          stage_name = ?, stage_type = ?, date = ?, distance_km = ?, 
          elevation_m = ?, start_city = ?, finish_city = ?, stage_code = ?
        WHERE id = ?`,
        [
          stageData.stage_name, stageData.stage_type, stageData.date,
          stageData.distance_km, stageData.elevation_m, stageData.start_city,
          stageData.finish_city, stageData.stage_code, existingStages[0].id
        ]
      );
    } else {
      console.log('  Creating new stage entry...');
      const stageId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO stages 
        (id, race_id, stage_number, stage_name, stage_type, date, distance_km, elevation_m, start_city, finish_city, stage_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stageId, raceId, stageData.stage_number, stageData.stage_name,
          stageData.stage_type, stageData.date, stageData.distance_km,
          stageData.elevation_m, stageData.start_city, stageData.finish_city,
          stageData.stage_code
        ]
      );
      console.log(`  Stage ID: ${stageId}`);
    }

    console.log('  Stage 1: Antwerp - Oudenaarde');
    console.log('    Date: 2026-04-05');
    console.log('    Distance: 278.2 km');
    console.log('    Elevation: 2,250 m');
    console.log('    Type: Hills (16 climbs, 7 cobbled sectors)');
    console.log('    Key climbs: Oude Kwaremont (x3), Paterberg, Koppenberg, Taaienberg');
    console.log('    Start: Antwerp');
    console.log('    Finish: Oudenaarde\n');

    // 4. Verification
    console.log('--- Verification ---');
    const [updatedRace] = await conn.query(
      'SELECT race_name, total_stages, total_distance, start_date, end_date FROM races WHERE id = ?',
      [raceId]
    );
    console.log(`Race: ${updatedRace[0].race_name}`);
    console.log(`  Dates: ${updatedRace[0].start_date} ~ ${updatedRace[0].end_date}`);
    console.log(`  Total stages: ${updatedRace[0].total_stages}`);
    console.log(`  Total distance: ${updatedRace[0].total_distance} km`);

    const [stages] = await conn.query(
      'SELECT stage_number, stage_name, date, distance_km, elevation_m, stage_type, start_city, finish_city FROM stages WHERE race_id = ? ORDER BY stage_number',
      [raceId]
    );
    console.log(`\nStages (${stages.length}):`);
    stages.forEach(s => {
      console.log(`  Stage ${s.stage_number}: ${s.date} | ${s.stage_name} | ${s.distance_km}km | ${s.elevation_m || 'N/A'}m elev | ${s.stage_type} | ${s.start_city} -> ${s.finish_city}`);
    });

    console.log('\nDone.');
  } finally {
    await conn.end();
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
