#!/usr/bin/env node

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 13306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql123456',
  database: process.env.DB_NAME || 'jersey_db',
  dateStrings: true
};

const RACE = {
  race_name: 'Tour Auvergne-Rhone-Alpes',
  race_name_en: 'Tour Auvergne-Rhone-Alpes',
  race_name_zh: '环多菲内',
  race_code: 'dauphine-2026',
  category: 'WorldTour',
  category_zh: '世巡赛',
  gender: 'MEN',
  season: 2026,
  country: 'France',
  start_date: '2026-06-07',
  end_date: '2026-06-14',
  total_stages: 8,
  total_distance: 1208.1,
  official_url: 'https://www.tour-auvergne-rhone-alpes.fr/en'
};

const STAGES = [
  {
    number: 1,
    date: '2026-06-07',
    start_city: 'Vizille',
    start_city_zh: '维济勒',
    finish_city: 'Saint-Ismier',
    finish_city_zh: '圣伊斯米耶',
    distance_km: 146.2,
    stage_type: 'mountains'
  },
  {
    number: 2,
    date: '2026-06-08',
    start_city: 'Saint-Martin-Le-Vinoux',
    start_city_zh: '圣马丹勒维努',
    finish_city: 'Le Puy-en-Velay',
    finish_city_zh: '勒皮昂沃莱',
    distance_km: 234.3,
    stage_type: 'hills'
  },
  {
    number: 3,
    date: '2026-06-09',
    start_city: 'Perreux',
    start_city_zh: '佩勒',
    finish_city: 'Perreux',
    finish_city_zh: '佩勒',
    distance_km: 28.4,
    stage_type: 'ttt'
  },
  {
    number: 4,
    date: '2026-06-10',
    start_city: 'Le Puy-en-Velay',
    start_city_zh: '勒皮昂沃莱',
    finish_city: 'Montrond-les-Bains',
    finish_city_zh: '蒙特龙莱班',
    distance_km: 167.4,
    stage_type: 'hills'
  },
  {
    number: 5,
    date: '2026-06-11',
    start_city: 'Saint-Chamond',
    start_city_zh: '圣沙蒙',
    finish_city: 'Parc des Oiseaux - Villars-les-Dombes',
    finish_city_zh: '鸟类公园 - 维拉尔莱栋布',
    distance_km: 195.8,
    stage_type: 'hills'
  },
  {
    number: 6,
    date: '2026-06-12',
    start_city: 'Saint-Vulbas',
    start_city_zh: '圣维尔巴',
    finish_city: 'Crest-Voland',
    finish_city_zh: '克雷沃朗',
    distance_km: 182.3,
    stage_type: 'mountains'
  },
  {
    number: 7,
    date: '2026-06-13',
    start_city: 'La Bridoire',
    start_city_zh: '拉布里杜瓦尔',
    finish_city: 'Grand Colombier',
    finish_city_zh: '大科隆比耶',
    distance_km: 133.6,
    stage_type: 'mountains'
  },
  {
    number: 8,
    date: '2026-06-14',
    start_city: 'Beaufort',
    start_city_zh: '博福尔',
    finish_city: 'Plateau de Solaison - Brison',
    finish_city_zh: '索莱松高原 - 布里松',
    distance_km: 120.1,
    stage_type: 'mountains'
  }
].map(stage => ({
  ...stage,
  stage_name: `${stage.start_city} - ${stage.finish_city}`,
  stage_name_zh: `${stage.start_city_zh} - ${stage.finish_city_zh}`,
  stage_code: `dauphine-2026-stage-${stage.number}`
}));

