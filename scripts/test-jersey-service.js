const assert = require('assert');
const { getJerseysForStage, getJerseysForStages } = require('../server/services/jerseyService');

function createPool() {
  return {
    async query(sql) {
      if (sql.includes('FROM jerseys')) {
        return [[
          {
            stage_id: 'stage-1',
            jersey_type: 'pink',
            rider_id: 'rider-1',
            team_id: 'team-1',
            rider_name: 'GC Rider',
            rider_name_zh: '总成绩车手',
            nationality: 'ITA',
            photo_url: 'gc.png',
            team_name: 'Team GC',
            team_name_zh: '总成绩车队',
            uci_code: 'TGC'
          },
          {
            stage_id: 'stage-1',
            jersey_type: 'POLKA_DOT',
            rider_id: 'rider-2',
            team_id: 'team-2',
            rider_name: 'KOM Rider',
            rider_name_zh: '爬坡车手',
            nationality: 'FRA',
            photo_url: 'kom.png',
            team_name: 'Team KOM',
            team_name_zh: '爬坡车队',
            uci_code: 'TKO'
          }
        ]];
      }

      if (sql.includes('FROM general_classification')) {
        return [[{ stage_id: 'stage-1', rider_id: 'rider-1', time_gap: '0:00' }]];
      }

      if (sql.includes('FROM points_classification')) {
        return [[{ stage_id: 'stage-1', rider_id: 'rider-3', points: 42 }]];
      }

      if (sql.includes('FROM mountains_classification')) {
        return [[{ stage_id: 'stage-1', rider_id: 'rider-2', points: 18 }]];
      }

      if (sql.includes('FROM youth_classification')) {
        return [[{ stage_id: 'stage-1', rider_id: 'rider-4', time_gap: '+0:10' }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

(async () => {
  const pool = createPool();
  const jerseys = await getJerseysForStage(pool, 'stage-1');

  assert.strictEqual(jerseys.length, 2);
  assert.strictEqual(jerseys[0].time_gap, '0:00');
  assert.strictEqual(jerseys[0].points, null);
  assert.strictEqual(jerseys[1].time_gap, null);
  assert.strictEqual(jerseys[1].points, 18);

  const grouped = await getJerseysForStages(pool, ['stage-1']);
  assert.strictEqual(grouped.get('stage-1').length, 2);

  console.log('Jersey service tests passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
