async function updateFavoritesTransaction({
  pool,
  userId,
  favoriteIds,
  createId,
}) {
  const conn = await pool.getConnection();
  const normalizedFavoriteIds = [...new Set(favoriteIds)];
  let toAdd = [];
  let toRemove = [];

  try {
    await conn.beginTransaction();

    const [currentFavorites] = await conn.query(
      'SELECT rider_id FROM riders_favorites WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    const currentIds = currentFavorites.map(f => f.rider_id);

    toAdd = normalizedFavoriteIds.filter(id => !currentIds.includes(id));
    toRemove = currentIds.filter(id => !normalizedFavoriteIds.includes(id));

    for (const riderId of toAdd) {
      await conn.query(
        `INSERT INTO riders_favorites (id, user_id, rider_id, created_at)
         VALUES (?, ?, ?, NOW())`,
        [createId(), userId, riderId]
      );
    }

    for (const riderId of toRemove) {
      await conn.query(
        'DELETE FROM riders_favorites WHERE user_id = ? AND rider_id = ?',
        [userId, riderId]
      );
    }

    await conn.query(
      `INSERT INTO admin_logs (id, user_id, action, details)
       VALUES (?, ?, 'UPDATE_FAVORITES', ?)`,
      [
        createId(),
        userId,
        JSON.stringify({
          added_count: toAdd.length,
          removed_count: toRemove.length
        })
      ]
    );

    await conn.commit();

    return {
      added_count: toAdd.length,
      removed_count: toRemove.length,
      current_count: normalizedFavoriteIds.length
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  updateFavoritesTransaction
};
