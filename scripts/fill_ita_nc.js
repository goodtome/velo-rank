// Fill Italian National Championships 2026 complete results
const mysql = require('mysql2/promise');
const crypto = require('crypto');
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stripD(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cKey(v){return stripD(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ')}

// Italian Men's ITT - 17 finishers
const IT_MTT=[
{r:1,n:'Filippo Ganna',t:'Netcompany INEOS',time:'47:40',g:'+00:00'},{r:2,n:'Luca Giaimi',t:'UAE Team Emirates XRG',g:'+02:06'},{r:3,n:'Mattia Cattaneo',t:'Red Bull - BORA - hansgrohe',g:'+02:35'},{r:4,n:'Filippo Baroncini',t:'UAE Team Emirates XRG',g:'+02:40'},{r:5,n:'Matteo Sobrero',t:'Lidl - Trek',g:'+02:57'},{r:6,n:'Lorenzo Mark Finn',t:'Red Bull - BORA - hansgrohe Rookies',g:'+03:22'},{r:7,n:'Mattia Gaffuri',t:'Team Picnic PostNL',g:'+03:27'},{r:8,n:'Jacopo Mosca',t:'Lidl - Trek',g:'+04:15'},{r:9,n:'Alessandro Romele',t:'XDS Astana Team',g:'+04:34'},{r:10,n:'Mirco Maestri',t:'Team Polti VisitMalta',g:'+05:03'},{r:11,n:'Matteo Ambrosini',t:'MBH Bank CSB Telecom Fort',g:'+05:31'},{r:12,n:'Federico Iacomoni',t:'Team Ukyo',g:'+05:40'},{r:13,n:'Mattia Bais',t:'Team Polti VisitMalta',g:'+06:00'},{r:14,n:'Dario Igor Belletta',t:'Team Polti VisitMalta',g:'+06:18'},{r:15,n:'Lorenzo Milesi',t:'Movistar Team',g:'+06:52'},{r:16,n:'Lorenzo Nespoli',t:'MBH Bank CSB Telecom Fort',g:'+06:53'},{r:17,n:'Manuel Dovesi',t:'Unattached',g:'+07:10'},
];

// Italian Men's RR - 71 finishers
const IT_MRR=[
{r:1,n:'Jonathan Milan',t:'Lidl - Trek',time:'04:52:40',g:'+00:00'},{r:2,n:'Tommaso Dati',t:'Team Ukyo',g:'+00'},{r:3,n:'Alessandro Romele',t:'XDS Astana Team',g:'+00'},{r:4,n:'Luca Colnaghi',t:'Bardiani CSF',g:'+00'},{r:5,n:'Marco Manenti',t:'Bardiani CSF',g:'+00'},{r:6,n:'Matteo Trentin',t:'Tudor Pro Cycling Team',g:'+00'},{r:7,n:'Alberto Dainese',t:'Soudal - Quick Step',g:'+00'},{r:8,n:'Gabriele Bessega',t:'Team Polti VisitMalta',g:'+00'},{r:9,n:'Giacomo Ballabio',t:'Unattached',g:'+00'},{r:10,n:'Dario Igor Belletta',t:'Team Polti VisitMalta',g:'+00'},{r:11,n:'Mirco Maestri',t:'Team Polti VisitMalta',g:'+00'},{r:12,n:'Lorenzo Conforti',t:'Bardiani CSF',g:'+00'},{r:13,n:'Sergio Meris',t:'Unibet Rose Rockets',g:'+00'},{r:14,n:'Davide De Pretto',t:'Team Jayco AlUla',g:'+00'},{r:15,n:'Simone Velasco',t:'XDS Astana Team',g:'+00'},{r:16,n:'Gianmarco Garofoli',t:'Soudal - Quick Step',g:'+00'},{r:17,n:'Andrea Piras',t:'Solution Tech - NIPPO - Rali',g:'+00'},{r:18,n:'Cesare Chesini',t:'MBH Bank CSB Telecom Fort',g:'+00'},{r:19,n:'Nicolo Pettiti',t:'Unattached',g:'+00'},{r:20,n:'Lorenzo Masciarelli',t:'MBH Bank CSB Telecom Fort',g:'+00'},{r:21,n:'Andrea Alfio Bruno',t:'Unattached',g:'+00'},{r:22,n:'Lorenzo Milesi',t:'Movistar Team',g:'+00'},{r:23,n:'Lorenzo Rota',t:'Lotto - Intermarche',g:'+00'},{r:24,n:'Edoardo Zamperini',t:'Cofidis',g:'+00'},{r:25,n:'Thomas Pesenti',t:'Team Polti VisitMalta',g:'+00'},{r:26,n:'Matteo Scofet',t:'Unattached',g:'+00'},{r:27,n:'Filippo Baroncini',t:'UAE Team Emirates XRG',g:'+00'},{r:28,n:'Luca Paletti',t:'Bardiani CSF',g:'+00'},{r:29,n:'Pietro Mattio',t:'Team Visma | Lease a Bike',g:'+00'},{r:30,n:'Luca Cretti',t:'MBH Bank CSB Telecom Fort',g:'+00'},{r:31,n:'Valerio Conti',t:'Solution Tech - NIPPO - Rali',g:'+00'},{r:32,n:'Lorenzo Quartucci',t:'Burgos - Burpellet - BH',g:'+00'},{r:33,n:'Mattia Stenico',t:'Bardiani CSF',g:'+00'},{r:34,n:'Davide Bais',t:'Team Polti VisitMalta',g:'+00'},{r:35,n:'Enrico Zanoncello',t:'Bardiani CSF',g:'+00'},{r:36,n:'Walter Calzoni',t:'Pinarello - Q36.5 Pro Cycling Team',g:'+00'},{r:37,n:'Federico Iacomoni',t:'Team Ukyo',g:'+00'},{r:38,n:'Diego Bracalente',t:'MBH Bank CSB Telecom Fort',g:'+00'},{r:39,n:'Giacomo Garavaglia',t:'Unattached',g:'+06'},{r:40,n:'Marco Frigo',t:'NSN Cycling Team',g:'+06'},{r:41,n:'Alessio Martinelli',t:'Bardiani CSF',g:'+06'},{r:42,n:'Nicolo Garibbo',t:'Team Ukyo',g:'+06'},{r:43,n:'Mattia Cattaneo',t:'Red Bull - BORA - hansgrohe',g:'+06'},{r:44,n:'Ludovico Crescioli',t:'Team Polti VisitMalta',g:'+06'},{r:45,n:'Fausto Masnada',t:'MBH Bank CSB Telecom Fort',g:'+06'},{r:46,n:'Giulio Ciccone',t:'Lidl - Trek',g:'+06'},{r:47,n:'Alessandro Tonelli',t:'Team Polti VisitMalta',g:'+06'},{r:48,n:'Lorenzo Galimberti',t:'Unattached',g:'+06'},{r:49,n:'Gabriel Fede',t:'Unattached',g:'+08'},{r:50,n:'Vincenzo Albanese',t:'EF Education - EasyPost',g:'+11'},{r:51,n:'Luca Bagnara',t:'Unattached',g:'+19'},{r:52,n:'Manuel Oioli',t:'Unattached',g:'+28'},{r:53,n:'Andrea Raccagni Noviero',t:'Soudal - Quick Step',g:'+32'},{r:54,n:'Manuel Dovesi',t:'Unattached',g:'+44'},{r:55,n:'Lorenzo Mark Finn',t:'Red Bull - BORA - hansgrohe Rookies',g:'+46'},{r:56,n:'Luca Vergallito',t:'Alpecin - Premier Tech',g:'+52'},{r:57,n:'Christian Bagatin',t:'MBH Bank CSB Telecom Fort',g:'+52'},{r:58,n:'Emanuele Ansaloni',t:'Unattached',g:'+52'},{r:59,n:'Matteo Ambrosini',t:'MBH Bank CSB Telecom Fort',g:'+52'},{r:60,n:'Nicola Conci',t:'XDS Astana Team',g:'+52'},{r:61,n:'Francesco Parravano',t:'Unattached',g:'+52'},{r:62,n:'Jacopo Pignatti',t:'Unattached',g:'+52'},{r:63,n:'Alessandro Verre',t:'MBH Bank CSB Telecom Fort',g:'+01:00'},{r:64,n:'Filippo Turconi',t:'Bardiani CSF',g:'+01:12'},{r:65,n:'Mattia Bais',t:'Team Polti VisitMalta',g:'+01:23'},{r:66,n:'Andrea Bagioli',t:'Lidl - Trek',g:'+01:34'},{r:67,n:'Filippo Magli',t:'Bardiani CSF',g:'+01:36'},{r:68,n:'Matteo Turconi',t:'Bardiani CSF',g:'+01:40'},{r:69,n:'Simone Raccani',t:'Team Ukyo',g:'+01:46'},{r:70,n:'Filippo Zana',t:'Soudal - Quick Step',g:'+02:05'},{r:71,n:'Filippo Daiuto',t:'Unattached',g:'+02:23'},
];

const DATA = {
  'italian-nc-2026-tt-men': IT_MTT,
  'italian-nc-2026-rr-men': IT_MRR,
};

async function loadIdx(c){const[ri]=await c.query('SELECT id,rider_name FROM riders');const[te]=await c.query('SELECT id,team_name FROM teams');const rn=new Map(),rk=new Map(),tn=new Map(),tk=new Map();for(const r of ri){rn.set(stripD(r.rider_name).toLowerCase(),r);rk.set(cKey(r.rider_name),r)}for(const t of te){tn.set(stripD(t.team_name).toLowerCase(),t);tk.set(cKey(t.team_name),t)}return{rn,rk,tn,tk}}
async function fT(c,ix,nm){const nn=clean(nm),dn=stripD(nn).toLowerCase();let t=ix.tn.get(dn);if(t)return t.id;t=ix.tk.get(cKey(nn));if(t)return t.id;for(const[n,x]of ix.tn){const w=nn.split(' ').filter(w=>w.length>2);if(w.length&&w.filter(w=>n.includes(w.toLowerCase())).length>=Math.min(2,w.length))return x.id}const[f]=await c.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',['%'+nn.split(' ').slice(0,3).join(' ')+'%']);if(f.length)return f[0].id;return '00000000-0000-0000-0000-000000000000'}
async function fR(c,ix,nm){const tn=clean(nm),dn=stripD(tn).toLowerCase();let r=ix.rn.get(dn);if(r)return r.id;r=ix.rk.get(cKey(tn));if(r)return r.id;const[f]=await c.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1',['%'+tn+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO riders (id,rider_name,nationality) VALUES (?,?,?)',[id,tn,'UNK']);return id}

async function main(){
  const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  await c.beginTransaction();
  try{
    console.log('=== Italian Nationals ===\n');
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
        await c.query('INSERT INTO stage_results (id,stage_id,rank_pos,rider_id,team_id,nationality,time_gap,is_same_time) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.time||null,(r.g==='+00:00'||r.g==='+00')?1:0]);sr++;
        await c.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,time_gap) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.g]);gc++;
      }
      console.log(`  ${code}: ${sr} results`);
      totalSR+=sr; totalGC+=gc;
    }
    await c.commit();
    console.log(`\nDone! Italian: ${totalSR} results.`);
  }catch(e){console.error(e);await c.rollback();}
  await c.end();
}
main();
