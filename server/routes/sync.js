const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');

// GET /api/v1/sync/status - 查看同步状态
router.get('/status', async (req, res) => {
  try {
    // 查询最近同步的赛事
    const [races] = await pool.query(`
      SELECT race_name, updated_at 
      FROM races 
      ORDER BY updated_at DESC 
      LIMIT 5
    `);
    res.json({ 
      code: 200, 
      data: { 
        recent_sync: races,
        message: '数据同步服务运行正常'
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '获取同步状态失败' });
  }
});

// POST /api/v1/sync/races/:id - 手动触发赛事数据同步（需认证）
router.post('/races/:id', async (req, res) => {
  try {
    // TODO: 添加认证中间件
    const { id } = req.params;
    // TODO: 触发PCS爬取脚本
    res.json({ 
      code: 200, 
      message: '同步任务已提交，请查看同步状态',
      data: { race_id: id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '触发同步失败' });
  }
});

module.exports = router;
