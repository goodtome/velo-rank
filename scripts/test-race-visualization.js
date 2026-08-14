const assert = require('assert');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'miniprogram/pages/race-detail/race-detail.js');
let pageConfig = null;

global.Page = config => { pageConfig = config; };
global.getApp = () => ({ globalData: {} });
global.wx = {};
delete require.cache[pagePath];
require(pagePath);

assert(pageConfig, 'race detail page should register its page configuration');

const visualization = pageConfig.buildVisualization.call(pageConfig, [
  { id: 'stage-1', stage_number: 1, stage_name: 'Opening', stage_type: 'flat', distance_km: 180, date: '2026-06-01' },
  { id: 'stage-2', stage_number: 2, stage_name: 'TT', stage_type: 'ITT', distance_km: 32, date: '2026-06-02' },
  { id: 'stage-3', stage_number: 3, stage_name: 'Mountain', stage_type: 'mountain', distance_km: 210, date: '2026-06-04' }
], {
  start_date: '2026-06-01',
  end_date: '2026-06-04',
  total_distance: 422
});

assert.strictEqual(visualization.totalStages, 3);
assert.strictEqual(visualization.restDays, 1);
assert.strictEqual(visualization.distanceBars[1].markerText, '计时');
assert.strictEqual(visualization.distanceBars[2].markerText, '最长 · 山地');
assert.strictEqual(visualization.distanceBars[2].isKeyStage, true);
assert.strictEqual(visualization.timelineItems[2].isRestDay, true);

console.log('Race visualization tests passed.');
