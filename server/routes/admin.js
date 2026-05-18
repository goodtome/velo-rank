const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db-pool');

// POST /api/v1/admin/generate-sql - 生成SQL导入脚本
router.post('/generate-sql', async (req, res) => {
  try {
    const { stage_info, results, jerseys } = req.body;
    
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
    const raceCode = race_code;
    const stageNum = stage_number;
    const stageName = stage_name ? `'${stage_name.replace(/'/g, "\\'")}'` : `'Stage ${stageNum}'`;
    const stageDate = date ? `'${date}'` : `'2026-01-01'`;
    const distanceKm = distance_km || 0;
    const stageType = stage_type ? `'${stage_type.replace(/'/g, "\\'")}'` : `'Unknown'`;
    const stageCode = `'${raceCode}-s${stageNum}'`;
    
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
  '${raceCode}' AS race_code,
  'GRAND_TOUR' AS category,
  'MEN' AS gender,
  2026 AS season
WHERE NOT EXISTS (SELECT 1 FROM races WHERE race_code = '${raceCode}');

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
WHERE r.race_code = '${raceCode}'
  AND NOT EXISTS (
    SELECT 1 FROM stages s 
    WHERE s.race_id = r.id AND s.stage_number = ${stageNum}
  );

-- ============================================
-- 3. 批量导入车手和车队
-- ============================================
`);
    
    // 车手数据
    const uniqueRiders = [...new Set(results.map(r => r.rider_name))];
    lines.push(`-- 车手数据 (${uniqueRiders.length} 条)`);
    uniqueRiders.forEach(name => {
      const safeName = name.replace(/'/g, "\\'");
      lines.push(`INSERT IGNORE INTO riders (rider_name, nationality) VALUES ('${safeName}', 'UNK');`);
    });
    
    // 车队数据
    lines.push(`
-- 车队数据`);
    const uniqueTeams = [...new Set(results.map(r => r.team_name))];
    uniqueTeams.forEach(name => {
      const safeName = name.replace(/'/g, "\\'");
      lines.push(`INSERT IGNORE INTO teams (team_name) VALUES ('${safeName}');`);
    });
    
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
  SELECT * FROM (VALUES
${results.map(r => `    (${r.rank}, '${r.rider_name.replace(/'/g, "\\'")}', '${r.team_name.replace(/'/g, "\\'")}', '${r.time_gap.replace(/'/g, "\\'")}')`).join(',\n')}
  ) AS tr(\`rank\`, rider_name, team_name, time_gap)
) tr
JOIN stages s ON s.race_id = (SELECT id FROM races WHERE race_code = '${raceCode}') AND s.stage_number = ${stageNum}
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
  '${j.jersey_type}',
  r.id,
  t.id
FROM stages s
JOIN riders r ON r.rider_name = '${j.rider_name.replace(/'/g, "\\'")}'
JOIN teams t ON t.team_name = '${j.team_name.replace(/'/g, "\\'")}'
WHERE s.race_id = (SELECT id FROM races WHERE race_code = '${raceCode}')
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
  CONCAT('✅ Stage ${stageNum} 导入完成: ', (SELECT COUNT(*) FROM stage_results WHERE stage_id = (SELECT id FROM stages WHERE race_code = '${raceCode}' AND stage_number = ${stageNum})), ' 条成绩') AS status;`);
    
    const sqlScript = lines.join('\n');
    
    res.json({ 
      code: 200, 
      data: { 
        sql: sqlScript,
        stage: `${raceCode} - Stage ${stageNum}`,
        results_count: results.length,
        jerseys_count: jerseys?.length || 0
      } 
    });
    
  } catch (err) {
    console.error('生成SQL失败:', err);
    res.status(500).json({ code: 500, message: '生成SQL失败: ' + err.message });
  }
});

