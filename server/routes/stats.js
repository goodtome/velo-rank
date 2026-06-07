const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { routeLog } = require('../middleware/requestLogger');
const log = routeLog('stats');

// GET /api/v1/stats/overview - 数据库统计概览
router.get('/overview', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM races WHERE is_active = 1) as races,
        (SELECT COUNT(*) FROM stages) as stages,
        (SELECT COUNT(*) FROM riders) as riders,
        (SELECT COUNT(*) FROM teams) as teams,
        (SELECT COUNT(*) FROM stage_results) as stage_results,
        (SELECT COUNT(*) FROM jerseys) as jerseys,
        (SELECT COUNT(*) FROM general_classification) as general_classification
    `);
    res.json({ code: 200, data: stats[0] });
  } catch (err) {
    log.error('获取统计信息失败', { error: err.message });
    res.status(500).json({ code: 500, message: '获取统计信息失败' });
  }
});

module.exports = router;
