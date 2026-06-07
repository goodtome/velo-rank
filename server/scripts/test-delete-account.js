/**
 * 测试 DELETE /api/v1/auth/account 账号注销接口
 */
const http = require('http');

const BASE = 'http://localhost:3000/api/v1';
const TEST_OPENID = 'test_delete_account_user';

function req(method, path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const r = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    r.end();
  });
}

function postReq(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = JSON.stringify(body);
    const r = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body2 = '';
      res.on('data', c => body2 += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body2) }); }
        catch { resolve({ status: res.statusCode, body: body2 }); }
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

function deleteReq(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const r = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    r.end();
  });
}

const mysql = require('mysql2/promise');

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost', port: 13306, user: 'root',
    password: 'mysql123456', database: 'jersey_db'
  });

  let passed = 0, failed = 0;

  function assert(name, cond) {
    if (cond) { console.log(`  ✅ ${name}`); passed++; }
    else { console.log(`  ❌ ${name}`); failed++; }
  }

  // --- 准备测试数据 ---
  console.log('\n📦 准备测试数据...');

  // 插入测试 token
  const testToken = 'test-delete-token-12345';
  await pool.query('DELETE FROM user_tokens WHERE openid = ?', [TEST_OPENID]);
  await pool.query('INSERT INTO user_tokens (token, openid, expires_at) VALUES (?, ?, ?)',
    [testToken, TEST_OPENID, new Date(Date.now() + 86400000)]);

  // 插入测试用户设置
  await pool.query('DELETE FROM users_settings WHERE user_id = ?', [TEST_OPENID]);
  await pool.query('INSERT INTO users_settings (user_id, openid) VALUES (?, ?)',
    [TEST_OPENID, TEST_OPENID]);

  // 插入测试收藏（需要有效 rider_id）
  const [riders] = await pool.query('SELECT id FROM riders LIMIT 1');
  if (riders.length > 0) {
    await pool.query('DELETE FROM riders_favorites WHERE user_id = ?', [TEST_OPENID]);
    await pool.query('INSERT INTO riders_favorites (id, user_id, rider_id) VALUES (UUID(), ?, ?)',
      [TEST_OPENID, riders[0].id]);
  }

  // 验证数据已插入
  const [tokensBefore] = await pool.query('SELECT COUNT(*) as cnt FROM user_tokens WHERE openid = ?', [TEST_OPENID]);
  assert('测试 token 已创建', tokensBefore[0].cnt >= 1);

  const [settingsBefore] = await pool.query('SELECT COUNT(*) as cnt FROM users_settings WHERE user_id = ?', [TEST_OPENID]);
  assert('测试用户设置已创建', settingsBefore[0].cnt === 1);

  const [favsBefore] = await pool.query('SELECT COUNT(*) as cnt FROM riders_favorites WHERE user_id = ?', [TEST_OPENID]);
  assert('测试收藏已创建', favsBefore[0].cnt >= 1);

  // --- 测试1: 无 token 调用 DELETE ---
  console.log('\n🔒 测试1: 无认证调用...');
  const r1 = await deleteReq('/auth/account', null);
  assert('无 token 返回 401', r1.status === 401);

  // --- 测试2: 正常注销 ---
  console.log('\n🗑️ 测试2: 正常注销账号...');
  const r2 = await deleteReq('/auth/account', testToken);
  assert('注销返回 200', r2.status === 200);
  assert('返回消息正确', r2.body.message && r2.body.message.includes('注销'));

  // --- 验证数据已删除 ---
  console.log('\n🔍 验证数据清除...');
  const [tokensAfter] = await pool.query('SELECT COUNT(*) as cnt FROM user_tokens WHERE openid = ?', [TEST_OPENID]);
  assert('token 已删除', tokensAfter[0].cnt === 0);

  const [settingsAfter] = await pool.query('SELECT COUNT(*) as cnt FROM users_settings WHERE user_id = ?', [TEST_OPENID]);
  assert('用户设置已删除', settingsAfter[0].cnt === 0);

  const [favsAfter] = await pool.query('SELECT COUNT(*) as cnt FROM riders_favorites WHERE user_id = ?', [TEST_OPENID]);
  assert('收藏已删除', favsAfter[0].cnt === 0);

  // --- 测试3: 注销后用同一 token 再调接口应失败 ---
  console.log('\n🔒 测试3: 注销后再调用...');
  const r3 = await deleteReq('/auth/account', testToken);
  assert('已注销 token 返回 401', r3.status === 401);

  // --- 汇总 ---
  console.log(`\n${'='.repeat(40)}`);
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
