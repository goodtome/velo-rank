/**
 * 导入环法 2026 赛段数据
 * 官方来源: letour.fr
 * 
 * 使用方式：node import-tdf2026-stages.js
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: `${__dirname}/../config/.env` });

const dbConfig = require('../config/database');

// 环法 2026 赛事配置
const RACE_CODE = 'tdf-2026';
const DUPLICATE_RACE_CODE = 'tour-de-france-2026'; // 重复记录，需要清理

// 环法 2026 赛段数据（来源: letour.fr 官方路线）
// 总距离 3333km，累计爬升 54450m
const STAGES = [
  {
    number: 1,
    start_city: 'Barcelona',
    finish_city: 'Barcelona',
    start_city_zh: '巴塞罗那',
    finish_city_zh: '巴塞罗那',
    date: '2026-07-04',
    distance_km: 19.0,
    stage_type: 'TTT',
    stage_name: 'Barcelona > Barcelona',
    stage_name_zh: '巴塞罗那 > 巴塞罗那',
    notes: '团队计时赛，Grand Départ'
  },
  {
    number: 2,
    start_city: 'Tarragona',
    finish_city: 'Barcelona',
    start_city_zh: '塔拉戈纳',
    finish_city_zh: '巴塞罗那',
    date: '2026-07-05',
    distance_km: 182.0,
    stage_type: 'Hills',
    stage_name: 'Tarragona > Barcelona',
    stage_name_zh: '塔拉戈纳 > 巴塞罗那'
  },
  {
    number: 3,
    start_city: 'Granollers',
    finish_city: 'Les Angles',
    start_city_zh: '格拉诺列斯',
    finish_city_zh: '莱桑格勒',
    date: '2026-07-06',
    distance_km: 196.0,
    stage_type: 'Mountain',
    stage_name: 'Granollers > Les Angles',
    stage_name_zh: '格拉诺列斯 > 莱桑格勒'
  },
  {
    number: 4,
    start_city: 'Carcassonne',
    finish_city: 'Foix',
    start_city_zh: '卡尔卡松',
    finish_city_zh: '富瓦',
    date: '2026-07-07',
    distance_km: 182.0,
    stage_type: 'Hills',
    stage_name: 'Carcassonne > Foix',
    stage_name_zh: '卡尔卡松 > 富瓦'
  },
  {
    number: 5,
    start_city: 'Lannemezan',
    finish_city: 'Pau',
    start_city_zh: '拉讷默藏',
    finish_city_zh: '波城',
    date: '2026-07-08',
    distance_km: 158.0,
    stage_type: 'Flat',
    stage_name: 'Lannemezan > Pau',
    stage_name_zh: '拉讷默藏 > 波城'
  },
  {
    number: 6,
    start_city: 'Pau',
    finish_city: 'Gavarnie-Gèdre',
    start_city_zh: '波城',
    finish_city_zh: '加瓦尔尼-热德',
    date: '2026-07-09',
    distance_km: 186.0,
    stage_type: 'Mountain',
    stage_name: 'Pau > Gavarnie-Gèdre',
    stage_name_zh: '波城 > 加瓦尔尼-热德'
  },
  // --- 休息日 7月10日 (Cantal) ---
  // 注意：第7赛段在休息日之后的 7月11日
  {
    number: 7,
    start_city: 'Hagetmau',
    finish_city: 'Bordeaux',
    start_city_zh: '阿热莫',
    finish_city_zh: '波尔多',
    date: '2026-07-11',
    distance_km: 175.0,
    stage_type: 'Flat',
    stage_name: 'Hagetmau > Bordeaux',
    stage_name_zh: '阿热莫 > 波尔多'
  },
  {
    number: 8,
    start_city: 'Périgueux',
    finish_city: 'Bergerac',
    start_city_zh: '佩里格',
    finish_city_zh: '贝尔热拉克',
    date: '2026-07-12',
    distance_km: 182.0,
    stage_type: 'Flat',
    stage_name: 'Périgueux > Bergerac',
    stage_name_zh: '佩里格 > 贝尔热拉克'
  },
  {
    number: 9,
    start_city: 'Malemort',
    finish_city: 'Ussel',
    start_city_zh: '马勒莫尔',
    finish_city_zh: '于塞勒',
    date: '2026-07-13',
    distance_km: 185.0,
    stage_type: 'Hills',
    stage_name: 'Malemort > Ussel',
    stage_name_zh: '马勒莫尔 > 于塞勒'
  },
  // --- 休息日 7月13日 (Cantal) ---
  {
    number: 10,
    start_city: 'Aurillac',
    finish_city: 'Le Lioran',
    start_city_zh: '欧里亚克',
    finish_city_zh: '勒利奥朗',
    date: '2026-07-14',
    distance_km: 167.0,
    stage_type: 'Mountain',
    stage_name: 'Aurillac > Le Lioran',
    stage_name_zh: '欧里亚克 > 勒利奥朗'
  },
  {
    number: 11,
    start_city: 'Vichy',
    finish_city: 'Nevers',
    start_city_zh: '维希',
    finish_city_zh: '讷韦尔',
    date: '2026-07-15',
    distance_km: 161.0,
    stage_type: 'Flat',
    stage_name: 'Vichy > Nevers',
    stage_name_zh: '维希 > 讷韦尔'
  },
  {
    number: 12,
    start_city: 'Circuit Nevers Magny-Cours',
    finish_city: 'Chalon-sur-Saône',
    start_city_zh: '马尼库尔赛道',
    finish_city_zh: '索恩河畔沙隆',
    date: '2026-07-16',
    distance_km: 181.0,
    stage_type: 'Flat',
    stage_name: 'Circuit Nevers Magny-Cours > Chalon-sur-Saône',
    stage_name_zh: '马尼库尔赛道 > 索恩河畔沙隆'
  },
  {
    number: 13,
    start_city: 'Dole',
    finish_city: 'Belfort',
    start_city_zh: '多勒',
    finish_city_zh: '贝尔福',
    date: '2026-07-17',
    distance_km: 205.0,
    stage_type: 'Hills',
    stage_name: 'Dole > Belfort',
    stage_name_zh: '多勒 > 贝尔福'
  },
  {
    number: 14,
    start_city: 'Mulhouse',
    finish_city: 'Le Markstein Fellering',
    start_city_zh: '米卢斯',
    finish_city_zh: '马尔克斯坦',
    date: '2026-07-18',
    distance_km: 155.0,
    stage_type: 'Mountain',
    stage_name: 'Mulhouse > Le Markstein Fellering',
    stage_name_zh: '米卢斯 > 马尔克斯坦'
  },
  {
    number: 15,
    start_city: 'Champagnole',
    finish_city: 'Plateau de Solaison',
    start_city_zh: '尚帕尼奥勒',
    finish_city_zh: '索莱松高原',
    date: '2026-07-19',
    distance_km: 184.0,
    stage_type: 'Mountain',
    stage_name: 'Champagnole > Plateau de Solaison',
    stage_name_zh: '尚帕尼奥勒 > 索莱松高原'
  },
  // --- 休息日 7月20日 (Haute-Savoie) ---
  {
    number: 16,
    start_city: 'Évian-les-Bains',
    finish_city: 'Thonon-les-Bains',
    start_city_zh: '埃维昂莱班',
    finish_city_zh: '托农莱班',
    date: '2026-07-21',
    distance_km: 26.0,
    stage_type: 'ITT',
    stage_name: 'Évian-les-Bains > Thonon-les-Bains',
    stage_name_zh: '埃维昂莱班 > 托农莱班',
    notes: '个人计时赛'
  },
  {
    number: 17,
    start_city: 'Chambéry',
    finish_city: 'Voiron',
    start_city_zh: '尚贝里',
    finish_city_zh: '瓦龙',
    date: '2026-07-22',
    distance_km: 175.0,
    stage_type: 'Flat',
    stage_name: 'Chambéry > Voiron',
    stage_name_zh: '尚贝里 > 瓦龙'
  },
  {
    number: 18,
    start_city: 'Voiron',
    finish_city: 'Orcières-Merlette',
    start_city_zh: '瓦龙',
    finish_city_zh: '奥尔西耶尔-梅莱特',
    date: '2026-07-23',
    distance_km: 185.0,
    stage_type: 'Mountain',
    stage_name: 'Voiron > Orcières-Merlette',
    stage_name_zh: '瓦龙 > 奥尔西耶尔-梅莱特'
  },
  {
    number: 19,
    start_city: 'Gap',
    finish_city: "Alpe d'Huez",
    start_city_zh: '加普',
    finish_city_zh: '阿尔普迪埃',
    date: '2026-07-24',
    distance_km: 128.0,
    stage_type: 'Mountain',
    stage_name: "Gap > Alpe d'Huez",
    stage_name_zh: '加普 > 阿尔普迪埃'
  },
  {
    number: 20,
    start_city: "Le Bourg d'Oisans",
    finish_city: "Alpe d'Huez",
    start_city_zh: '布尔多瓦桑',
    finish_city_zh: '阿尔普迪埃',
    date: '2026-07-25',
    distance_km: 171.0,
    stage_type: 'Mountain',
    stage_name: "Le Bourg d'Oisans > Alpe d'Huez",
    stage_name_zh: '布尔多瓦桑 > 阿尔普迪埃',
    notes: '双登阿尔普迪埃第二日'
  },
  {
    number: 21,
    start_city: 'Thoiry',
    finish_city: 'Paris Champs-Élysées',
    start_city_zh: '图瓦里',
    finish_city_zh: '巴黎香榭丽舍大街',
    date: '2026-07-26',
    distance_km: 130.0,
    stage_type: 'Flat',
    stage_name: 'Thoiry > Paris Champs-Élysées',
    stage_name_zh: '图瓦里 > 巴黎香榭丽舍大街'
  }
];

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      ...dbConfig.development,
      database: dbConfig.development.database
    });

    console.log('🚴 导入环法 2026 赛段数据');
    console.log('='.repeat(60));

    // ========== 1. 清理重复赛事记录 ==========
    const [duplicates] = await conn.query(
      'SELECT id, race_code FROM races WHERE race_code = ?',
      [DUPLICATE_RACE_CODE]
    );

    if (duplicates.length > 0) {
      // 检查重复赛事是否有赛段关联
      const [dupStages] = await conn.query(
        'SELECT COUNT(*) as cnt FROM stages WHERE race_id = ?',
        [duplicates[0].id]
      );

      if (dupStages[0].cnt > 0) {
        console.log(`⚠️  重复赛事 ${DUPLICATE_RACE_CODE} 下有 ${dupStages[0].cnt} 个赛段，先清理...`);
        // 清理关联的赛段成绩和领骑衫
        await conn.query(`
          DELETE sr FROM stage_results sr
          JOIN stages s ON sr.stage_id = s.id
          WHERE s.race_id = ?
        `, [duplicates[0].id]);
        await conn.query(`
          DELETE j FROM jerseys j
          JOIN stages s ON j.stage_id = s.id
          WHERE s.race_id = ?
        `, [duplicates[0].id]);
        await conn.query('DELETE FROM stages WHERE race_id = ?', [duplicates[0].id]);
        console.log(`  ✅ 已清理重复赛事的关联数据`);
      }

      await conn.query('DELETE FROM races WHERE race_code = ?', [DUPLICATE_RACE_CODE]);
      console.log(`✅ 已删除重复赛事记录: ${DUPLICATE_RACE_CODE}`);
    }

    // ========== 2. 获取目标赛事 ==========
    const [races] = await conn.query(
      'SELECT id, race_name, race_code FROM races WHERE race_code = ?',
      [RACE_CODE]
    );

    if (races.length === 0) {
      console.log('❌ 赛事不存在: ' + RACE_CODE);
      return;
    }

    const raceId = races[0].id;
    console.log(`✅ 赛事: ${races[0].race_name} (${races[0].race_code})`);
    console.log(`   ID: ${raceId}\n`);

    // ========== 3. 检查已有赛段 ==========
    const [existingStages] = await conn.query(
      'SELECT stage_number, id FROM stages WHERE race_id = ? ORDER BY stage_number',
      [raceId]
    );
    const existingMap = {};
    existingStages.forEach(s => { existingMap[s.stage_number] = s.id; });

    if (existingStages.length > 0) {
      console.log(`ℹ️  已有 ${existingStages.length} 个赛段记录，将更新已有记录\n`);
    }

    // ========== 4. 导入赛段 ==========
    let created = 0, updated = 0;

    for (const stage of STAGES) {
      const stageCode = `tdf-2026-s${stage.number}`;

      if (existingMap[stage.number]) {
        // 更新已有赛段
        await conn.query(`
          UPDATE stages SET
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
          WHERE id = ?
        `, [
          stage.stage_name,
          stage.stage_name_zh,
          stage.stage_type,
          stage.date,
          stage.distance_km,
          stage.start_city,
          stage.start_city_zh,
          stage.finish_city,
          stage.finish_city_zh,
          stageCode,
          existingMap[stage.number]
        ]);
        console.log(`  🔄 更新赛段 ${stage.number}: ${stage.stage_name} (${stage.distance_km}km ${stage.stage_type})`);
        updated++;
      } else {
        // 创建新赛段
        const stageId = uuidv4();
        await conn.query(`
          INSERT INTO stages (
            id, race_id, stage_number, stage_name, stage_name_zh,
            stage_type, date, distance_km,
            start_city, start_city_zh, finish_city, finish_city_zh,
            stage_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
          stageCode
        ]);
        console.log(`  ✅ 创建赛段 ${stage.number}: ${stage.stage_name} (${stage.distance_km}km ${stage.stage_type})`);
        created++;
      }
    }

    // ========== 5. 更新赛事总距离 ==========
    const totalDistance = STAGES.reduce((sum, s) => sum + s.distance_km, 0);
    await conn.query(
      'UPDATE races SET total_distance = ?, start_date = ?, end_date = ? WHERE id = ?',
      [
        totalDistance,
        STAGES[0].date,
        STAGES[STAGES.length - 1].date,
        raceId
      ]
    );

    // ========== 汇总 ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 导入完成`);
    console.log(`   新建: ${created} 个赛段`);
    console.log(`   更新: ${updated} 个赛段`);
    console.log(`   总距离: ${totalDistance.toFixed(0)} km`);
    console.log(`   日期范围: ${STAGES[0].date} → ${STAGES[STAGES.length - 1].date}`);

    // 验证
    const [verify] = await conn.query(
      'SELECT COUNT(*) as cnt FROM stages WHERE race_id = ?',
      [raceId]
    );
    console.log(`   数据库中赛段总数: ${verify[0].cnt}`);

  } catch (err) {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
  } finally {
    if (conn) await conn.end();
  }
}

main();
