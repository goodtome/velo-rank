/**
 * Comprehensive Data Verification for TdF 2025 Import
 * Database: jersey_db @ localhost:13306
 * Race ID: 24a6d4ef-797b-42cb-b23b-ec18732e3d6d
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  port: 13306,
  user: 'root',
  password: 'mysql123456',
  database: 'jersey_db'
};

const RACE_ID = '24a6d4ef-797b-42cb-b23b-ec18732e3d6d';

const CLASSIFICATION_TABLES = [
  'stage_results',
  'general_classification',
  'points_classification',
  'mountains_classification',
  'youth_classification'
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function divider(title) {
  const line = '='.repeat(72);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}`);
}

function subDivider(title) {
  console.log(`\n--- ${title} ${'-'.repeat(Math.max(0, 64 - title.length))}`);
}

function padRight(str, len) {
  return String(str).padEnd(len);
}

function padLeft(str, len) {
  return String(str).padStart(len);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const anomalies = [];

  console.log('TdF 2025 Data Verification Report');
  console.log(`Race ID : ${RACE_ID}`);
  console.log(`Database: ${DB_CONFIG.database} @ ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  console.log(`Date    : ${new Date().toISOString()}`);

  // ── 0. Load stage metadata ───────────────────────────────────────────────
  const [stages] = await conn.query(
    `SELECT id, stage_number, stage_name, stage_name_zh, date
     FROM stages WHERE race_id = ? ORDER BY stage_number`,
    [RACE_ID]
  );

  if (stages.length === 0) {
    console.error('\nFATAL: No stages found for race_id=' + RACE_ID);
    await conn.end();
    process.exit(1);
  }

  const stageMap = {}; // stage_number -> stage row
  stages.forEach(s => { stageMap[s.stage_number] = s; });

  divider('0. RACE OVERVIEW');
  const [raceRows] = await conn.query(
    'SELECT race_name, race_code, category, season, start_date, end_date, total_stages FROM races WHERE id = ?',
    [RACE_ID]
  );
  if (raceRows.length > 0) {
    const r = raceRows[0];
    console.log(`  Race Name  : ${r.race_name}`);
    console.log(`  Race Code  : ${r.race_code}`);
    console.log(`  Category   : ${r.category}`);
    console.log(`  Season     : ${r.season}`);
    console.log(`  Date Range : ${r.start_date} - ${r.end_date}`);
    console.log(`  Total Stages (declared): ${r.total_stages}`);
    console.log(`  Total Stages (in DB)   : ${stages.length}`);
    if (r.total_stages && r.total_stages !== stages.length) {
      anomalies.push(`Stage count mismatch: races.total_stages=${r.total_stages} but ${stages.length} stage rows found`);
    }
  }

  // ── 1. Record counts per stage per table ─────────────────────────────────
  divider('1. RECORD COUNTS PER STAGE PER TABLE');

  // Header
  console.log(
    padLeft('Stage', 6) + '  ' +
    padLeft('Results', 8) + '  ' +
    padLeft('GC', 6) + '  ' +
    padLeft('Points', 7) + '  ' +
    padLeft('Mtns', 6) + '  ' +
    padLeft('Youth', 6)
  );
  console.log('-'.repeat(50));

  const countsByStage = {}; // stage_number -> { table: count }

  for (const stage of stages) {
    const sn = stage.stage_number;
    const sid = stage.id;
    const counts = {};

    for (const table of CLASSIFICATION_TABLES) {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE stage_id = ?`,
        [sid]
      );
      counts[table] = rows[0].cnt;
    }
    countsByStage[sn] = counts;

    console.log(
      padLeft(sn, 6) + '  ' +
      padLeft(counts.stage_results, 8) + '  ' +
      padLeft(counts.general_classification, 6) + '  ' +
      padLeft(counts.points_classification, 7) + '  ' +
      padLeft(counts.mountains_classification, 6) + '  ' +
      padLeft(counts.youth_classification, 6)
    );
  }

  // Anomaly detection for counts
  subDivider('Count Anomalies');
  let countAnomalyFound = false;

  for (const stage of stages) {
    const sn = stage.stage_number;
    const c = countsByStage[sn];

    // Check for zero counts
    for (const table of CLASSIFICATION_TABLES) {
      if (c[table] === 0) {
        const msg = `Stage ${sn}: ${table} has ZERO records`;
        anomalies.push(msg);
        console.log(`  [WARN] ${msg}`);
        countAnomalyFound = true;
      }
    }

    // Check GC/Mtns/Points/Youth should generally be > 0 and reasonable
    // Stage results should typically be between 100-200 riders
    if (c.stage_results > 0 && c.stage_results < 50) {
      const msg = `Stage ${sn}: stage_results has only ${c.stage_results} riders (expected ~100-200)`;
      anomalies.push(msg);
      console.log(`  [WARN] ${msg}`);
      countAnomalyFound = true;
    }

    // GC should generally be >= stage_results or close
    // Points/mountains/youth can have fewer entries
  }

  // Check for missing stages (1-21)
  for (let i = 1; i <= 21; i++) {
    if (!stageMap[i]) {
      const msg = `Stage ${i} is MISSING from the stages table`;
      anomalies.push(msg);
      console.log(`  [ERROR] ${msg}`);
      countAnomalyFound = true;
    }
  }

  if (!countAnomalyFound) {
    console.log('  No count anomalies detected.');
  }

  // ── 2. Final GC (Stage 21) - Top 5 ──────────────────────────────────────
  divider('2. FINAL GC (STAGE 21) - TOP 5');

  const stage21 = stageMap[21];
  if (stage21) {
    const [gcTop5] = await conn.query(
      `SELECT gc.rank, gc.total_time, gc.time_gap, r.rider_name, r.rider_name_zh, t.team_name, t.team_name_zh, gc.nationality
       FROM general_classification gc
       JOIN riders r ON gc.rider_id = r.id
       JOIN teams t ON gc.team_id = t.id
       WHERE gc.stage_id = ?
       ORDER BY gc.rank ASC
       LIMIT 5`,
      [stage21.id]
    );

    if (gcTop5.length === 0) {
      const msg = 'Stage 21 general_classification is EMPTY';
      anomalies.push(msg);
      console.log(`  [ERROR] ${msg}`);
    } else {
      console.log(
        padLeft('Rank', 5) + '  ' +
        padRight('Rider', 30) + '  ' +
        padRight('Team', 30) + '  ' +
        padLeft('Total Time', 14) + '  ' +
        padLeft('Gap', 10)
      );
      console.log('-'.repeat(100));

      for (const row of gcTop5) {
        const nameDisplay = row.rider_name_zh
          ? `${row.rider_name} (${row.rider_name_zh})`
          : row.rider_name;
        const teamDisplay = row.team_name_zh || row.team_name;
        console.log(
          padLeft(row.rank, 5) + '  ' +
          padRight(nameDisplay.substring(0, 30), 30) + '  ' +
          padRight(teamDisplay.substring(0, 30), 30) + '  ' +
          padLeft(row.total_time || 'N/A', 14) + '  ' +
          padLeft(row.time_gap || '-', 10)
        );
      }
    }

    // Verify rank=1 has a valid total_time
    if (gcTop5.length > 0 && gcTop5[0].rank === 1) {
      if (!gcTop5[0].total_time || gcTop5[0].total_time === '' || gcTop5[0].total_time === 'null') {
        const msg = 'GC winner (rank=1) has no valid total_time on stage 21';
        anomalies.push(msg);
        console.log(`  [WARN] ${msg}`);
      } else {
        console.log(`\n  GC Winner total time: ${gcTop5[0].total_time}`);
      }
    }
  } else {
    const msg = 'Stage 21 not found in stages table';
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
  }

  // ── 3. Yellow Jersey Progression ─────────────────────────────────────────
  divider('3. YELLOW JERSEY PROGRESSION (GC Leader after stages 1, 7, 14, 21)');

  const checkStages = [1, 7, 14, 21];

  console.log(
    padLeft('Stage', 6) + '  ' +
    padRight('GC Leader', 35) + '  ' +
    padRight('Team', 30) + '  ' +
    padLeft('Total Time', 14) + '  ' +
    padLeft('Gap', 10)
  );
  console.log('-'.repeat(105));

  for (const sn of checkStages) {
    const stage = stageMap[sn];
    if (!stage) {
      console.log(padLeft(sn, 6) + '  ** STAGE MISSING **');
      continue;
    }

    const [leader] = await conn.query(
      `SELECT gc.rank, gc.total_time, gc.time_gap, r.rider_name, r.rider_name_zh, t.team_name
       FROM general_classification gc
       JOIN riders r ON gc.rider_id = r.id
       JOIN teams t ON gc.team_id = t.id
       WHERE gc.stage_id = ? AND gc.rank = 1`,
      [stage.id]
    );

    if (leader.length === 0) {
      console.log(padLeft(sn, 6) + '  ** NO GC DATA **');
      const msg = `Stage ${sn}: No GC leader found (rank=1 missing)`;
      anomalies.push(msg);
    } else {
      const l = leader[0];
      const nameDisplay = l.rider_name_zh ? `${l.rider_name} (${l.rider_name_zh})` : l.rider_name;
      console.log(
        padLeft(sn, 6) + '  ' +
        padRight(nameDisplay.substring(0, 35), 35) + '  ' +
        padRight((l.team_name || '').substring(0, 30), 30) + '  ' +
        padLeft(l.total_time || 'N/A', 14) + '  ' +
        padLeft(l.time_gap || '-', 10)
      );
    }
  }

  // ── 4. Referential Integrity (Orphan Check) ─────────────────────────────
  divider('4. REFERENTIAL INTEGRITY - ORPHAN REFERENCES');

  // Get all stage IDs for this race
  const stageIds = stages.map(s => `'${s.id}'`).join(',');

  // 4a. stage_results.rider_id -> riders.id
  subDivider('4a. stage_results.rider_id -> riders.id');
  const [orphanSR_rider] = await conn.query(
    `SELECT DISTINCT sr.rider_id
     FROM stage_results sr
     LEFT JOIN riders r ON sr.rider_id = r.id
     WHERE sr.stage_id IN (${stageIds}) AND r.id IS NULL`
  );
  if (orphanSR_rider.length > 0) {
    const msg = `stage_results: ${orphanSR_rider.length} orphan rider_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
    orphanSR_rider.forEach(r => console.log(`    - ${r.rider_id}`));
  } else {
    console.log('  OK - No orphan rider_id references in stage_results');
  }

  // 4b. stage_results.team_id -> teams.id
  subDivider('4b. stage_results.team_id -> teams.id');
  const [orphanSR_team] = await conn.query(
    `SELECT DISTINCT sr.team_id
     FROM stage_results sr
     LEFT JOIN teams t ON sr.team_id = t.id
     WHERE sr.stage_id IN (${stageIds}) AND t.id IS NULL`
  );
  if (orphanSR_team.length > 0) {
    const msg = `stage_results: ${orphanSR_team.length} orphan team_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
    orphanSR_team.forEach(r => console.log(`    - ${r.team_id}`));
  } else {
    console.log('  OK - No orphan team_id references in stage_results');
  }

  // 4c. general_classification rider/team references
  subDivider('4c. general_classification rider_id -> riders.id');
  const [orphanGC_rider] = await conn.query(
    `SELECT DISTINCT gc.rider_id
     FROM general_classification gc
     LEFT JOIN riders r ON gc.rider_id = r.id
     WHERE gc.stage_id IN (${stageIds}) AND r.id IS NULL`
  );
  if (orphanGC_rider.length > 0) {
    const msg = `general_classification: ${orphanGC_rider.length} orphan rider_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
  } else {
    console.log('  OK - No orphan rider_id references in general_classification');
  }

  subDivider('4d. general_classification team_id -> teams.id');
  const [orphanGC_team] = await conn.query(
    `SELECT DISTINCT gc.team_id
     FROM general_classification gc
     LEFT JOIN teams t ON gc.team_id = t.id
     WHERE gc.stage_id IN (${stageIds}) AND t.id IS NULL`
  );
  if (orphanGC_team.length > 0) {
    const msg = `general_classification: ${orphanGC_team.length} orphan team_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
  } else {
    console.log('  OK - No orphan team_id references in general_classification');
  }

  // 4e. points_classification rider_id
  subDivider('4e. points_classification rider_id -> riders.id');
  const [orphanPC_rider] = await conn.query(
    `SELECT DISTINCT pc.rider_id
     FROM points_classification pc
     LEFT JOIN riders r ON pc.rider_id = r.id
     WHERE pc.stage_id IN (${stageIds}) AND r.id IS NULL`
  );
  if (orphanPC_rider.length > 0) {
    const msg = `points_classification: ${orphanPC_rider.length} orphan rider_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
  } else {
    console.log('  OK - No orphan rider_id references in points_classification');
  }

  // 4f. mountains_classification rider_id
  subDivider('4f. mountains_classification rider_id -> riders.id');
  const [orphanMC_rider] = await conn.query(
    `SELECT DISTINCT mc.rider_id
     FROM mountains_classification mc
     LEFT JOIN riders r ON mc.rider_id = r.id
     WHERE mc.stage_id IN (${stageIds}) AND r.id IS NULL`
  );
  if (orphanMC_rider.length > 0) {
    const msg = `mountains_classification: ${orphanMC_rider.length} orphan rider_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
  } else {
    console.log('  OK - No orphan rider_id references in mountains_classification');
  }

  // 4g. youth_classification rider_id
  subDivider('4g. youth_classification rider_id -> riders.id');
  const [orphanYC_rider] = await conn.query(
    `SELECT DISTINCT yc.rider_id
     FROM youth_classification yc
     LEFT JOIN riders r ON yc.rider_id = r.id
     WHERE yc.stage_id IN (${stageIds}) AND r.id IS NULL`
  );
  if (orphanYC_rider.length > 0) {
    const msg = `youth_classification: ${orphanYC_rider.length} orphan rider_id references`;
    anomalies.push(msg);
    console.log(`  [ERROR] ${msg}`);
  } else {
    console.log('  OK - No orphan rider_id references in youth_classification');
  }

  // ── 5. Unique Riders and Teams ───────────────────────────────────────────
  divider('5. UNIQUE RIDERS AND TEAMS ACROSS ALL STAGES');

  // Unique riders in stage_results
  const [uniqueRidersSR] = await conn.query(
    `SELECT COUNT(DISTINCT rider_id) AS cnt FROM stage_results WHERE stage_id IN (${stageIds})`
  );
  console.log(`  Unique riders in stage_results          : ${uniqueRidersSR[0].cnt}`);

  // Unique riders in GC
  const [uniqueRidersGC] = await conn.query(
    `SELECT COUNT(DISTINCT rider_id) AS cnt FROM general_classification WHERE stage_id IN (${stageIds})`
  );
  console.log(`  Unique riders in general_classification  : ${uniqueRidersGC[0].cnt}`);

  // Unique riders in points
  const [uniqueRidersPC] = await conn.query(
    `SELECT COUNT(DISTINCT rider_id) AS cnt FROM points_classification WHERE stage_id IN (${stageIds})`
  );
  console.log(`  Unique riders in points_classification   : ${uniqueRidersPC[0].cnt}`);

  // Unique riders in mountains
  const [uniqueRidersMC] = await conn.query(
    `SELECT COUNT(DISTINCT rider_id) AS cnt FROM mountains_classification WHERE stage_id IN (${stageIds})`
  );
  console.log(`  Unique riders in mountains_classification: ${uniqueRidersMC[0].cnt}`);

  // Unique riders in youth
  const [uniqueRidersYC] = await conn.query(
    `SELECT COUNT(DISTINCT rider_id) AS cnt FROM youth_classification WHERE stage_id IN (${stageIds})`
  );
  console.log(`  Unique riders in youth_classification    : ${uniqueRidersYC[0].cnt}`);

  // Unique teams in stage_results
  const [uniqueTeamsSR] = await conn.query(
    `SELECT COUNT(DISTINCT team_id) AS cnt FROM stage_results WHERE stage_id IN (${stageIds})`
  );
  console.log(`\n  Unique teams in stage_results            : ${uniqueTeamsSR[0].cnt}`);

  // Unique teams in GC
  const [uniqueTeamsGC] = await conn.query(
    `SELECT COUNT(DISTINCT team_id) AS cnt FROM general_classification WHERE stage_id IN (${stageIds})`
  );
  console.log(`  Unique teams in general_classification   : ${uniqueTeamsGC[0].cnt}`);

  // Cross-check: all rider_ids in classification tables should exist in stage_results too
  subDivider('Cross-check: riders in GC but not in any stage_results');
  const [ridersInGCNotSR] = await conn.query(
    `SELECT DISTINCT gc.rider_id, r.rider_name
     FROM general_classification gc
     JOIN riders r ON gc.rider_id = r.id
     WHERE gc.stage_id IN (${stageIds})
       AND gc.rider_id NOT IN (
         SELECT DISTINCT rider_id FROM stage_results WHERE stage_id IN (${stageIds})
       )`
  );
  if (ridersInGCNotSR.length > 0) {
    console.log(`  [INFO] ${ridersInGCNotSR.length} riders appear in GC but not in stage_results:`);
    ridersInGCNotSR.slice(0, 10).forEach(r => console.log(`    - ${r.rider_name} (${r.rider_id})`));
    if (ridersInGCNotSR.length > 10) {
      console.log(`    ... and ${ridersInGCNotSR.length - 10} more`);
    }
  } else {
    console.log('  OK - All GC riders also appear in stage_results');
  }

  // ── 6. Anomaly Summary ──────────────────────────────────────────────────
  divider('6. ANOMALY SUMMARY');

  // Additional checks

  // Check for duplicate ranks within a stage
  subDivider('Duplicate rank check');
  let dupAnomalyFound = false;
  for (const stage of stages) {
    const sn = stage.stage_number;
    const sid = stage.id;

    for (const table of ['stage_results', 'general_classification']) {
      const rankCol = table === 'stage_results' ? 'rank_pos' : 'rank';
      const [dups] = await conn.query(
        `SELECT \`${rankCol}\` AS r, COUNT(*) AS cnt
         FROM \`${table}\` WHERE stage_id = ?
         GROUP BY \`${rankCol}\` HAVING cnt > 1
         ORDER BY r LIMIT 5`,
        [sid]
      );
      if (dups.length > 0) {
        const msg = `Stage ${sn} ${table}: ${dups.length} duplicate rank values (e.g., rank ${dups[0].r} appears ${dups[0].cnt} times)`;
        anomalies.push(msg);
        console.log(`  [WARN] ${msg}`);
        dupAnomalyFound = true;
      }
    }
  }
  if (!dupAnomalyFound) {
    console.log('  OK - No duplicate ranks found');
  }

  // Check for NULL/empty time_gap on rank=1 in stage_results
  subDivider('Stage winner time check');
  for (const stage of stages) {
    const sn = stage.stage_number;
    const sid = stage.id;
    const [winners] = await conn.query(
      `SELECT time_gap FROM stage_results WHERE stage_id = ? AND rank_pos = 1`,
      [sid]
    );
    if (winners.length > 0) {
      const tg = winners[0].time_gap;
      // Winner should have an absolute time, not a gap like "+ ..."
      if (tg && tg.startsWith('+')) {
        const msg = `Stage ${sn}: winner has time_gap="${tg}" (should be absolute time, not a gap)`;
        anomalies.push(msg);
        console.log(`  [WARN] ${msg}`);
      }
    } else if (countsByStage[sn].stage_results > 0) {
      // There are results but no rank=1
      const msg = `Stage ${sn}: stage_results has data but no rank_pos=1`;
      anomalies.push(msg);
      console.log(`  [WARN] ${msg}`);
    }
  }

  // Check GC rank=1 time_gap consistency (leader should have time_gap = null, empty, or '0:00')
  subDivider('GC leader time_gap consistency');
  for (const stage of stages) {
    const sn = stage.stage_number;
    const sid = stage.id;
    const [leaders] = await conn.query(
      `SELECT time_gap, total_time FROM general_classification WHERE stage_id = ? AND \`rank\` = 1`,
      [sid]
    );
    if (leaders.length > 0) {
      const l = leaders[0];
      // For GC leader, time_gap should be null, empty, or '0:00' or similar
      if (l.time_gap && l.time_gap !== '' && l.time_gap !== '0:00' && l.time_gap !== '00:00' && !l.time_gap.startsWith('0:0')) {
        const msg = `Stage ${sn}: GC leader has unexpected time_gap="${l.time_gap}"`;
        anomalies.push(msg);
        console.log(`  [INFO] ${msg}`);
      }
    }
  }

  // Final anomaly count
  subDivider('Total Anomalies');
  if (anomalies.length === 0) {
    console.log('  No anomalies detected. Data looks clean.');
  } else {
    console.log(`  Total anomalies found: ${anomalies.length}\n`);
    anomalies.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a}`);
    });
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  divider('VERIFICATION COMPLETE');
  console.log(`  Total anomalies: ${anomalies.length}`);
  console.log(`  Status: ${anomalies.length === 0 ? 'PASS' : 'REVIEW NEEDED'}\n`);

  await conn.end();
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
