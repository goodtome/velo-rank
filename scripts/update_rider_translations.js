require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', 'config', '.env') });

const mysql = require('mysql2/promise');

const FULL_NAME_OVERRIDES = new Map(Object.entries({
  'Tadej Pogacar': '塔代伊·波加查',
  'Tadej Pogačar': '塔代伊·波加查',
  'Jonas Vingegaard': '乔纳斯·温格高',
  'Remco Evenepoel': '雷姆科·埃费内普尔',
  'Mathieu van der Poel': '马修·范德普尔',
  'Wout van Aert': '沃特·范阿尔特',
  'Primoz Roglic': '普里莫日·罗格利奇',
  'Primož Roglič': '普里莫日·罗格利奇',
  'Jasper Philipsen': '贾斯珀·菲利普森',
  'Biniam Girmay': '比尼亚姆·吉尔迈',
  'Julian Alaphilippe': '朱利安·阿拉菲利普',
  'Julien Alaphilippe': '朱利安·阿拉菲利普',
  'Richard Carapaz': '理查德·卡拉帕斯',
  'Nairo Quintana': '奈罗·金塔纳',
  'Sepp Kuss': '塞普·库斯',
  'Mads Pedersen': '马兹·彼得森',
  'Tom Pidcock': '汤姆·皮德科克',
  'Juan Ayuso': '胡安·阿尤索',
  'Joao Almeida': '若昂·阿尔梅达',
  'João Almeida': '若昂·阿尔梅达',
  'Carlos Rodriguez': '卡洛斯·罗德里格斯',
  'Carlos Rodríguez': '卡洛斯·罗德里格斯',
  'Enric Mas': '恩里克·马斯',
  'Mikel Landa': '米克尔·兰达',
  'Geraint Thomas': '杰兰特·托马斯',
  'Egan Bernal': '埃甘·贝尔纳尔',
  'Simon Yates': '西蒙·耶茨',
  'Adam Yates': '亚当·耶茨',
  'Michael Matthews': '迈克尔·马修斯',
  'Dylan Groenewegen': '迪伦·赫鲁内维亨',
  'Caleb Ewan': '卡莱布·尤安',
  'Mark Cavendish': '马克·卡文迪什',
  'Peter Sagan': '彼得·萨甘',
  'Filippo Ganna': '菲利波·甘纳',
  'Elisa Longo Borghini': '埃莉萨·隆戈·博尔吉尼',
  'Demi Vollering': '德米·沃勒林',
  'Lotte Kopecky': '洛特·科佩基',
  'Lorena Wiebes': '洛雷娜·维贝斯',
  'Pauline Ferrand Prevot': '波利娜·费朗-普雷沃',
  'Pauline Ferrand-Prévot': '波利娜·费朗-普雷沃',
  'Marianne Vos': '玛丽安娜·沃斯',
  'Annemiek van Vleuten': '安妮米克·范弗勒滕',
  'Katarzyna Niewiadoma': '卡塔日娜·涅维亚多马'
}));

