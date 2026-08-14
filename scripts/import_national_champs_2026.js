// Import National Championships 2026 results
const mysql = require('mysql2/promise');
const crypto = require('crypto');
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stripD(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cKey(v){return stripD(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ')}

// Define events for each national championship
const EVENTS = [
  // French Nationals - 4 events
  {race:'french-nationals-2026', code:'french-nc-2026-tt-men', num:1, name:'ITT Men', zh:'男子个人计时赛', type:'itt', date:'2026-06-25', km:35},
  {race:'french-nationals-2026', code:'french-nc-2026-tt-women', num:2, name:'ITT Women', zh:'女子个人计时赛', type:'itt', date:'2026-06-25', km:25},
  {race:'french-nationals-2026', code:'french-nc-2026-rr-women', num:3, name:'RR Women', zh:'女子公路赛', type:'hills', date:'2026-06-27', km:130},
  {race:'french-nationals-2026', code:'french-nc-2026-rr-men', num:4, name:'RR Men', zh:'男子公路赛', type:'hills', date:'2026-06-28', km:225},
  // Italian Nationals - 2 events
  {race:'italian-nationals-2026', code:'italian-nc-2026-tt-men', num:1, name:'ITT Men', zh:'男子个人计时赛', type:'itt', date:'2026-06-25', km:35},
  {race:'italian-nationals-2026', code:'italian-nc-2026-rr-men', num:2, name:'RR Men', zh:'男子公路赛', type:'hills', date:'2026-06-27', km:240},
  // Spanish Nationals - 4 events
  {race:'spanish-nationals-2026', code:'spanish-nc-2026-tt-men', num:1, name:'ITT Men', zh:'男子个人计时赛', type:'itt', date:'2026-06-25', km:32},
  {race:'spanish-nationals-2026', code:'spanish-nc-2026-tt-women', num:2, name:'ITT Women', zh:'女子个人计时赛', type:'itt', date:'2026-06-25', km:25},
  {race:'spanish-nationals-2026', code:'spanish-nc-2026-rr-women', num:3, name:'RR Women', zh:'女子公路赛', type:'hills', date:'2026-06-27', km:120},
  {race:'spanish-nationals-2026', code:'spanish-nc-2026-rr-men', num:4, name:'RR Men', zh:'男子公路赛', type:'hills', date:'2026-06-27', km:200},
  // Belgian Nationals - 4 events
  {race:'belgian-nationals-2026', code:'belgian-nc-2026-tt-men', num:1, name:'ITT Men', zh:'男子个人计时赛', type:'itt', date:'2026-06-26', km:35},
  {race:'belgian-nationals-2026', code:'belgian-nc-2026-tt-women', num:2, name:'ITT Women', zh:'女子个人计时赛', type:'itt', date:'2026-06-26', km:25},
  {race:'belgian-nationals-2026', code:'belgian-nc-2026-rr-men', num:3, name:'RR Men', zh:'男子公路赛', type:'hills', date:'2026-06-28', km:235},
  {race:'belgian-nationals-2026', code:'belgian-nc-2026-rr-women', num:4, name:'RR Women', zh:'女子公路赛', type:'hills', date:'2026-06-28', km:130},
];

// Results data (podium = top 3, plus additional where available)
// Format: {code: stage_code, results: [{r:rank, n:name, t:team, time, g:gap}]}
const RESULTS = {};

// French ITT Men
RESULTS['french-nc-2026-tt-men'] = [
  {r:1,n:'Remi Cavagna',t:'Groupama - FDJ United',g:'+00:00'},
  {r:2,n:'Bruno Armirail',t:'Team Visma | Lease a Bike',g:'+00'},
  {r:3,n:'Ewen Costiou',t:'Groupama - FDJ United',g:'+00'},
];

// French ITT Women
RESULTS['french-nc-2026-tt-women'] = [
  {r:1,n:'Celia Le Mouel',t:'Ma Petite Entreprise',g:'+00:00'},
  {r:2,n:'Maeva Squiban',t:'UAE Team ADQ',g:'+00'},
  {r:3,n:'Cedrine Kerbaol',t:'EF Education - Oatly',g:'+00'},
];

// French RR Women
RESULTS['french-nc-2026-rr-women'] = [
  {r:1,n:'Celia Gery',t:'FDJ United - SUEZ',g:'+00:00'},
  {r:2,n:'Cedrine Kerbaol',t:'EF Education - Oatly',g:'+00'},
  {r:3,n:'Emile Morier',t:'St Michel - Preference Home - Auber93',g:'+00'},
];

// French RR Men
RESULTS['french-nc-2026-rr-men'] = [
  {r:1,n:'Romain Gregoire',t:'Groupama - FDJ United',g:'+00:00'},
  {r:2,n:'Julian Alaphilippe',t:'Tudor Pro Cycling Team',g:'+00'},
  {r:3,n:'Valentin Madouas',t:'Groupama - FDJ United',g:'+00'},
  {r:4,n:'Paul Lapeira',t:'Decathlon CMA CGM Team',g:'+00'},
  {r:5,n:'Clement Russo',t:'Groupama - FDJ United',g:'+00'},
];

// Italian ITT Men
RESULTS['italian-nc-2026-tt-men'] = [
  {r:1,n:'Filippo Ganna',t:'Netcompany INEOS',g:'+00:00'},
  {r:2,n:'Luca Giaimi',t:'UAE Team Emirates XRG',g:'+00'},
  {r:3,n:'Mattia Cattaneo',t:'Red Bull - BORA - hansgrohe',g:'+00'},
];

// Italian RR Men
RESULTS['italian-nc-2026-rr-men'] = [
  {r:1,n:'Jonathan Milan',t:'Lidl - Trek',g:'+00:00'},
  {r:2,n:'Tommaso Dati',t:'Team UKYO',g:'+00'},
  {r:3,n:'Alessandro Romele',t:'XDS Astana Team',g:'+00'},
  {r:4,n:'Andrea Bagioli',t:'Lidl - Trek',g:'+00'},
  {r:5,n:'Alberto Bruttomesso',t:'Bahrain Victorious',g:'+00'},
];

// Spanish ITT Men
RESULTS['spanish-nc-2026-tt-men'] = [
  {r:1,n:'Pablo Castrillo',t:'Movistar Team',g:'+00:00'},
  {r:2,n:'Xabier Mikel Azparren Iruzun',t:'Pinarello - Q36.5 Pro Cycling Team',g:'+00'},
  {r:3,n:'Pablo Torres',t:'UAE Team Emirates XRG',g:'+00'},
];

// Spanish ITT Women
RESULTS['spanish-nc-2026-tt-women'] = [
  {r:1,n:'Mireia Benito',t:'AG Insurance - Soudal Team',g:'+00:00'},
  {r:2,n:'Sara Martin Martin',t:'Movistar Team Women',g:'+00'},
  {r:3,n:'Sandra Alonso',t:'Eneicat - Be Call',g:'+00'},
];

// Spanish RR Women
RESULTS['spanish-nc-2026-rr-women'] = [
  {r:1,n:'Mireia Benito',t:'AG Insurance - Soudal Team',g:'+00:00'},
  {r:2,n:'Sara Martin Martin',t:'Movistar Team Women',g:'+00'},
  {r:3,n:'Paula Ostiz',t:'Movistar Team Women',g:'+00'},
];

// Spanish RR Men
RESULTS['spanish-nc-2026-rr-men'] = [
  {r:1,n:'Carlos Canal Blanco',t:'Movistar Team',g:'+00:00'},
  {r:2,n:'Alex Aranburu Deba',t:'Cofidis',g:'+00'},
  {r:3,n:'Jorge Arcas Pena',t:'Movistar Team',g:'+00'},
];

// Belgian ITT Men
RESULTS['belgian-nc-2026-tt-men'] = [
  {r:1,n:'Alec Segaert',t:'Bahrain Victorious',g:'+00:00'},
  {r:2,n:'Tim Wellens',t:'UAE Team Emirates XRG',g:'+00'},
  {r:3,n:'Vlad van Mechelen',t:'Bahrain Victorious',g:'+00'},
];

// Belgian ITT Women
RESULTS['belgian-nc-2026-tt-women'] = [
  {r:1,n:'Lotte Claes',t:'Fenix - Premier Tech',g:'+00:00'},
  {r:2,n:'Sandrine Tas',t:'Lotto Intermarche Ladies',g:'+00'},
  {r:3,n:'Margot Vanpachtenbeke',t:'Lidl - Trek Ladies',g:'+00'},
];

// Belgian RR Men
RESULTS['belgian-nc-2026-rr-men'] = [
  {r:1,n:'Rune Herregodts',t:'UAE Team Emirates XRG',g:'+00:00'},
  {r:2,n:'Jonas Rickaert',t:'Alpecin - Premier Tech',g:'+00'},
  {r:3,n:'Fabio Van Den Bossche',t:'Soudal - Quick Step',g:'+00'},
  {r:4,n:'Jasper Stuyven',t:'Soudal - Quick Step',g:'+00'},
  {r:5,n:'Dylan Teuns',t:'Cofidis',g:'+00'},
];

// Belgian RR Women
RESULTS['belgian-nc-2026-rr-women'] = [
  {r:1,n:'Shari Bossuyt',t:'AG Insurance - Soudal Team',g:'+00:00'},
  {r:2,n:'Lotte Kopecky',t:'Team SD Worx - Protime',g:'+00'},
  {r:3,n:'Sandrine Tas',t:'Lotto Intermarche Ladies',g:'+00'},
];

async function loadIdx(c){const[ri]=await c.query('SELECT id,rider_name FROM riders');const[te]=await c.query('SELECT id,team_name FROM teams');const rn=new Map(),rk=new Map(),tn=new Map(),tk=new Map();for(const r of ri){rn.set(stripD(r.rider_name).toLowerCase(),r);rk.set(cKey(r.rider_name),r)}for(const t of te){tn.set(stripD(t.team_name).toLowerCase(),t);tk.set(cKey(t.team_name),t)}return{rn,rk,tn,tk}}
async function fT(c,ix,nm){const nn=clean(nm),dn=stripD(nn).toLowerCase();let t=ix.tn.get(dn);if(t)return t.id;t=ix.tk.get(cKey(nn));if(t)return t.id;for(const[n,x]of ix.tn){const w=nn.split(' ').filter(w=>w.length>2);if(w.length&&w.filter(w=>n.includes(w.toLowerCase())).length>=Math.min(2,w.length))return x.id}const[f]=await c.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',['%'+nn.split(' ').slice(0,3).join(' ')+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO teams (id,team_name,team_name_en,category,country) VALUES (?,?,?,?,?)',[id,nn,nn,'Continental',null]);return id}
async function fR(c,ix,nm){const tn=clean(nm),dn=stripD(tn).toLowerCase();let r=ix.rn.get(dn);if(r)return r.id;r=ix.rk.get(cKey(tn));if(r)return r.id;const[f]=await c.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1',['%'+tn+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO riders (id,rider_name,nationality) VALUES (?,?,?)',[id,tn,'UNK']);return id}

async function main(){
  const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  await c.beginTransaction();
  try{
    console.log('=== Importing National Championships 2026 ===\n');
    let totalStages = 0, totalResults = 0;

    for(const evt of EVENTS){
      // Find race
      const[race] = await c.query('SELECT id FROM races WHERE race_code=?',[evt.race]);
      if(!race.length){console.log('Race not found:',evt.race);continue;}

      // Check if stage exists, create if not
      let [stg] = await c.query('SELECT id FROM stages WHERE stage_code=?',[evt.code]);
      if(!stg.length){
        const sid = crypto.randomUUID();
        await c.query(`INSERT INTO stages (id,race_id,stage_number,stage_name,stage_name_zh,stage_type,date,distance_km,stage_code) VALUES (?,?,?,?,?,?,?,?,?)`,[
          sid, race[0].id, evt.num, evt.name, evt.zh, evt.type, evt.date, evt.km, evt.code
        ]);
        stg = [{id:sid}];
        totalStages++;
      }

      // Import results
      const data = RESULTS[evt.code];
      if(!data){console.log('  No results for',evt.code);continue;}

      await c.query('DELETE FROM stage_results WHERE stage_id=?',[stg[0].id]);
      await c.query('DELETE FROM general_classification WHERE stage_id=?',[stg[0].id]);

      const ix = await loadIdx(c);
      let sr=0, gc=0;
      for(const r of data){
        const rid = await fR(c,ix,r.n);
        const tid = await fT(c,ix,r.t);
        await c.query('INSERT INTO stage_results (id,stage_id,rank_pos,rider_id,team_id,nationality,time_gap,is_same_time) VALUES (?,?,?,?,?,?,?,?)',
          [crypto.randomUUID(),stg[0].id,r.r,rid,tid,'UNK',r.time||null,(r.g==='+00:00')?1:0]);
        sr++;
        await c.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,time_gap) VALUES (?,?,?,?,?,?,?)',
          [crypto.randomUUID(),stg[0].id,r.r,rid,tid,'UNK',r.g]);
        gc++;
      }
      console.log(`  ${evt.race}/${evt.code}: ${sr} results, ${gc} GC`);
      totalResults += sr;
    }

    await c.commit();
    console.log(`\nDone! Created ${totalStages} stages, imported ${totalResults} results.`);
  } catch(e){console.error(e);await c.rollback();}
  await c.end();
}
main();
