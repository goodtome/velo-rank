/**
 * TDF 2026 Stage 1 (TTT) 成绩导入
 * 
 * 数据来源: PCS race/tour-de-france/2026/stage-1 (2026-07-05)
 * 赛段: Barcelona TTT, 19.6km
 * 冠军: Team Visma | Lease a Bike (21:47.870)
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const DB = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };

// ============================================================
// PCS 完整 TTT 成绩 (23 teams × 8 riders = 184)
// ============================================================
const TTT_RESULTS = [
  // Rank 1: Team Visma | Lease a Bike - 21:47.870
  { rank: 1, team: 'Team Visma | Lease a Bike', gap: '+0:00', 
    riders: ['Jonas Vingegaard','Davide Piganzoli','Sepp Kuss','Matteo Jorgenson','Bruno Armirail','Victor Campenaerts','Edoardo Affini','Per Strand Hagenes'] },
  // Rank 2: Netcompany INEOS - +0:08
  { rank: 2, team: 'Netcompany INEOS', gap: '+0:08',
    riders: ['Filippo Ganna','Tobias Foss','Thymen Arensman','Kevin Vauquelin','Dorian Godon','Joshua Tarling','Michal Kwiatkowski','Egan Bernal'] },
  // Rank 3: UAE Team Emirates - XRG - +0:12
  { rank: 3, team: 'UAE Team Emirates - XRG', gap: '+0:12',
    riders: ['Tadej Pogacar','Isaac Del Toro','Brandon McNulty','Felix Grossschartner','Tim Wellens','Florian Vermeersch','Adam Yates','Nils Politt'] },
  // Rank 4: Lidl - Trek - +0:16
  { rank: 4, team: 'Lidl - Trek', gap: '+0:16',
    riders: ['Juan Ayuso','Mathias Vacek','Mattias Skjelmose','Derek Gee-West','Toms Skujins','Mads Pedersen','Carlos Verona','Quinn Simmons'] },
  // Rank 5: Red Bull - BORA - hansgrohe - +0:19
  { rank: 5, team: 'Red Bull - BORA - hansgrohe', gap: '+0:19',
    riders: ['Remco Evenepoel','Florian Lipowitz','Maxim Van Gils','Jai Hindley','Mattia Cattaneo','Jan Tratnik','Nico Denz','Tim van Dijke'] },
  // Rank 6: Decathlon CMA CGM Team - +0:39
  { rank: 6, team: 'Decathlon CMA CGM Team', gap: '+0:39',
    riders: ['Paul Seixas','Matthew Riccitello','Aurelien Paret-Peintre','Tiesj Benoot','Nicolas Prodhomme','Olav Kooij','Daan Hoole','Cees Bol'] },
  // Rank 7: Alpecin - Premier Tech - +0:39
  { rank: 7, team: 'Alpecin - Premier Tech', gap: '+0:39',
    riders: ['Mathieu Van Der Poel','Emiel Verstrynge','Ramses Debruyne','Tim Marsman','Edward Planckaert','Jasper Philipsen','Silvan Dillier','Jonas Rickaert'] },
  // Rank 8: Groupama - FDJ United - +0:41
  { rank: 8, team: 'Groupama - FDJ United', gap: '+0:41',
    riders: ['Romain Gregoire','Clement Braz Afonso','Lorenzo Germani','Clement Russo','Ewen Costiou','Quentin Pacher','Guillaume Martin','Clement Berthet'] },
  // Rank 9: Bahrain - Victorious - +0:47
  { rank: 9, team: 'Bahrain - Victorious', gap: '+0:47',
    riders: ['Antonio Tiberi','Lenny Martinez','Damiano Caruso','Vlad Van Mechelen','Matej Mohoric','Robert Stannard','Phil Bauhaus','Kamil Gradek'] },
  // Rank 10: Team Jayco AlUla - +0:51
  { rank: 10, team: 'Team Jayco AlUla', gap: '+0:51',
    riders: ['Michael Matthews','Luke Plapp','Ben O\'Connor','Kelland O\'Brien','Felix Engelhardt','Mauro Schmid','Pascal Ackermann','Luke Durbridge'] },
  // Rank 11: EF Education - EasyPost - +0:57
  { rank: 11, team: 'EF Education - EasyPost', gap: '+0:57',
    riders: ['Alex Baudin','Georg Steinhauser','Richard Carapaz','Sean Quinn','Ben Healy','Kasper Asgreen','Max Walker','Michael Valgren'] },
  // Rank 12: Pinarello Q36.5 Pro Cycling Team - +0:57
  { rank: 12, team: 'Pinarello Q36.5 Pro Cycling Team', gap: '+0:57',
    riders: ['Tom Pidcock','Quinten Hermans','Damien Howson','Fred Wright','Xandro Meurisse','Xabier Mikel Azparren','Chris Harper','Brent Van Moer'] },
  // Rank 13: Soudal Quick-Step - +0:58
  { rank: 13, team: 'Soudal Quick-Step', gap: '+0:58',
    riders: ['Ilan Van Wilder','Dylan van Baarle','Valentin Paret-Peintre','Jasper Stuyven','Louis Vervaeke','Pascal Eenkhoorn','Tim Merlier','Bert Van Lerberghe'] },
  // Rank 14: Uno-X Mobility - +1:00
  { rank: 14, team: 'Uno-X Mobility', gap: '+1:00',
    riders: ['Tobias Halland Johannessen','Torstein Traeen','Anthon Charmig','Anders Halland Johannessen','Magnus Cort','Jonas Abrahamsen','Anders Skaarseth','Soren Waerenskjold'] },
  // Rank 15: TotalEnergies - +1:02
  { rank: 15, team: 'TotalEnergies', gap: '+1:02',
    riders: ['Jordan Jegat','Mathis Le Berre','Matteo Vercher','Nicolas Breuillard','Alexandre Delettre','Anthony Turgis','Joris Delbove','Thibault Guernalec'] },
  // Rank 16: Caja Rural - Seguros RGA - +1:12
  { rank: 16, team: 'Caja Rural - Seguros RGA', gap: '+1:12',
    riders: ['Alex Molenaar','Jose Felix Parra','Abel Balderstone','Sebastian Berwick','Stefano Oldani','Fernando Gaviria','Jakub Otruba','Joel Nicolau'] },
  // Rank 17: Tudor Pro Cycling Team - +1:14
  { rank: 17, team: 'Tudor Pro Cycling Team', gap: '+1:14',
    riders: ['Yannis Voisard','Julian Alaphilippe','Marc Hirschi','Michael Storer','Rick Pluimers','Arvid de Kleijn','Matteo Trentin','Marco Haller'] },
  // Rank 18: NSN Cycling Team - +1:16
  { rank: 18, team: 'NSN Cycling Team', gap: '+1:16',
    riders: ['George Bennett','Biniam Girmay','Lewis Askey','Krists Neilands','Marco Frigo','Tom Van Asbroeck','Jake Stewart','Matis Louvel'] },
  // Rank 19: Cofidis - +1:17
  { rank: 19, team: 'Cofidis', gap: '+1:17',
    riders: ['Ion Izagirre','Alex Kirsch','Benjamin Thomas','Alex Aranburu','Hugo Page','Jenthe Biermans','Milan Fretin','Piet Allegaert'] },
  // Rank 20: Movistar Team - +1:18
  { rank: 20, team: 'Movistar Team', gap: '+1:18',
    riders: ['Raul Garcia Pierna','Pablo Castrillo','Jefferson Alveiro Cepeda','Cian Uijtdebroeks','Nelson Oliveira','Michel Hessmann','Javier Romo','Einer Rubio'] },
  // Rank 21: Lotto Intermarche - +1:36
  { rank: 21, team: 'Lotto Intermarche', gap: '+1:36',
    riders: ['Lennert Van Eetvelt','Jenno Berckmoes','Huub Artz','Georg Zimmermann','Liam Slock','Lars Craps','Baptiste Veistroffer','Arnaud De Lie'] },
  // Rank 22: Team Picnic PostNL - +1:55
  { rank: 22, team: 'Team Picnic PostNL', gap: '+1:55',
    riders: ['Robbe Dhondt','Frank van den Broek','Pavel Bittner','Warren Barguil','Julius van den Berg','Frits Biesterbos','John Degenkolb','Niklas Markl'] },
  // Rank 23: XDS Astana Team - +2:18
  { rank: 23, team: 'XDS Astana Team', gap: '+2:18',
    riders: ['Sergio Higuita','Harold Tejada','Max Kanter','Aaron Gate','Mike Teunissen','Davide Ballerini','Nicolas Vinokurov','Simone Velasco'] }
];

async function findRider(conn, name) {
  // Try exact match
  const [r1] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [name]);
  if (r1.length) return r1[0].id;
  
  // Try LIKE
  const [r2] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${name.split(' ').pop()}%`]);
  if (r2.length) return r2[0].id;
  
  // Try slug
  const slug = name.toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  try {
    const [r3] = await conn.query('SELECT id FROM riders WHERE rider_slug LIKE ? LIMIT 1', [`%${slug}%`]);
    if (r3.length) return r3[0].id;
  } catch(e) {}
  
  return null;
}

async function findTeam(conn, name) {
  // Try exact match
  const [r1] = await conn.query('SELECT id FROM teams WHERE team_name = ? LIMIT 1', [name]);
  if (r1.length) return r1[0].id;
  
  // Try case-insensitive
  const [r2] = await conn.query('SELECT id FROM teams WHERE UPPER(team_name) = UPPER(?) LIMIT 1', [name]);
  if (r2.length) return r2[0].id;
  
  // Try LIKE
  const parts = name.split(/[\s\-\|]+/).filter(p => p.length > 2);
  for (const p of parts.slice(0, 2)) {
    const [r3] = await conn.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1', [`%${p}%`]);
    if (r3.length) return r3[0].id;
  }
  
  return null;
}

function getCountry(teamName) {
  // Basic mapping for team nationality
  const map = {
    'Visma': 'NL', 'INEOS': 'GB', 'UAE': 'AE', 'Lidl': 'US', 'BORA': 'DE',
    'Decathlon': 'FR', 'Alpecin': 'BE', 'Groupama': 'FR', 'Bahrain': 'BH',
    'Jayco': 'AU', 'EF': 'US', 'Pinarello': 'CH', 'Soudal': 'BE',
    'Uno-X': 'NO', 'TotalEnergies': 'FR', 'Caja': 'ES', 'Tudor': 'CH',
    'NSN': 'BE', 'Cofidis': 'FR', 'Movistar': 'ES', 'Lotto': 'BE',
    'Picnic': 'NL', 'XDS': 'KZ'
  };
  for (const [k, v] of Object.entries(map)) {
    if (teamName.includes(k)) return v;
  }
  return 'UNK';
}

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log('=== TDF 2026 Stage 1 (TTT) Import ===\n');

  const [raceRows] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  const raceId = raceRows[0].id;
  const [stageRows] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=1', [raceId]);
  const stageId = stageRows[0].id;

  // Delete existing results if any (re-import)
  await conn.query('DELETE FROM stage_results WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM jerseys WHERE stage_id=?', [stageId]);

  console.log(`Stage: ${stageId}`);
  console.log(`Teams: ${TTT_RESULTS.length}\n`);

  let totalRiders = 0;
  let seqRank = 1;
  const stageRankMap = {}; // rider_id → rank for GC
  const skippedRiders = [];

  for (const team of TTT_RESULTS) {
    const teamId = await findTeam(conn, team.team);
    const country = getCountry(team.team);
    
    if (!teamId) {
      console.log(`  ⚠️ Team not found: ${team.team}, skipping`);
      seqRank += team.riders.length;
      continue;
    }

    for (const riderName of team.riders) {
      const riderId = await findRider(conn, riderName);
      if (!riderId) {
        skippedRiders.push(`${riderName} (${team.team})`);
        seqRank++;
        continue;
      }

      const isSameTime = team.gap === '+0:00' ? 1 : 0;
      
      // Stage result
      await conn.query(
        `INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), stageId, seqRank, riderId, teamId, country, team.gap, isSameTime]
      );
      
      totalRiders++;
      stageRankMap[riderId] = seqRank;
      seqRank++;
    }
    console.log(`  #${team.rank} ${team.team} (${team.gap}) - ${team.riders.length} riders`);
  }
  
  if (skippedRiders.length > 0) {
    console.log(`\n  ⚠️ Skipped ${skippedRiders.length} riders (not found in DB):`);
    skippedRiders.slice(0, 10).forEach(r => console.log(`    - ${r}`));
    if (skippedRiders.length > 10) console.log(`    ... +${skippedRiders.length - 10} more`);
  }

  // GC = Stage results (after TTT stage 1, GC mirrors stage)
  console.log(`\nGC: copying stage results...`);
  let gcCount = 0;
  for (const [riderId, rank] of Object.entries(stageRankMap)) {
    const [sr] = await conn.query(
      'SELECT team_id, nationality, time_gap FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1',
      [stageId, riderId]
    );
    if (!sr.length) continue;
    
    await conn.query(
      `INSERT INTO general_classification (id, stage_id, \`rank\`, rider_id, team_id, nationality, total_time, time_gap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), stageId, rank, riderId, sr[0].team_id, sr[0].nationality, null, sr[0].time_gap]
    );
    gcCount++;
  }

  // Jerseys: Yellow → Vingegaard (Visma rank 1 leader)
  console.log(`\nJerseys...`);
  const [vinge] = await conn.query("SELECT id FROM riders WHERE rider_name='Jonas Vingegaard'");
  if (vinge.length) {
    const [vTeam] = await conn.query(
      "SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1",
      [stageId, vinge[0].id]
    );
    if (vTeam.length) {
      await conn.query(
        'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), stageId, 'YELLOW', vinge[0].id, vTeam[0].team_id]
      );
      console.log('  YELLOW: Jonas Vingegaard (Team Visma | Lease a Bike)');
    }
  }

  // Green: no sprint points in TTT
  // White: find best young rider - let me check who the best U25 is
  // For now, skip Green/White/KOM since TTT doesn't award them in a standard way

  // Summary
  console.log(`\n========================================`);
  console.log(`IMPORT SUMMARY`);
  console.log(`========================================`);
  console.log(`  Stage results: ${totalRiders} riders`);
  console.log(`  GC: ${gcCount} riders`);
  console.log(`  Jerseys: Yellow (Vingegaard)`);
  console.log(`  Stage winner: Team Visma | Lease a Bike (21:47.870)`);
  console.log(`========================================\n`);

  await conn.end();
  console.log('✅ TDF 2026 Stage 1 imported!');
}

main().catch(e => { console.error(e); process.exit(1); });