const TOKEN_OVERRIDES = new Map(Object.entries({
  aaron: '阿伦', abd: '阿卜德', abdul: '阿卜杜勒', abdulla: '阿卜杜拉', abdullah: '阿卜杜拉',
  halim: '哈利姆', muhammad: '穆罕默德', mohd: '穆罕默德', shahmir: '沙赫米尔', aiman: '艾曼',
  jasim: '贾西姆', ali: '阿里', alhidan: '阿尔希丹', alyaqoobi: '阿尔亚库比', abel: '阿贝尔',
  abram: '亚伯拉罕',
  abdulrahman: '阿卜杜勒拉赫曼', adam: '亚当', ade: '阿德', adne: '阿德内', adria: '阿德里亚',
  adrian: '阿德里安', adrián: '阿德里安', adrien: '阿德里安', afonso: '阿丰索', agnieszka: '阿格涅什卡',
  agua: '阿瓜', ahmet: '艾哈迈德', aidan: '艾丹', aime: '艾梅', aimé: '艾梅', ainara: '艾娜拉',
  aj: 'AJ', alan: '阿兰', alana: '阿拉娜', alastair: '阿拉斯泰尔', albert: '阿尔伯特',
  alberte: '阿尔贝特', alberto: '阿尔贝托', aldo: '阿尔多', alejandro: '亚历杭德罗',
  aleksandr: '亚历山大', alena: '阿莲娜', alessandro: '亚历山德罗', alessia: '阿莱西亚',
  alessio: '阿莱西奥', alex: '亚历克斯', alexander: '亚历山大', alexandra: '亚历山德拉',
  alexandre: '亚历山大', alice: '爱丽丝', alison: '艾莉森', amanda: '阿曼达', amy: '艾米',
  anastasiya: '阿纳斯塔西娅', andrea: '安德烈亚', andreas: '安德烈亚斯', andre: '安德烈',
  andré: '安德烈', anja: '安雅', annemiek: '安妮米克', annika: '安妮卡', antonio: '安东尼奥',
  arnaud: '阿诺', arthur: '阿图尔', ashley: '阿什莉', audrey: '奥德丽', ben: '本', benjamin: '本杰明',
  bram: '布拉姆', brian: '布莱恩', bruno: '布鲁诺', bryan: '布莱恩', callum: '卡勒姆',
  cameron: '卡梅伦', camilla: '卡米拉', carlos: '卡洛斯', caroline: '卡罗琳', casper: '卡斯珀',
  cedric: '塞德里克', cédrik: '塞德里克', celia: '塞莉娅', cesar: '塞萨尔',
  charlotte: '夏洛特', chloe: '克洛伊', christian: '克里斯蒂安', christophe: '克里斯托夫',
  christopher: '克里斯托弗', clara: '克拉拉', clement: '克莱芒', clément: '克莱芒', corbin: '科尔宾',
  cristian: '克里斯蒂安', daan: '达恩', daniel: '丹尼尔', danny: '丹尼', dario: '达里奥',
  david: '戴维', davide: '达维德', diego: '迭戈', diogo: '迪奥戈', dylan: '迪伦', edward: '爱德华',
  edoardo: '爱德华多', eleonora: '埃莱奥诺拉', elena: '埃琳娜', elisa: '埃莉萨', ella: '埃拉',
  ellen: '艾伦', emanuel: '埃马努埃尔', emil: '埃米尔', emma: '艾玛', enric: '恩里克',
  erik: '埃里克', ethan: '伊森', eva: '伊娃', fabio: '法比奥', federico: '费德里科',
  felix: '费利克斯', femke: '费姆克', filip: '菲利普', filippo: '菲利波', finlay: '芬利',
  finn: '芬恩', florian: '弗洛里安', francisco: '弗朗西斯科', frederik: '弗雷德里克',
  gaia: '盖娅', gabriele: '加布里埃莱', george: '乔治', giacomo: '贾科莫', gianni: '詹尼',
  giulio: '朱利奥', gorka: '戈尔卡', greg: '格雷格', gregoire: '格雷瓜尔', guillaume: '纪尧姆',
  hamish: '哈米什', hannah: '汉娜', hannes: '汉内斯', hayato: '隼人', henri: '亨利',
  henry: '亨利', hugo: '雨果', ibai: '伊拜', iker: '伊克尔', ilaria: '伊拉里亚', ion: '伊昂',
  irene: '伊雷娜', isaac: '艾萨克', ivan: '伊万', jack: '杰克', jacob: '雅各布', jacopo: '雅各波',
  jade: '杰德', jakob: '雅各布', james: '詹姆斯', jan: '扬', jasper: '贾斯珀', javier: '哈维尔',
  jay: '杰伊', jean: '让', jefferson: '杰斐逊', jesper: '耶斯珀', joao: '若昂', joel: '乔尔',
  jonas: '约纳斯', jonathan: '乔纳森', jordan: '乔丹', josie: '乔茜', joshua: '约书亚',
  jose: '何塞', josé: '何塞', juan: '胡安', julian: '朱利安', julien: '朱利安',
  julie: '朱莉', julia: '朱莉娅', juliette: '朱丽叶', junior: '儒尼奥尔', kaden: '卡登',
  kamil: '卡米尔', karlijn: '卡琳', kasper: '卡斯珀', katarzyna: '卡塔日娜', kevin: '凯文',
  laura: '劳拉', laurens: '劳伦斯', lea: '莱娅', leonardo: '莱昂纳多', leonel: '莱昂内尔',
  leo: '莱奥', léo: '莱奥', liam: '利亚姆', linda: '琳达', lisa: '丽莎', lorenzo: '洛伦佐',
  lorena: '洛雷娜', louis: '路易', luca: '卢卡', lucas: '卢卡斯', ludwig: '路德维希',
  luke: '卢克', magnus: '马格努斯', marc: '马克', marco: '马尔科', maria: '玛丽亚',
  marie: '玛丽', marina: '玛丽娜', marine: '玛琳', marianne: '玛丽安娜', marion: '玛丽昂',
  mark: '马克', markus: '马库斯', margot: '玛戈', maria: '玛丽亚', martina: '玛蒂娜',
  martin: '马丁', matteo: '马泰奥', matthew: '马修', mattia: '马蒂亚', mathias: '马蒂亚斯',
  mathieu: '马修', maxime: '马克西姆', max: '马克斯', meo: '梅奥', michael: '迈克尔',
  michal: '米哈尔', michał: '米哈尔', michiel: '米希尔', mikel: '米克尔', milan: '米兰',
  nadia: '娜迪亚', nahom: '纳霍姆', nairo: '奈罗', nathan: '内森', neilson: '尼尔森',
  niccolo: '尼科洛', nicolo: '尼科洛', nicolas: '尼古拉', nicola: '尼古拉', nina: '妮娜',
  nils: '尼尔斯', noah: '诺亚', noa: '诺阿', nora: '诺拉', oliver: '奥利弗', oscar: '奥斯卡',
  pablo: '巴勃罗', patrick: '帕特里克', paul: '保罗', paula: '保拉', pauline: '波利娜',
  pavel: '帕维尔', pedro: '佩德罗', pepijn: '佩平', peter: '彼得', petr: '彼得', pierre: '皮埃尔',
  primož: '普里莫日', primoz: '普里莫日', quinn: '奎因', quinten: '昆滕', rafael: '拉斐尔',
  remco: '雷姆科', riccardo: '里卡多', richard: '理查德', robert: '罗伯特', roberto: '罗伯托',
  robbe: '罗贝', rodrigo: '罗德里戈', romain: '罗曼', romeo: '罗密欧', rui: '鲁伊', ryan: '瑞安',
  sam: '萨姆', samuel: '塞缪尔', sander: '桑德', sara: '萨拉', sarah: '萨拉', scott: '斯科特',
  sebastian: '塞巴斯蒂安', sepp: '塞普', sergio: '塞尔吉奥', simon: '西蒙', simone: '西蒙内',
  sofia: '索菲娅', sophie: '索菲', stan: '斯坦', stefan: '斯特凡', stefano: '斯特凡诺',
  stephen: '斯蒂芬', sven: '斯文', tadej: '塔德伊', theo: '泰奥', thomas: '托马斯',
  tim: '蒂姆', timothy: '蒂莫西', tobias: '托比亚斯', tom: '汤姆', tomas: '托马斯',
  tommaso: '托马索', tony: '托尼', unai: '乌奈', valentin: '瓦伦丁', valentina: '瓦伦蒂娜',
  victor: '维克托', victoria: '维多利亚', vittoria: '维托里亚', wang: '王', william: '威廉',
  wout: '沃特', xabier: '哈维尔', yevgeniy: '叶夫根尼', yuliya: '尤利娅',

  van: '范', vander: '范德', von: '冯', der: '德', den: '登', de: '德', da: '达', di: '迪',
  del: '德尔', della: '德拉', le: '勒', la: '拉', al: '阿尔', el: '埃尔', dos: '多斯',

  gate: '盖特', balderstone: '巴尔德斯通', stockman: '斯托克曼', lewis: '刘易斯', rafferty: '拉弗蒂',
  toupalik: '托帕利克', engelen: '恩赫伦', pericas: '佩里卡斯', benito: '贝尼托',
  bustamante: '布斯塔曼特', fajardo: '法哈多', maire: '迈尔', lopes: '洛佩斯', silva: '席尔瓦',
  skalniak: '斯卡尔尼亚克', sójka: '索伊卡', espinola: '埃斯皮诺拉', akpinar: '阿克皮纳尔',
  orken: '厄尔肯', buttigieg: '布蒂吉格', lasa: '拉萨', gendt: '亨特', mikutis: '米库蒂斯',
  jousseaume: '朱索姆', castrique: '卡斯特里克', mackellar: '麦凯勒', torres: '托雷斯',
  philipsen: '菲利普森', greve: '格雷夫', bruttomesso: '布鲁托梅索', dainese: '戴内塞',
  taillieu: '塔利厄', callejas: '卡列哈斯', bereznyak: '别列兹尼亚克', grigorev: '格里戈列夫',
  ivanchenko: '伊万琴科', borgo: '博尔戈', cattani: '卡塔尼', covi: '科维', dante: '丹特',
  fancellu: '范切卢', iacchi: '亚基', milesi: '米莱西', romele: '罗梅莱', verre: '韦雷',
  vigilia: '维吉利亚', zambelli: '赞贝利', vedove: '韦多韦', magagnotti: '马加尼奥蒂',
  martinelli: '马蒂内利', menghini: '门吉尼', aranburu: '阿兰布鲁', baudin: '博丹',
  diaz: '迪亚斯', kirsch: '基尔施', molenaar: '莫莱纳尔', tolio: '托利奥', cepeda: '塞佩达',
  kamp: '坎普', konijn: '科宁', konychev: '科尼切夫', salby: '萨尔比', manly: '曼利',
  volstad: '沃尔斯塔德', balmer: '巴尔默', revesz: '雷韦斯', meisa: '梅萨', toledo: '托莱多',
  marina: '玛丽娜', aidi: '艾迪', gerde: '盖尔德', tuisk: '图伊斯克', ailetz: '艾莱茨',
  bosch: '博世', aivaras: '艾瓦拉斯', august: '奥古斯特', christie: '克里斯蒂',
  johnston: '约翰斯顿', withen: '威森', garcia: '加西亚', lee: '李', kim: '金',
  andersen: '安德森', lopez: '洛佩斯', martinez: '马丁内斯', cepeda: '塞佩达',
  knaven: '克纳文', perez: '佩雷斯', walsh: '沃尔什', pedersen: '彼得森', fernandez: '费尔南德斯',
  prades: '普拉德斯', brien: '布赖恩', campos: '坎波斯', ruiz: '鲁伊斯',
  rodriguez: '罗德里格斯', quintero: '金特罗', pinto: '平托', norsgaard: '诺斯高',
  carvalho: '卡瓦略', clercq: '克莱克', oliveira: '奥利维拉', kessler: '凯斯勒',
  santiago: '圣地亚哥', berg: '贝格', gutierrez: '古铁雷斯', johannessen: '约翰内森',
  pidcock: '皮德科克', yilmaz: '耶尔马兹', delgado: '德尔加多', halland: '哈兰',
  lecerf: '勒塞尔夫', girmay: '吉尔迈', tricht: '特里赫特', moolman: '穆尔曼',
  larsen: '拉森', schachmann: '沙赫曼', garau: '加劳', fidanza: '菲丹扎',
  takacs: '陶卡奇', guernalec: '盖尔纳莱克', gasparrini: '加斯帕里尼', leal: '莱亚尔',
  prevot: '普雷沃', oda: '小田', niu: '牛', gonzalez: '冈萨雷斯', plapp: '普拉普',
  masciarelli: '马夏雷利', fisher: '费舍尔', black: '布莱克', jansen: '扬森',
  hansen: '汉森', zanetti: '扎内蒂', sambinello: '桑比内洛', lotte: '洛特',
  ottestad: '奥特斯塔德', molano: '莫拉诺', okamoto: '冈本', yamamoto: '山本'
}));

