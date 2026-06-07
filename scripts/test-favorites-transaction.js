const assert = require('assert');
const { updateFavoritesTransaction } = require('../server/services/favoritesService');

function createConn(options = {}) {
  const queries = [];
  const conn = {
    queries,
    released: false,
    committed: false,
    rolledBack: false,
    async beginTransaction() {
      queries.push(['BEGIN']);
    },
    async query(sql, params) {
      queries.push([sql, params]);
      if (options.failOnQuery && options.failOnQuery(sql, params)) {
        throw new Error('boom');
      }

      if (sql.includes('SELECT rider_id FROM riders_favorites')) {
        return [[{ rider_id: 'rider-keep' }]];
      }

      return [[]];
    },
    async commit() {
      this.committed = true;
      queries.push(['COMMIT']);
    },
    async rollback() {
      this.rolledBack = true;
      queries.push(['ROLLBACK']);
    },
    release() {
      this.released = true;
      queries.push(['RELEASE']);
    }
  };

  return conn;
}

async function runSuccessCase() {
  const conn = createConn();
  const pool = {
    async getConnection() {
      return conn;
    }
  };
  const ids = ['rider-keep', 'rider-add', 'rider-add'];
  const idValues = ['log-1', 'log-2'];
  const result = await updateFavoritesTransaction({
    pool,
    userId: 'user-1',
    favoriteIds: ids,
    createId: () => idValues.shift()
  });

  assert.deepStrictEqual(result, {
    added_count: 1,
    removed_count: 0,
    current_count: 2
  });
  assert.strictEqual(conn.committed, true);
  assert.strictEqual(conn.rolledBack, false);
  assert.strictEqual(conn.released, true);
  assert.ok(conn.queries.some(([sql]) => String(sql).includes('INSERT INTO riders_favorites')));
  assert.ok(conn.queries.some(([sql]) => String(sql).includes("INSERT INTO admin_logs")));
}

async function runRollbackCase() {
  const conn = createConn({
    failOnQuery(sql) {
      return String(sql).includes('INSERT INTO riders_favorites');
    }
  });
  const pool = {
    async getConnection() {
      return conn;
    }
  };

  await assert.rejects(
    () => updateFavoritesTransaction({
      pool,
      userId: 'user-2',
      favoriteIds: ['rider-keep', 'rider-add'],
      createId: () => 'log-x'
    }),
    /boom/
  );

  assert.strictEqual(conn.committed, false);
  assert.strictEqual(conn.rolledBack, true);
  assert.strictEqual(conn.released, true);
}

(async () => {
  await runSuccessCase();
  await runRollbackCase();
  console.log('Favorites transaction tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