// POST /api/v1/admin/import-stage - 直接执行导入（通过API）
router.post('/import-stage', async (req, res) => {
  try {
    const { stage_info, results, jerseys } = req.body;
    
    if (!stage_info || !results || !Array.isArray(results)) {
      return res.status(400).json({ 
        code: 400, 
        message: '缺少必需字段: stage_info 或 results' 
      });
    }
    
    const { race_code, stage_number, stage_name, date, distance_km, stage_type } = stage_info;
    
    console.log(`[Admin Import] 开始导入: ${race_code} Stage ${stage_number}`);
    
    // 1. 获取或创建赛事
    const [races] = await pool.query('SELECT * FROM races WHERE race_code = ?', [race_code]);
    let raceId;
    if (races.length > 0) {
      raceId = races[0].id;
      console.log(`[Admin Import] 赛事已存在: ${raceId}`);
    } else {
      raceId = uuidv4();
      await pool.query(`
        INSERT INTO races (id, race_name, race_name_en, race_code, category, gender, season)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [raceId, "Giro d'Italia", "Giro d'Italia", race_code, 'GRAND_TOUR', 'MEN', 2026]);
      console.log(`[Admin Import] 创建赛事: ${raceId}`);
    }
    
    // 2. 获取或创建赛段
    const [stages] = await pool.query(
      'SELECT * FROM stages WHERE race_id = ? AND stage_number = ?',
      [raceId, stage_number]
    );
    let stageId;
    if (stages.length > 0) {
      stageId = stages[0].id;
      console.log(`[Admin Import] 赛段已存在: ${stageId}`);
    } else {
      stageId = uuidv4();
      await pool.query(`
        INSERT INTO stages (id, race_id, stage_number, stage_name, date, distance_km, stage_type, stage_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [stageId, raceId, stage_number, stage_name || `Stage ${stage_number}`, date || '2026-01-01', distance_km || 0, stage_type || 'Unknown', `${race_code}-s${stage_number}`]);
      console.log(`[Admin Import] 创建赛段: ${stageId}`);
    }
    
    // 3. 批量导入成绩
    let imported = 0;
    let skipped = 0;
    
    for (const result of results) {
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
          INSERT INTO stage_results (id, stage_id, \`rank\`, rider_id, team_id, nationality, time_gap)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            rider_id = VALUES(rider_id),
            team_id = VALUES(team_id),
            time_gap = VALUES(time_gap)
        `, [uuidv4(), stageId, result.rank, riderId, teamId, 'UNK', result.time_gap]);
        
        imported++;
      } catch (err) {
        skipped++;
        console.error(`[Admin Import] 失败 [${result.rank}] ${result.rider_name}:`, err.message);
      }
    }
    
    console.log(`[Admin Import] 成绩导入完成: ${imported} 成功, ${skipped} 失败`);
    
    // 4. 导入领骑衫
    let jerseyImported = 0;
    if (jerseys && jerseys.length > 0) {
      for (const jersey of jerseys) {
        try {
          const [riders] = await pool.query('SELECT * FROM riders WHERE rider_name = ?', [jersey.rider_name]);
          const [teams] = await pool.query('SELECT * FROM teams WHERE team_name = ?', [jersey.team_name]);
          
          if (riders.length === 0 || teams.length === 0) {
            console.error(`[Admin Import] 找不到车手或车队: ${jersey.rider_name} / ${jersey.team_name}`);
            continue;
          }
          
          await pool.query(`
            INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE rider_id = VALUES(rider_id), team_id = VALUES(team_id)
          `, [uuidv4(), stageId, jersey.jersey_type, riders[0].id, teams[0].id]);
          
          jerseyImported++;
        } catch (err) {
          console.error(`[Admin Import] 领骑衫失败 ${jersey.jersey_type}:`, err.message);
        }
      }
    }
    
    // 5. 验证
    const [count] = await pool.query(
      'SELECT COUNT(*) as count FROM stage_results WHERE stage_id = ?',
      [stageId]
    );
    
    const message = `导入完成！\n赛事: ${race_code}\n赛段: Stage ${stage_number}\n成绩: ${imported} 条 (跳过: ${skipped})\n领骑衫: ${jerseyImported} 件\n数据库验证: ${count[0].count} 条成绩`;
    
    console.log(`[Admin Import] ${message}`);
    
    res.json({ 
      code: 200, 
      message,
      data: {
        race_code,
        stage_number,
        results_imported: imported,
        results_skipped: skipped,
        jerseys_imported: jerseyImported,
        db_count: count[0].count
      }
    });
    
  } catch (err) {
    console.error('[Admin Import] 导入失败:', err);
    res.status(500).json({ code: 500, message: '导入失败: ' + err.message });
  }
});



// ========== 中文名称管理API ==========

// GET /api/v1/admin/riders-without-zh - 获取没有中文名的车手列表
router.get('/riders-without-zh', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search = '' } = req.query;
    
    let query = 'SELECT id, rider_name, rider_name_zh FROM riders WHERE rider_name_zh IS NULL OR rider_name_zh = ""';
    let params = [];
    
    if (search) {
      query += ' AND rider_name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY rider_name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
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
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('获取车手列表失败:', err);
    res.status(500).json({ code: 500, message: '获取车手列表失败: ' + err.message });
  }
});