const CHUNKS = [
  ['sch', '施'], ['sh', '什'], ['ch', '奇'], ['th', '特'], ['ph', '夫'], ['ck', '克'], ['qu', '奎'],
  ['gue', '格'], ['gui', '吉'], ['gn', '尼'], ['ll', '利'], ['rr', '尔'], ['ss', '斯'], ['tt', '特'],
  ['bb', '布'], ['dd', '德'], ['ff', '夫'], ['gg', '格'], ['kk', '克'], ['mm', '姆'], ['nn', '恩'],
  ['pp', '普'], ['au', '奥'], ['ou', '乌'], ['ei', '艾'], ['ie', '伊'], ['ai', '艾'], ['ay', '艾'],
  ['ey', '伊'], ['ee', '伊'], ['oo', '乌'], ['ea', '伊'], ['ia', '亚'], ['io', '奥'], ['oa', '奥'],
  ['a', '阿'], ['b', '布'], ['c', '克'], ['d', '德'], ['e', '埃'], ['f', '夫'], ['g', '格'],
  ['h', '赫'], ['i', '伊'], ['j', '杰'], ['k', '克'], ['l', '尔'], ['m', '姆'], ['n', '恩'],
  ['o', '奥'], ['p', '普'], ['q', '克'], ['r', '尔'], ['s', '斯'], ['t', '特'], ['u', '乌'],
  ['v', '夫'], ['w', '沃'], ['x', '克斯'], ['y', '伊'], ['z', '兹']
];

