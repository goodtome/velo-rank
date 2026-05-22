const mysql = require('mysql2/promise');
const crypto = require('crypto');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db'
  });

  // ===== 世界锦标赛 (4场) =====
  // 2026 UCI Road World Championships - Montreal, Sep 20-27
  const worlds = [
    { name:"UCI Road World Championships - Men Elite ITT", zh:'世锦赛男子个人计时赛', code:'worlds-2026-men-itt', s:'2026-09-20', e:'2026-09-20', st:null, country:'Canada', gender:'MEN' },
    { name:"UCI Road World Championships - Women Elite ITT", zh:'世锦赛女子个人计时赛', code:'worlds-2026-women-itt', s:'2026-09-21', e:'2026-09-21', st:null, country:'Canada', gender:'WOMEN' },
    { name:"UCI Road World Championships - Women Elite RR", zh:'世锦赛女子公路赛', code:'worlds-2026-women-rr', s:'2026-09-26', e:'2026-09-26', st:null, country:'Canada', gender:'WOMEN' },
    { name:"UCI Road World Championships - Men Elite RR", zh:'世锦赛男子公路赛', code:'worlds-2026-men-rr', s:'2026-09-27', e:'2026-09-27', st:null, country:'Canada', gender:'MEN' },
  ];

  // ===== 洲际赛 Continental (精选30场) =====
  // European Tour .1 level + Asian Tour + National Champs
  const continental = [
    // 欧洲重要 .1 级别单日赛
    { name:"Clasica de Almeria Men", zh:'阿尔梅里亚经典赛', code:'clasica-almeria-men-2026', s:'2026-02-15', e:'2026-02-15', st:null, country:'Spain', gender:'MEN' },
    { name:"Le Samyn", zh:'勒萨明赛', code:'le-samyn-2026', s:'2026-03-03', e:'2026-03-03', st:null, country:'Belgium', gender:'MEN' },
    { name:"Ronde van Drenthe", zh:'德伦特环赛', code:'ronde-van-drenthe-2026', s:'2026-03-15', e:'2026-03-15', st:null, country:'Netherlands', gender:'MEN' },
    { name:"Volta Limburg Classic", zh:'林堡环赛', code:'volta-limburg-2026', s:'2026-04-04', e:'2026-04-04', st:null, country:'Netherlands', gender:'MEN' },
    { name:"Paris-Camembert", zh:'巴黎-卡芒贝尔', code:'paris-camembert-2026', s:'2026-04-14', e:'2026-04-14', st:null, country:'France', gender:'MEN' },
    { name:"La Roue Tourangelle", zh:'图尔赛', code:'roue-tourangelle-2026', s:'2026-04-19', e:'2026-04-19', st:null, country:'France', gender:'MEN' },
    { name:"Tour du Finistere", zh:'菲尼斯泰尔环赛', code:'tour-finistere-2026', s:'2026-05-02', e:'2026-05-02', st:null, country:'France', gender:'MEN' },
    { name:"Boucles de l'Aulne", zh:'奥讷环赛', code:'boucles-aulne-2026', s:'2026-05-03', e:'2026-05-03', st:null, country:'France', gender:'MEN' },
    { name:"Grote Prijs Marcel Kint", zh:'马塞尔·金特大奖赛', code:'gp-marcel-kint-2026', s:'2026-05-24', e:'2026-05-24', st:null, country:'Belgium', gender:'MEN' },
    { name:"Elfstedenronde Brugge", zh:'布鲁日十一城赛', code:'elfstedenronde-2026', s:'2026-06-14', e:'2026-06-14', st:null, country:'Belgium', gender:'MEN' },
    { name:"Dwars door het Hageland", zh:'穿越哈赫兰', code:'dwars-hageland-2026', s:'2026-06-20', e:'2026-06-20', st:null, country:'Belgium', gender:'MEN' },
    { name:"Heistse Pijl", zh:'海斯特之箭', code:'heistse-pijl-2026', s:'2026-06-28', e:'2026-06-28', st:null, country:'Belgium', gender:'MEN' },
    // 欧洲重要多日赛
    { name:"Etoile de Besseges", zh:'贝塞日之星', code:'etoile-besseges-2026', s:'2026-02-04', e:'2026-02-08', st:5, country:'France', gender:'MEN' },
    { name:"Tour de la Provence", zh:'环普罗旺斯', code:'tour-provence-2026', s:'2026-02-13', e:'2026-02-16', st:4, country:'France', gender:'MEN' },
    { name:"Tour du Haut Var", zh:'环上瓦尔', code:'tour-haut-var-2026', s:'2026-02-21', e:'2026-02-22', st:2, country:'France', gender:'MEN' },
    { name:"Settimana Coppi e Bartali", zh:'科皮-巴塔利周赛', code:'coppi-bartali-2026', s:'2026-03-24', e:'2026-03-28', st:5, country:'Italy', gender:'MEN' },
    { name:"Tour of Austria", zh:'环奥地利', code:'tour-austria-2026', s:'2026-07-04', e:'2026-07-10', st:7, country:'Austria', gender:'MEN' },
    { name:"Sibiu Cycling Tour", zh:'锡比乌环赛', code:'sibiu-tour-2026', s:'2026-07-08', e:'2026-07-12', st:5, country:'Romania', gender:'MEN' },
    { name:"Tour de l'Ain", zh:'环安省', code:'tour-ain-2026', s:'2026-07-15', e:'2026-07-17', st:3, country:'France', gender:'MEN' },
    // 亚洲巡回赛
    { name:"Tour of Thailand", zh:'环泰国', code:'tour-thailand-2026', s:'2026-03-30', e:'2026-04-04', st:6, country:'Thailand', gender:'MEN' },
    { name:"Tour of Japan", zh:'环日本', code:'tour-japan-2026', s:'2026-05-17', e:'2026-05-24', st:8, country:'Japan', gender:'MEN' },
    { name:"Tour de Kumano", zh:'熊野环赛', code:'tour-kumano-2026', s:'2026-05-28', e:'2026-05-30', st:3, country:'Japan', gender:'MEN' },
    { name:"Tour of Korea", zh:'环韩国', code:'tour-korea-2026', s:'2026-06-07', e:'2026-06-14', st:8, country:'South Korea', gender:'MEN' },
    { name:"Tour of Taihu Lake", zh:'环太湖', code:'tour-taihu-2026', s:'2026-10-09', e:'2026-10-13', st:5, country:'China', gender:'MEN' },
    // 国家级锦标赛
    { name:"Chinese National Road Championships", zh:'中国公路锦标赛', code:'chinese-nationals-2026', s:'2026-06-25', e:'2026-06-28', st:null, country:'China', gender:'MEN' },
    { name:"Italian National Road Championships", zh:'意大利公路锦标赛', code:'italian-nationals-2026', s:'2026-06-25', e:'2026-06-28', st:null, country:'Italy', gender:'MEN' },
    { name:"French National Road Championships", zh:'法国公路锦标赛', code:'french-nationals-2026', s:'2026-06-25', e:'2026-06-28', st:null, country:'France', gender:'MEN' },
    { name:"Belgian National Road Championships", zh:'比利时公路锦标赛', code:'belgian-nationals-2026', s:'2026-06-28', e:'2026-06-28', st:null, country:'Belgium', gender:'MEN' },
    { name:"Spanish National Road Championships", zh:'西班牙公路锦标赛', code:'spanish-nationals-2026', s:'2026-06-28', e:'2026-06-28', st:null, country:'Spain', gender:'MEN' },
  ];

  const [existing] = await conn.query('SELECT race_code FROM races');
  const existingCodes = new Set(existing.map(r => r.race_code));

  let added = 0, skipped = 0;

  // 世锦赛
  for (const r of worlds) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'World Championships', '世锦赛', r.gender, 2026, r.country, r.s, r.e, r.st]
    );
    added++;
  }

  // 洲际赛
  for (const r of continental) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'Continental', '洲际赛', r.gender, 2026, r.country, r.s, r.e, r.st]
    );
    added++;
  }

  const [cnt] = await conn.query('SELECT COUNT(*) as cnt FROM races');
  console.log('Added:', added, '| Skipped:', skipped, '| Total:', cnt[0].cnt);

  const [byCat] = await conn.query('SELECT category, category_zh, gender, COUNT(*) as cnt FROM races GROUP BY category, category_zh, gender ORDER BY cnt DESC');
  console.log('\n=== 全部赛事分类 ===');
  byCat.forEach(r => console.log(r.category, '|', r.category_zh, '|', r.gender, ':', r.cnt));

  await conn.end();
})();
