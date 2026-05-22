const mysql = require('mysql2/promise');
const crypto = require('crypto');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db'
  });

  // 单日赛 (16场) - 数据源: UCI官方 + domestiquecycling交叉验证
  const oneDay = [
    { name:"Cadel Evans Great Ocean Road Race - Women", zh:'卡德尔·埃文斯大洋路赛(女子)', code:'cadel-evans-women-2026', date:'2026-01-31', country:'Australia' },
    { name:"Omloop Nieuwsblad Women", zh:'新闻报环赛(女子)', code:'omloop-women-2026', date:'2026-02-28', country:'Belgium' },
    { name:"Strade Bianche Donne", zh:'白路赛(女子)', code:'strade-bianche-women-2026', date:'2026-03-07', country:'Italy' },
    { name:"Trofeo Alfredo Binda", zh:'阿尔弗雷多·宾达奖杯赛', code:'trofeo-binda-2026', date:'2026-03-15', country:'Italy' },
    { name:"Milano-Sanremo Donne", zh:'米兰-圣雷莫(女子)', code:'milano-sanremo-women-2026', date:'2026-03-21', country:'Italy' },
    { name:"Ronde van Brugge Women", zh:'布鲁日环赛(女子)', code:'ronde-brugge-women-2026', date:'2026-03-26', country:'Belgium' },
    { name:"Gent-Wevelgem Women", zh:'根特-韦弗尔海姆(女子)', code:'gent-wevelgem-women-2026', date:'2026-03-29', country:'Belgium' },
    { name:"Dwars door Vlaanderen Women", zh:'穿越法兰德斯(女子)', code:'dwars-vlaanderen-women-2026', date:'2026-04-01', country:'Belgium' },
    { name:"Ronde van Vlaanderen Women", zh:'环法兰德斯(女子)', code:'ronde-vlaanderen-women-2026', date:'2026-04-05', country:'Belgium' },
    { name:"Paris-Roubaix Femmes", zh:'巴黎-鲁贝(女子)', code:'paris-roubaix-women-2026', date:'2026-04-12', country:'France' },
    { name:"Amstel Gold Race Ladies Edition", zh:'阿姆斯特尔黄金赛(女子)', code:'amstel-gold-women-2026', date:'2026-04-19', country:'Netherlands' },
    { name:"La Fleche Wallonne Femmes", zh:'瓦隆之箭(女子)', code:'fleche-wallonne-women-2026', date:'2026-04-22', country:'Belgium' },
    { name:"Liege-Bastogne-Liege Femmes", zh:'列日-巴斯通-列日(女子)', code:'liege-bastogne-women-2026', date:'2026-04-26', country:'Belgium' },
    { name:"Copenhagen Sprint Women", zh:'哥本哈根冲刺赛(女子)', code:'copenhagen-sprint-women-2026', date:'2026-06-13', country:'Denmark' },
    { name:"Classic Lorient Agglomeration", zh:'洛里昂经典赛(女子)', code:'classic-lorient-women-2026', date:'2026-08-29', country:'France' },
    { name:"Tour of Guangxi Women", zh:'环广西(女子)', code:'tour-guangxi-women-2026', date:'2026-10-18', country:'China' },
  ];

  // 多日赛 (11场)
  const stageRaces = [
    { name:"Santos Tour Down Under Women", zh:'环澳赛(女子)', code:'tour-down-under-women-2026', s:'2026-01-17', e:'2026-01-19', st:3, country:'Australia' },
    { name:"UAE Tour Women", zh:'环阿联酋(女子)', code:'uae-tour-women-2026', s:'2026-02-05', e:'2026-02-08', st:4, country:'United Arab Emirates' },
    { name:"La Vuelta Femenina", zh:'环西女子赛', code:'vuelta-femenina-2026', s:'2026-05-03', e:'2026-05-10', st:8, country:'Spain' },
    { name:"Itzulia Women", zh:'环巴斯克(女子)', code:'itzulia-women-2026', s:'2026-05-15', e:'2026-05-17', st:3, country:'Spain' },
    { name:"Vuelta a Burgos Feminas", zh:'环布尔戈斯(女子)', code:'vuelta-burgos-women-2026', s:'2026-05-21', e:'2026-05-24', st:4, country:'Spain' },
    { name:"Giro d'Italia Women", zh:'环意女子赛', code:'giro-women-2026', s:'2026-05-30', e:'2026-06-07', st:9, country:'Italy' },
    { name:"Tour de Suisse Women", zh:'环瑞士(女子)', code:'tour-suisse-women-2026', s:'2026-06-17', e:'2026-06-21', st:5, country:'Switzerland' },
    { name:"Tour de France Femmes", zh:'环法女子赛', code:'tdf-women-2026', s:'2026-08-01', e:'2026-08-09', st:9, country:'France' },
    { name:"Tour of Britain Women", zh:'环英国(女子)', code:'tour-britain-women-2026', s:'2026-08-19', e:'2026-08-23', st:5, country:'United Kingdom' },
    { name:"Tour de Romandie Feminin", zh:'环罗曼蒂(女子)', code:'tour-romandie-women-2026', s:'2026-09-04', e:'2026-09-06', st:3, country:'Switzerland' },
    { name:"Tour of Chongming Island", zh:'环崇明岛(女子)', code:'tour-chongming-2026', s:'2026-10-13', e:'2026-10-15', st:3, country:'China' },
  ];

  const [existing] = await conn.query('SELECT race_code FROM races');
  const existingCodes = new Set(existing.map(r => r.race_code));

  let added = 0, skipped = 0;

  for (const r of oneDay) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'Women-WorldTour', '女子世巡赛', 'WOMEN', 2026, r.country, r.date, r.date, null]
    );
    added++;
  }

  for (const r of stageRaces) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'Women-WorldTour', '女子世巡赛', 'WOMEN', 2026, r.country, r.s, r.e, r.st]
    );
    added++;
  }

  const [cnt] = await conn.query('SELECT COUNT(*) as cnt FROM races');
  console.log('Women WWT added:', added, '| Skipped:', skipped, '| Total:', cnt[0].cnt);

  // 分类统计
  const [byCat] = await conn.query('SELECT category, category_zh, gender, COUNT(*) as cnt FROM races GROUP BY category, category_zh, gender ORDER BY cnt DESC');
  console.log('\n=== 全部赛事分类 ===');
  byCat.forEach(r => console.log(r.category, '|', r.category_zh, '|', r.gender, ':', r.cnt));

  await conn.end();
})();
