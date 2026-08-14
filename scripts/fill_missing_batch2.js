// Fill missing GC: Tour of Slovenia Stage 2 + BBT Stage 2 & 3
const mysql = require('mysql2/promise');
const crypto = require('crypto');
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stripD(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cKey(v){return stripD(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ')}

// === Tour of Slovenia Stage 2 GC (113 riders) ===
const TOS_S2=[
{r:1,n:'Laurence Pithie',t:'Red Bull - BORA - hansgrohe',tt:'07:34:43',g:'-'},
{r:2,n:'Axel Van Der Tuuk',t:'Euskaltel - Euskadi',g:'+09'},
{r:3,n:'Arne Marit',t:'Red Bull - BORA - hansgrohe',g:'+10'},
{r:4,n:'Edoardo Zambanini',t:'Bahrain Victorious',g:'+12'},
{r:5,n:'Tomas Pridal',t:'Team United Shipping',g:'+16'},
{r:6,n:'Xabier Berasategi Garmendia',t:'Euskaltel - Euskadi',g:'+16'},
{r:7,n:'Ivan Cobo Cayon',t:'Equipo Kern Pharma',g:'+16'},
{r:8,n:'Stefano Oldani',t:'Caja Rural - Seguros RGA',g:'+16'},
{r:9,n:'Lorenzo Masciarelli',t:'MBH Bank CSB Telecom Fort',g:'+16'},
{r:10,n:'Francisco Munoz Llana',t:'Team Polti VisitMalta',g:'+16'},
{r:11,n:'Joel Nicolau Beltran',t:'Caja Rural - Seguros RGA',g:'+16'},
{r:12,n:'Gotzon Martin Sanz',t:'Euskaltel - Euskadi',g:'+16'},
{r:13,n:'Mats Wenzel',t:'Equipo Kern Pharma',g:'+16'},
{r:14,n:'Joseba Lopez Cuesta',t:'Caja Rural - Seguros RGA',g:'+16'},
{r:15,n:'Alessandro Fancellu',t:'MBH Bank CSB Telecom Fort',g:'+16'},
{r:16,n:'Luca Covili',t:'Bardiani CSF',g:'+16'},
{r:17,n:'Domenico Pozzovivo',t:'Solution Tech - NIPPO - Rali',g:'+16'},
{r:18,n:'Davide Bais',t:'Team Polti VisitMalta',g:'+16'},
{r:19,n:'Fausto Masnada',t:'MBH Bank CSB Telecom Fort',g:'+16'},
{r:20,n:'Max van der Meulen',t:'Bahrain Victorious',g:'+16'},
{r:21,n:'Mario Aparicio Munoz',t:'Burgos - Burpellet - BH',g:'+16'},
{r:22,n:'Alex Tolio',t:'Bardiani CSF',g:'+16'},
{r:23,n:'Jakob Omrzel',t:'Bahrain Victorious',g:'+16'},
{r:24,n:'Sebastian Berwick',t:'Caja Rural - Seguros RGA',g:'+16'},
{r:25,n:'Matteo Ambrosini',t:'MBH Bank CSB Telecom Fort',g:'+16'},
{r:26,n:'Samuel Fernandez Garcia',t:'Caja Rural - Seguros RGA',g:'+16'},
{r:27,n:'Roman Ermakov',t:'Bahrain Victorious',g:'+16'},
{r:28,n:'Florian Lipowitz',t:'Red Bull - BORA - hansgrohe',g:'+16'},
{r:29,n:'Giulio Pellizzari',t:'Red Bull - BORA - hansgrohe',g:'+16'},
{r:30,n:'Tilen Finkst',t:'Solution Tech - NIPPO - Rali',g:'+25'},
{r:31,n:'Mattia Cattaneo',t:'Red Bull - BORA - hansgrohe',g:'+01:28'},
{r:32,n:'Jan Tratnik',t:'Red Bull - BORA - hansgrohe',g:'+01:49'},
{r:33,n:'Dusan Rajovic',t:'Solution Tech - NIPPO - Rali',g:'+02:53'},
{r:34,n:'Nikiforos Arvanitou',t:'Team United Shipping',g:'+02:59'},
{r:35,n:'Enrico Zanoncello',t:'Bardiani CSF',g:'+03:03'},
{r:36,n:'Georgios Bouglas',t:'Burgos - Burpellet - BH',g:'+03:03'},
{r:37,n:'Marcin Budzinski',t:'MBH Bank CSB Telecom Fort',g:'+03:03'},
{r:38,n:'Jonathan Lastra Martinez',t:'Euskaltel - Euskadi',g:'+03:03'},
{r:39,n:'Ben Oliver',t:'Modern Adventure Pro Cycling',g:'+03:03'},
{r:40,n:'Thomas Pesenti',t:'Team Polti VisitMalta',g:'+03:03'},
{r:41,n:'Carlos Garcia Pierna',t:'Burgos - Burpellet - BH',g:'+03:03'},
{r:42,n:'Josh Burnett',t:'Burgos - Burpellet - BH',g:'+03:03'},
{r:43,n:'Nicolas Gojkovic',t:'Pogi Team Gusto Ljubljana',g:'+03:03'},
{r:44,n:'Jon Agirre Egana',t:'Euskaltel - Euskadi',g:'+03:03'},
{r:45,n:'Fran Miholjevic',t:'Bahrain Victorious',g:'+03:03'},
{r:46,n:'Hugo De La Calle Arango',t:'Burgos - Burpellet - BH',g:'+03:03'},
{r:47,n:'Jorge Gutierrez Gonzalez',t:'Equipo Kern Pharma',g:'+03:03'},
{r:48,n:'Louis Sutton',t:'Euskaltel - Euskadi',g:'+03:03'},
{r:49,n:'Erik Fetter',t:'Team United Shipping',g:'+03:03'},
{r:50,n:'Alessandro Tonelli',t:'Team Polti VisitMalta',g:'+03:03'},
{r:51,n:'Byron Munton',t:'Modern Adventure Pro Cycling',g:'+03:03'},
{r:52,n:'Thomas Oliver Stockwell',t:'Bahrain Victorious',g:'+03:14'},
{r:53,n:'Gorka Corres Ibanez De Opakua',t:'Caja Rural - Seguros RGA',g:'+06:12'},
{r:54,n:'Anze Ravbar',t:'Factor Racing',g:'+08:40'},
{r:55,n:'Sam Brand',t:'Team Novo Nordisk',g:'+08:57'},
{r:56,n:'Antonio Jesus Soto Guirao',t:'Equipo Kern Pharma',g:'+08:59'},
{r:57,n:'Alberto Bruttomesso',t:'Bahrain Victorious',g:'+08:59'},
{r:58,n:'David Lozano Riba',t:'Team Novo Nordisk',g:'+08:59'},
{r:59,n:'Nejc Peterlin',t:'KK Tarnovia Tarnowo Podgorne',g:'+08:59'},
{r:60,n:'Zeteny Szijarto',t:'Team United Shipping',g:'+08:59'},
{r:61,n:'Unai Iribar Jauregi',t:'Equipo Kern Pharma',g:'+08:59'},
{r:62,n:'Jose Manuel Diaz Gallego',t:'Burgos - Burpellet - BH',g:'+08:59'},
{r:63,n:'Ben Zwiehoff',t:'Red Bull - BORA - hansgrohe',g:'+08:59'},
{r:64,n:'Fabrizio Crozzolo',t:'Team Polti VisitMalta',g:'+08:59'},
{r:65,n:'Lorenzo Quartucci',t:'Burgos - Burpellet - BH',g:'+08:59'},
{r:66,n:'Stefan De Bod',t:'Modern Adventure Pro Cycling',g:'+08:59'},
{r:67,n:'Michal Schuran',t:'Team United Shipping',g:'+08:59'},
{r:68,n:'Jaka Marolt',t:'Factor Racing',g:'+08:59'},
{r:69,n:'Alessandro Iacchi',t:'Solution Tech - NIPPO - Rali',g:'+08:59'},
{r:70,n:'Gabriele Bessega',t:'Team Polti VisitMalta',g:'+08:59'},
{r:71,n:'Alessio Martinelli',t:'Bardiani CSF',g:'+08:59'},
{r:72,n:'Riley Pickrell',t:'Modern Adventure Pro Cycling',g:'+08:59'},
{r:73,n:'Diego Uriarte Belzunegi',t:'Equipo Kern Pharma',g:'+14:09'},
{r:74,n:'Antonio Polga',t:'Team Novo Nordisk',g:'+14:22'},
{r:75,n:'Gasper Stajnar',t:'Pogi Team Gusto Ljubljana',g:'+14:22'},
{r:76,n:'Andrea Montagner',t:'Bardiani CSF',g:'+14:22'},
{r:77,n:'Jon Pritrz nik',t:'Pogi Team Gusto Ljubljana',g:'+14:22'},
{r:78,n:'Zsombor Palumby',t:'Team United Shipping',g:'+14:22'},
{r:79,n:'Mateusz Kostanski',t:'Wibatech Lubelskie Perla Polski',g:'+14:36'},
{r:80,n:'Marcel Gladek',t:'Factor Racing',g:'+14:36'},
{r:81,n:'Radoslaw Fratczak',t:'Wibatech Lubelskie Perla Polski',g:'+14:36'},
{r:82,n:'Davide Persico',t:'MBH Bank CSB Telecom Fort',g:'+14:36'},
{r:83,n:'Juan Jose Lopez Rodriguez',t:'Team Novo Nordisk',g:'+14:36'},
{r:84,n:'Michele Gazzoli',t:'Solution Tech - NIPPO - Rali',g:'+14:36'},
{r:85,n:'Quinten De Graeve',t:'Team Novo Nordisk',g:'+14:36'},
{r:86,n:'Andrea Peron',t:'Team Novo Nordisk',g:'+14:36'},
{r:87,n:'Igor Sek',t:'Wibatech Lubelskie Perla Polski',g:'+14:36'},
{r:88,n:'Lucas Dauge',t:'Team Novo Nordisk',g:'+14:36'},
{r:89,n:'Felix James Meo',t:'Solution Tech - NIPPO - Rali',g:'+14:36'},
{r:90,n:'Samuele Zoccarato',t:'MBH Bank CSB Telecom Fort',g:'+14:36'},
{r:91,n:'Paul Wright',t:'Modern Adventure Pro Cycling',g:'+14:36'},
{r:92,n:'Leon Lukic',t:'KK Tarnovia Tarnowo Podgorne',g:'+17:15'},
{r:93,n:'Samuel Florez Garces',t:'Modern Adventure Pro Cycling',g:'+17:15'},
{r:94,n:'Kacper Majewski',t:'Wibatech Lubelskie Perla Polski',g:'+19:22'},
{r:95,n:'Marcel Skok',t:'KK Tarnovia Tarnowo Podgorne',g:'+19:24'},
{r:96,n:'Bartlomiej Proc',t:'Wibatech Lubelskie Perla Polski',g:'+19:26'},
{r:97,n:'Jakub Musialik',t:'Wibatech Lubelskie Perla Polski',g:'+19:26'},
{r:98,n:'Filippo Cettolin',t:'Bardiani CSF',g:'+19:26'},
{r:99,n:'Vid Murn',t:'KK Tarnovia Tarnowo Podgorne',g:'+19:26'},
{r:100,n:'Bastian Petric',t:'Pogi Team Gusto Ljubljana',g:'+19:26'},
{r:101,n:'Tim Mervar',t:'KK Tarnovia Tarnowo Podgorne',g:'+19:26'},
{r:102,n:'Anze Skok',t:'KK Tarnovia Tarnowo Podgorne',g:'+19:26'},
{r:103,n:'Veljko Stojnic',t:'Team United Shipping',g:'+19:26'},
{r:104,n:'Nejc Komac',t:'Factor Racing',g:'+19:26'},
{r:105,n:'Martin Jurik',t:'KK Tarnovia Tarnowo Podgorne',g:'+19:26'},
{r:106,n:'Taj Zagar',t:'Factor Racing',g:'+19:26'},
{r:107,n:'Paul Hennequin',t:'Euskaltel - Euskadi',g:'+19:26'},
{r:108,n:'Jakob Slibar',t:'Pogi Team Gusto Ljubljana',g:'+19:26'},
{r:109,n:'Mihael Stajnar',t:'Pogi Team Gusto Ljubljana',g:'+19:30'},
{r:110,n:'Gal Oblak',t:'Factor Racing',g:'+23:54'},
{r:111,n:'Ziga Hamun',t:'Pogi Team Gusto Ljubljana',g:'+26:07'},
];

async function loadIdx(c){const[ri]=await c.query('SELECT id,rider_name FROM riders');const[te]=await c.query('SELECT id,team_name FROM teams');const rn=new Map(),rk=new Map(),tn=new Map(),tk=new Map();for(const r of ri){rn.set(stripD(r.rider_name).toLowerCase(),r);rk.set(cKey(r.rider_name),r)}for(const t of te){tn.set(stripD(t.team_name).toLowerCase(),t);tk.set(cKey(t.team_name),t)}return{rn,rk,tn,tk}}
async function fT(c,ix,nm){const nn=clean(nm),dn=stripD(nn).toLowerCase();let t=ix.tn.get(dn);if(t)return t.id;t=ix.tk.get(cKey(nn));if(t)return t.id;for(const[n,x]of ix.tn){const w=nn.split(' ').filter(w=>w.length>2);if(w.length&&w.filter(w=>n.includes(w.toLowerCase())).length>=Math.min(2,w.length))return x.id}const[f]=await c.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',['%'+nn.split(' ').slice(0,3).join(' ')+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO teams (id,team_name,team_name_en,category,country) VALUES (?,?,?,?,?)',[id,nn,nn,'Continental',null]);return id}
async function fR(c,ix,nm){const tn=clean(nm),dn=stripD(tn).toLowerCase();let r=ix.rn.get(dn);if(r)return r.id;r=ix.rk.get(cKey(tn));if(r)return r.id;const[f]=await c.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1',['%'+tn+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO riders (id,rider_name,nationality) VALUES (?,?,?)',[id,tn,'UNK']);return id}

async function main(){
  const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  await c.beginTransaction();
  try{
    console.log('=== ToS Stage 2 GC ===');
    const[st]=await c.query('SELECT id FROM stages WHERE stage_code=?',['tour-of-slovenia-2026-stage-2']);
    await c.query('DELETE FROM general_classification WHERE stage_id=?',[st[0].id]);
    const ix=await loadIdx(c);let gI=0;
    for(const r of TOS_S2){const rid=await fR(c,ix,r.n),tid=await fT(c,ix,r.t);await c.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,total_time,time_gap) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.tt||null,r.g]);gI++}
    console.log('ToS S2 GC:',gI);
    await c.commit();
    console.log('Done!');
  }catch(e){console.error(e);await c.rollback()}
  await c.end();
}
main();
