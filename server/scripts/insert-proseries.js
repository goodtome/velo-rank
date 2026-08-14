const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { localDbConfig } = require('../../scripts/lib/db-config');

(async () => {
  const conn = await mysql.createConnection(localDbConfig());

  const oneDay = [
    { name:'Muscat Classic', zh:'马斯喀特经典赛', code:'muscat-classic-2026', date:'2026-02-06', country:'Oman' },
    { name:'Figueira Champions Classic', zh:'菲盖拉冠军经典赛', code:'figueira-2026', date:'2026-02-14', country:'Portugal' },
    { name:'Clasica de Almeria', zh:'阿尔梅里亚经典赛', code:'clasica-almeria-2026', date:'2026-02-15', country:'Spain' },
    { name:'Faun-Ardeche Classic', zh:'阿尔代什经典赛', code:'faun-ardeche-2026', date:'2026-02-28', country:'France' },
    { name:'Faun Drome Classic', zh:'德龙经典赛', code:'faun-drome-2026', date:'2026-03-01', country:'France' },
    { name:'Kuurne - Brussel - Kuurne', zh:'屈尔内-布鲁塞尔-屈尔内', code:'kuurne-brussel-2026', date:'2026-03-01', country:'Belgium' },
    { name:'Trofeo Laigueglia', zh:'拉伊圭利亚奖杯赛', code:'trofeo-laigueglia-2026', date:'2026-03-04', country:'Italy' },
    { name:'Danilith Nokere Koerse', zh:'诺克雷赛', code:'nokere-koerse-2026', date:'2026-03-18', country:'Belgium' },
    { name:'Milano - Torino', zh:'米兰-都灵', code:'milano-torino-2026', date:'2026-03-18', country:'Italy' },
    { name:'Grand Prix de Denain', zh:'德南大奖赛', code:'gp-denain-2026', date:'2026-03-19', country:'France' },
    { name:'Bredene Koksijde Classic', zh:'布雷达讷-科克赛德经典赛', code:'bredene-2026', date:'2026-03-20', country:'Belgium' },
    { name:'Gran Premio Miguel Indurain', zh:'米格尔·因杜拉因大奖赛', code:'gp-indurain-2026', date:'2026-04-04', country:'Spain' },
    { name:'Scheldeprijs', zh:'斯海尔德大奖赛', code:'scheldeprijs-2026', date:'2026-04-08', country:'Belgium' },
    { name:'De Brabantse Pijl', zh:'布拉班特之箭', code:'brabantse-pijl-2026', date:'2026-04-17', country:'Belgium' },
    { name:'Grand Prix du Morbihan', zh:'莫尔比昂大奖赛', code:'gp-morbihan-2026', date:'2026-05-09', country:'France' },
    { name:'Tro-Bro Leon', zh:'特罗-布罗莱昂', code:'tro-bro-leon-2026', date:'2026-05-10', country:'France' },
    { name:'Classique Dunkerque', zh:'敦刻尔克经典赛', code:'classique-dunkerque-2026', date:'2026-05-19', country:'France' },
    { name:'Brussels Cycling Classic', zh:'布鲁塞尔经典赛', code:'brussels-classic-2026', date:'2026-06-07', country:'Belgium' },
    { name:'Circuit Franco-Belge', zh:'法国-比利时环赛', code:'circuit-franco-belge-2026', date:'2026-06-10', country:'Belgium' },
    { name:'Maryland Cycling Classic', zh:'马里兰经典赛', code:'maryland-2026', date:'2026-09-05', country:'United States' },
    { name:'GP Industria & Artigianato', zh:'工业与手工艺大奖赛', code:'gp-industria-2026', date:'2026-09-06', country:'Italy' },
    { name:'Coppa Sabatini', zh:'萨巴蒂尼杯', code:'coppa-sabatini-2026', date:'2026-09-10', country:'Italy' },
    { name:'GP de Fourmies', zh:'福尔米大奖赛', code:'gp-fourmies-2026', date:'2026-09-13', country:'France' },
    { name:'Lotto Grand Prix de Wallonie', zh:'瓦隆大奖赛', code:'gp-wallonie-2026', date:'2026-09-16', country:'Belgium' },
    { name:'Flandrien 0.0 Classic', zh:'弗兰德人经典赛', code:'flandrien-2026', date:'2026-09-19', country:'Belgium' },
    { name:"Giro dell'Emilia", zh:'艾米利亚环赛', code:'giro-emilia-2026', date:'2026-10-03', country:'Italy' },
    { name:'Sparkassen Muensterland Giro', zh:'明斯特兰环赛', code:'munsterland-2026', date:'2026-10-03', country:'Germany' },
    { name:'Coppa Bernocchi', zh:'贝尔诺基杯', code:'coppa-bernocchi-2026', date:'2026-10-05', country:'Italy' },
    { name:'Tre Valli Varesine', zh:'瓦雷泽三谷赛', code:'tre-valli-varesine-2026', date:'2026-10-06', country:'Italy' },
    { name:'Gran Piemonte', zh:'皮埃蒙特大奖赛', code:'gran-piemonte-2026', date:'2026-10-08', country:'Italy' },
    { name:'Paris - Tours Elite', zh:'巴黎-图尔', code:'paris-tours-2026', date:'2026-10-11', country:'France' },
    { name:'Giro del Veneto', zh:'威尼托环赛', code:'giro-veneto-2026', date:'2026-10-14', country:'Italy' },
    { name:'Veneto Classic', zh:'威尼托经典赛', code:'veneto-classic-2026', date:'2026-10-18', country:'Italy' },
    { name:'Japan Cup', zh:'日本杯', code:'japan-cup-2026', date:'2026-10-18', country:'Japan' },
  ];

  const stageRaces = [
    { name:'AlUla Tour', zh:'埃尔奥拉环赛', code:'alula-tour-2026', s:'2026-01-27', e:'2026-01-31', st:5, country:'Saudi Arabia' },
    { name:'Volta Comunitat Valenciana', zh:'环瓦伦西亚', code:'volta-valenciana-2026', s:'2026-02-04', e:'2026-02-08', st:5, country:'Spain' },
    { name:'Tour of Oman', zh:'环阿曼', code:'tour-oman-2026', s:'2026-02-07', e:'2026-02-11', st:5, country:'Oman' },
    { name:'Vuelta a Andalucia', zh:'环安达卢西亚', code:'vuelta-andalucia-2026', s:'2026-02-18', e:'2026-02-22', st:5, country:'Spain' },
    { name:'Volta ao Algarve', zh:'环阿尔加维', code:'volta-algarve-2026', s:'2026-02-18', e:'2026-02-22', st:5, country:'Portugal' },
    { name:'Region Pays de la Loire Tour', zh:'卢瓦尔河地区环赛', code:'pays-loire-2026', s:'2026-04-07', e:'2026-04-11', st:5, country:'France' },
    { name:'Tour of Hainan', zh:'环海南', code:'tour-hainan-2026', s:'2026-04-15', e:'2026-04-20', st:6, country:'China' },
    { name:'Tour of the Alps', zh:'环阿尔卑斯', code:'tour-alps-2026', s:'2026-04-20', e:'2026-04-24', st:5, country:'Italy' },
    { name:'Presidential Tour of Turkiye', zh:'环土耳其', code:'tour-turkiye-2026', s:'2026-04-26', e:'2026-05-03', st:8, country:'Turkey' },
    { name:'Tour de Hongrie', zh:'环匈牙利', code:'tour-hongrie-2026', s:'2026-05-13', e:'2026-05-17', st:5, country:'Hungary' },
    { name:'4 Jours de Dunkerque', zh:'敦刻尔克四日赛', code:'dunkerque-2026', s:'2026-05-19', e:'2026-05-24', st:6, country:'France' },
    { name:'Boucles de la Mayenne', zh:'马耶讷环赛', code:'boucles-mayenne-2026', s:'2026-05-28', e:'2026-05-31', st:4, country:'France' },
    { name:'Tour of Norway', zh:'环挪威', code:'tour-norway-2026', s:'2026-05-28', e:'2026-05-31', st:4, country:'Norway' },
    { name:'Ethias-Tour de Wallonie', zh:'环瓦隆', code:'tour-wallonie-2026', s:'2026-06-01', e:'2026-06-05', st:5, country:'Belgium' },
    { name:'Tour of Slovenia', zh:'环斯洛文尼亚', code:'tour-slovenia-2026', s:'2026-06-17', e:'2026-06-21', st:5, country:'Slovenia' },
    { name:'Baloise Belgium Tour', zh:'环比利时', code:'belgium-tour-2026', s:'2026-06-17', e:'2026-06-21', st:5, country:'Belgium' },
    { name:'Tour of Qinghai Lake', zh:'环青海湖', code:'tour-qinghai-2026', s:'2026-07-11', e:'2026-07-20', st:10, country:'China' },
    { name:'PostNord Tour of Denmark', zh:'环丹麦', code:'tour-denmark-2026', s:'2026-07-29', e:'2026-08-02', st:5, country:'Denmark' },
    { name:'Vuelta a Burgos', zh:'环布尔戈斯', code:'vuelta-burgos-2026', s:'2026-08-04', e:'2026-08-08', st:5, country:'Spain' },
    { name:'Arctic Race of Norway', zh:'挪威北极赛', code:'arctic-norway-2026', s:'2026-08-13', e:'2026-08-16', st:4, country:'Norway' },
    { name:'Czech Tour', zh:'环捷克', code:'czech-tour-2026', s:'2026-08-13', e:'2026-08-16', st:4, country:'Czech Republic' },
    { name:'Lidl Deutschland Tour', zh:'环德国', code:'deutschland-tour-2026', s:'2026-08-19', e:'2026-08-23', st:5, country:'Germany' },
    { name:'Tour of Britain', zh:'环英国', code:'tour-britain-2026', s:'2026-09-02', e:'2026-09-09', st:8, country:'United Kingdom' },
    { name:'Skoda Tour de Luxembourg', zh:'环卢森堡', code:'tour-luxembourg-2026', s:'2026-09-16', e:'2026-09-20', st:5, country:'Luxembourg' },
    { name:'CRO Race', zh:'克罗地亚环赛', code:'cro-race-2026', s:'2026-09-22', e:'2026-09-27', st:6, country:'Croatia' },
    { name:'Tour de Langkawi', zh:'环兰卡威', code:'tour-langkawi-2026', s:'2026-09-27', e:'2026-10-04', st:8, country:'Malaysia' },
  ];

  const [existing] = await conn.query('SELECT race_code FROM races');
  const existingCodes = new Set(existing.map(r => r.race_code));

  let added = 0, skipped = 0;

  for (const r of oneDay) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'ProSeries', '职业赛', 'MEN', 2026, r.country, r.date, r.date, null]
    );
    added++;
  }

  for (const r of stageRaces) {
    if (existingCodes.has(r.code)) { skipped++; continue; }
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code, category, category_zh, gender, season, country, start_date, end_date, total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, r.name, r.name, r.zh, r.code, 'ProSeries', '职业赛', 'MEN', 2026, r.country, r.s, r.e, r.st]
    );
    added++;
  }

  const [cnt] = await conn.query('SELECT COUNT(*) as cnt FROM races');
  console.log('ProSeries added:', added, '| Skipped:', skipped, '| Total:', cnt[0].cnt);
  await conn.end();
})();
