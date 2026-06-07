/**
 * 环法 2026 赛事初始化脚本
 * 
 * 功能：
 * 1. 创建 Tour de France 2026 赛事记录
 * 2. 创建 21 个赛段记录
 * 3. 导入 23 支参赛车队
 * 
 * 使用方式：
 *   node server/scripts/import-tdf2026-setup.js
 * 
 * 数据来源：letour.fr 官方路线 + ASO 车队公告
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: `${__dirname}/../config/.env` });
const dbConfig = require('../config/database');

// ============================================================
// 环法 2026 赛事配置
// ============================================================

const RACE = {
  race_name: '环法自行车赛 2026',
  race_name_en: 'Tour de France 2026',
  race_code: 'tour-de-france-2026',
  category: 'GRAND_TOUR',
  gender: 'MEN',
  season: 2026,
  country: 'France',
  start_date: '2026-07-04',
  end_date: '2026-07-26',
  total_stages: 21,
  total_distance: 3333.0,
  official_url: 'https://www.letour.fr'
};

// 21个赛段（数据来源：letour.fr 官方路线）
const STAGES = [
  { number: 1,  date: '2026-07-04', start: 'Barcelona',           finish: 'Barcelona',                km: 19,   type: 'TTT',       name_zh: '巴塞罗那团队计时赛' },
  { number: 2,  date: '2026-07-05', start: 'Tarragona',           finish: 'Barcelona',                km: 182,  type: 'HILLS',     name_zh: '塔拉戈纳 → 巴塞罗那' },
  { number: 3,  date: '2026-07-06', start: 'Granollers',          finish: 'Les Angles',               km: 196,  type: 'MOUNTAIN',  name_zh: '格拉诺列尔斯 → 莱桑格勒' },
  { number: 4,  date: '2026-07-07', start: 'Carcassonne',         finish: 'Foix',                     km: 182,  type: 'HILLS',     name_zh: '卡尔卡松 → 富瓦' },
  { number: 5,  date: '2026-07-08', start: 'Lannemezan',          finish: 'Pau',                      km: 158,  type: 'FLAT',      name_zh: '拉讷默藏 → 波城' },
  { number: 6,  date: '2026-07-09', start: 'Pau',                 finish: 'Gavarnie-Gedre',           km: 186,  type: 'MOUNTAIN',  name_zh: '波城 → 加瓦尔尼-热德爾' },
  { number: 7,  date: '2026-07-10', start: 'Hagetmau',            finish: 'Bordeaux',                 km: 175,  type: 'FLAT',      name_zh: '阿热莫 → 波尔多' },
  { number: 8,  date: '2026-07-11', start: 'Perigueux',           finish: 'Bergerac',                 km: 182,  type: 'FLAT',      name_zh: '佩里格 → 贝尔热拉克' },
  { number: 9,  date: '2026-07-12', start: 'Malemort',            finish: 'Ussel',                    km: 185,  type: 'HILLS',     name_zh: '马勒莫尔 → 于塞勒' },
  // 7/13 休息日
  { number: 10, date: '2026-07-14', start: 'Aurillac',            finish: 'Le Lioran',                km: 167,  type: 'MOUNTAIN',  name_zh: '欧里亚克 → 勒利奥朗' },
  { number: 11, date: '2026-07-15', start: 'Vichy',               finish: 'Nevers',                   km: 161,  type: 'FLAT',      name_zh: '维希 → 讷韦尔' },
  { number: 12, date: '2026-07-16', start: 'Circuit Nevers Magny-Cours', finish: 'Chalon-sur-Saône', km: 181,  type: 'FLAT',      name_zh: '讷韦尔赛道 → 索恩河畔沙隆' },
  { number: 13, date: '2026-07-17', start: 'Dole',                finish: 'Belfort',                  km: 205,  type: 'HILLS',     name_zh: '多勒 → 贝尔福' },
  { number: 14, date: '2026-07-18', start: 'Mulhouse',            finish: 'Le Markstein Fellering',   km: 155,  type: 'MOUNTAIN',  name_zh: '米卢斯 → 勒马克斯坦' },
  { number: 15, date: '2026-07-19', start: 'Champagnole',         finish: 'Plateau de Solaison',     km: 184,  type: 'MOUNTAIN',  name_zh: '尚帕尼奥勒 → 索莱松高原' },
  // 7/20 休息日
  { number: 16, date: '2026-07-21', start: 'Evian-les-Bains',     finish: 'Thonon-les-Bains',        km: 26,   type: 'ITT',       name_zh: '埃维昂个人计时赛' },
  { number: 17, date: '2026-07-22', start: 'Chambéry',            finish: 'Voiron',                   km: 175,  type: 'FLAT',      name_zh: '尚贝里 → 瓦龙' },
  { number: 18, date: '2026-07-23', start: 'Voiron',              finish: 'Orcières-Merlette',       km: 185,  type: 'MOUNTAIN',  name_zh: '瓦龙 → 奥尔西耶尔-梅莱特' },
  { number: 19, date: '2026-07-24', start: 'Gap',                 finish: "Alpe d'Huez",             km: 128,  type: 'MOUNTAIN',  name_zh: '加普 → 阿尔普迪埃' },
  { number: 20, date: '2026-07-25', start: "Le Bourg-d'Oisans",   finish: "Alpe d'Huez",             km: 171,  type: 'MOUNTAIN',  name_zh: '布尔杜瓦桑 → 阿尔普迪埃' },
  { number: 21, date: '2026-07-26', start: 'Thoiry',              finish: 'Paris Champs-Élysées',    km: 130,  type: 'FLAT',      name_zh: '图瓦里 → 巴黎香榭丽舍' }
];

// 23支参赛车队（ASO 2026年1月30日公告）
const TEAMS = [
  // WorldTour 车队 (18)
  { name: 'Alpecin - Premier Tech',          name_zh: '欧倍青-博泰',           uci_code: 'APT' },
  { name: 'Bahrain Victorious',              name_zh: '巴林胜利',              uci_code: 'TBV' },
  { name: 'Decathlon AG2R La Mondiale',      name_zh: '迪卡侬-达飞',           uci_code: 'DAT' },
  { name: 'EF Education - EasyPost',         name_zh: 'EF教育-易邮',           uci_code: 'EFE' },
  { name: 'Groupama - FDJ',                  name_zh: '安盟-FDJ',             uci_code: 'GFC' },
  { name: 'INEOS Grenadiers',                name_zh: '英力士掷弹兵',          uci_code: 'IGD' },
  { name: 'Lotto - Intermarché',             name_zh: '乐透-英特马什',         uci_code: 'LTD' },
  { name: 'Lidl - Trek',                     name_zh: '力多-崔克',            uci_code: 'LTK' },
  { name: 'Movistar Team',                   name_zh: '移动之星',             uci_code: 'MOV' },
  { name: 'NSN',                             name_zh: 'NSN',                  uci_code: 'NSN' },
  { name: 'Red Bull - BORA - hansgrohe',     name_zh: '红牛-博拉-汉斯格雅',    uci_code: 'RBH' },
  { name: 'Soudal - Quick-Step',             name_zh: '速德奥-快步',          uci_code: 'SOQ' },
  { name: 'Team Visma | Lease a Bike',       name_zh: '维斯马-租自行车',       uci_code: 'TVL' },
  { name: 'Team Jayco AlUla',                name_zh: '杰科-阿拉乌拉',         uci_code: 'JAY' },
  { name: 'Team Picnic PostNL',              name_zh: '野餐-PostNL',          uci_code: 'DFP' },
  { name: 'UAE Team Emirates - XRG',         name_zh: '阿联酋航空-XRG',       uci_code: 'UAD' },
  { name: 'Uno-X Mobility',                  name_zh: 'Uno-X',               uci_code: 'UXM' },
  { name: 'XDS Astana Team',                 name_zh: 'XDS阿斯塔纳',          uci_code: 'XAT' },
  // ProTeams / 特邀车队 (5)
  { name: 'Cofidis',                         name_zh: '科菲迪斯',             uci_code: 'COF' },
  { name: 'Q36.5 Pro Cycling Team',          name_zh: 'Q36.5',               uci_code: 'Q36' },
  { name: 'Tudor Pro Cycling Team',          name_zh: '都铎',                uci_code: 'TUD' },
  { name: 'Team TotalEnergies',              name_zh: '道达尔能源',           uci_code: 'TEN' },
  { name: 'Caja Rural - Seguros RGA',        name_zh: '西班牙农业银行',       uci_code: 'CJR' }
];


// ============================================================
// 数据库操作
// ============================================================

async function setupTDF2026() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig.development);
    
    console.log('🚴 环法 2026 赛事初始化');
    console.log('='.repeat(60));

    // -------- 1. 创建/更新赛事记录 --------
    console.log('\n📋 步骤 1: 创建赛事记录...');

    // 先检查是否已存在
    const [existingRaces] = await conn.query(
      'SELECT id FROM races WHERE race_code = ?',
      [RACE.race_code]
    );

    let raceId;
    if (existingRaces.length > 0) {
      raceId = existingRaces[0].id;
      // 更新现有记录
      await conn.query(`
        UPDATE races SET
          race_name = ?, race_name_en = ?, category = ?, gender = ?,
          season = ?, country = ?, start_date = ?, end_date = ?,
          total_stages = ?, total_distance = ?, official_url = ?
        WHERE id = ?
      `, [
        RACE.race_name, RACE.race_name_en, RACE.category, RACE.gender,
        RACE.season, RACE.country, RACE.start_date, RACE.end_date,
        RACE.total_stages, RACE.total_distance, RACE.official_url, raceId
      ]);
      console.log(`  ✅ 赛事已更新: ${RACE.race_name_en} (${raceId})`);
    } else {
      raceId = uuidv4();
      await conn.query(`
        INSERT INTO races (
          id, race_name, race_name_en, race_code, category, gender,
          season, country, start_date, end_date, total_stages, total_distance,
          official_url, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
      `, [
        raceId, RACE.race_name, RACE.race_name_en, RACE.race_code,
        RACE.category, RACE.gender, RACE.season, RACE.country,
        RACE.start_date, RACE.end_date, RACE.total_stages,
        RACE.total_distance, RACE.official_url
      ]);
      console.log(`  ✅ 赛事已创建: ${RACE.race_name_en} (${raceId})`);
    }

    // -------- 2. 创建赛段记录 --------
    console.log('\n📋 步骤 2: 创建赛段记录...');

    let stagesCreated = 0;
    let stagesUpdated = 0;

    for (const stage of STAGES) {
      const stageCode = `tour-de-france-2026-s${String(stage.number).padStart(2, '0')}`;
      const stageName = `${stage.start} → ${stage.finish}`;

      const [existingStages] = await conn.query(
        'SELECT id FROM stages WHERE race_id = ? AND stage_number = ?',
        [raceId, stage.number]
      );

      if (existingStages.length > 0) {
        // 更新现有赛段
        await conn.query(`
          UPDATE stages SET
            stage_name = ?, stage_type = ?, date = ?,
            distance_km = ?, start_city = ?, finish_city = ?
          WHERE id = ?
        `, [
          stageName, stage.type, stage.date,
          stage.km, stage.start, stage.finish,
          existingStages[0].id
        ]);
        stagesUpdated++;
      } else {
        const stageId = uuidv4();
        await conn.query(`
          INSERT INTO stages (
            id, race_id, stage_number, stage_name, stage_type,
            date, distance_km, start_city, finish_city, stage_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          stageId, raceId, stage.number, stageName, stage.type,
          stage.date, stage.km, stage.start, stage.finish, stageCode
        ]);
        stagesCreated++;
      }
    }

    console.log(`  ✅ 赛段: 新建 ${stagesCreated} 个, 更新 ${stagesUpdated} 个`);

    // -------- 3. 导入参赛车队 --------
    console.log('\n📋 步骤 3: 导入参赛车队...');

    let teamsCreated = 0;
    let teamsUpdated = 0;
    let teamsSkipped = 0;

    for (const team of TEAMS) {
      // 先按 uci_code 查找（最可靠）
      const [existingByCode] = await conn.query(
        'SELECT id FROM teams WHERE uci_code = ?',
        [team.uci_code]
      );

      if (existingByCode.length > 0) {
        // 更新中文名等信息
        await conn.query(`
          UPDATE teams SET
            team_name_zh = COALESCE(team_name_zh, ?)
          WHERE id = ?
        `, [team.name_zh, existingByCode[0].id]);
        teamsUpdated++;
      } else {
        // 按英文名模糊查找（有些车队名字略有差异）
        const [existingByName] = await conn.query(
          'SELECT id FROM teams WHERE team_name LIKE ?',
          [`%${team.name.split(' - ')[0]}%`]
        );

        if (existingByName.length > 0) {
          await conn.query(`
            UPDATE teams SET
              uci_code = ?,
              team_name = ?,
              team_name_zh = COALESCE(team_name_zh, ?)
            WHERE id = ?
          `, [team.uci_code, team.name, team.name_zh, existingByName[0].id]);
          teamsUpdated++;
        } else {
          // 全新车队
          const teamId = uuidv4();
          await conn.query(`
            INSERT INTO teams (id, team_name, team_name_zh, uci_code, category)
            VALUES (?, ?, ?, ?, 'UCI_WORLD_TEAM')
          `, [teamId, team.name, team.name_zh, team.uci_code]);
          teamsCreated++;
        }
      }
    }

    console.log(`  ✅ 车队: 新建 ${teamsCreated} 支, 更新 ${teamsUpdated} 支`);

    // -------- 汇总 --------
    console.log('\n' + '='.repeat(60));
    console.log('📊 初始化完成汇总：');
    console.log('='.repeat(60));
    console.log(`  🏁 赛事: ${RACE.race_name_en}`);
    console.log(`  📅 日期: ${RACE.start_date} ~ ${RACE.end_date}`);
    console.log(`  🏔️ 赛段: ${STAGES.length} 个 (新建${stagesCreated}, 更新${stagesUpdated})`);
    console.log(`  📏 总距离: ${RACE.total_distance} km`);
    console.log(`  🚴 车队: ${TEAMS.length} 支 (新建${teamsCreated}, 更新${teamsUpdated})`);
    console.log(`  🎽 领骑衫: 黄衫(GC) / 绿衫(冲刺) / 圆点衫(爬坡) / 白衫(青年)`);
    console.log('='.repeat(60));

    // 验证数据完整性
    console.log('\n🔍 数据验证...');
    const [raceCount] = await conn.query(
      'SELECT COUNT(*) as cnt FROM races WHERE race_code = ?',
      [RACE.race_code]
    );
    const [stageCount] = await conn.query(
      'SELECT COUNT(*) as cnt FROM stages WHERE race_id = ?',
      [raceId]
    );
    const [teamCount] = await conn.query(
      'SELECT COUNT(*) as cnt FROM teams WHERE uci_code IN (?)',
      [TEAMS.map(t => t.uci_code)]
    );

    console.log(`  赛事: ${raceCount[0].cnt} ✅`);
    console.log(`  赛段: ${stageCount[0].cnt}/21 ${stageCount[0].cnt === 21 ? '✅' : '⚠️'}`);
    console.log(`  车队: ${teamCount[0].cnt}/23 ${teamCount[0].cnt === 23 ? '✅' : '⚠️'}`);

    console.log('\n🎉 环法 2026 初始化完成！');
    console.log('\n下一步：');
    console.log('  1. 运行 sync-pcs.js 爬取赛段成绩:');
    console.log('     node server/scripts/sync-pcs.js tour-de-france-2026');
    console.log('  2. 或用 Python 脚本下载 PCS 页面 HTML 后手动导入');

  } catch (err) {
    console.error('❌ 初始化失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

// 运行
setupTDF2026();
