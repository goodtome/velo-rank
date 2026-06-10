#!/usr/bin/env node
/**
 * 更新2026年穿越弗兰德斯赛（Dwars door Vlaanderen）赛段数据
 * 数据来源：CyclingNews, CyclingUpToDate, CyclingOracle, Soudal Quick-Step, Biketo, Toutiao 等
 * 交叉验证后的准确数据
 *
 * 赛事信息：
 *   - 日期：2026年4月1日（周三）
 *   - 距离：184.6 km
 *   - 起点：Roeselare（鲁瑟拉勒）
 *   - 终点：Waregem（瓦勒海姆）
 *   - 类型：Hills（石板路古典赛，12个计分爬坡 + 7段石板路）
 *   - 冠军：Filippo Ganna (Ineos Grenadiers)
 *   - 亚军：Søren Wærenskjold (Uno-X Mobility)
 *   - 季军：Biniam Girmay (Intermarché-Wanty)
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
  console.log('=== Updating Dwars door Vlaanderen 2026 ===\n');

  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('DB connected.\n');

  try {
    const raceId = '6525517e-49f4-42da-8643-dbdebe8dd5c8';

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
        total_distance = 184.6
      WHERE id = ?`,
      [raceId]
    );
    console.log('  total_stages: null -> 1');
    console.log('  total_distance: null -> 184.6 km\n');

    // 3. Create or update the single stage entry
    console.log('--- Updating stages table ---');

    const [existingStages] = await conn.query(
      'SELECT id FROM stages WHERE race_id = ? AND stage_number = 1',
      [raceId]
    );

    const stageData = {
      stage_number: 1,
      stage_name: 'Roeselare - Waregem',
      stage_type: 'Hills',
      date: '2026-04-01',
      distance_km: 184.6,
      elevation_m: null,  // No authoritative source provided exact figure
      start_city: 'Roeselare',
      finish_city: 'Waregem',
      stage_code: 'dwars-door-vlaanderen-2026-s1'
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

    console.log('  Stage 1: Roeselare - Waregem');
    console.log('    Date: 2026-04-01');
    console.log('    Distance: 184.6 km');
    console.log('    Type: Hills (12 climbs, 7 cobbled sectors)');
    console.log('    Key climbs: Knokteberg-Trieu (7.7%), Eikenberg, Nokereberg');
    console.log('    Start: Roeselare');
    console.log('    Finish: Waregem\n');

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
