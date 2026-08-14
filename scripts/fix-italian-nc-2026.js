/**
 * 意大利公路锦标赛 2026 数据修正 + 补充
 * 
 * 修正内容:
 * 1. Men's RR time_gap (null → actual gaps from PCS)
 * 2. Men's ITT time_gap (null → actual gaps)
 * 3. nationality (UNK → ITA)
 * 4. 添加女子 RR 赛段 + 成绩
 * 5. 添加女子 ITT 赛段 (如果有)
 * 
 * 数据来源: PCS 2026-07-04
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const DB_CONFIG = {
  host: '127.0.0.1', port: 13306, user: 'root',
  password: 'mysql123456', database: 'jersey_db', charset: 'utf8mb4'
};

// ============================================================
// PCS 精确数据
// ============================================================

// Men's RR - 71 finishers (from PCS nc-italy/2026/result)
// Format: [rank, time_gap, rider_slug, team_slug]
const RR_TIME_GAPS = {
  1: '4:52:40',
  2: '+0:00', 3: '+0:00', 4: '+0:00', 5: '+0:00',
  6: '+0:00', 7: '+0:00', 8: '+0:00', 9: '+0:00', 10: '+0:00',
  11: '+0:00', 12: '+0:00', 13: '+0:00', 14: '+0:00', 15: '+0:00',
  16: '+0:00', 17: '+0:00', 18: '+0:00', 19: '+0:00', 20: '+0:00',
  21: '+0:00', 22: '+0:00', 23: '+0:00', 24: '+0:00', 25: '+0:00',
  26: '+0:00', 27: '+0:00', 28: '+0:00', 29: '+0:00', 30: '+0:00',
  31: '+0:00', 32: '+0:00', 33: '+0:00', 34: '+0:00', 35: '+0:00',
  36: '+0:00', 37: '+0:00', 38: '+0:00',
  39: '+0:06', 40: '+0:06', 41: '+0:06', 42: '+0:06',
  43: '+0:06', 44: '+0:06', 45: '+0:06', 46: '+0:06', 47: '+0:06',
  48: '+0:06', 49: '+0:08',
  50: '+0:11',
  51: '+0:19',
  52: '+0:28',
  53: '+0:32',
  54: '+0:44',
  55: '+0:46',
  56: '+0:52', 57: '+0:52', 58: '+0:52', 59: '+0:52', 60: '+0:52',
  61: '+0:52', 62: '+0:52',
  63: '+1:00',
  64: '+1:12',
  65: '+1:23',
  66: '+1:34',
  67: '+1:36',
  68: '+1:40',
  69: '+1:46',
  70: '+2:05',
  71: '+2:23'
};

// Men's ITT - 17 finishers (from PCS nc-italy-itt/2026/result)
// Time format from PCS: "47.39" = 47:39, gaps in format "2.06" = 2:06
const ITT_TIMES = {
  1:  { time: '47:39', gap: '+0:00', rider: 'Filippo Ganna', team: 'Netcompany INEOS' },
  2:  { time: null,   gap: '+2:06', rider: 'Luca Giaimi', team: 'UAE Team Emirates - XRG' },
  3:  { time: null,   gap: '+2:22', rider: 'Mattia Cattaneo', team: 'Red Bull - BORA - hansgrohe' },
  4:  { time: null,   gap: '+2:40', rider: 'Filippo Baroncini', team: 'UAE Team Emirates - XRG' },
  5:  { time: null,   gap: '+2:57', rider: 'Matteo Sobrero', team: 'Lidl - Trek' },
  6:  { time: null,   gap: '+3:22', rider: 'Lorenzo Mark Finn', team: 'Red Bull - BORA - hansgrohe Rookies' },
  7:  { time: null,   gap: '+3:27', rider: 'Mattia Gaffuri', team: 'Team Picnic PostNL' },
  8:  { time: null,   gap: '+4:15', rider: 'Jacopo Mosca', team: 'Lidl - Trek' },
  9:  { time: null,   gap: '+4:34', rider: 'Alessandro Romele', team: 'XDS Astana Team' },
  10: { time: null,   gap: '+5:03', rider: 'Mirco Maestri', team: 'Team Polti VisitMalta' },
  11: { time: null,   gap: '+5:31', rider: 'Matteo Ambrosini', team: 'MBH Bank CSB Telecom Fort' },
  12: { time: null,   gap: '+5:40', rider: 'Federico Iacomoni', team: 'Team UKYO' },
  13: { time: null,   gap: '+6:00', rider: 'Mattia Bais', team: 'Team Polti VisitMalta' },
  14: { time: null,   gap: '+6:18', rider: 'Dario Igor Belletta', team: 'Team Polti VisitMalta' },
  15: { time: null,   gap: '+6:52', rider: 'Lorenzo Milesi', team: 'Movistar Team' },
  16: { time: null,   gap: '+6:54', rider: 'Lorenzo Nespoli', team: 'MBH Bank CSB Telecom Fort' },
  17: { time: null,   gap: '+7:10', rider: 'Manuel Dovesi', team: 'GoodShop Team Yoyogurt' }
};

// Women's RR top 10 (PCS nc-italy-we/2026/result)
const WOMEN_RR = [
  { rank: 1,  rider: 'Elisa Balsamo', team: 'Lidl - Trek', time: '2:49:10', gap: '+0:00' },
  { rank: 2,  rider: 'Elisa Longo Borghini', team: 'UAE Team ADQ', time: null, gap: '+0:00' },
  { rank: 3,  rider: 'Chiara Consonni', team: 'UAE Team ADQ', time: null, gap: '+0:00' },
  { rank: 4,  rider: 'Eleonora Ciabocco', team: 'UAE Development Team', time: null, gap: '+0:00' },
  { rank: 5,  rider: 'Silvia Persico', team: 'UAE Team ADQ', time: null, gap: '+0:00' },
  { rank: 6,  rider: 'Elena Pirrone', team: 'AG Insurance - Soudal Team', time: null, gap: '+0:00' },
  { rank: 7,  rider: 'Rachele Barbieri', team: 'AG Insurance - Soudal Team', time: null, gap: '+0:00' },
  { rank: 8,  rider: 'Francesca Barale', team: 'AG Insurance - Soudal Team', time: null, gap: '+0:00' },
  { rank: 9,  rider: 'Sofia Bertizzolo', team: 'UAE Team ADQ', time: null, gap: '+0:00' },
  { rank: 10, rider: 'Gaia Masetti', team: 'AG Insurance - Soudal Team', time: null, gap: '+0:00' }
];

// ============================================================
// 数据库操作
// ============================================================

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('=== Italian Nationals 2026 Data Fix ===\n');

  // 1. Fix nationality for ALL stage_results of Italian Nationals
  console.log('1. Fixing nationality (UNK → ITA)...');
  const [stages] = await conn.query(
    "SELECT s.id, s.stage_number, s.stage_name_zh FROM stages s JOIN races r ON s.race_id=r.id WHERE r.race_code='italian-nationals-2026' ORDER BY s.stage_number"
  );
  
  for (const s of stages) {
    const [result] = await conn.query(
      "UPDATE stage_results SET nationality = 'ITA' WHERE stage_id = ? AND nationality = 'UNK'",
      [s.id]
    );
    console.log(`  S${s.stage_number}: ${result.affectedRows} nationality fixed`);
  }

  // 2. Fix Men's RR time_gap
  console.log('\n2. Fixing Men\'s RR time_gap...');
  const rrStage = stages.find(s => s.stage_number === 2);
  if (rrStage) {
    const [rows] = await conn.query(
      'SELECT id, rank_pos, time_gap FROM stage_results WHERE stage_id = ? ORDER BY rank_pos',
      [rrStage.id]
    );
    
    let fixed = 0;
    for (const row of rows) {
      const gap = RR_TIME_GAPS[row.rank_pos];
      if (gap && (row.time_gap !== gap)) {
        // rank 1 stores actual time as time_gap (PCS convention)
        await conn.query(
          'UPDATE stage_results SET time_gap = ?, is_same_time = ? WHERE id = ?',
          [gap, gap === '+0:00' ? 1 : 0, row.id]
        );
        fixed++;
      }
    }
    console.log(`  Fixed ${fixed} time_gap values`);
  }

  // 3. Fix Men's ITT time_gap
  console.log('\n3. Fixing Men\'s ITT time_gap...');
  const ittStage = stages.find(s => s.stage_number === 1);
  if (ittStage) {
    const [rows] = await conn.query(
      'SELECT id, rank_pos, time_gap, rider_id FROM stage_results WHERE stage_id = ? ORDER BY rank_pos',
      [ittStage.id]
    );
    
    let fixed = 0;
    for (const row of rows) {
      const tt = ITT_TIMES[row.rank_pos];
      if (tt) {
        const newGap = tt.gap;
        if (row.time_gap !== newGap) {
          await conn.query(
            'UPDATE stage_results SET time_gap = ? WHERE id = ?',
            [newGap, row.id]
          );
          fixed++;
        }
      }
    }
    console.log(`  Fixed ${fixed} time_gap values`);
  }

  // 4. Add Women's Road Race (S3)
  console.log('\n4. Adding Women\'s events...');
  
  const [raceRow] = await conn.query("SELECT id FROM races WHERE race_code='italian-nationals-2026'");
  const raceId = raceRow[0].id;
  
  // Check if Women's RR already exists
  const [existingWRR] = await conn.query(
    'SELECT id FROM stages WHERE race_id = ? AND stage_number = 3', [raceId]
  );
  
  let wrrStageId;
  if (existingWRR.length === 0) {
    wrrStageId = uuidv4();
    await conn.query(
      'INSERT INTO stages (id, race_id, stage_number, stage_name, stage_name_zh, stage_type, date, distance_km, start_city, finish_city, stage_code) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [wrrStageId, raceId, 3, 'Pordenone → Pordenone', '女子公路赛', 'ROAD', '2026-06-28', 120.0, 'Pordenone', 'Pordenone', 'italian-nationals-2026-s03']
    );
    console.log('  Created S3: Women\'s Road Race');
  } else {
    wrrStageId = existingWRR[0].id;
    console.log('  S3 already exists');
  }
  
  // Import Women's RR results
  const [existingWrrResults] = await conn.query(
    'SELECT COUNT(*) as cnt FROM stage_results WHERE stage_id = ?', [wrrStageId]
  );
  
  if (existingWrrResults[0].cnt === 0) {
    let imported = 0;
    for (const r of WOMEN_RR) {
      // Find or create rider
      let riderId;
      const [riderRows] = await conn.query(
        'SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [r.rider]
      );
      if (riderRows.length) {
        riderId = riderRows[0].id;
      } else {
        riderId = uuidv4();
        await conn.query(
          'INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)',
          [riderId, r.rider, 'ITA']
        );
        console.log(`    + new rider: ${r.rider}`);
      }

      // Find team
      let teamId;
      const [teamRows] = await conn.query(
        'SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1', [`%${r.team.split(' - ')[0]}%`]
      );
      if (teamRows.length) teamId = teamRows[0].id;

      const isSameTime = r.gap === '+0:00' ? 1 : 0;
      await conn.query(
        'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), wrrStageId, r.rank, riderId, teamId, 'ITA', r.gap, isSameTime]
      );
      imported++;
    }
    console.log(`  Imported ${imported} women\'s RR results`);
  } else {
    console.log(`  Women\'s RR already has ${existingWrrResults[0].cnt} results`);
  }

  // 5. Update race total_stages
  await conn.query(
    'UPDATE races SET total_stages = 3, end_date = ? WHERE id = ?',
    ['2026-06-28', raceId]
  );

  // Verification
  console.log('\n=== Verification ===');
  const [finalStages] = await conn.query(
    'SELECT s.stage_number, s.stage_name_zh, s.date, COUNT(sr.id) as cnt FROM stages s LEFT JOIN stage_results sr ON sr.stage_id=s.id WHERE s.race_id=? GROUP BY s.id ORDER BY s.stage_number',
    [raceId]
  );
  finalStages.forEach(s => {
    console.log(`  S${s.stage_number} ${s.stage_name_zh} | ${String(s.date).substring(0,10)} | ${s.cnt} results`);
  });

  await conn.end();
  console.log('\n✅ Italian Nationals 2026 updated!');
}

main().catch(e => { console.error(e); process.exit(1); });