function normalizeToken(token) {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function transliterateUnknownToken(rawToken) {
  const token = normalizeToken(rawToken);
  if (!token) return '';
  if (/^\d+$/.test(token)) return token;

  let output = '';
  let index = 0;
  while (index < token.length) {
    const match = CHUNKS.find(([chunk]) => token.startsWith(chunk, index));
    if (match) {
      output += match[1];
      index += match[0].length;
    } else {
      output += token[index].toUpperCase();
      index += 1;
    }
  }

  return output
    .replace(/阿埃/g, '埃')
    .replace(/阿奥/g, '奥')
    .replace(/尔斯$/g, '斯')
    .replace(/恩$/g, '恩')
    .replace(/特$/g, '特');
}

function translateToken(rawToken) {
  const key = rawToken.toLowerCase();
  const normalized = normalizeToken(rawToken);
  return TOKEN_OVERRIDES.get(key) || TOKEN_OVERRIDES.get(normalized) || transliterateUnknownToken(rawToken);
}

function translateName(name) {
  if (FULL_NAME_OVERRIDES.has(name)) return FULL_NAME_OVERRIDES.get(name);

  const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (FULL_NAME_OVERRIDES.has(normalizedName)) return FULL_NAME_OVERRIDES.get(normalizedName);

  const parts = name
    .replace(/[’']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((part) => part.split('-').filter(Boolean));

  const translated = parts.map(translateToken).filter(Boolean);
  return translated.join('·');
}

function hasHan(value) {
  return /[\u3400-\u9fff]/u.test(value || '');
}

function shouldUpdate(row) {
  const override = FULL_NAME_OVERRIDES.get(row.rider_name)
    || FULL_NAME_OVERRIDES.get(row.rider_name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (override && row.rider_name_zh !== override) return true;
  return !(row.rider_name_zh || '').trim();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
  });

  try {
    const [rows] = await conn.query(`
      SELECT id, rider_name, rider_name_zh, nationality
      FROM riders
      ORDER BY rider_name
    `);

    const updates = rows
      .filter(shouldUpdate)
      .map((row) => ({
        id: row.id,
        rider_name: row.rider_name,
        rider_name_zh: translateName(row.rider_name),
        nationality: row.nationality
      }))
      .filter((row) => hasHan(row.rider_name_zh));

    console.log(`pending updates: ${updates.length}`);
    console.log(JSON.stringify(updates.slice(0, 40), null, 2));

    if (dryRun) return;

    await conn.beginTransaction();
    for (const row of updates) {
      await conn.query('UPDATE riders SET rider_name_zh = ?, updated_at = NOW() WHERE id = ?', [
        row.rider_name_zh,
        row.id
      ]);
    }
    await conn.commit();

    console.log(`updated: ${updates.length}`);
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      // Ignore rollback errors when no transaction was started.
    }
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