async function upsertRace(conn) {
  const [existing] = await conn.query('SELECT id FROM races WHERE race_code = ?', [RACE.race_code]);
  const raceId = existing[0]?.id || uuidv4();

  if (existing.length === 0) {
    await conn.query(
      `INSERT INTO races (
        id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender,
        season, country, start_date, end_date, total_stages, total_distance, official_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [
        raceId,
        RACE.race_name,
        RACE.race_name_en,
        RACE.race_name_zh,
        RACE.race_code,
        RACE.category,
        RACE.category_zh,
        RACE.gender,
        RACE.season,
        RACE.country,
        RACE.start_date,
        RACE.end_date,
        RACE.total_stages,
        RACE.total_distance,
        RACE.official_url
      ]
    );
    return { raceId, created: true };
  }

  await conn.query(
    `UPDATE races SET
      race_name = ?,
      race_name_en = ?,
      race_name_zh = ?,
      category = ?,
      category_zh = ?,
      gender = ?,
      season = ?,
      country = ?,
      start_date = ?,
      end_date = ?,
      total_stages = ?,
      total_distance = ?,
      official_url = ?,
      is_active = true
    WHERE id = ?`,
    [
      RACE.race_name,
      RACE.race_name_en,
      RACE.race_name_zh,
      RACE.category,
      RACE.category_zh,
      RACE.gender,
      RACE.season,
      RACE.country,
      RACE.start_date,
      RACE.end_date,
      RACE.total_stages,
      RACE.total_distance,
      RACE.official_url,
      raceId
    ]
  );
  return { raceId, created: false };
}

async function upsertStage(conn, raceId, stage) {
  const [existing] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?',
    [raceId, stage.number]
  );
  const stageId = existing[0]?.id || uuidv4();

  if (existing.length === 0) {
    await conn.query(
      `INSERT INTO stages (
        id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date,
        distance_km, start_city, start_city_zh, finish_city, finish_city_zh, stage_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stageId,
        raceId,
        stage.number,
        stage.stage_name,
        stage.stage_name_zh,
        stage.stage_type,
        stage.date,
        stage.distance_km,
        stage.start_city,
        stage.start_city_zh,
        stage.finish_city,
        stage.finish_city_zh,
        stage.stage_code
      ]
    );
    return 'created';
  }

  await conn.query(
    `UPDATE stages SET
      stage_name = ?,
      stage_name_zh = ?,
      stage_type = ?,
      date = ?,
      distance_km = ?,
      start_city = ?,
      start_city_zh = ?,
      finish_city = ?,
      finish_city_zh = ?,
      stage_code = ?
    WHERE id = ?`,
    [
      stage.stage_name,
      stage.stage_name_zh,
      stage.stage_type,
      stage.date,
      stage.distance_km,
      stage.start_city,
      stage.start_city_zh,
      stage.finish_city,
      stage.finish_city_zh,
      stage.stage_code,
      stageId
    ]
  );
  return 'updated';
}

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    await conn.beginTransaction();

    const { raceId, created } = await upsertRace(conn);
    console.log(`${created ? 'Created' : 'Updated'} race ${RACE.race_code}: ${raceId}`);

    const counts = { created: 0, updated: 0 };
    for (const stage of STAGES) {
      const status = await upsertStage(conn, raceId, stage);
      counts[status] += 1;
      console.log(`${status}: stage ${stage.number} ${stage.stage_name} (${stage.distance_km} km)`);
    }

    const [verification] = await conn.query(
      `SELECT COUNT(*) AS stage_count, ROUND(SUM(distance_km), 1) AS distance_sum
       FROM stages
       WHERE race_id = ?`,
      [raceId]
    );
    const stageCount = Number(verification[0].stage_count);
    const distanceSum = Number(verification[0].distance_sum);

    if (stageCount !== RACE.total_stages) {
      throw new Error(`Expected ${RACE.total_stages} stages, found ${stageCount}`);
    }
    if (Math.abs(distanceSum - RACE.total_distance) > 0.1) {
      throw new Error(`Expected ${RACE.total_distance} km, found ${distanceSum} km`);
    }

    await conn.commit();

    const [stages] = await conn.query(
      `SELECT stage_number, stage_name, stage_name_zh, date, distance_km, stage_type, start_city, finish_city
       FROM stages
       WHERE race_id = ?
       ORDER BY stage_number`,
      [raceId]
    );

    console.log(`\nVerification OK: ${stageCount} stages, ${distanceSum.toFixed(1)} km`);
    for (const s of stages) {
      console.log(
        `Stage ${s.stage_number}: ${formatDate(s.date)} | ${s.stage_name} | ${s.distance_km} km | ${s.stage_type}`
      );
    }
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
