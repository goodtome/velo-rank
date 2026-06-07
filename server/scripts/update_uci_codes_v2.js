const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/config/.env' });

const uciCodes = [
  { keywords: ['Tudor'], code: 'TUD' },
  { keywords: ['PICNIC', 'POSTNL'], code: 'TPP' },
  { keywords: ['DECATHLON', 'CMA', 'CGM'], code: 'DCT' },
  { keywords: ['EF EDUCATION', 'EASYPOST'], code: 'EFE' },
  { keywords: ['Visma', 'Lease'], code: 'TVL' },
  { keywords: ['Alpecin', 'Premier'], code: 'APC' },
  { keywords: ['UNIBET'], code: 'URR' },
  { keywords: ['POLTI'], code: 'PTK' },
  { keywords: ['NSN'], code: 'NSN' },
  { keywords: ['JAYCO', 'ALULA'], code: 'JAY' },
  { keywords: ['RED BULL', 'BORA', 'HANSGROHE'], code: 'RBH' },
  { keywords: ['MOVISTAR'], code: 'MOV' },
  { keywords: ['Q36.5'], code: 'Q36' },
  { keywords: ['LOTTO', 'INTERMARCHÉ'], code: 'LOI' },
  { keywords: ['Lidl', 'Trek'], code: 'LTK' },
  { keywords: ['INEOS'], code: 'IGD' },
  { keywords: ['SOUDAL', 'QUICK-STEP'], code: 'SOQ' },
  { keywords: ['UAE', 'Emirates'], code: 'UAE' },
  { keywords: ['UNO-X'], code: 'UXM' },
  { keywords: ['BARDIANI'], code: 'VBF' },
  { keywords: ['Groupama', 'FDJ'], code: 'GFC' },
  { keywords: ['ASTANA'], code: 'XAT' },
  { keywords: ['Bahrain', 'Victorious'], code: 'TBV' }
];

async function updateUciCodes() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [teams] = await conn.query('SELECT id, team_name, uci_code FROM teams');
    console.log(`Found ${teams.length} teams in database.`);

    // 先清除可能导致冲突的重复项或错误项（可选，但这里我们用 try-catch 忽略冲突）
    
    for (const team of teams) {
      const match = uciCodes.find(m => 
        m.keywords.every(k => team.team_name.toUpperCase().includes(k.toUpperCase()))
      );

      if (match) {
        if (team.uci_code === match.code) {
            console.log(`Skipping ${team.team_name}, already has code ${match.code}`);
            continue;
        }
        
        try {
          console.log(`Updating ${team.team_name} -> UCI Code: ${match.code}`);
          await conn.query('UPDATE teams SET uci_code = ? WHERE id = ?', [match.code, team.id]);
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            console.warn(`[SKIP DUPLICATE] ${team.team_name} already exists with code ${match.code}`);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('✅ UCI codes update completed (skipped duplicates).');
  } catch (err) {
    console.error('Error updating UCI codes:', err);
  } finally {
    await conn.end();
  }
}

updateUciCodes();
