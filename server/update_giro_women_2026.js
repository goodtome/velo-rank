#!/usr/bin/env node
/**
 * 更新2026年环意大利女子赛赛段数据
 * 数据来源：CyclingNews, Olympics.com, 官方网站(giroditaliawomen.it), CyclingUpToDate
 * 交叉验证后的准确数据
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

// 交叉验证后的赛段数据（4个来源一致）
const CORRECTED_STAGES = [
  { number: 1, date: '2026-05-30', start_city: 'Cesenatico', finish_city: 'Ravenna', distance_km: 139.0, stage_type: 'Flat', stage_name: 'Cesenatico - Ravenna' },
  { number: 2, date: '2026-05-31', start_city: 'Roncade', finish_city: 'Caorle', distance_km: 146.0, stage_type: 'Flat', stage_name: 'Roncade - Caorle' },
  { number: 3, date: '2026-06-01', start_city: 'Bibione', finish_city: 'Buja', distance_km: 154.0, stage_type: 'Hills', stage_name: 'Bibione - Buja' },
  { number: 4, date: '2026-06-02', start_city: 'Belluno', finish_city: 'Nevegal', distance_km: 12.7, stage_type: 'ITT', stage_name: 'Belluno - Nevegal (ITT)' },
  { number: 5, date: '2026-06-03', start_city: 'Longarone', finish_city: 'Santo Stefano di Cadore', distance_km: 138.0, stage_type: 'Mountain', stage_name: 'Longarone - Santo Stefano di Cadore' },
  { number: 6, date: '2026-06-04', start_city: 'Ala', finish_city: 'Brescello', distance_km: 155.0, stage_type: 'Flat', stage_name: 'Ala - Brescello' },
  { number: 7, date: '2026-06-05', start_city: 'Sorbolo Mezzani', finish_city: 'Salice Terme', distance_km: 165.0, stage_type: 'Hills', stage_name: 'Sorbolo Mezzani - Salice Terme' },
  { number: 8, date: '2026-06-06', start_city: 'Rivoli', finish_city: 'Sestriere', distance_km: 101.0, stage_type: 'Mountain', stage_name: 'Rivoli - Sestriere' },
  { number: 9, date: '2026-06-07', start_city: 'Saluzzo', finish_city: 'Saluzzo', distance_km: 143.0, stage_type: 'Mountain', stage_name: 'Saluzzo - Saluzzo' }
];

async function main() {
  console.log('=== 更新2026年环意大利女子赛赛段数据 ===\n');

  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('DB connected.\n');

  try {
    // 1. 获取赛事信息
    const [races] = await conn.query(
      "SELECT id, race_name, start_date, end_date, total_distance FROM races WHERE race_name LIKE ? AND season = 2026",
      ['Giro d%Italia Women']
    );

    if (races.length === 0) {
      console.error('ERROR: Race not found!');
      return;
    }

    const race = races[0];
    const raceId = race.id;
    console.log(`Race: ${race.race_name} (ID: ${raceId})`);
    console.log(`Current dates: ${race.start_date} ~ ${race.end_date}`);
    console.log(`Current total_distance: ${race.total_distance}\n`);

    // 2. 更新赛事信息
    console.log('--- Updating race info ---');
    await conn.query(
      "UPDATE races SET start_date = '2026-05-30', end_date = '2026-06-07', total_distance = 1153.7 WHERE id = ?",
      [raceId]
    );
    console.log('  start_date: 2026-05-30');
    console.log('  end_date: 2026-06-07');
    console.log('  total_distance: 1153.7 km\n');

    // 3. 获取现有赛段
    const [existingStages] = await conn.query(
      'SELECT id, stage_number, stage_name, date, distance_km, stage_type, start_city, finish_city FROM stages WHERE race_id = ? ORDER BY stage_number',
      [raceId]
    );
    console.log(`Found ${existingStages.length} existing stages.\n`);

    // 4. 对比并更新赛段
    console.log('--- Stage updates (old -> new) ---');
    let updatedCount = 0;

    for (const corrected of CORRECTED_STAGES) {
      const existing = existingStages.find(s => s.stage_number === corrected.number);

      if (!existing) {
        console.log(`  Stage ${corrected.number}: NOT FOUND in DB, skipping.`);
        continue;
      }

      // Check what changed
      const changes = [];
      if (formatDate(existing.date) !== corrected.date) changes.push(`date: ${formatDate(existing.date)} -> ${corrected.date}`);
      if (parseFloat(existing.distance_km) !== corrected.distance_km) changes.push(`distance: ${existing.distance_km}km -> ${corrected.distance_km}km`);
      if (existing.stage_type !== corrected.stage_type) changes.push(`type: ${existing.stage_type} -> ${corrected.stage_type}`);
      if (existing.start_city !== corrected.start_city) changes.push(`start_city: ${existing.start_city} -> ${corrected.start_city}`);
      if (existing.finish_city !== corrected.finish_city) changes.push(`finish_city: ${existing.finish_city} -> ${corrected.finish_city}`);
      if (existing.stage_name !== corrected.stage_name) changes.push(`stage_name: ${existing.stage_name} -> ${corrected.stage_name}`);

      if (changes.length > 0) {
        console.log(`  Stage ${corrected.number}: ${changes.join(', ')}`);

        await conn.query(
          `UPDATE stages SET 
            date = ?, 
            distance_km = ?, 
            stage_type = ?, 
            start_city = ?, 
            finish_city = ?, 
            stage_name = ?
          WHERE id = ?`,
          [
            corrected.date,
            corrected.distance_km,
            corrected.stage_type,
            corrected.start_city,
            corrected.finish_city,
            corrected.stage_name,
            existing.id
          ]
        );
        updatedCount++;
      } else {
        console.log(`  Stage ${corrected.number}: no changes needed`);
      }
    }

    console.log(`\nUpdated ${updatedCount} stages.\n`);

    // 5. 验证更新结果
    console.log('--- Verification ---');
    const [updatedRace] = await conn.query(
      'SELECT race_name, start_date, end_date, total_distance, total_stages FROM races WHERE id = ?',
      [raceId]
    );
    console.log(`Race: ${updatedRace[0].race_name}`);
    console.log(`  Dates: ${formatDate(updatedRace[0].start_date)} ~ ${formatDate(updatedRace[0].end_date)}`);
    console.log(`  Total distance: ${updatedRace[0].total_distance} km`);
    console.log(`  Total stages: ${updatedRace[0].total_stages}`);

    const [updatedStages] = await conn.query(
      'SELECT stage_number, stage_name, date, distance_km, stage_type, start_city, finish_city FROM stages WHERE race_id = ? ORDER BY stage_number',
      [raceId]
    );
    console.log(`\nStages:`);
    let totalDist = 0;
    updatedStages.forEach(s => {
      const dist = parseFloat(s.distance_km);
      totalDist += dist;
      console.log(`  Stage ${s.stage_number}: ${formatDate(s.date)} | ${s.stage_name} | ${s.distance_km}km | ${s.stage_type} | ${s.start_city} -> ${s.finish_city}`);
    });
    console.log(`\nSum of stage distances: ${totalDist.toFixed(1)} km`);
    console.log(`Race total_distance: ${updatedRace[0].total_distance} km`);
    console.log(`Match: ${Math.abs(totalDist - parseFloat(updatedRace[0].total_distance)) < 0.1 ? 'YES' : 'NO'}`);

  } finally {
    await conn.end();
    console.log('\nDone.');
  }
}

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
