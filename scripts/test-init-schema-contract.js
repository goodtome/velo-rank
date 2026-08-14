const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const initDb = fs.readFileSync(path.join(ROOT, 'server/scripts/init-db.js'), 'utf8');

function tableDefinition(tableName) {
  const match = initDb.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\(([\\s\\S]*?)\\) ENGINE=InnoDB`, 'm'));
  assert(match, `${tableName} table definition not found`);
  return match[1];
}

function assertContains(definition, needle, message) {
  assert(
    definition.includes(needle),
    message || `Expected schema definition to contain: ${needle}`
  );
}

function testRacesSchemaMatchesRoutes() {
  const races = tableDefinition('races');

  assertContains(races, 'race_name_zh VARCHAR(200)', 'races.race_name_zh is used by routes and admin translation APIs');
  assertContains(races, 'category_zh VARCHAR(50)', 'races.category_zh is written by race create/update APIs');
  assertContains(races, 'INDEX idx_start_date (start_date)', 'GET /races uses USE INDEX(idx_start_date)');
}

function testSyncLogsExistsForRaceDeletion() {
  tableDefinition('sync_logs');
}

function testMountedFeatureTablesExist() {
  const usersSettings = tableDefinition('users_settings');
  assertContains(usersSettings, 'user_id VARCHAR(50) PRIMARY KEY', 'auth account deletion deletes from users_settings');

  const ridersFavorites = tableDefinition('riders_favorites');
  assertContains(ridersFavorites, 'user_id VARCHAR(50) NOT NULL', 'favorites routes filter by riders_favorites.user_id');
  assertContains(ridersFavorites, 'UNIQUE KEY unique_user_rider (user_id, rider_id)', 'favorites routes expect one favorite per user/rider');

  const adminLogs = tableDefinition('admin_logs');
  assertContains(adminLogs, 'action VARCHAR(100) NOT NULL', 'favorites routes write admin_logs.action');

  const pushSettings = tableDefinition('user_push_settings');
  assertContains(pushSettings, 'openid VARCHAR(128) NOT NULL', 'push routes read and write user_push_settings.openid');
  assertContains(pushSettings, 'UNIQUE KEY uk_openid (openid)', 'push settings use ON DUPLICATE KEY UPDATE by openid');

  const pushSubscriptions = tableDefinition('user_push_subscriptions');
  assertContains(pushSubscriptions, 'UNIQUE KEY uk_openid_template (openid, template_id)', 'push subscriptions use ON DUPLICATE KEY UPDATE by openid/template_id');

  const pushHistory = tableDefinition('push_history');
  assertContains(pushHistory, 'error_msg TEXT', 'push routes record send errors in push_history.error_msg');
}

function testStagesSchemaMatchesAdminTranslationRoutes() {
  const stages = tableDefinition('stages');

  assertContains(stages, 'stage_name_zh VARCHAR(200)', 'stages.stage_name_zh is used by admin translation APIs');
}

testRacesSchemaMatchesRoutes();
testStagesSchemaMatchesAdminTranslationRoutes();
testSyncLogsExistsForRaceDeletion();
testMountedFeatureTablesExist();
console.log('Init schema contract tests passed.');
