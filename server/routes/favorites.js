/**
 * 关注功能路由
 * 处理车手关注/取消关注、获取关注列表等功能
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db-pool');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const Joi = require('joi');

// ========== 验证Schemas ==========

const addFavoriteSchema = Joi.object({
  rider_id: Joi.string().guid({ version: ['uuidv4'] }).required()
});

const removeFavoriteSchema = Joi.object({
  rider_id: Joi.string().guid({ version: ['uuidv4'] }).required()
});

// GET /api/v1/favorites - 获取当前用户的关注列表
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.openid;

    // 验证user_id格式
    if (!user_id || typeof user_id !== 'string') {
      throw new AppError('无效的用户ID', 400);
    }

    // 查询关注列表
    const [favorites] = await pool.query(`
      SELECT rf.id, rf.rider_id, rf.created_at,
             r.rider_name, r.rider_name_zh, r.nationality, r.photo_url,
             r.birth_date, r.country_code,
             t.team_id, t.team_name, t.team_name_zh, t.uci_code
      FROM riders_favorites rf
      JOIN riders r ON rf.rider_id = r.id
      LEFT JOIN teams t ON r.team_id = t.id
      WHERE rf.user_id = ?
      ORDER BY rf.created_at DESC
    `, [user_id]);

    res.json({
      code: 200,
      data: favorites,
      total: favorites.length
    });
  } catch (err) {
    console.error('获取关注列表失败:', err);
    throw new AppError('获取关注列表失败', 500);
  }
}));

// POST /api/v1/favorites/add - 添加关注
router.post('/add', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.openid;
    const { rider_id } = req.body;

    // 验证请求参数
    const valid = addFavoriteSchema.validate(req.body);
    if (valid.error) {
      throw new AppError('请求参数验证失败', 400, valid.error.details);
    }

    // 验证user_id
    if (!user_id || typeof user_id !== 'string') {
      throw new AppError('无效的用户ID', 400);
    }

    // 验证rider_id格式
    const uuidSchema = Joi.string().guid({ version: ['uuidv4'] }).required();
    const { error: uuidError } = uuidSchema.validate(rider_id);
    if (uuidError) {
      throw new AppError('无效的车手ID格式', 400);
    }

    // 检查车手是否存在
    const [rider] = await pool.query(
      'SELECT id FROM riders WHERE id = ?',
      [rider_id]
    );

    if (rider.length === 0) {
      throw new AppError('车手不存在', 404);
    }

    // 检查是否已经关注
    const [existing] = await pool.query(
      `SELECT id FROM riders_favorites
       WHERE user_id = ? AND rider_id = ?`,
      [user_id, rider_id]
    );

    if (existing.length > 0) {
      throw new AppError('已经关注该车手', 409);
    }

    // 添加关注
    await pool.query(
      `INSERT INTO riders_favorites (id, user_id, rider_id, created_at)
       VALUES (?, ?, ?, NOW())`,
      [require('uuid').v4(), user_id, rider_id]
    );

    // 记录操作日志
    await pool.query(
      `INSERT INTO admin_logs (id, user_id, action, details)
       VALUES (?, ?, 'ADD_FAVORITE', ?)`,
      [require('uuid').v4(), user_id, JSON.stringify({ rider_id })]
    );

    // 获取车手信息
    const [riderInfo] = await pool.query(
      'SELECT * FROM riders WHERE id = ?',
      [rider_id]
    );

    res.json({
      code: 200,
      message: '关注成功',
      data: {
        rider_id: rider_id,
        rider_name: riderInfo[0].rider_name,
        rider_name_zh: riderInfo[0].rider_name_zh,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('添加关注失败', 500);
  }
}));

// POST /api/v1/favorites/remove - 取消关注
router.post('/remove', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.openid;
    const { rider_id } = req.body;

    // 验证请求参数
    const valid = removeFavoriteSchema.validate(req.body);
    if (valid.error) {
      throw new AppError('请求参数验证失败', 400, valid.error.details);
    }

    // 验证user_id
    if (!user_id || typeof user_id !== 'string') {
      throw new AppError('无效的用户ID', 400);
    }

    // 验证rider_id格式
    const uuidSchema = Joi.string().guid({ version: ['uuidv4'] }).required();
    const { error: uuidError } = uuidSchema.validate(rider_id);
    if (uuidError) {
      throw new AppError('无效的车手ID格式', 400);
    }

    // 检查关注是否存在
    const [favorite] = await pool.query(
      `SELECT id FROM riders_favorites
       WHERE user_id = ? AND rider_id = ?`,
      [user_id, rider_id]
    );

    if (favorite.length === 0) {
      throw new AppError('未关注该车手', 404);
    }

    // 删除关注
    await pool.query(
      `DELETE FROM riders_favorites WHERE user_id = ? AND rider_id = ?`,
      [user_id, rider_id]
    );

    // 记录操作日志
    await pool.query(
      `INSERT INTO admin_logs (id, user_id, action, details)
       VALUES (?, ?, 'REMOVE_FAVORITE', ?)`,
      [require('uuid').v4(), user_id, JSON.stringify({ rider_id })]
    );

    res.json({
      code: 200,
      message: '取消关注成功'
    });
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('取消关注失败', 500);
  }
}));

// GET /api/v1/favorites/check/:riderId - 检查是否已关注某个车手
router.get('/check/:riderId', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.openid;
    const { riderId } = req.params;

    // 验证riderId格式
    const uuidSchema = Joi.string().guid({ version: ['uuidv4'] }).required();
    const { error: uuidError } = uuidSchema.validate(riderId);
    if (uuidError) {
      throw new AppError('无效的车手ID格式', 400);
    }

    // 检查是否关注
    const [favorites] = await pool.query(
      `SELECT id FROM riders_favorites
       WHERE user_id = ? AND rider_id = ?`,
      [user_id, riderId]
    );

    res.json({
      code: 200,
      data: {
        is_favorite: favorites.length > 0,
        rider_id: riderId
      }
    });
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('检查关注状态失败', 500);
  }
}));

// PUT /api/v1/favorites - 更新关注列表（批量）
router.put('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.openid;
    const { favorite_ids } = req.body; // Array of rider_id

    if (!Array.isArray(favorite_ids)) {
      throw new AppError('favorite_ids必须是数组', 400);
    }

    // 验证user_id
    if (!user_id || typeof user_id !== 'string') {
      throw new AppError('无效的用户ID', 400);
    }

    // 验证所有车手ID格式
    const uuidSchema = Joi.string().guid({ version: ['uuidv4'] }).required();
    for (const riderId of favorite_ids) {
      const { error } = uuidSchema.validate(riderId);
      if (error) {
        throw new AppError(`无效的车手ID格式: ${riderId}`, 400);
      }
    }

    // 验证所有车手都存在
    const placeholders = favorite_ids.map(() => '?').join(',');
    const [riders] = await pool.query(
      `SELECT id FROM riders WHERE id IN (${placeholders})`,
      favorite_ids
    );

    if (riders.length !== favorite_ids.length) {
      throw new AppError('部分车手不存在', 404);
    }

    // 获取当前关注的车手ID
    const [currentFavorites] = await pool.query(
      'SELECT rider_id FROM riders_favorites WHERE user_id = ?',
      [user_id]
    );
    const currentIds = currentFavorites.map(f => f.rider_id);

    // 计算要添加和删除的关注
    const toAdd = favorite_ids.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !favorite_ids.includes(id));

    // 执行添加和删除
    const insertPromises = toAdd.map(riderId =>
      pool.query(
        `INSERT INTO riders_favorites (id, user_id, rider_id, created_at)
         VALUES (?, ?, ?, NOW())`,
        [require('uuid').v4(), user_id, riderId]
      )
    );

    const deletePromises = toRemove.map(riderId =>
      pool.query(
        `DELETE FROM riders_favorites WHERE user_id = ? AND rider_id = ?`,
        [user_id, riderId]
      )
    );

    await Promise.all([...insertPromises, ...deletePromises]);

    // 记录操作日志
    await pool.query(
      `INSERT INTO admin_logs (id, user_id, action, details)
       VALUES (?, ?, 'UPDATE_FAVORITES', ?)`,
      [require('uuid').v4(), user_id, JSON.stringify({
        added_count: toAdd.length,
        removed_count: toRemove.length
      })]
    );

    res.json({
      code: 200,
      message: '关注列表已更新',
      data: {
        added_count: toAdd.length,
        removed_count: toRemove.length,
        current_count: favorite_ids.length
      }
    });
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('更新关注列表失败', 500);
  }
}));

// DELETE /api/v1/favorites/:riderId - 删除单个关注
router.delete('/:riderId', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.openid;
    const { riderId } = req.params;

    // 验证riderId格式
    const uuidSchema = Joi.string().guid({ version: ['uuidv4'] }).required();
    const { error: uuidError } = uuidSchema.validate(riderId);
    if (uuidError) {
      throw new AppError('无效的车手ID格式', 400);
    }

    // 验证user_id
    if (!user_id || typeof user_id !== 'string') {
      throw new AppError('无效的用户ID', 400);
    }

    // 检查是否关注
    const [favorite] = await pool.query(
      `SELECT id FROM riders_favorites
       WHERE user_id = ? AND rider_id = ?`,
      [user_id, riderId]
    );

    if (favorite.length === 0) {
      throw new AppError('未关注该车手', 404);
    }

    // 删除关注
    await pool.query(
      `DELETE FROM riders_favorites WHERE user_id = ? AND rider_id = ?`,
      [user_id, riderId]
    );

    // 记录操作日志
    await pool.query(
      `INSERT INTO admin_logs (id, user_id, action, details)
       VALUES (?, ?, 'DELETE_FAVORITE', ?)`,
      [require('uuid').v4(), user_id, JSON.stringify({ rider_id: riderId })]
    );

    res.json({
      code: 200,
      message: '已删除关注'
    });
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('删除关注失败', 500);
  }
}));

module.exports = router;
