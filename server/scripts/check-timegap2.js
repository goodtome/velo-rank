const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  // Check correct format (with + prefix)
  console.log('=== stage_results.time_gap 正确格式 (sample) ===');
  const [good] = await c.query(
    "SELECT time_gap as val, COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '+%' GROUP BY time_gap ORDER BY cnt DESC LIMIT 10"
  );
  good.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

  // Check * prefix patterns in detail
  console.log('\n=== stage_results.time_gap 所有 * 前缀值 ===');
  const [star] = await c.query(
    "SELECT time_gap as val, COUNT(*) as cnt FROM stage_results WHERE time_gap LIKE '*%' GROUP BY time_gap ORDER BY cnt DESC LIMIT 30"
  );
  star.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

  // Check general_classification.time_gap correct format
  console.log('\n=== general_classification.time_gap 正确格式 (sample) ===');
  const [gcGood] = await c.query(
    "SELECT time_gap as val, COUNT(*) as cnt FROM general_classification WHERE time_gap LIKE '+%' GROUP BY time_gap ORDER BY cnt DESC LIMIT 10"
  );
  gcGood.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

  // Check general_classification.time_gap all patterns
  console.log('\n=== general_classification.time_gap 所有非空/非+值 ===');
  const [gcOther] = await c.query(
    "SELECT time_gap as val, COUNT(*) as cnt FROM general_classification WHERE time_gap IS NOT NULL AND time_gap != '' AND time_gap NOT LIKE '+%' AND time_gap NOT LIKE ',,%' GROUP BY time_gap ORDER BY cnt DESC LIMIT 10"
  );
  gcOther.forEach(r => console.log(`  "${r.val}" x${r.cnt}`));

  // Stage 19-20 time_gap check (imported from JSON, different format)
  console.log('\n=== Stage 19 time_gap patterns ===');
  const [s19] = await c.query(
    `SELECT sr.time_gap, COUNT(*) as cnt FROM stage_results sr 
     JOIN stages s ON sr.stage_id = s.id 
     WHERE s.stage_number = 19 AND s.race_id = (SELECT id FROM races WHERE race_code = 'giro-ditalia-2026')
     GROUP BY sr.time_gap ORDER BY cnt DESC LIMIT 10`
  );
  s19.forEach(r => console.log(`  "${r.time_gap}" x${r.cnt}`));

  await c.end();
})();