// PUT /api/v1/admin/rider/:id/chinese-name - 更新车手中文名
router.put('/rider/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const { rider_name_zh } = req.body;
    
    if (!rider_name_zh || rider_name_zh.trim() === '') {
      return res.status(400).json({ code: 400, message: 'rider_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE riders SET rider_name_zh = ?, updated_at = NOW() WHERE id = ?',
      [rider_name_zh.trim(), id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '车手不存在' });
    }
    
    res.json({ code: 200, message: '车手中文名更新成功' });
  } catch (err) {
    console.error('更新车手中文名失败:', err);
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// GET /api/v1/admin/teams-without-zh - 获取没有中文名的车队列表
router.get('/teams-without-zh', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search = '' } = req.query;
    
    let query = 'SELECT id, team_name, team_name_zh FROM teams WHERE team_name_zh IS NULL OR team_name_zh = ""';
    let params = [];
    
    if (search) {
      query += ' AND team_name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY team_name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
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
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('获取车队列表失败:', err);
    res.status(500).json({ code: 500, message: '获取车队列表失败: ' + err.message });
  }
});

// PUT /api/v1/admin/team/:id/chinese-name - 更新车队中文名
router.put('/team/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const { team_name_zh } = req.body;
    
    if (!team_name_zh || team_name_zh.trim() === '') {
      return res.status(400).json({ code: 400, message: 'team_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE teams SET team_name_zh = ? WHERE id = ?',
      [team_name_zh.trim(), id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '车队不存在' });
    }
    
    res.json({ code: 200, message: '车队中文名更新成功' });
  } catch (err) {
    console.error('更新车队中文名失败:', err);
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// PUT /api/v1/admin/race/:id/chinese-name - 更新比赛中文名
router.put('/race/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const { race_name_zh } = req.body;
    
    if (!race_name_zh || race_name_zh.trim() === '') {
      return res.status(400).json({ code: 400, message: 'race_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE races SET race_name_zh = ?, updated_at = NOW() WHERE id = ?',
      [race_name_zh.trim(), id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '比赛不存在' });
    }
    
    res.json({ code: 200, message: '比赛中文名更新成功' });
  } catch (err) {
    console.error('更新比赛中文名失败:', err);
    res.status(500).json({ code: 500, message: '更新失败: ' + err.message });
  }
});

// PUT /api/v1/admin/stage/:id/chinese-name - 更新赛段中文名
router.put('/stage/:id/chinese-name', async (req, res) => {
  try {
    const { id } = req.params;
    const { stage_name_zh } = req.body;
    
    if (!stage_name_zh || stage_name_zh.trim() === '') {
      return res.status(400).json({ code: 400, message: 'stage_name_zh 不能为空' });
    }
    
    const [result] = await pool.query(
      'UPDATE stages SET stage_name_zh = ?, updated_at = NOW() WHERE id = ?',
      [stage_name_zh.trim(), id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '赛段不存在' });
    }
    
    res.json({ code: 200, message: '赛段中文名更新成功' });
  } catch (err) {
    console.error('更新赛段中文名失败:', err);
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
    stats.teams.percentage = ((stats.teams.translated / stats.teams.total) * 100).toFixed(2);
    
    // 车手翻译统计
    const [riderStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN rider_name_zh IS NOT NULL AND rider_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM riders
    `);
    stats.riders = riderStats[0];
    stats.riders.percentage = ((stats.riders.translated / stats.riders.total) * 100).toFixed(2);
    
    // 比赛翻译统计
    const [raceStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN race_name_zh IS NOT NULL AND race_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM races
    `);
    stats.races = raceStats[0];
    stats.races.percentage = ((stats.races.translated / stats.races.total) * 100).toFixed(2);
    
    // 赛段翻译统计
    const [stageStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stage_name_zh IS NOT NULL AND stage_name_zh != '' THEN 1 ELSE 0 END) as translated
      FROM stages
    `);
    stats.stages = stageStats[0];
    stats.stages.percentage = ((stats.stages.translated / stats.stages.total) * 100).toFixed(2);
    
    res.json({ code: 200, data: stats });
  } catch (err) {
    console.error('获取翻译统计失败:', err);
    res.status(500).json({ code: 500, message: '获取统计失败: ' + err.message });
  }
});


module.exports = router;
