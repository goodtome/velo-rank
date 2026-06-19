const mysql = require('mysql2/promise');
const crypto = require('crypto');
const dbConfig = require('./config/database');

const JERSEY_RULES = {
  pink: { table: 'general_classification', rankField: 'rank' },
  yellow: { table: 'general_classification', rankField: 'rank' },
  green: { table: 'points_classification', rankField: 'rank' },
  purple: { table: 'points_classification', rankField: 'rank' },
  blue: { table: 'mountains_classification', rankField: 'rank' },
  polka_dot: { table: 'mountains_classification', rankField: 'rank' },
  white: { table: 'youth_classification', rankField: 'rank' }
};

const JERSEY_NORMALIZE = {
  rosa: 'pink',
  'maglia rosa': 'pink',
  pink: 'pink',
  yellow: 'yellow',
  green: 'green',
  ciclamino: 'purple',
  purple: 'purple',
  blue: 'blue',
  azzurra: 'blue',
  'polka dot': 'polka_dot',
  polka_dot: 'polka_dot',
  white: 'white',
  bianca: 'white'
};

function normalizeJerseyType(value) {
  if (!value) return null;
  const cleaned = String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  return JERSEY_NORMALIZE[cleaned] || cleaned;
}

function normalizeTimeGap(value) {
  if (!value) return null;
  return String(value).trim();
}

async function getStageLabel(conn, stageId) {
  const [rows] = await conn.query(
    `SELECT s.stage_number, s.stage_name, s.stage_name_zh, r.race_name, r.race_name_zh
     FROM stages s
     JOIN races r ON r.id = s.race_id
     WHERE s.id = ?
     LIMIT 1`,
    [stageId]
  );
  if (!rows.length) return { stageNumber: null, label: stageId };
  const row = rows[0];
  return {
    stageNumber: row.stage_number,
    label: `${row.race_name_zh || row.race_name} / S${row.stage_number} ${row.stage_name_zh || row.stage_name || ''}`.trim()
  };
}

async function getExpectedLeader(conn, stageId, jerseyType) {
  const rule = JERSEY_RULES[jerseyType];
  if (!rule) return { reason: 'unmapped_jersey_type', expected: null };

  const [rows] = await conn.query(
    `SELECT rider_id
     FROM ${rule.table}
     WHERE stage_id = ? AND \`${rule.rankField}\` = 1
     ORDER BY id ASC
     LIMIT 1`,
    [stageId]
  );

  if (!rows.length) {
    return { reason: 'missing_expected_row', expected: null };
  }

  const riderId = rows[0].rider_id;
  const [riders] = await conn.query(
    `SELECT rider_name, rider_name_zh, rider_slug, nationality
     FROM riders
     WHERE id = ?
     LIMIT 1`,
    [riderId]
  );

  return {
    reason: null,
    expected: {
      riderId,
      riderName: riders[0]?.rider_name || null,
      riderNameZh: riders[0]?.rider_name_zh || null,
      riderSlug: riders[0]?.rider_slug || null,
      nationality: riders[0]?.nationality || null
    }
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--write');
  const conn = await mysql.createConnection({
    ...dbConfig.development,
    dateStrings: true
  });

  try {
    const [rows] = await conn.query(`
      SELECT j.id, j.stage_id, j.jersey_type, j.rider_id, j.team_id, j.time_gap, j.points,
             s.stage_number, s.stage_name, s.stage_name_zh,
             r.rider_name, r.rider_name_zh,
             t.team_name, t.team_name_zh
      FROM jerseys j
      JOIN stages s ON s.id = j.stage_id
      JOIN riders r ON r.id = j.rider_id
      JOIN teams t ON t.id = j.team_id
      ORDER BY s.stage_number, j.jersey_type, j.id
    `);

    const summary = {
      total: rows.length,
      typeCounts: {},
      mismatches: [],
      orphanIssues: [],
      normalizedTypes: [],
      duplicates: []
    };

    const seen = new Map();

    for (const row of rows) {
      const normalizedType = normalizeJerseyType(row.jersey_type);
      summary.typeCounts[normalizedType || row.jersey_type] = (summary.typeCounts[normalizedType || row.jersey_type] || 0) + 1;

      const key = `${row.stage_id}:${normalizedType}`;
      if (seen.has(key)) {
        summary.duplicates.push({
          stageId: row.stage_id,
          jerseyType: normalizedType,
          firstId: seen.get(key).id,
          duplicateId: row.id
        });
      } else {
        seen.set(key, row);
      }

      if (normalizedType !== row.jersey_type) {
        summary.normalizedTypes.push({
          id: row.id,
          from: row.jersey_type,
          to: normalizedType
        });
      }

      const expected = await getExpectedLeader(conn, row.stage_id, normalizedType);
      if (expected.reason) {
        summary.orphanIssues.push({
          stageId: row.stage_id,
          stageNumber: row.stage_number,
          jerseyType: row.jersey_type,
          reason: expected.reason
        });
        continue;
      }

      if (expected.expected.riderId !== row.rider_id) {
        summary.mismatches.push({
          stageId: row.stage_id,
          stageNumber: row.stage_number,
          jerseyType: normalizedType,
          jerseyRowId: row.id,
          currentRiderId: row.rider_id,
          currentRiderName: row.rider_name_zh || row.rider_name,
          expectedRiderId: expected.expected.riderId,
          expectedRiderName: expected.expected.riderNameZh || expected.expected.riderName
        });
      }
    }

    console.log(JSON.stringify(summary, null, 2));

    if (!dryRun) {
      const normalizedCount = summary.normalizedTypes.length;
      for (const item of summary.normalizedTypes) {
        await conn.query('UPDATE jerseys SET jersey_type = ? WHERE id = ?', [item.to, item.id]);
      }
      console.log(`normalized jersey_type rows: ${normalizedCount}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
