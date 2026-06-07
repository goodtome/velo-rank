const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});

  console.log('🏁 points_classification 最终验证');
  console.log('='.repeat(60));

  // 1. Per-stage counts
  console.log('\n📊 各赛段积分数据:');
  const [perStage] = await c.query(
    `SELECT s.stage_number, COUNT(pc.rider_id) as cnt 
     FROM stages s LEFT JOIN points_classification pc ON s.id = pc.stage_id
     WHERE s.race_id = (SELECT id FROM races WHERE race_code = 'giro-ditalia-2026')
     GROUP BY s.stage_number ORDER BY s.stage_number`
  );
  let allHaveData = true;
  perStage.forEach(r => {
    const ok = r.cnt > 0;
    if (!ok) allHaveData = false;
    console.log(`  S${String(r.stage_number).padStart(2,'0')}: ${r.cnt} 条 ${ok ? '' : '⚠️ 缺失!'}`);
  });

  // 2. Total
  const [total] = await c.query('SELECT COUNT(*) as cnt FROM points_classification');
  console.log(`\n  总计: ${total[0].cnt} 条`);

  // 3. Purple jersey per stage
  console.log('\n🟣 紫衫得主:');
  const [jerseys] = await c.query(
    `SELECT s.stage_number, r.rider_name, pc.points
     FROM jerseys j 
     JOIN stages s ON j.stage_id = s.id 
     JOIN riders r ON j.rider_id = r.id
     LEFT JOIN points_classification pc ON pc.stage_id = j.stage_id AND pc.rider_id = j.rider_id
     WHERE j.jersey_type = 'PURPLE'
       AND s.race_id = (SELECT id FROM races WHERE race_code = 'giro-ditalia-2026')
     ORDER BY s.stage_number`
  );
  jerseys.forEach(j => console.log(`  S${String(j.stage_number).padStart(2,'0')}: ${j.rider_name} (${j.points || '?'} pt)`));

  // 4. Final points standings (S21)
  console.log('\n🏆 最终冲刺积分 Top 10 (S21):');
  const [finalTop] = await c.query(
    `SELECT pc.\`rank\`, r.rider_name, t.team_name, pc.points
     FROM points_classification pc
     JOIN riders r ON pc.rider_id = r.id
     JOIN stage_results sr ON sr.stage_id = pc.stage_id AND sr.rider_id = r.id
     JOIN teams t ON sr.team_id = t.id
     JOIN stages s ON pc.stage_id = s.id
     JOIN races rc ON s.race_id = rc.id
     WHERE rc.race_code = 'giro-ditalia-2026' AND s.stage_number = 21
     ORDER BY pc.\`rank\` LIMIT 10`
  );
  finalTop.forEach(r => console.log(`  ${r.rank}. ${r.rider_name} (${r.team_name}) - ${r.points} pt`));

  // 5. Overall DB summary
  console.log('\n📊 全库汇总:');
  const tables = ['races','stages','riders','teams','stage_results','general_classification','points_classification','mountains_classification','youth_classification','team_classification','jerseys'];
  for (const t of tables) {
    const [r] = await c.query('SELECT COUNT(*) as cnt FROM ' + t);
    console.log(`  ${t}: ${r[0].cnt}`);
  }

  if (allHaveData) console.log('\n🎉 所有 21 个赛段均有积分数据！');
  else console.log('\n⚠️ 仍有赛段缺少积分数据');

  await c.end();
})();
