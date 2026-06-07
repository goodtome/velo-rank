const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  // Find which stages have the non-+ time_gap values
  const [rows] = await c.query(
    `SELECT s.stage_number, sr.time_gap, r.rider_name, sr.rank_pos
     FROM stage_results sr 
     JOIN stages s ON sr.stage_id = s.id
     JOIN races rc ON s.race_id = rc.id
     JOIN riders r ON sr.rider_id = r.id
     WHERE rc.race_code = 'giro-ditalia-2026'
       AND sr.time_gap IS NOT NULL AND sr.time_gap != ''
       AND sr.time_gap NOT LIKE '+%'
       AND sr.time_gap NOT IN ('DNF','DNS','OTL','DSQ','s.t.')
     ORDER BY s.stage_number, sr.rank_pos`
  );

  console.log(`非 + 前缀的 time_gap 值 (${rows.length} 条):`);
  rows.forEach(r => console.log(`  S${String(r.stage_number).padStart(2,'0')} #${r.rank_pos} ${r.rider_name}: "${r.time_gap}"`));

  await c.end();
})();
