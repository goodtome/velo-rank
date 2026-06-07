const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/config/.env' });

const mapping = [
  { keywords: ['Alpecin', 'Premier'], zh: '欧倍青-博泰车队' },
  { keywords: ['Bahrain', 'Victorious'], zh: '巴林胜利车队' },
  { keywords: ['DECATHLON', 'CMA', 'CGM'], zh: '迪卡侬达飞车队' },
  { keywords: ['EF EDUCATION', 'EASYPOST'], zh: 'EF教育-易邮车队' },
  { keywords: ['Groupama', 'FDJ'], zh: '安盟-FDJ车队' },
  { keywords: ['INEOS'], zh: '英力士-掷弹兵车队' },
  { keywords: ['LOTTO', 'INTERMARCHÉ'], zh: '乐透-英特马诗车队' },
  { keywords: ['Lidl', 'Trek'], zh: '历德-崔克车队' },
  { keywords: ['MOVISTAR'], zh: '移动之星车队' },
  { keywords: ['NSN'], zh: 'NSN车队' },
  { keywords: ['RED BULL', 'BORA', 'HANSGROHE'], zh: '红牛-博拉-汉斯格雅车队' },
  { keywords: ['SOUDAL', 'QUICK-STEP'], zh: '苏达尔-快步车队' },
  { keywords: ['PICNIC', 'POSTNL'], zh: '荷兰邮政车队' },
  { keywords: ['JAYCO', 'ALULA'], zh: '杰科-埃尔奥拉车队' },
  { keywords: ['Visma', 'Lease'], zh: '维斯玛-租赁自行车车队' },
  { keywords: ['UAE', 'Emirates', 'XRG'], zh: '阿联酋航空-XRG车队' },
  { keywords: ['UNO-X'], zh: 'UNO-X车队' },
  { keywords: ['ASTANA'], zh: 'XDS阿斯坦纳车队' },
  { keywords: ['Q36.5'], zh: 'Q36.5车队' },
  { keywords: ['Tudor'], zh: '帝舵车队' },
  { keywords: ['Cofidis'], zh: '科菲迪斯车队' },
  { keywords: ['TotalEnergies'], zh: '道达尔能源车队' },
  { keywords: ['Caja Rural'], zh: '西班牙农业银行车队' }
];

async function updateTranslations() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [teams] = await conn.query('SELECT id, team_name FROM teams');
    console.log(`Found ${teams.length} teams in database.`);

    for (const team of teams) {
      const match = mapping.find(m => 
        m.keywords.every(k => team.team_name.toUpperCase().includes(k.toUpperCase()))
      );

      if (match) {
        console.log(`Updating ${team.team_name} -> ${match.zh}`);
        await conn.query('UPDATE teams SET team_name_zh = ? WHERE id = ?', [match.zh, team.id]);
      }
    }

    console.log('✅ Translation update completed.');
  } catch (err) {
    console.error('Error updating translations:', err);
  } finally {
    await conn.end();
  }
}

updateTranslations();
