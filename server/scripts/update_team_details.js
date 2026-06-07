const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/config/.env' });

const teamData = [
  { keywords: ['Alpecin', 'Premier'], category: 'UCI_WORLD_TEAM', country: 'BEL', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/alpecin-premier-tech.png' },
  { keywords: ['Bahrain', 'Victorious'], category: 'UCI_WORLD_TEAM', country: 'BHR', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/bahrain-victorious.png' },
  { keywords: ['DECATHLON', 'CMA', 'CGM'], category: 'UCI_WORLD_TEAM', country: 'FRA', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/decathlon-cma-cgm.png' },
  { keywords: ['EF EDUCATION', 'EASYPOST'], category: 'UCI_WORLD_TEAM', country: 'USA', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/ef-education-easypost.png' },
  { keywords: ['Groupama', 'FDJ'], category: 'UCI_WORLD_TEAM', country: 'FRA', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/groupama-fdj.png' },
  { keywords: ['INEOS'], category: 'UCI_WORLD_TEAM', country: 'GBR', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/ineos-grenadiers.png' },
  { keywords: ['LOTTO', 'INTERMARCHÉ'], category: 'UCI_WORLD_TEAM', country: 'BEL', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/lotto-intermarche.png' },
  { keywords: ['Lidl', 'Trek'], category: 'UCI_WORLD_TEAM', country: 'USA', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/lidl-trek.png' },
  { keywords: ['MOVISTAR'], category: 'UCI_WORLD_TEAM', country: 'ESP', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/movistar.png' },
  { keywords: ['NSN'], category: 'UCI_PRO_TEAM', country: 'SUI', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/nsn-cycling-team.png' },
  { keywords: ['RED BULL', 'BORA', 'HANSGROHE'], category: 'UCI_WORLD_TEAM', country: 'GER', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/red-bull-bora-hansgrohe.png' },
  { keywords: ['SOUDAL', 'QUICK-STEP'], category: 'UCI_WORLD_TEAM', country: 'BEL', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/soudal-quick-step.png' },
  { keywords: ['PICNIC', 'POSTNL'], category: 'UCI_PRO_TEAM', country: 'NED', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/team-picnic-postnl.png' },
  { keywords: ['JAYCO', 'ALULA'], category: 'UCI_WORLD_TEAM', country: 'AUS', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/team-jayco-alula.png' },
  { keywords: ['Visma', 'Lease'], category: 'UCI_WORLD_TEAM', country: 'NED', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/visma-lease-a-bike.png' },
  { keywords: ['UAE', 'Emirates', 'XRG'], category: 'UCI_WORLD_TEAM', country: 'UAE', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/uae-team-emirates.png' },
  { keywords: ['UNO-X'], category: 'UCI_PRO_TEAM', country: 'NOR', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/uno-x-mobility.png' },
  { keywords: ['ASTANA'], category: 'UCI_WORLD_TEAM', country: 'KAZ', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/astana-qazaqstan.png' },
  { keywords: ['Q36.5'], category: 'UCI_PRO_TEAM', country: 'SUI', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/q365-pro-cycling.png' },
  { keywords: ['Tudor'], category: 'UCI_PRO_TEAM', country: 'SUI', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/tudor-pro-cycling.png' },
  { keywords: ['BARDIANI'], category: 'UCI_PRO_TEAM', country: 'ITA', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/bardiani-csf-7saber.png' },
  { keywords: ['POLTI'], category: 'UCI_PRO_TEAM', country: 'ITA', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/polti-visitmalta.png' },
  { keywords: ['UNIBET'], category: 'UCI_PRO_TEAM', country: 'NED', logo: 'https://files.procyclingstats.com/images/teams/logos/2026/unibet-rose-rockets.png' }
];

async function updateTeamDetails() {
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
      const match = teamData.find(m => 
        m.keywords.every(k => team.team_name.toUpperCase().includes(k.toUpperCase()))
      );

      if (match) {
        console.log(`Updating ${team.team_name}: Category=${match.category}, Country=${match.country}`);
        await conn.query(
          'UPDATE teams SET category = ?, country = ?, logo_url = ? WHERE id = ?',
          [match.category, match.country, match.logo, team.id]
        );
      }
    }

    console.log('✅ Team details update completed.');
  } catch (err) {
    console.error('Error updating team details:', err);
  } finally {
    await conn.end();
  }
}

updateTeamDetails();
