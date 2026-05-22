/**
 * 数据同步脚本 v2：本地 MySQL → TiDB Cloud
 * 
 * 按 TiDB 实际列结构同步，自动跳过本地独有的列
 * 同步顺序：teams → riders → stages → stage_results
 *   → points → mountains → youth
 */

const mysql = require('mysql2/promise');

const LOCAL = {
  host: '127.0.0.1', port: 13306,
  user: 'root', password: 'mysql123456', database: 'jersey_db'
};

const TIDB = {
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc',
  database: 'jersey_db', ssl: { rejectUnauthorized: true }
};

// TiDB 实际列结构（与本地差异已排除）
const TABLES = {
  teams: ['id', 'uci_code', 'team_name', 'team_name_zh', 'team_name_en',
          'team_slug', 'category', 'country', 'logo_url', 'bike_brand', 'created_at'],
  riders: ['id', 'uci_id', 'rider_name', 'rider_name_zh',
           'nationality', 'birth_date', 'height_cm', 'weight_kg',
           'is_retired', 'photo_url', 'created_at', 'updated_at'],
  stages: ['id', 'race_id', 'stage_number', 'stage_name',
           'stage_type', 'date', 'distance_km', 'elevation_m',
           'start_city', 'finish_city', 'stage_code', 'created_at', 'updated_at'],
  stage_results: ['id', 'stage_id', 'rank_pos', 'rider_id', 'team_id',
                  'nationality', 'time_gap', 'is_same_time',
                  'sprint_points', 'mountain_points', 'youth_eligible',
                  'jersey_earned', 'created_at'],
  points_classification: ['id', 'stage_id', 'rider_id', 'rank', 'points',
                           'jersey_type', 'created_at', 'updated_at'],
  mountains_classification: ['id', 'stage_id', 'rider_id', 'rank', 'points',
                              'jersey_type', 'created_at', 'updated_at'],
  youth_classification: ['id', 'stage_id', 'rider_id', 'rank', 'time',
                          'time_gap', 'jersey_type', 'created_at', 'updated_at'],
};

const SYNC_ORDER = ['teams', 'riders', 'stages', 'stage_results',
  'points_classification', 'mountains_classification', 'youth_classification'];

async function getCount(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) as c FROM \`${table}\``);
  return rows[0].c;
}

async function syncTable(local, tidb, table) {
  const columns = TABLES[table];
  const colStr = columns.map(c => `\`${c}\``).join(',');
  const holders = columns.map(() => '?').join(',');

  const [rows] = await local.query(`SELECT ${colStr} FROM \`${table}\``);
  const total = rows.length;
  if (total === 0) return { table, total: 0, imported: 0 };

  const sql = `INSERT IGNORE INTO \`${table}\` (${colStr}) VALUES (${holders})`;
  let imported = 0, errors = 0;

  for (const row of rows) {
    const values = columns.map(c => row[c]);
    try {
      await tidb.query(sql, values);
      imported++;
    } catch (e) {
      if (errors < 3) console.error(`  ${table} ERROR:`, e.message.substring(0, 120));
      errors++;
    }
  }

  console.log(`  ${table}: ${total} rows → ${imported} imported` + (errors ? ` (${errors} errors)` : ''));
  return { table, total, imported, errors };
}

async function main() {
  console.log('=== 数据同步 v2 ===\n');

  const local = await mysql.createConnection(LOCAL);
  const tidb = await mysql.createConnection(TIDB);
  console.log('双端连接成功\n');

  // 同步前
  console.log('同步前 TiDB 记录数:');
  const before = {};
  for (const t of SYNC_ORDER) {
    before[t] = await getCount(tidb, t);
    console.log(`  ${t}: ${before[t]}`);
  }

  // 同步
  console.log('\n开始同步...');
  for (let i = 0; i < SYNC_ORDER.length; i++) {
    console.log(`${i + 1}/${SYNC_ORDER.length} ${SYNC_ORDER[i]}...`);
    await syncTable(local, tidb, SYNC_ORDER[i]);
  }

  // 验证
  console.log('\n=== 验证 ===');
  let totalRows = 0;
  for (const t of SYNC_ORDER) {
    const count = await getCount(tidb, t);
    const diff = count - before[t];
    totalRows += count;
    const icon = diff > 0 ? '✅' : (count > 0 ? '✅' : '⚠️');
    console.log(`${icon} ${t}: ${before[t]} → ${count} (+${diff})`);
  }

  console.log(`\nTiDB 总记录: ${totalRows}`);
  await local.end();
  await tidb.end();
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
