// Fill BBT Stage 2 GC - final missing data
const mysql = require('mysql2/promise');
const crypto = require('crypto');
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stripD(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cKey(v){return stripD(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ')}

const GC = [
{r:1,n:'Tim Merlier',t:'Soudal - Quick Step',tt:'08:24:05',g:'-'},
{r:2,n:'Biniam Girmay Hailu',t:'NSN Cycling Team',g:'+06'},
{r:3,n:'Bart Kortleve',t:'Metec - Solarwatt P/B Mantel',g:'+08'},
{r:4,n:'Viktor Vandenberghe',t:'Pauwels Sauzen - Altez Industriebouw',g:'+08'},
{r:5,n:'Robbe Mellaerts',t:'Baloise Verzekeringen - Het Poetsbureau Lions',g:'+09'},
{r:6,n:'Olav Kooij',t:'Decathlon CMA CGM Team',g:'+10'},
{r:7,n:'Max Kanter',t:'XDS Astana Team',g:'+12'},
{r:8,n:'Jasper Philipsen',t:'Alpecin - Premier Tech',g:'+12'},
{r:9,n:'Victor Broex',t:'Metec - Solarwatt P/B Mantel',g:'+12'},
{r:10,n:'Wies Nuyens',t:'Pauwels Sauzen - Altez Industriebouw',g:'+13'},
{r:11,n:'Emilien Jeanniere',t:'TotalEnergies',g:'+16'},
{r:12,n:'Soren Waerenskjold',t:'Uno-X Mobility',g:'+16'},
{r:13,n:'Steffen De Schuyteneer',t:'Lotto - Intermarche',g:'+16'},
{r:14,n:'Frits Biesterbos',t:'Team Picnic PostNL',g:'+16'},
{r:15,n:'Arvid de Kleijn',t:'Tudor Pro Cycling Team',g:'+16'},
{r:16,n:'Tom Crabbe',t:'Team Flanders - Baloise',g:'+16'},
{r:17,n:'David Dekker',t:'BEAT CC powered by Saxo',g:'+16'},
{r:18,n:'Jenno Berckmoes',t:'Lotto - Intermarche',g:'+16'},
{r:19,n:'Rui Filipe Oliveira Alves',t:'UAE Team Emirates XRG',g:'+16'},
{r:20,n:'Anthony Turgis',t:'TotalEnergies',g:'+16'},
{r:21,n:'Mike Teunissen',t:'XDS Astana Team',g:'+16'},
{r:22,n:'Emils Liepins',t:'Pinarello - Q36.5 Pro Cycling Team',g:'+16'},
{r:23,n:'Jocelyn Baguelin',t:'AARCO',g:'+16'},
{r:24,n:'Lukas Kubis',t:'Unibet Rose Rockets',g:'+16'},
{r:25,n:'Timothy Dupont',t:'Tarteletto - Isorex',g:'+16'},
{r:26,n:'Daan Depuydt',t:'Baloise Verzekeringen - Het Poetsbureau Lions',g:'+16'},
{r:27,n:'Enaut Urcaregui Sanz',t:'Lidl-Trek Future Racing',g:'+16'},
{r:28,n:'Roan Konings',t:'Metec - Solarwatt P/B Mantel',g:'+16'},
{r:29,n:'Naud De Clercq',t:'Pauwels Sauzen - Altez Industriebouw',g:'+16'},
{r:30,n:'Jochem Kerckhaert',t:'BEAT CC powered by Saxo',g:'+16'},
{r:31,n:'Tibor Del Grosso',t:'Alpecin - Premier Tech',g:'+16'},
{r:32,n:'Hugo Page',t:'Cofidis',g:'+16'},
{r:33,n:'Carlos Canal Blanco',t:'Movistar Team',g:'+16'},
{r:34,n:'Huub Artz',t:'Lotto - Intermarche',g:'+16'},
{r:35,n:'Luca Giaimi',t:'UAE Team Emirates XRG',g:'+16'},
{r:36,n:'Jonas Abrahamsen',t:'Uno-X Mobility',g:'+16'},
{r:37,n:'Florian Vermeersch',t:'UAE Team Emirates XRG',g:'+16'},
{r:38,n:'Lorenzo Milesi',t:'Movistar Team',g:'+16'},
{r:39,n:'Arne Santy',t:'Tarteletto - Isorex',g:'+16'},
{r:40,n:'Michael Vanthourenhout',t:'Pauwels Sauzen - Altez Industriebouw',g:'+16'},
{r:41,n:'Olivier Godfroid',t:'Baloise Verzekeringen - Het Poetsbureau Lions',g:'+16'},
{r:42,n:'Aaron Gate',t:'XDS Astana Team',g:'+16'},
{r:43,n:'Michiel Lambrecht',t:'Team Flanders - Baloise',g:'+16'},
{r:44,n:'Jenthe Biermans',t:'Cofidis',g:'+16'},
{r:45,n:'Brent Van Moer',t:'Pinarello - Q36.5 Pro Cycling Team',g:'+16'},
{r:46,n:'Riley Sheehan',t:'NSN Cycling Team',g:'+16'},
{r:47,n:'Lewis Askey',t:'NSN Cycling Team',g:'+16'},
{r:48,n:'Matyas Kopecky',t:'Unibet Rose Rockets',g:'+16'},
{r:49,n:'Filip Maciejuk',t:'Movistar Team',g:'+16'},
{r:50,n:'Joshua Giddings',t:'Lotto - Intermarche',g:'+16'},
{r:51,n:'Rick Pluimers',t:'Tudor Pro Cycling Team',g:'+16'},
{r:52,n:'Kay De Bruyckere',t:'Pauwels Sauzen - Altez Industriebouw',g:'+16'},
{r:53,n:'Davide Toneatti',t:'XDS Astana Team',g:'+16'},
{r:54,n:'Toon Aerts',t:'Lotto - Intermarche',g:'+16'},
{r:55,n:'Alex Kirsch',t:'Cofidis',g:'+16'},
{r:56,n:'Jasper Stuyven',t:'Soudal - Quick Step',g:'+16'},
{r:57,n:'Vincent Van Hemelen',t:'Team Flanders - Baloise',g:'+16'},
{r:58,n:'Cees Bol',t:'Decathlon CMA CGM Team',g:'+16'},
{r:59,n:'Alex Aranburu Deba',t:'Cofidis',g:'+16'},
{r:60,n:'Thomas Gachignard',t:'TotalEnergies',g:'+16'},
{r:61,n:'Guillaume Boivin',t:'NSN Cycling Team',g:'+16'},
{r:62,n:'Tim Marsman',t:'Alpecin - Premier Tech',g:'+16'},
{r:63,n:'Ryan Gal',t:'Metec - Solarwatt P/B Mantel',g:'+16'},
{r:64,n:'Hector Alvarez Martinez',t:'Lidl - Trek',g:'+16'},
{r:65,n:'Jonas Hvideberg',t:'Uno-X Mobility',g:'+16'},
{r:66,n:'Alexandre Delettre',t:'TotalEnergies',g:'+16'},
{r:67,n:'Ferre Geeraerts',t:'Team Flanders - Baloise',g:'+16'},
{r:68,n:'William Blume Levy',t:'Uno-X Mobility',g:'+16'},
{r:69,n:'Joren Bloem',t:'Unibet Rose Rockets',g:'+16'},
{r:70,n:'Rasmus Tiller',t:'Uno-X Mobility',g:'+16'},
{r:71,n:'Tim Torn Teutenberg',t:'Lidl - Trek',g:'+16'},
{r:72,n:'Jake Stewart',t:'NSN Cycling Team',g:'+16'},
{r:73,n:'Jonas Geens',t:'Alpecin - Premier Tech',g:'+16'},
{r:74,n:'Michiel Coppens',t:'BEAT CC powered by Saxo',g:'+16'},
{r:75,n:'John Degenkolb',t:'Team Picnic PostNL',g:'+16'},
{r:76,n:'Tomas Kopecky',t:'Unibet Rose Rockets',g:'+16'},
{r:77,n:'Dylan van Baarle',t:'Soudal - Quick Step',g:'+16'},
{r:78,n:'Matis Louvel',t:'NSN Cycling Team',g:'+16'},
{r:79,n:'Jonas Rickaert',t:'Alpecin - Premier Tech',g:'+16'},
{r:80,n:'Bert Van Lerberghe',t:'Soudal - Quick Step',g:'+16'},
{r:81,n:'Erik Nordsaeter Resell',t:'Uno-X Mobility',g:'+16'},
{r:82,n:'Quinten Hermans',t:'Pinarello - Q36.5 Pro Cycling Team',g:'+16'},
{r:83,n:'Gianni Marchand',t:'Tarteletto - Isorex',g:'+16'},
{r:84,n:'Dylan Teuns',t:'Cofidis',g:'+16'},
{r:85,n:'Stan Dewulf',t:'Decathlon CMA CGM Team',g:'+16'},
{r:86,n:'Rune Herregodts',t:'UAE Team Emirates XRG',g:'+16'},
{r:87,n:'Nils Eekhoff',t:'Team Picnic PostNL',g:'+16'},
{r:88,n:'Aime De Gendt',t:'Pinarello - Q36.5 Pro Cycling Team',g:'+16'},
{r:89,n:'Antoine LHote',t:'Decathlon CMA CGM Team',g:'+16'},
{r:90,n:'Julius Johansen',t:'UAE Team Emirates XRG',g:'+16'},
{r:91,n:'Storm Ingebrigtsen',t:'Uno-X Mobility',g:'+16'},
{r:92,n:'Milan Lanhove',t:'Team Flanders - Baloise',g:'+16'},
{r:93,n:'Otto Vergaerde',t:'Lidl - Trek',g:'+16'},
{r:94,n:'Alessandro Romele',t:'XDS Astana Team',g:'+16'},
{r:95,n:'Wessel Mouris',t:'Unibet Rose Rockets',g:'+16'},
{r:96,n:'Florian Dauphin',t:'TotalEnergies',g:'+16'},
{r:97,n:'Sergio Meris',t:'Unibet Rose Rockets',g:'+16'},
{r:98,n:'Julius van den Berg',t:'Team Picnic PostNL',g:'+16'},
{r:99,n:'Fabio Van Den Bossche',t:'Soudal - Quick Step',g:'+01:25'},
{r:100,n:'Krists Neilands',t:'NSN Cycling Team',g:'+02:26'},
{r:101,n:'Fabian Lienhard',t:'Tudor Pro Cycling Team',g:'+02:32'},
{r:102,n:'Petr Kelemen',t:'Tudor Pro Cycling Team',g:'+02:32'},
{r:103,n:'Gustav Wang',t:'XDS Astana Team',g:'+02:32'},
{r:104,n:'Lars Daelmans',t:'Starbikes - Ridley Cycling Team',g:'+02:32'},
{r:105,n:'Robbe Ghys',t:'Decathlon CMA CGM Team',g:'+02:45'},
{r:106,n:'Stijn Appel',t:'BEAT CC powered by Saxo',g:'+03:47'},
{r:107,n:'Florian Senechal',t:'Alpecin - Premier Tech',g:'+04:03'},
{r:108,n:'Jasper De Buyst',t:'Lotto - Intermarche',g:'+04:54'},
{r:109,n:'Liam Van Bylen',t:'Decathlon CMA CGM Development Team',g:'+06:13'},
{r:110,n:'Arne Baers',t:'Baloise Verzekeringen - Het Poetsbureau Lions',g:'+08:16'},
{r:111,n:'Rory Townsend',t:'Unibet Rose Rockets',g:'+08:27'},
{r:112,n:'Maxence Place',t:'AARCO',g:'+09:20'},
{r:113,n:'Johan Meens',t:'AARCO',g:'+09:20'},
{r:114,n:'Gilles Dockx',t:'AARCO',g:'+09:37'},
{r:115,n:'Milan Fretin',t:'Cofidis',g:'+10:31'},
{r:116,n:'Roy Hoogendoorn',t:'Metec - Solarwatt P/B Mantel',g:'+10:31'},
{r:117,n:'Daan van Sintmaartensdijk',t:'BEAT CC powered by Saxo',g:'+10:31'},
{r:118,n:'Zeno Moonen',t:'Tarteletto - Isorex',g:'+10:31'},
{r:119,n:'Manlio Moro',t:'Movistar Team',g:'+10:31'},
{r:120,n:'Lindsay De Vylder',t:'Alpecin - Premier Tech',g:'+10:31'},
{r:121,n:'Victor Hannes',t:'AARCO',g:'+11:42'},
{r:122,n:'Nicola Marcerou',t:'TotalEnergies',g:'+11:46'},
{r:123,n:'Jelle Vermoote',t:'Tarteletto - Isorex',g:'+11:59'},
{r:124,n:'Jonah Killy',t:'Tarteletto - Isorex',g:'+12:52'},
];

async function loadIdx(c){const[ri]=await c.query('SELECT id,rider_name FROM riders');const[te]=await c.query('SELECT id,team_name FROM teams');const rn=new Map(),rk=new Map(),tn=new Map(),tk=new Map();for(const r of ri){rn.set(stripD(r.rider_name).toLowerCase(),r);rk.set(cKey(r.rider_name),r)}for(const t of te){tn.set(stripD(t.team_name).toLowerCase(),t);tk.set(cKey(t.team_name),t)}return{rn,rk,tn,tk}}
async function fT(c,ix,nm){const nn=clean(nm),dn=stripD(nn).toLowerCase();let t=ix.tn.get(dn);if(t)return t.id;t=ix.tk.get(cKey(nn));if(t)return t.id;for(const[n,x]of ix.tn){const w=nn.split(' ').filter(w=>w.length>2);if(w.length&&w.filter(w=>n.includes(w.toLowerCase())).length>=Math.min(2,w.length))return x.id}const[f]=await c.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',['%'+nn.split(' ').slice(0,3).join(' ')+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO teams (id,team_name,team_name_en,category,country) VALUES (?,?,?,?,?)',[id,nn,nn,'Continental',null]);return id}
async function fR(c,ix,nm){const tn=clean(nm),dn=stripD(tn).toLowerCase();let r=ix.rn.get(dn);if(r)return r.id;r=ix.rk.get(cKey(tn));if(r)return r.id;const[f]=await c.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1',['%'+tn+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO riders (id,rider_name,nationality) VALUES (?,?,?)',[id,tn,'UNK']);return id}

async function main(){
  const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  await c.beginTransaction();
  const[st]=await c.query('SELECT id FROM stages WHERE stage_code=?',['baloise-belgium-tour-2026-stage-2']);
  await c.query('DELETE FROM general_classification WHERE stage_id=?',[st[0].id]);
  const ix=await loadIdx(c);let gI=0;
  for(const r of GC){
    const rid=await fR(c,ix,r.n),tid=await fT(c,ix,r.t);
    await c.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,total_time,time_gap) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.tt||null,r.g]);
    gI++;if(gI%40===0)console.log('  ...',gI);
  }
  console.log('BBT S2 GC:',gI);
  await c.commit();
  await c.end();
}
main().catch(async e=>{console.error(e);const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});await c.rollback();await c.end()});
