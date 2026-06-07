function key(stageId, riderId) {
  return `${stageId}:${riderId}`;
}

function normalizeJerseyType(type) {
  return String(type || '').toLowerCase();
}

function rowsToMap(rows, valueField) {
  const map = new Map();
  for (const row of rows) {
    map.set(key(row.stage_id, row.rider_id), row[valueField]);
  }
  return map;
}

async function queryClassificationMaps(pool, stageIds) {
  if (!stageIds.length) {
    return {
      gc: new Map(),
      points: new Map(),
      mountains: new Map(),
      youth: new Map()
    };
  }

  const [gcRows, pointRows, mountainRows, youthRows] = await Promise.all([
    pool.query(
      'SELECT stage_id, rider_id, time_gap FROM general_classification WHERE stage_id IN (?)',
      [stageIds]
    ),
    pool.query(
      'SELECT stage_id, rider_id, points FROM points_classification WHERE stage_id IN (?)',
      [stageIds]
    ),
    pool.query(
      'SELECT stage_id, rider_id, points FROM mountains_classification WHERE stage_id IN (?)',
      [stageIds]
    ),
    pool.query(
      'SELECT stage_id, rider_id, time_gap FROM youth_classification WHERE stage_id IN (?)',
      [stageIds]
    )
  ]);

  return {
    gc: rowsToMap(gcRows[0], 'time_gap'),
    points: rowsToMap(pointRows[0], 'points'),
    mountains: rowsToMap(mountainRows[0], 'points'),
    youth: rowsToMap(youthRows[0], 'time_gap')
  };
}

function attachJerseyValue(row, maps) {
  const jerseyType = normalizeJerseyType(row.jersey_type);
  const rowKey = key(row.stage_id, row.rider_id);
  let time_gap = null;
  let points = null;

  if (jerseyType === 'pink' || jerseyType === 'yellow') {
    time_gap = maps.gc.get(rowKey) ?? null;
  } else if (jerseyType === 'purple' || jerseyType === 'green') {
    points = maps.points.get(rowKey) ?? null;
  } else if (jerseyType === 'blue' || jerseyType === 'polka_dot') {
    points = maps.mountains.get(rowKey) ?? null;
  } else if (jerseyType === 'white') {
    time_gap = maps.youth.get(rowKey) ?? null;
  }

  return {
    stage_id: row.stage_id,
    jersey_type: row.jersey_type,
    rider_name: row.rider_name,
    rider_name_zh: row.rider_name_zh,
    nationality: row.nationality,
    photo_url: row.photo_url,
    team_name: row.team_name,
    team_name_zh: row.team_name_zh,
    uci_code: row.uci_code,
    time_gap,
    points
  };
}

async function getJerseysForStages(pool, stageIds) {
  const uniqueStageIds = [...new Set(stageIds.filter(Boolean))];
  if (!uniqueStageIds.length) {
    return new Map();
  }

  const [jerseyRows] = await pool.query(`
    SELECT j.stage_id, j.jersey_type, j.rider_id, j.team_id,
           r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
           t.team_name, t.team_name_zh, t.uci_code
    FROM jerseys j
    JOIN riders r ON j.rider_id = r.id
    JOIN teams t ON j.team_id = t.id
    WHERE j.stage_id IN (?)
    ORDER BY j.stage_id, j.jersey_type
  `, [uniqueStageIds]);

  const maps = await queryClassificationMaps(pool, uniqueStageIds);
  const grouped = new Map(uniqueStageIds.map(stageId => [stageId, []]));

  for (const row of jerseyRows) {
    grouped.get(row.stage_id)?.push(attachJerseyValue(row, maps));
  }

  return grouped;
}

async function getJerseysForStage(pool, stageId) {
  const grouped = await getJerseysForStages(pool, [stageId]);
  return grouped.get(stageId) || [];
}

module.exports = {
  getJerseysForStage,
  getJerseysForStages
};
