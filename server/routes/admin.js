const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db-pool');
const { adminMiddleware } = require('../middleware/auth');
const { routeLog } = require('../middleware/requestLogger');
const log = routeLog('admin');

function formatPercentage(translated, total) {
  const totalNum = Number(total) || 0;
  if (totalNum <= 0) {
    return '0.00';
  }

  const translatedNum = Number(translated) || 0;
  return ((translatedNum / totalNum) * 100).toFixed(2);
}

function parseAdminPaging(query) {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawOffset = Number.parseInt(query.offset, 10);

  return {
    limit: Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 50 : rawLimit)),
    offset: Math.max(0, Number.isNaN(rawOffset) ? 0 : rawOffset)
  };
}

function sqlLiteral(value) {
  if (value === undefined || value === null || value === '') {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function parsePositiveInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }

  return null;
}

function normalizeImportStagePayload(stageInfo, results) {
  if (!stageInfo || !results || !Array.isArray(results)) {
    return { error: 'missing required fields: stage_info and results' };
  }

  const raceCode = typeof stageInfo.race_code === 'string' ? stageInfo.race_code.trim() : stageInfo.race_code;
  const stageNum = parsePositiveInteger(stageInfo.stage_number);

  if (!raceCode || !stageNum) {
    return { error: 'stage_info must include race_code and a positive integer stage_number' };
  }

  if (results.length === 0) {
    return { error: 'results must contain at least one row' };
  }

  const normalizedResults = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i] || {};
    const rank = parsePositiveInteger(result.rank);
    const riderName = typeof result.rider_name === 'string' ? result.rider_name.trim() : '';
    const teamName = typeof result.team_name === 'string' ? result.team_name.trim() : '';

    if (!rank || !riderName || !teamName) {
      return { error: `invalid result row at index ${i}: rank, rider_name and team_name are required` };
    }

    normalizedResults.push({
      ...result,
      rank,
      rider_name: riderName,
      team_name: teamName
    });
  }

  return {
    raceCode,
    stageNum,
    results: normalizedResults
  };
}

