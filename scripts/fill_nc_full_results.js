// Fill complete rankings for National Championships 2026
const mysql = require('mysql2/promise');
const crypto = require('crypto');
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stripD(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cKey(v){return stripD(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ')}

// ===== FRENCH MEN'S ITT - 74 finishers =====
const FR_MTT = [
{r:1,n:'Remi Cavagna',t:'Groupama - FDJ United',time:'36:54',g:'+00:00'},{r:2,n:'Bruno Armirail',t:'Team Visma | Lease a Bike',g:'+49'},{r:3,n:'Ewen Costiou',t:'Groupama - FDJ United',g:'+01:03'},{r:4,n:'Maxime Decomble',t:'Groupama - FDJ United',g:'+01:16'},{r:5,n:'Arthur Blaise',t:'AARCO',g:'+01:28'},{r:6,n:'Thibaud Gruel',t:'Groupama - FDJ United',g:'+01:46'},{r:7,n:'Leo Bisiaux',t:'Decathlon CMA CGM Team',g:'+01:49'},{r:8,n:'Thibault Guernalec',t:'TotalEnergies',g:'+01:49'},{r:9,n:'Samuel Leroux',t:'TotalEnergies',g:'+02:02'},{r:10,n:'Thomas Gachignard',t:'TotalEnergies',g:'+02:07'},{r:11,n:'Mathias Ribeiro Da Cruz',t:'Unattached',g:'+02:23'},{r:12,n:'Theo Delacroix',t:'St Michel - Preference Home - Auber93',g:'+02:26'},{r:13,n:'Mavric Beaune',t:'Unattached',g:'+02:48'},{r:14,n:'Leandre Huck',t:'Van Rysel - Roubaix',g:'+02:54'},{r:15,n:'Thomas Denis',t:'Unattached',g:'+03:05'},{r:16,n:'Artus Jaladeau',t:'Unattached',g:'+03:05'},{r:17,n:'Benjamin Buchetet',t:'Unattached',g:'+03:21'},{r:18,n:'Quentin Bezza',t:'Unattached',g:'+03:24'},{r:19,n:'Pierre Thierry',t:'TotalEnergies',g:'+03:26'},{r:20,n:'Luca De Vincenzi',t:'Unattached',g:'+03:34'},{r:21,n:'Ellande Larronde',t:'Caja Rural - Seguros RGA',g:'+03:41'},{r:22,n:'Ludovic Morice',t:'Unattached',g:'+03:44'},{r:23,n:'Tanguy Floch Prigent',t:'Unattached',g:'+03:45'},{r:24,n:'Alexandre Jamet',t:'Unattached',g:'+04:10'},{r:25,n:'Jules Hue',t:'Unattached',g:'+04:10'},{r:26,n:'Erwan Besnier',t:'Unattached',g:'+04:13'},{r:27,n:'Aurelien Lionnet',t:'Unattached',g:'+04:20'},{r:28,n:'Kevin Avoine',t:'Van Rysel - Roubaix',g:'+04:23'},{r:29,n:'Jeremy Lecroq',t:'St Michel - Preference Home - Auber93',g:'+04:35'},{r:30,n:'Eliott Boulet',t:'Groupama - FDJ United',g:'+04:38'},
];

// ===== FRENCH MEN'S ROAD RACE - 39 finishers =====
const FR_MRR = [
{r:1,n:'Romain Gregoire',t:'Groupama - FDJ United',time:'05:12:47',g:'+00:00'},{r:2,n:'Paul Lapeira',t:'Decathlon CMA CGM Team',g:'+13'},{r:3,n:'Joris Delbove',t:'TotalEnergies',g:'+14'},{r:4,n:'Alex Baudin',t:'EF Education - EasyPost',g:'+22'},{r:5,n:'Leo Bisiaux',t:'Decathlon CMA CGM Team',g:'+26'},{r:6,n:'Clement Berthet',t:'Groupama - FDJ United',g:'+49'},{r:7,n:'Jordan Jegat',t:'TotalEnergies',g:'+01:24'},{r:8,n:'Alexandre Delettre',t:'TotalEnergies',g:'+01:24'},{r:9,n:'Axel Mariault',t:'Unattached',g:'+01:24'},{r:10,n:'Dorian Godon',t:'Netcompany INEOS',g:'+01:29'},{r:11,n:'Axel Laurance',t:'Netcompany INEOS',g:'+01:29'},{r:12,n:'Julien Bernard',t:'Lidl - Trek',g:'+01:29'},{r:13,n:'Nicolas Breuillard',t:'TotalEnergies',g:'+01:29'},{r:14,n:'Valentin Madouas',t:'Groupama - FDJ United',g:'+01:56'},{r:15,n:'Aubin Sparfel',t:'Decathlon CMA CGM Development Team',g:'+01:56'},{r:16,n:'Pavel Sivakov',t:'UAE Team Emirates XRG',g:'+01:56'},{r:17,n:'Mathieu Burgaudeau',t:'TotalEnergies',g:'+01:56'},{r:18,n:'Paul Magnier',t:'Soudal - Quick Step',g:'+03:05'},{r:19,n:'Benoit Cosnefroy',t:'UAE Team Emirates XRG',g:'+03:05'},{r:20,n:'Matteo Vercher',t:'TotalEnergies',g:'+03:12'},{r:21,n:'Maxime Vezie',t:'Unattached',g:'+05:43'},{r:22,n:'Rudy Molard',t:'Groupama - FDJ United',g:'+06:31'},{r:23,n:'Quentin Pacher',t:'Groupama - FDJ United',g:'+06:31'},{r:24,n:'Ewen Costiou',t:'Groupama - FDJ United',g:'+06:31'},{r:25,n:'Clement Braz Afonso',t:'Groupama - FDJ United',g:'+06:31'},{r:26,n:'Clement Venturini',t:'Unibet Rose Rockets',g:'+07:20'},{r:27,n:'Sandy Dujardin',t:'TotalEnergies',g:'+07:20'},{r:28,n:'Valentin Paret-Peintre',t:'Soudal - Quick Step',g:'+08:05'},{r:29,n:'Simon Guglielmi',t:'St Michel - Preference Home - Auber93',g:'+10:56'},{r:30,n:'Jordan Labrosse',t:'Decathlon CMA CGM Team',g:'+10:56'},{r:31,n:'Lenaic Langella',t:'Unattached',g:'+11:32'},{r:32,n:'Remi Capron',t:'Van Rysel - Roubaix',g:'+12:03'},{r:33,n:'Axel Huens',t:'Groupama - FDJ United',g:'+12:03'},{r:34,n:'Paul Ourselin',t:'Cofidis',g:'+12:03'},{r:35,n:'Benjamin Thomas',t:'Cofidis',g:'+12:03'},{r:36,n:'Guillaume Martin',t:'Groupama - FDJ United',g:'+12:03'},{r:37,n:'Mathis Le Berre',t:'TotalEnergies',g:'+12:57'},{r:38,n:'Matys Grisel',t:'Lotto - Intermarche',g:'+12:57'},{r:39,n:'Louis Hardouin',t:'Van Rysel - Roubaix',g:'+12:57'},
];

// ===== FRENCH WOMEN'S ROAD RACE - 25 finishers =====
const FR_WRR = [
{r:1,n:'Celia Gery',t:'FDJ United - SUEZ',time:'03:00:27',g:'+00:00'},{r:2,n:'Cedrine Kerbaol',t:'EF Education - Oatly',g:'+05'},{r:3,n:'Emilie Morier',t:'St Michel - Preference Home - Auber93',g:'+07'},{r:4,n:'Maeva Squiban',t:'UAE Team ADQ',g:'+13'},{r:5,n:'Juliette Berthet-Labous',t:'FDJ United - SUEZ',g:'+25'},{r:6,n:'Clemence Latimier',t:'Ma Petite Entreprise',g:'+26'},{r:7,n:'Gladys Verhulst-Wild',t:'AG Insurance - Soudal Team',g:'+01:27'},{r:8,n:'Solene Muller',t:'St Michel - Preference Home - Auber93',g:'+01:43'},{r:9,n:'Lea Curinier',t:'FDJ United - SUEZ',g:'+01:43'},{r:10,n:'Victoire Berteau',t:'Cofidis Women Team',g:'+02:06'},{r:11,n:'Laura Asencio',t:'Ma Petite Entreprise',g:'+03:48'},{r:12,n:'Marie Le Net',t:'FDJ United - SUEZ',g:'+03:53'},{r:13,n:'Marion Bunel',t:'Team Visma | Lease a Bike Women',g:'+04:50'},{r:14,n:'Constance Valentin',t:'Unattached',g:'+06:04'},{r:15,n:'Celia Le Mouel',t:'Ma Petite Entreprise',g:'+06:29'},{r:16,n:'Evita Muzic',t:'FDJ United - SUEZ',g:'+06:31'},{r:17,n:'Titia Ryo',t:'Human Powered Health',g:'+06:42'},{r:18,n:'Amandine Fouquenet',t:'AG Insurance - Soudal Team',g:'+06:47'},{r:19,n:'India Grangier',t:'St Michel - Preference Home - Auber93',g:'+07:03'},{r:20,n:'Alice Coutinho',t:'Unattached',g:'+07:29'},{r:21,n:'Noemie Abgrall',t:'Ma Petite Entreprise',g:'+10:37'},{r:22,n:'Valentine Fortin',t:'Cofidis Women Team',g:'+10:40'},{r:23,n:'Ema Comte',t:'Cofidis Women Team',g:'+14:59'},{r:24,n:'Justine Gegu',t:'Unattached',g:'+14:59'},{r:25,n:'Lea Rondel',t:'Unattached',g:'+23:33'},
];

// ===== FRENCH WOMEN'S ITT - 3 podium =====
const FR_WTT = [
{r:1,n:'Celia Le Mouel',t:'Ma Petite Entreprise',time:'43:57',g:'+00:00'},{r:2,n:'Maeva Squiban',t:'UAE Team ADQ',g:'+01:11'},{r:3,n:'Cedrine Kerbaol',t:'EF Education - Oatly',g:'+24'},
];

// Map data to stage codes
const DATA = {
  'french-nc-2026-tt-men': FR_MTT,
  'french-nc-2026-tt-women': FR_WTT,
  'french-nc-2026-rr-women': FR_WRR,
  'french-nc-2026-rr-men': FR_MRR,
};

async function loadIdx(c){const[ri]=await c.query('SELECT id,rider_name FROM riders');const[te]=await c.query('SELECT id,team_name FROM teams');const rn=new Map(),rk=new Map(),tn=new Map(),tk=new Map();for(const r of ri){rn.set(stripD(r.rider_name).toLowerCase(),r);rk.set(cKey(r.rider_name),r)}for(const t of te){tn.set(stripD(t.team_name).toLowerCase(),t);tk.set(cKey(t.team_name),t)}return{rn,rk,tn,tk}}
async function fT(c,ix,nm){const nn=clean(nm),dn=stripD(nn).toLowerCase();let t=ix.tn.get(dn);if(t)return t.id;t=ix.tk.get(cKey(nn));if(t)return t.id;for(const[n,x]of ix.tn){const w=nn.split(' ').filter(w=>w.length>2);if(w.length&&w.filter(w=>n.includes(w.toLowerCase())).length>=Math.min(2,w.length))return x.id}const[f]=await c.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',['%'+nn.split(' ').slice(0,3).join(' ')+'%']);if(f.length)return f[0].id;return '00000000-0000-0000-0000-000000000000'}
async function fR(c,ix,nm){const tn=clean(nm),dn=stripD(tn).toLowerCase();let r=ix.rn.get(dn);if(r)return r.id;r=ix.rk.get(cKey(tn));if(r)return r.id;const[f]=await c.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1',['%'+tn+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO riders (id,rider_name,nationality) VALUES (?,?,?)',[id,tn,'UNK']);return id}

async function main(){
  const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  await c.beginTransaction();
  try{
    console.log('=== Filling complete rankings ===\n');
    let totalSR=0, totalGC=0;
    for(const [code, data] of Object.entries(DATA)){
      const[st]=await c.query('SELECT id FROM stages WHERE stage_code=?',[code]);
      if(!st.length){console.log('  Skip:',code);continue;}
      await c.query('DELETE FROM stage_results WHERE stage_id=?',[st[0].id]);
      await c.query('DELETE FROM general_classification WHERE stage_id=?',[st[0].id]);
      const ix=await loadIdx(c);
      let sr=0, gc=0;
      for(const r of data){
        const rid=await fR(c,ix,r.n),tid=await fT(c,ix,r.t);
        await c.query('INSERT INTO stage_results (id,stage_id,rank_pos,rider_id,team_id,nationality,time_gap,is_same_time) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.time||null,(r.g==='+00:00')?1:0]);sr++;
        await c.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,time_gap) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.g]);gc++;
      }
      console.log(`  ${code}: ${sr} results`);
      totalSR+=sr; totalGC+=gc;
    }
    await c.commit();
    console.log(`\nDone! ${totalSR} results, ${totalGC} GC entries.`);
  }catch(e){console.error(e);await c.rollback();}
  await c.end();
}
main();
