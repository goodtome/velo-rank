/**
 * TDF 2026 Stage 2 (Tarragona → Barcelona, 168.5km, HILLS)
 * 
 * Import to local MySQL + sync to production TiDB
 * Data source: PCS race/tour-de-france/2026/stage-2 (2026-07-06)
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const LOCAL = { host: '127.0.0.1', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db' };
const PROD = { host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', port: 4000, user: '2A7GiKTCf4sRJLw.root', password: 'JkDXt0GyOnhMIagc', database: 'jersey_db', ssl: { rejectUnauthorized: true } };

// Stage 2 results from PCS: [rank, rider_name, gap]
const STAGE2 = [
  [1,'Isaac Del Toro','+0:00'],[2,'Tadej Pogacar','+0:00'],[3,'Remco Evenepoel','+0:00'],
  [4,'Jonas Vingegaard','+0:00'],[5,'Mattias Skjelmose','+0:03'],[6,'Tobias Halland Johannessen','+0:03'],
  [7,'Romain Gregoire','+0:03'],[8,'Paul Seixas','+0:03'],[9,'Lenny Martinez','+0:03'],
  [10,'Tom Pidcock','+0:03'],[11,'Lennert Van Eetvelt','+0:03'],[12,'Juan Ayuso','+0:03'],
  [13,'Ilan Van Wilder','+0:03'],[14,'Richard Carapaz','+0:07'],[15,'Alex Baudin','+0:10'],
  [16,'Florian Lipowitz','+0:10'],[17,'Cian Uijtdebroeks','+0:27'],[18,'Adam Yates','+0:39'],
  [19,'Tobias Foss','+0:43'],[20,'Sergio Higuita','+0:43'],[21,'Thymen Arensman','+0:47'],
  [22,'Mathieu Van Der Poel','+0:47'],[23,'Egan Bernal','+0:47'],[24,'Alex Aranburu','+0:49'],
  [25,'Harold Tejada','+0:51'],[26,'Jose Felix Parra','+0:54'],[27,'Yannis Voisard','+1:10'],
  [28,'Davide Piganzoli','+1:10'],[29,'Jordan Jegat','+1:10'],[30,'Ion Izagirre','+1:11'],
  [31,'Javier Romo','+1:18'],[32,'Abel Balderstone','+1:18'],[33,'Joris Delbove','+1:36'],
  [34,'Sean Quinn','+1:39'],[35,'Torstein Traeen','+1:55'],[36,'Jai Hindley','+1:55'],
  [37,'Tiesj Benoot','+1:55'],[38,'Mathias Vacek','+5:02'],[39,'Brandon McNulty','+5:02'],
  [40,'Ben O\'Connor','+5:31'],[41,'Matthew Riccitello','+5:31'],[42,'Guillaume Martin','+5:31'],
  [43,'George Bennett','+5:31'],[44,'Luke Plapp','+5:31'],[45,'Derek Gee-West','+5:31'],
  [46,'Antonio Tiberi','+5:44'],[47,'Quinten Hermans','+5:57'],[48,'Matteo Jorgenson','+6:03'],
  [49,'Mauro Schmid','+6:21'],[50,'Bruno Armirail','+6:52'],[51,'Kevin Vauquelin','+6:52'],
  [52,'Sepp Kuss','+6:52'],[53,'Anders Halland Johannessen','+6:52'],[54,'Clement Braz Afonso','+7:15'],
  [55,'Anders Skaarseth','+8:40'],[56,'Pascal Eenkhoorn','+9:28'],[57,'Georg Steinhauser','+9:28'],
  [58,'Georg Zimmermann','+9:28'],[59,'Rick Pluimers','+9:28'],[60,'Robbe Dhondt','+9:28'],
  [61,'Sebastian Berwick','+9:28'],[62,'Nicolas Prodhomme','+9:28'],[63,'Louis Vervaeke','+9:28'],
  [64,'Marc Hirschi','+9:28'],[65,'Lars Craps','+9:28'],[66,'Emiel Verstrynge','+9:28'],
  [67,'Chris Harper','+9:28'],[68,'Ramses Debruyne','+9:40'],[69,'Quentin Pacher','+10:24'],
  [70,'Joel Nicolau','+11:01'],[71,'Maxim Van Gils','+11:06'],[72,'Xandro Meurisse','+11:06'],
  [73,'Damiano Caruso','+11:06'],[74,'Thibault Guernalec','+11:06'],[75,'Marco Frigo','+11:06'],
  [76,'Robert Stannard','+11:06'],[77,'Nelson Oliveira','+11:06'],[78,'Lorenzo Germani','+11:06'],
  [79,'Ewen Costiou','+11:06'],[80,'Alexandre Delettre','+11:06'],[81,'Matteo Vercher','+11:06'],
  [82,'Nicolas Breuillard','+11:06'],[83,'Mattia Cattaneo','+11:06'],[84,'Benjamin Thomas','+11:06'],
  [85,'Joshua Tarling','+11:06'],[86,'Michal Kwiatkowski','+11:06'],[87,'Mike Teunissen','+11:06'],
  [88,'Luke Durbridge','+11:06'],[89,'Dylan van Baarle','+11:06'],[90,'Raul Garcia Pierna','+11:06'],
  [91,'Julian Alaphilippe','+11:06'],[92,'Michael Matthews','+11:57'],[93,'Valentin Paret-Peintre','+12:08'],
  [94,'Clement Russo','+12:08'],[95,'Niklas Markl','+12:08'],[96,'Aurelien Paret-Peintre','+12:08'],
  [97,'Aaron Gate','+12:08'],[98,'Victor Campenaerts','+12:08'],[99,'Tim Wellens','+12:08'],
  [100,'Felix Grossschartner','+12:08'],[101,'Mathis Le Berre','+12:08'],[102,'Carlos Verona','+12:08'],
  [103,'Jonas Rickaert','+12:08'],[104,'Kasper Asgreen','+12:08'],[105,'Max Walker','+12:16'],
  [106,'Michael Valgren','+12:16'],[107,'Ben Healy','+12:16'],[108,'Michel Hessmann','+12:16'],
  [109,'Jenno Berckmoes','+12:16'],[110,'Lewis Askey','+12:30'],[111,'Edward Planckaert','+12:47'],
  [112,'Felix Engelhardt','+13:33'],[113,'Nils Politt','+13:33'],[114,'Jonas Abrahamsen','+13:33'],
  [115,'Tom Van Asbroeck','+13:33'],[116,'Silvan Dillier','+13:33'],[117,'Nicolas Vinokurov','+13:33'],
  [118,'Hugo Page','+13:33'],[119,'Einer Rubio','+13:33'],[120,'Nico Denz','+13:33'],
  [121,'Dorian Godon','+13:33'],[122,'Warren Barguil','+13:33'],[123,'John Degenkolb','+13:33'],
  [124,'Xabier Mikel Azparren','+13:33'],[125,'Damien Howson','+13:33'],[126,'Jefferson Alveiro Cepeda','+13:33'],
  [127,'Pablo Castrillo','+13:33'],[128,'Tim Marsman','+13:33'],[129,'Anthon Charmig','+13:33'],
  [130,'Anthony Turgis','+13:33'],[131,'Matis Louvel','+13:33'],[132,'Jasper Philipsen','+13:33'],
  [133,'Jasper Stuyven','+13:33'],[134,'Brent Van Moer','+13:33'],[135,'Florian Vermeersch','+13:33'],
  [136,'Tim van Dijke','+13:33'],[137,'Frits Biesterbos','+13:33'],[138,'Michael Storer','+13:33'],
  [139,'Pavel Bittner','+13:33'],[140,'Stefano Oldani','+13:33'],[141,'Fernando Gaviria','+13:33'],
  [142,'Max Kanter','+13:33'],[143,'Jenthe Biermans','+13:33'],[144,'Jakub Otruba','+13:33'],
  [145,'Toms Skujins','+13:33'],[146,'Krists Neilands','+13:33'],[147,'Tim Merlier','+13:33'],
  [148,'Daan Hoole','+13:33'],[149,'Milan Fretin','+13:46'],[150,'Magnus Cort','+13:52'],
  [151,'Matej Mohoric','+13:56'],[152,'Jan Tratnik','+13:56'],[153,'Quinn Simmons','+13:56'],
  [154,'Alex Kirsch','+13:56'],[155,'Jake Stewart','+13:56'],[156,'Mads Pedersen','+13:56'],
  [157,'Biniam Girmay','+13:56'],[158,'Arvid de Kleijn','+13:56'],[159,'Phil Bauhaus','+13:56'],
  [160,'Julius van den Berg','+13:56'],[161,'Frank van den Broek','+13:56'],[162,'Pascal Ackermann','+13:56'],
  [163,'Kamil Gradek','+13:56'],[164,'Simone Velasco','+13:56'],[165,'Alex Molenaar','+13:56'],
  [166,'Piet Allegaert','+13:56'],[167,'Vlad Van Mechelen','+14:20'],[168,'Fred Wright','+14:20'],
  [169,'Filippo Ganna','+14:43'],[170,'Bert Van Lerberghe','+14:51'],[171,'Per Strand Hagenes','+15:02'],
  [172,'Soren Waerenskjold','+15:06'],[173,'Matteo Trentin','+15:29'],[174,'Huub Artz','+15:29'],
  [175,'Davide Ballerini','+15:44'],[176,'Marco Haller','+16:08'],[177,'Liam Slock','+16:33'],
  [178,'Edoardo Affini','+16:47'],[179,'Kelland O\'Brien','+17:49'],[180,'Olav Kooij','+18:08'],
  [181,'Cees Bol','+18:08'],[182,'Baptiste Veistroffer','+18:25'],[183,'Arnaud De Lie','+18:25']
];

// GC after S2 from PCS: [rank, rider_name, total_time, gap]
const GC = [
  [1,'Jonas Vingegaard','4:01:48','+0:00'],[2,'Tadej Pogacar','4:01:54','+0:06'],
  [3,'Remco Evenepoel','4:02:03','+0:15'],[4,'Isaac Del Toro','4:02:04','+0:16'],
  [5,'Juan Ayuso','4:02:07','+0:19'],[6,'Paul Seixas','4:02:30','+0:42'],
  [7,'Romain Gregoire','4:02:32','+0:44'],[8,'Lenny Martinez','4:02:33','+0:45'],
  [9,'Florian Lipowitz','4:02:41','+0:53'],[10,'Tom Pidcock','4:02:48','+1:00'],
  [11,'Ilan Van Wilder','4:02:49','+1:01'],[12,'Tobias Halland Johannessen','4:02:51','+1:03'],
  [13,'Alex Baudin','4:02:55','+1:07'],[14,'Tobias Foss','4:03:09','+1:21'],
  [15,'Mathieu Van Der Poel','4:03:14','+1:26'],[16,'Mattias Skjelmose','4:03:24','+1:36'],
  [17,'Davide Piganzoli','4:03:26','+1:38'],[18,'Lennert Van Eetvelt','4:03:27','+1:39'],
  [19,'Thymen Arensman','4:03:31','+1:43'],[20,'Richard Carapaz','4:03:36','+1:48'],
  [21,'Jordan Jegat','4:04:00','+2:12'],[22,'Cian Uijtdebroeks','4:04:08','+2:20'],
  [23,'Yannis Voisard','4:04:12','+2:24'],[24,'Ion Izagirre','4:04:16','+2:28'],
  [25,'Jose Felix Parra','4:04:20','+2:32'],[26,'Sergio Higuita','4:04:49','+3:01'],
  [27,'Abel Balderstone','4:04:58','+3:10'],[28,'Torstein Traeen','4:05:12','+3:24'],
  [29,'Harold Tejada','4:05:25','+3:37'],[30,'Sean Quinn','4:05:35','+3:47'],
  [31,'Egan Bernal','4:05:41','+3:53'],[32,'Javier Romo','4:05:52','+4:04'],
  [33,'Jai Hindley','4:06:07','+4:19'],[34,'Alex Aranburu','4:06:31','+4:43'],
  [35,'Adam Yates','4:06:54','+5:06'],[36,'Tiesj Benoot','4:07:02','+5:14'],
  [37,'Joris Delbove','4:07:58','+6:10'],[38,'Mathias Vacek','4:08:02','+6:14'],
  [39,'Matthew Riccitello','4:08:09','+6:21'],[40,'Antonio Tiberi','4:08:19','+6:31'],
  [41,'George Bennett','4:08:35','+6:47'],[42,'Brandon McNulty','4:09:16','+7:28'],
  [43,'Luke Plapp','4:09:16','+7:28'],[44,'Derek Gee-West','4:09:22','+7:34'],
  [45,'Kevin Vauquelin','4:09:54','+8:06']
];

function parseSeconds(gap) {
  if (!gap || gap === '+0:00' || gap === '0:00') return 0;
  const parts = gap.replace('+','').split(':').map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return 0;
}

async function findRider(conn, name) {
  const [r] = await conn.query('SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [name]);
  if (r.length) return r[0].id;
  const [r2] = await conn.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1', [`%${name.split(' ').pop()}%`]);
  return r2.length ? r2[0].id : null;
}

async function getS1Gap(conn, riderId) {
  const [r] = await conn.query(
    'SELECT time_gap FROM stage_results WHERE stage_id=(SELECT id FROM stages WHERE race_id=(SELECT id FROM races WHERE race_code=?) AND stage_number=1) AND rider_id=? LIMIT 1',
    ['tdf-2026', riderId]
  );
  return r.length ? (r[0].time_gap || '+0:00') : '+0:00';
}

async function importToDb(conn, dbName) {
  const [race] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  const raceId = race[0].id;
  const [stage] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=2', [raceId]);
  const stageId = stage[0].id;

  // Clear existing
  await conn.query('DELETE FROM stage_results WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM general_classification WHERE stage_id=?', [stageId]);
  await conn.query('DELETE FROM jerseys WHERE stage_id=?', [stageId]);

  // Import stage results
  let imported = 0, skipped = 0;
  console.log(`\n  [${dbName}] Stage results:`);
  for (const [rank, name, gap] of STAGE2) {
    const riderId = await findRider(conn, name);
    if (!riderId) {
      if (skipped < 5) console.log(`    ⚠️ Not found: ${name}`);
      skipped++;
      continue;
    }
    
    // Get team from S1
    const [sr1] = await conn.query(
      'SELECT team_id, nationality FROM stage_results WHERE stage_id=(SELECT id FROM stages WHERE race_id=? AND stage_number=1) AND rider_id=? LIMIT 1',
      [raceId, riderId]
    );
    const teamId = sr1.length ? sr1[0].team_id : null;
    const nationality = sr1.length ? sr1[0].nationality : 'UNK';
    const isSameTime = gap === '+0:00' ? 1 : 0;

    await conn.query(
      'INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, is_same_time) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), stageId, rank, riderId, teamId, nationality, gap, isSameTime]
    );
    imported++;
  }
  if (skipped > 0) console.log(`    ⚠️ ${skipped} riders not found`);
  console.log(`    ${imported} results imported`);

  // Compute GC = S1 gaps + S2 gaps + time bonuses
  console.log(`  [${dbName}] GC:`);
  const [s2Results] = await conn.query(
    'SELECT rider_id, time_gap FROM stage_results WHERE stage_id=? ORDER BY rank_pos', [stageId]
  );
  
  // Build GC entries
  const gcEntries = [];
  for (const sr of s2Results) {
    const s1Gap = await getS1Gap(conn, sr.rider_id);
    const s1Sec = parseSeconds(s1Gap);
    const s2Sec = parseSeconds(sr.time_gap);
    let totalSec = s1Sec + s2Sec;
    
    // Time bonuses for top 3
    const s2Result = STAGE2.find(s => {
      const idx = s2Results.indexOf(sr);
      return idx >= 0 && STAGE2[idx] && STAGE2[idx][1];
    });
    // Simpler: match by rank
    const srRank = s2Results.indexOf(sr) + 1;
    if (srRank === 1) totalSec -= 10;
    else if (srRank === 2) totalSec -= 6;
    else if (srRank === 3) totalSec -= 4;
    
    gcEntries.push({ riderId: sr.rider_id, totalSec, s1Gap, s2Gap: sr.time_gap });
  }
  
  // Sort by total time
  gcEntries.sort((a, b) => a.totalSec - b.totalSec);
  
  let gcImported = 0;
  // Insert top 45 with official PCS data where available
  const gcMap = new Map(GC.map(g => [g[1].toLowerCase(), g]));
  
  for (let i = 0; i < gcEntries.length; i++) {
    const entry = gcEntries[i];
    const rank = i + 1;
    
    // Get rider name
    const [rider] = await conn.query('SELECT rider_name FROM riders WHERE id=?', [entry.riderId]);
    const riderName = rider.length ? rider[0].rider_name.toLowerCase() : '';
    
    // Get team
    const [sr1] = await conn.query(
      'SELECT team_id, nationality FROM stage_results WHERE stage_id=(SELECT id FROM stages WHERE race_id=? AND stage_number=1) AND rider_id=? LIMIT 1',
      [raceId, entry.riderId]
    );
    const teamId = sr1.length ? sr1[0].team_id : null;
    const nationality = sr1.length ? sr1[0].nationality : 'UNK';
    
    // Use official PCS gap if available
    let totalTime = null;
    let timeGap = null;
    const official = gcMap.get(riderName);
    
    if (official && official[0] === rank) {
      timeGap = rank === 1 ? '+0:00' : official[3];
      if (rank === 1) totalTime = official[2]; // leader's total time
    } else if (rank === 1) {
      timeGap = '+0:00';
    } else {
      const gapSec = entry.totalSec - gcEntries[0].totalSec;
      timeGap = '+' + Math.floor(gapSec/60) + ':' + String(gapSec%60).padStart(2,'0');
    }
    
    // Convert seconds to H:MM:SS for total time (leader only)
    if (rank === 1) {
      const h = Math.floor(entry.totalSec / 3600);
      const m = Math.floor((entry.totalSec % 3600) / 60);
      const s = entry.totalSec % 60;
      totalTime = `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    
    await conn.query(
      'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), stageId, rank, entry.riderId, teamId, nationality, totalTime, timeGap]
    );
    gcImported++;
  }
  console.log(`    ${gcImported} GC entries`);

  // Jerseys
  console.log(`  [${dbName}] Jerseys:`);
  
  // Yellow: Vingegaard (GC #1)
  if (gcEntries.length > 0) {
    const [vinge] = await conn.query("SELECT id FROM riders WHERE rider_name='Jonas Vingegaard'");
    if (vinge.length) {
      const [vt] = await conn.query('SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, vinge[0].id]);
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'YELLOW', vinge[0].id, vt[0].team_id]);
      console.log('    YELLOW: Jonas Vingegaard');
    }
  }
  
  // Green + White: Isaac del Toro
  const [delToro] = await conn.query("SELECT id FROM riders WHERE rider_name='Isaac Del Toro'");
  let dtTeamId = null;
  if (delToro.length) {
    const [dt] = await conn.query('SELECT team_id FROM stage_results WHERE stage_id=? AND rider_id=? LIMIT 1', [stageId, delToro[0].id]);
    if (dt.length) {
      dtTeamId = dt[0].team_id;
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'GREEN', delToro[0].id, dtTeamId]);
      console.log('    GREEN: Isaac del Toro');
      
      await conn.query('INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?,?,?,?,?)',
        [uuidv4(), stageId, 'WHITE', delToro[0].id, dtTeamId]);
      console.log('    WHITE: Isaac del Toro');
    }
  }
  
  // Polka dot: Unknown for S2 (no major KOM points reported for this hilly stage)
  // Skip for now
  
  console.log(`  [${dbName}] Done.`);
}

async function verify(conn, dbName) {
  const [race] = await conn.query("SELECT id FROM races WHERE race_code='tdf-2026'");
  const raceId = race[0].id;
  const [s2] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=2', [raceId]);
  const stageId = s2[0].id;
  
  const [sr] = await conn.query('SELECT COUNT(*) as c FROM stage_results WHERE stage_id=?', [stageId]);
  const [gc] = await conn.query('SELECT COUNT(*) as c FROM general_classification WHERE stage_id=?', [stageId]);
  const [j] = await conn.query('SELECT COUNT(*) as c FROM jerseys WHERE stage_id=?', [stageId]);
  
  console.log(`\n  [${dbName}] S2: stage=${sr[0].c} GC=${gc[0].c} jerseys=${j[0].c}`);
}

async function main() {
  console.log('=== TDF 2026 Stage 2 Import ===');
  console.log('Stage: Tarragona → Barcelona (168.5km, HILLS)');
  console.log('Winner: Isaac del Toro (UAE Team Emirates - XRG) 3:40:01\n');

  // Step 1: Local MySQL
  console.log('Step 1: Import to local MySQL...');
  const localConn = await mysql.createConnection(LOCAL);
  await importToDb(localConn, 'LOCAL');
  await verify(localConn, 'LOCAL');
  await localConn.end();

  // Step 2: Production TiDB
  console.log('\nStep 2: Sync to production TiDB...');
  const prodConn = await mysql.createConnection(PROD);
  await importToDb(prodConn, 'PROD');
  await verify(prodConn, 'PROD');
  await prodConn.end();

  console.log('\n✅ TDF 2026 Stage 2 imported to both local and production!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