function buildImportValidationSummary(stageInfo, results, jerseys = []) {
  const rows = Array.isArray(results) ? results : [];
  const jerseyRows = Array.isArray(jerseys) ? jerseys : [];
  const ranks = new Map();
  const riders = new Set();
  const teams = new Set();
  const errors = [];
  let missingTimeGap = 0;

  if (!stageInfo || typeof stageInfo !== 'object') {
    errors.push('stage_info is required');
  } else {
    if (!normalizeRequiredStringField(stageInfo, 'race_code')) errors.push('stage_info.race_code is required');
    if (!parsePositiveInteger(stageInfo.stage_number)) errors.push('stage_info.stage_number must be a positive integer');
  }

  if (!Array.isArray(results)) {
    errors.push('results must be an array');
  } else if (rows.length === 0) {
    errors.push('results must contain at least one row');
  }

  rows.forEach((row, index) => {
    const rank = parsePositiveInteger(row && row.rank);
    const riderName = row && typeof row.rider_name === 'string' ? row.rider_name.trim() : '';
    const teamName = row && typeof row.team_name === 'string' ? row.team_name.trim() : '';

    if (!rank) errors.push(`results[${index}].rank must be a positive integer`);
    if (!riderName) errors.push(`results[${index}].rider_name is required`);
    if (!teamName) errors.push(`results[${index}].team_name is required`);

    if (rank) {
      if (!ranks.has(rank)) ranks.set(rank, []);
      ranks.get(rank).push(index);
    }
    if (riderName) riders.add(riderName);
    if (teamName) teams.add(teamName);
    if (!row || row.time_gap === undefined || row.time_gap === null || row.time_gap === '') missingTimeGap += 1;
  });

  const duplicateRanks = [...ranks.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([rank, indexes]) => ({ rank, rows: indexes }));

  duplicateRanks.forEach(item => {
    errors.push(`duplicate rank ${item.rank} at result rows ${item.rows.join(', ')}`);
  });

  jerseyRows.forEach((row, index) => {
    if (!row || !row.jersey_type) errors.push(`jerseys[${index}].jersey_type is required`);
    if (!row || !row.rider_name) errors.push(`jerseys[${index}].rider_name is required`);
    if (!row || !row.team_name) errors.push(`jerseys[${index}].team_name is required`);
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings: missingTimeGap > 0 ? [`${missingTimeGap} result row(s) have no time_gap and will import as NULL`] : [],
    summary: {
      race_code: stageInfo && stageInfo.race_code,
      stage_number: stageInfo && stageInfo.stage_number,
      results_count: rows.length,
      jerseys_count: jerseyRows.length,
      unique_riders: riders.size,
      unique_teams: teams.size,
      duplicate_rank_count: duplicateRanks.length,
      missing_time_gap_count: missingTimeGap
    }
  };
}

function validationErrorResponse(res, validation, message = 'Import payload validation failed') {
  return res.status(400).json({
    code: 400,
    message,
    data: {
      validation
    }
  });
}

function chineseNameUpdateResponse(entityType, id, field, value) {
  return {
    code: 200,
    message: `${entityType} Chinese name updated`,
    data: {
      entity_type: entityType,
      id,
      field,
      value,
      summary: {
        updated: 1,
        empty_after_trim: false
      }
    }
  };
}

function normalizeRequiredStringField(body, fieldName) {
  if (!body || typeof body[fieldName] !== 'string') {
    return null;
  }

  const value = body[fieldName].trim();
  return value === '' ? null : value;
}

router.use(adminMiddleware);

// POST /api/v1/admin/generate-sql - 生成SQL导入脚本
router.post('/generate-sql', async (req, res) => {
  try {
    const { stage_info, results, jerseys } = req.body;
    const validation = buildImportValidationSummary(stage_info, results, jerseys);
    if (!validation.ok) {
      return validationErrorResponse(res, validation);
    }
    
    if (!stage_info || !results || !Array.isArray(results)) {
      return res.status(400).json({ 
        code: 400, 
        message: '缺少必需字段: stage_info 或 results' 
      });
    }
    
    const { race_code, stage_number, stage_name, date, distance_km, stage_type } = stage_info;
    if (!race_code || !stage_number) {
      return res.status(400).json({ 
        code: 400, 
        message: 'stage_info 必须包含 race_code 和 stage_number' 
      });
    }
    
    // SQL生成逻辑（同generate-import-script.js）
    const lines = [];
    const raceCode = typeof race_code === 'string' ? race_code.trim() : race_code;
    const stageNum = parsePositiveInteger(stage_number);
    if (!stageNum) {
      return res.status(400).json({
        code: 400,
        message: 'stage_number 必须是正整数'
      });
    }

    const normalizedPayload = normalizeImportStagePayload(stage_info, results);
    if (normalizedPayload.error) {
      return res.status(400).json({
        code: 400,
        message: normalizedPayload.error
      });
    }
    const sqlResults = normalizedPayload.results;

    const stageName = sqlLiteral(stage_name || `Stage ${stageNum}`);
    const stageDate = sqlLiteral(date || '2026-01-01');
    const distanceKm = Number.isFinite(Number(distance_km)) ? Number(distance_km) : 0;
    const stageType = sqlLiteral(stage_type || 'Unknown');
    const raceCodeSql = sqlLiteral(raceCode);
    const stageCode = sqlLiteral(`${raceCode}-s${stageNum}`);
    
    // 头部注释
    lines.push(`-- ============================================
-- 🚴 领骑 / Jersey - MySQL导入脚本
-- ============================================
-- 生成时间: ${new Date().toISOString()}
-- 赛事: ${raceCode}
-- 赛段: Stage ${stageNum} - ${stage_name || 'N/A'}
-- 日期: ${date || 'N/A'}
-- 距离: ${distance_km || 'N/A'}km
-- 类型: ${stage_type || 'N/A'}
-- 
-- 成绩数量: ${results.length}
-- 领骑衫数量: ${jerseys?.length || 0}
-- ============================================

USE jersey_db;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 处理赛事信息
-- ============================================
INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season)
SELECT 
  UUID() AS id,
  'Giro d''Italia' AS race_name,
  'Giro d''Italia' AS race_name_en,
  ${raceCodeSql} AS race_code,
  'GRAND_TOUR' AS category,
  'MEN' AS gender,
  2026 AS season
WHERE NOT EXISTS (SELECT 1 FROM races WHERE race_code = ${raceCodeSql});

-- ============================================
-- 2. 处理赛段信息
-- ============================================
INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
SELECT 
  UUID() AS id,
  r.id AS race_id,
  ${stageNum} AS stage_number,
  ${stageName} AS stage_name,
  ${stageDate} AS date,
  ${distanceKm} AS distance_km,
  ${stageType} AS stage_type,
  ${stageCode} AS stage_code
FROM races r
WHERE r.race_code = ${raceCodeSql}
  AND NOT EXISTS (
    SELECT 1 FROM stages s 
    WHERE s.race_id = r.id AND s.stage_number = ${stageNum}
  );

-- ============================================
-- 3. 批量导入车手和车队
-- ============================================
`);
    
    // 车手数据
    const uniqueRiders = [...new Set(sqlResults.map(r => r.rider_name))];
    lines.push(`-- 车手数据 (${uniqueRiders.length} 条)`);
    uniqueRiders.forEach(name => {
      const safeName = sqlLiteral(name);
      lines.push(`INSERT INTO riders (id, rider_name, nationality)
SELECT UUID(), ${safeName}, 'UNK'
WHERE NOT EXISTS (SELECT 1 FROM riders WHERE rider_name = ${safeName});`);
    });
    
    // 车队数据
    lines.push(`
-- 车队数据`);
    const uniqueTeams = [...new Set(sqlResults.map(r => r.team_name))];
    uniqueTeams.forEach(name => {
      const safeName = sqlLiteral(name);
      lines.push(`INSERT INTO teams (id, team_name)
SELECT UUID(), ${safeName}
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE team_name = ${safeName});`);
    });

    const resultRowsSql = sqlResults.map(r => {
      const rank = r.rank;
      return `  SELECT ${rank} AS \`rank\`, ${sqlLiteral(r.rider_name)} AS rider_name, ${sqlLiteral(r.team_name)} AS team_name, ${sqlLiteral(r.time_gap)} AS time_gap`;
    }).join('\n  UNION ALL\n');
    
    // 成绩数据
    lines.push(`
-- ============================================
-- 4. 导入赛段成绩 (${results.length} 条)
-- ============================================
INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, time_gap, nationality)
SELECT 
  UUID() AS id,
  s.id AS stage_id,
  tr.\`rank\`,
  r.id AS rider_id,
  t.id AS team_id,
  tr.time_gap,
  'UNK' AS nationality
FROM (
${resultRowsSql}
) tr
JOIN stages s ON s.race_id = (SELECT id FROM races WHERE race_code = ${raceCodeSql}) AND s.stage_number = ${stageNum}
JOIN riders r ON r.rider_name = tr.rider_name
JOIN teams t ON t.team_name = tr.team_name
ON DUPLICATE KEY UPDATE
  rider_id = VALUES(rider_id),
  team_id = VALUES(team_id),
  time_gap = VALUES(time_gap);`);
    
    // 领骑衫数据
    if (jerseys && jerseys.length > 0) {
      lines.push(`
-- ============================================
-- 5. 导入领骑衫持有者 (${jerseys.length} 件)
-- ============================================`);
      
      jerseys.forEach(j => {
        lines.push(`
INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
SELECT 
  UUID(),
  s.id,
  ${sqlLiteral(j.jersey_type)},
  r.id,
  t.id
FROM stages s
JOIN riders r ON r.rider_name = ${sqlLiteral(j.rider_name)}
JOIN teams t ON t.team_name = ${sqlLiteral(j.team_name)}
WHERE s.race_id = (SELECT id FROM races WHERE race_code = ${raceCodeSql})
  AND s.stage_number = ${stageNum}
ON DUPLICATE KEY UPDATE rider_id = VALUES(rider_id), team_id = VALUES(team_id);`);
      });
    }
    
    // 收尾
    lines.push(`
-- ============================================
-- 6. 完成
-- ============================================
SET FOREIGN_KEY_CHECKS = 1;

SELECT 
  CONCAT('✅ Stage ${stageNum} 导入完成: ', (
    SELECT COUNT(*)
    FROM stage_results sr
    JOIN stages s ON sr.stage_id = s.id
    JOIN races r ON s.race_id = r.id
    WHERE r.race_code = ${raceCodeSql} AND s.stage_number = ${stageNum}
  ), ' 条成绩') AS status;`);
    
    const sqlScript = lines.join('\n');
    
    res.json({ 
      code: 200, 
      data: { 
        sql: sqlScript,
        stage: `${raceCode} - Stage ${stageNum}`,
        results_count: sqlResults.length,
        jerseys_count: jerseys?.length || 0,
        validation,
        summary: {
          ...validation.summary,
          generated_sql_bytes: Buffer.byteLength(sqlScript, 'utf8')
        }
      } 
    });
    
  } catch (err) {
    log.error('生成SQL失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '生成SQL失败: ' + err.message });
  }
});

// POST /api/v1/admin/import-stage - 直接执行导入（通过API）
router.post('/import-stage', async (req, res) => {
  try {
    const { stage_info, results, jerseys } = req.body;
    const validation = buildImportValidationSummary(stage_info, results, jerseys);
    if (!validation.ok) {
      return validationErrorResponse(res, validation);
    }
    const normalized = normalizeImportStagePayload(stage_info, results);
    if (normalized.error) {
      return res.status(400).json({
        code: 400,
        message: normalized.error
      });
    }
    const raceCode = normalized.raceCode;
    const stageNum = normalized.stageNum;
    const normalizedResults = normalized.results;
    
    if (!stage_info || !results || !Array.isArray(results)) {
      return res.status(400).json({ 
        code: 400, 
        message: '缺少必需字段: stage_info 或 results' 
      });
    }
    
    const { race_code, stage_number, stage_name, date, distance_km, stage_type } = stage_info;
    
    log.info('开始导入', { race_code: raceCode, stage_number: stageNum });
    
    // 1. 获取或创建赛事
    const [races] = await pool.query('SELECT * FROM races WHERE race_code = ?', [raceCode]);
    let raceId;
    if (races.length > 0) {
      raceId = races[0].id;
      log.info('赛事已存在', { raceId });
    } else {
      raceId = uuidv4();
      await pool.query(`
        INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [raceId, "Giro d'Italia", "Giro d'Italia", raceCode, 'GRAND_TOUR', 'MEN', 2026]);
      log.info('创建赛事', { raceId });
    }
    
    // 2. 获取或创建赛段
    const [stages] = await pool.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, stageNum]
    );
    let stageId;
    if (stages.length > 0) {
      stageId = stages[0].id;
      log.info('赛段已存在', { stageId });
    } else {
      stageId = uuidv4();
      await pool.query(`
        INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [stageId, raceId, stageNum, stage_name || `Stage ${stageNum}`, date || '2026-01-01', distance_km || 0, stage_type || 'Unknown', `${raceCode}-s${stageNum}`]);
      log.info('创建赛段', { stageId });
    }
    
    // 3. 批量导入成绩
    let imported = 0;
    let skipped = 0;
    const rowErrors = [];
    
    for (const result of normalizedResults) {
      try {
        // 获取或创建车手
        const [riders] = await pool.query('SELECT * FROM riders WHERE rider_name = ?', [result.rider_name]);
        let riderId;
        if (riders.length > 0) {
          riderId = riders[0].id;
        } else {
          riderId = uuidv4();
          await pool.query('INSERT INTO riders (id, rider_name, nationality) VALUES (?, ?, ?)', [riderId, result.rider_name, 'UNK']);
        }
        
        // 获取或创建车队
        const [teams] = await pool.query('SELECT * FROM teams WHERE team_name = ?', [result.team_name]);
        let teamId;
        if (teams.length > 0) {
          teamId = teams[0].id;
        } else {
          teamId = uuidv4();
          await pool.query('INSERT INTO teams (id, team_name) VALUES (?, ?)', [teamId, result.team_name]);
        }
        
        // 插入成绩
        await pool.query(`
          INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, result.rank, riderId, teamId, 'UNK', result.time_gap]);
        
        imported++;
      } catch (err) {
        skipped++;
        rowErrors.push({
          rank: result.rank,
          rider_name: result.rider_name,
          team_name: result.team_name,
          error: err.message
        });
        log.error('成绩导入失败', { rank: result.rank, rider_name: result.rider_name, error: err.message });
      }
    }
    
    log.info('成绩导入完成', { imported, skipped });
    
    // 4. 导入领骑衫
    if (normalizedResults.length > 0 && imported === 0) {
      return res.status(500).json({
        code: 500,
        message: 'import failed: no result rows were imported',
        data: {
          race_code: raceCode,
          stage_number: stageNum,
          results_imported: imported,
          results_skipped: skipped,
          row_errors: rowErrors.slice(0, 10),
          validation,
          summary: {
            ...validation.summary,
            results_imported: imported,
            results_skipped: skipped
          }
        }
      });
    }

    let jerseyImported = 0;
    const jerseyErrors = [];
    if (jerseys && jerseys.length > 0) {
      for (const jersey of jerseys) {
        try {
          const [riders] = await pool.query('SELECT * FROM riders WHERE rider_name = ?', [jersey.rider_name]);
          const [teams] = await pool.query('SELECT * FROM teams WHERE team_name = ?', [jersey.team_name]);
          
          if (riders.length === 0 || teams.length === 0) {
            jerseyErrors.push({
              jersey_type: jersey.jersey_type,
              rider_name: jersey.rider_name,
              team_name: jersey.team_name,
              error: 'rider or team not found after result import'
            });
            log.error('找不到车手或车队', { rider_name: jersey.rider_name, team_name: jersey.team_name });
            continue;
          }
          
          await pool.query(`
            INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE rider_id = VALUES(rider_id), team_id = VALUES(team_id)
          `, [uuidv4(), stageId, jersey.jersey_type, riders[0].id, teams[0].id]);
          
          jerseyImported++;
        } catch (err) {
          jerseyErrors.push({
            jersey_type: jersey.jersey_type,
            rider_name: jersey.rider_name,
            team_name: jersey.team_name,
            error: err.message
          });
          log.error('领骑衫导入失败', { jersey_type: jersey.jersey_type, error: err.message });
        }
      }
    }
    
    // 5. 验证
    const [count] = await pool.query(
      'SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?',
      [stageId]
    );
    
    const message = `导入完成！\n赛事: ${race_code}\n赛段: Stage ${stage_number}\n成绩: ${imported} 条 (跳过: ${skipped})\n领骑衫: ${jerseyImported} 件\n数据库验证: ${count[0].count} 条成绩`;
    
    log.info('导入完成', { race_code, stage_number, imported, skipped, jerseyImported, db_count: count[0].count });
    
    res.json({ 
      code: 200, 
      message,
      data: {
        race_code: raceCode,
        stage_number: stageNum,
        results_imported: imported,
        results_skipped: skipped,
        jerseys_imported: jerseyImported,
        jerseys_skipped: jerseyErrors.length,
        db_count: count[0].count,
        row_errors: rowErrors.slice(0, 10),
        jersey_errors: jerseyErrors.slice(0, 10),
        validation,
        summary: {
          ...validation.summary,
          results_imported: imported,
          results_skipped: skipped,
          jerseys_imported: jerseyImported,
          jerseys_skipped: jerseyErrors.length,
          db_result_count: count[0].count
        }
      }
    });
    
  } catch (err) {
    log.error('导入失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '导入失败: ' + err.message });
  }
});



// ========== 中文名称管理API ==========

// GET /api/v1/admin/riders-without-zh - 获取没有中文名的车手列表
router.get('/riders-without-zh', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const { limit, offset } = parseAdminPaging(req.query);
    
    let query = 'SELECT id, rider_name, rider_name_zh FROM riders WHERE rider_name_zh IS NULL OR rider_name_zh = ""';
    let params = [];
    
    if (search) {
      query += ' AND rider_name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY rider_name LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [riders] = await pool.query(query, params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM riders WHERE rider_name_zh IS NULL OR rider_name_zh = ""';
    let countParams = [];
    if (search) {
      countQuery += ' AND rider_name LIKE ?';
      countParams.push(`%${search}%`);
    }
    const [countResult] = await pool.query(countQuery, countParams);
    
    res.json({
      code: 200,
      data: {
        riders,
        total: countResult[0].total,
        limit,
        offset
      }
    });
  } catch (err) {
    log.error('获取车手列表失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '获取车手列表失败: ' + err.message });
  }
});

// PUT /api/v1/admin/rider/:id/chinese-name - 更新车手中文名
router.put('/rider/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const riderNameZh = normalizeRequiredStringField(req.body, 'rider_name_zh');
    
    if (!riderNameZh) {
      return res.status(400).json({ code: 400, message: 'rider_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE riders SET rider_name_zh = ?, updated_at = NOW() WHERE id = ?',
      [riderNameZh, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '车手不存在' });
    }
    
    res.json(chineseNameUpdateResponse('rider', id, 'rider_name_zh', riderNameZh));
  } catch (err) {
    log.error('更新车手中文名失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// GET /api/v1/admin/teams-without-zh - 获取没有中文名的车队列表
router.get('/teams-without-zh', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const { limit, offset } = parseAdminPaging(req.query);
    
    let query = 'SELECT id, team_name, team_name_zh FROM teams WHERE team_name_zh IS NULL OR team_name_zh = ""';
    let params = [];
    
    if (search) {
      query += ' AND team_name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY team_name LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [teams] = await pool.query(query, params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM teams WHERE team_name_zh IS NULL OR team_name_zh = ""';
    let countParams = [];
    if (search) {
      countQuery += ' AND team_name LIKE ?';
      countParams.push(`%${search}%`);
    }
    const [countResult] = await pool.query(countQuery, countParams);
    
    res.json({
      code: 200,
      data: {
        teams,
        total: countResult[0].total,
        limit,
        offset
      }
    });
  } catch (err) {
    log.error('获取车队列表失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '获取车队列表失败: ' + err.message });
  }
});

// PUT /api/v1/admin/team/:id/chinese-name - 更新车队中文名
router.put('/team/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const teamNameZh = normalizeRequiredStringField(req.body, 'team_name_zh');
    
    if (!teamNameZh) {
      return res.status(400).json({ code: 400, message: 'team_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE teams SET team_name_zh = ? WHERE id = ?',
      [teamNameZh, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '车队不存在' });
    }
    
    res.json(chineseNameUpdateResponse('team', id, 'team_name_zh', teamNameZh));
  } catch (err) {
    log.error('更新车队中文名失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// PUT /api/v1/admin/race/:id/chinese-name - 更新比赛中文名
router.put('/race/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const raceNameZh = normalizeRequiredStringField(req.body, 'race_name_zh');
    
    if (!raceNameZh) {
      return res.status(400).json({ code: 400, message: 'race_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE races SET race_name_zh = ?, updated_at = NOW() WHERE id = ?',
      [raceNameZh, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '比赛不存在' });
    }
    
    res.json(chineseNameUpdateResponse('race', id, 'race_name_zh', raceNameZh));
  } catch (err) {
    log.error('更新比赛中文名失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// PUT /api/v1/admin/stage/:id/chinese-name - 更新赛段中文名
router.put('/stage/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const stageNameZh = normalizeRequiredStringField(req.body, 'stage_name_zh');
    
    if (!stageNameZh) {
      return res.status(400).json({ code: 400, message: 'stage_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE stages SET stage_name_zh = ?, updated_at = NOW() WHERE id = ?',
      [stageNameZh, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '赛段不存在' });
    }
    
    res.json(chineseNameUpdateResponse('stage', id, 'stage_name_zh', stageNameZh));
  } catch (err) {
    log.error('更新赛段中文名失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// GET /api/v1/admin/translation-stats - 获取翻译统计
router.get('/translation-stats', async (req, res) => {
  try {
    const stats = {};
    
    // 车队翻译统计
    const [teamStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN team_name_zh IS NOT NULL AND team_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM teams
    `);
    stats.teams = teamStats[0];
    stats.teams.percentage = formatPercentage(stats.teams.translated, stats.teams.total);
    
    // 车手翻译统计
    const [riderStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN rider_name_zh IS NOT NULL AND rider_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM riders
    `);
    stats.riders = riderStats[0];
    stats.riders.percentage = formatPercentage(stats.riders.translated, stats.riders.total);
    
    // 比赛翻译统计
    const [raceStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN race_name_zh IS NOT NULL AND race_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM races
    `);
    stats.races = raceStats[0];
    stats.races.percentage = formatPercentage(stats.races.translated, stats.races.total);
    
    // 赛段翻译统计
    const [stageStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stage_name_zh IS NOT NULL AND stage_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM stages
    `);
    stats.stages = stageStats[0];
    stats.stages.percentage = formatPercentage(stats.stages.translated, stats.stages.total);
    
    res.json({ code: 200, data: stats });
  } catch (err) {
    log.error('获取翻译统计失败', { error: err.message || String(err) });
    res.status(500).json({ code: 500, message: '获取统计失败: ' + err.message });
  }
});


module.exports = router;
