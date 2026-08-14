const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { localDbConfig } = require('../../scripts/lib/db-config');

(async () => {
  const conn = await mysql.createConnection(localDbConfig());

  // 单日赛 1.Pro (16场) - 数据源: Wikipedia + tourdepolognewomen.pl 交叉验证
  const oneDay = [
    { name:"Women's Tour Down Under One Day Race", zh:'环澳赛单日赛(女子)', code:'tour-down-under-oneday-women-2026', date:'2026-01-21', country:'Australia' },
    { name:"Vuelta CV Feminas", zh:'瓦伦西亚社区女子环赛', code:'vuelta-cv-feminas-2026', date:'2026-02-08', country:'Spain' },
    { name:"Clasica de Almeria Women", zh:'阿尔梅里亚经典赛(女子)', code:'clasica-almeria-women-2026', date:'2026-02-22', country:'Spain' },
    { name:"Ixina GP Oetingen", zh:'奥廷根大奖赛(女子)', code:'ixina-oetingen-2026', date:'2026-03-11', country:'Belgium' },
    { name:"Nokere Koerse Women", zh:'诺克雷赛(女子)', code:'nokere-koerse-women-2026', date:'2026-03-18', country:'Belgium' },
    { name:"Scheldeprijs Women", zh:'斯海尔德大奖赛(女子)', code:'scheldeprijs-women-2026', date:'2026-04-08', country:'Belgium' },
    { name:"Brabantse Pijl Women", zh:'布拉班特之箭(女子)', code:'brabantse-pijl-women-2026', date:'2026-04-17', country:'Belgium' },
    { name:"Clasica Femenina Navarra", zh:'纳瓦拉女子经典赛', code:'clasica-navarra-women-2026', date:'2026-05-13', country:'Spain' },
    { name:"Antwerp Port Epic Ladies", zh:'安特卫普港史诗赛(女子)', code:'antwerp-port-epic-women-2026', date:'2026-05-24', country:'Belgium' },
    { name:"Women Cycling Day", zh:'女子自行车日赛', code:'women-cycling-day-2026', date:'2026-06-21', country:'Germany' },
    { name:"GP Lucien Van Impe Women", zh:'吕西安·范·因佩大奖赛(女子)', code:'gp-van-impe-women-2026', date:'2026-08-20', country:'Belgium' },
    { name:"Pointe du Raz Ladies Classic", zh:'拉兹角女子经典赛', code:'pointe-du-raz-2026', date:'2026-09-06', country:'France' },
    { name:"La Choralis Fourmies Feminine", zh:'富尔米女子赛', code:'choralis-fourmies-2026', date:'2026-09-13', country:'France' },
    { name:"Women's Cycling Grand Prix Stuttgart", zh:'斯图加特女子大奖赛', code:'gp-stuttgart-women-2026', date:'2026-09-13', country:'Germany' },
    { name:"Giro dell'Emilia Donne", zh:'艾米利亚环赛(女子)', code:'giro-emilia-women-2026', date:'2026-10-03', country:'Italy' },
    { name:"Tre Valli Varesine Women", zh:'瓦雷泽三谷赛(女子)', code:'tre-valli-varesine-women-2026', date:'2026-10-06', country:'Italy' },
  ];

  // 多日赛 2.Pro (3场)
  const stageRaces = [
    { name:"Setmana Ciclista Valenciana", zh:'瓦伦西亚自行车周(女子)', code:'setmana-valenciana-2026', s:'2026-02-12', e:'2026-02-15', st:4, country:'Spain' },
    { name:"Tour Feminin International des Pyrenees", zh:'比利牛斯女子国际环赛', code:'tour-pyrenees-women-2026', s:'2026-06-12', e:'2026-06-14', st:3, country:'France' },
    { name:"Tour de Pologne Women", zh:'环波兰(女子)', code:'tour-pologne-women-2026', s:'2026-07-24', e:'2026-07-26', st:3, country:'Poland' },
  ];

  const [existing] = await conn.query('SELECT race_code FROM races');
  const existingCodes = new Set(existing.map(r => r.race_code));

  let added = 0, skipped = 0;

  for (const r of oneDay) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'Women-ProSeries', '女子职业赛', 'WOMEN', 2026, r.country, r.date, r.date, null]
    );
    added++;
  }

  for (const r of stageRaces) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'Women-ProSeries', '女子职业赛', 'WOMEN', 2026, r.country, r.s, r.e, r.st]
    );
    added++;
  }

  const [cnt] = await conn.query('SELECT COUNT(*) as cnt FROM races');
  console.log('Women ProSeries added:', added, '| Skipped:', skipped, '| Total:', cnt[0].cnt);

  const [byCat] = await conn.query('SELECT category, category_zh, gender, COUNT(*) as cnt FROM races GROUP BY category, category_zh, gender ORDER BY cnt DESC');
  console.log('\n=== 全部赛事分类 ===');
  byCat.forEach(r => console.log(r.category, '|', r.category_zh, '|', r.gender, ':', r.cnt));

  await conn.end();
})();
