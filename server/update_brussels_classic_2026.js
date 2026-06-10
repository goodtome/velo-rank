#!/usr/bin/env node
/**
 * 更新2026年布鲁塞尔经典自行车赛（Brussels Cycling Classic）赛段数据
 * 数据来源：CyclingNews, CyclingUpToDate, IDLProCycling, 官方网站(brusselscyclingclassic.be)
 * 交叉验证后的准确数据
 *
 * 赛事信息：
 *   - 日期：2026年6月7日（周日）
 *   - 距离：206.3 km
 *   - 起点：Etterbeek（埃特贝克）
 *   - 终点：Brussels（布鲁塞尔，Houba de Strooperlaan / 近原子塔）
 *   - 类型：Hills（丘陵古典赛，含石板路爬坡）
 *   - 累计爬升：约2000 m
 *   - 关键爬坡：Muur van Geraardsbergen（3次）、Bosberg、Congoberg
 *   - 冠军：Jordi Meeus (Red Bull-BORA-hansgrohe)
 *   - 亚军：Milan Fretin (Cofidis)
 *   - 季军：Biniam Girmay (NSN Cycling Team)
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

async function main() {
  console.log('=== Updating Brussels Cycling Classic 2026 ===\n');

  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('DB connected.\n');

  try {
    const raceId = 'e011ce85-b5a2-4e7b-9216-4758476c69c4';

    // 1. Verify the race exists
    const [races] = await conn.query('SELECT * FROM races WHERE id = ?', [raceId]);
    if (races.length === 0) {
      console.error('ERROR: Race not found!');
      return;
    }
    const race = races[0];
    console.log(`Race: ${race.race_name} (ID: ${raceId})`);
    console.log(`Current: total_stages=${race.total_stages}, total_distance=${race.total_distance}\n`);

    // 2. Update races table
    console.log('--- Updating races table ---');
    await conn.query(
      `UPDATE races SET 
        total_stages = 1, 
        total_distance = 206.3,
        official_url = 'https://www.brusselscyclingclassic.be/'
      WHERE id = ?`,
      [raceId]
    );
    console.log('  total_stages: null -> 1');
    console.log('  total_distance: null -> 206.3 km');
    console.log('  official_url: set\n');

    // 3. Create or update the single stage entry
    console.log('--- Updating stages table ---');

    const [existingStages] = await conn.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = 1',
      [raceId]
    );

    const stageData = {
      stage_number: 1,
      stage_name: 'Etterbeek - Brussels',
      stage_type: 'Hills',
      date: '2026-06-07',
      distance_km: 206.3,
      elevation_m: 2000,
      start_city: 'Etterbeek',
      finish_city: 'Brussels',
      stage_code: 'brussels-classic-2026-s1'
    };

    if (existingStages.length > 0) {
      // Update existing stage
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
      // Insert new stage
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

    console.log('  Stage 1: Etterbeek - Brussels');
    console.log('    Date: 2026-06-07');
    console.log('    Distance: 206.3 km');
    console.log('    Elevation: ~2000 m');
    console.log('    Type: Hills (Muur van Geraardsbergen x3, Bosberg, Congoberg)');
    console.log('    Start: Etterbeek');
    console.log('    Finish: Brussels\n');

    // 4. Verification
    console.log('--- Verification ---');
    const [updatedRace] = await conn.query(
      'SELECT race_name, total_stages, total_distance, DATE_FORMAT(start_date, "%Y-%m-%d") as sd, DATE_FORMAT(end_date, "%Y-%m-%d") as ed FROM races WHERE id = ?',
      [raceId]
    );
    console.log(`Race: ${updatedRace[0].race_name}`);
    console.log(`  Dates: ${updatedRace[0].sd} ~ ${updatedRace[0].ed}`);
    console.log(`  Total stages: ${updatedRace[0].total_stages}`);
    console.log(`  Total distance: ${updatedRace[0].total_distance} km`);

    const [stages] = await conn.query(
      'SELECT stage_number, stage_name, DATE_FORMAT(date, "%Y-%m-%d") as date, distance_km, elevation_m, stage_type, start_city, finish_city FROM stages WHERE race_id = ? ORDER BY stage_number',
      [raceId]
    );
    console.log(`\nStages (${stages.length}):`);
    stages.forEach(s => {
      console.log(`  Stage ${s.stage_number}: ${s.date} | ${s.stage_name} | ${s.distance_km}km | ${s.elevation_m || '?'}m elev | ${s.stage_type} | ${s.start_city} -> ${s.finish_city}`);
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
