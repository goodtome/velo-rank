// Fill missing data: TdS Women S1/S2 GC + Women Cycling Day 2026
const mysql = require('mysql2/promise');
const crypto = require('crypto');
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function stripD(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cKey(v){return stripD(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ')}

// === TdS Women Stage 1 GC (92 riders) ===
const TDSW_S1_GC=[
{r:1,n:'Femke de Vries',t:'Team Visma | Lease a Bike Women',tt:'02:56:13',g:'-'},
{r:2,n:'Lauren Dickson',t:'FDJ United - SUEZ',g:'+00:00'},
{r:3,n:'Cedrine Kerbaol',t:'EF Education - Oatly',g:'+00:35'},
{r:4,n:'Kimberley Le Court de Billot',t:'AG Insurance - Soudal Team',g:'+00:48'},
{r:5,n:'Sarah Van Dam',t:'Team Visma | Lease a Bike Women',g:'+00:48'},
{r:6,n:'Steffi Haberlin',t:'Team SD Worx - Protime',g:'+00:48'},
{r:7,n:'Elisa Longo Borghini',t:'UAE Team ADQ',g:'+00:48'},
{r:8,n:'Marlen Reusser',t:'Movistar Team Women',g:'+00:48'},
{r:9,n:'Katarzyna Niewiadoma',t:'Canyon//SRAM Racing zondacrypto',g:'+00:48'},
{r:10,n:'Juliette Berthet-Labous',t:'FDJ United - SUEZ',g:'+01:07'},
{r:11,n:'Thalita de Jong',t:'Human Powered Health',g:'+01:26'},
{r:12,n:'Axelle Dubau Prevot',t:'EF Education - Oatly',g:'+01:26'},
{r:13,n:'Clemence Latimier',t:'Ma Petite Entreprise',g:'+01:26'},
{r:14,n:'Ginia Caluori',t:'Switzerland',g:'+01:29'},
{r:15,n:'Yara Kastelijn',t:'Fenix - Premier Tech',g:'+01:29'},
{r:16,n:'Ricarda Bauernfeind',t:'Lidl - Trek Ladies',g:'+01:29'},
{r:17,n:'Sara Casasola',t:'Fenix - Premier Tech',g:'+01:52'},
{r:18,n:'Nienke Vinke',t:'Team SD Worx - Protime',g:'+02:15'},
{r:19,n:'Franziska Koch',t:'FDJ United - SUEZ',g:'+02:16'},
{r:20,n:'Karlijn Swinkels',t:'UAE Team ADQ',g:'+03:33'},
{r:21,n:'Megan Arens',t:'Team Picnic PostNL',g:'+03:39'},
{r:22,n:'Alice Towers',t:'EF Education - Oatly',g:'+03:39'},
{r:23,n:'Talia Appleton',t:'Liv AlUla Jayco',g:'+04:01'},
{r:24,n:'Francesca Barale',t:'Movistar Team Women',g:'+04:01'},
{r:25,n:'Liane Lippert',t:'Movistar Team Women',g:'+06:30'},
{r:26,n:'Jasmin Liechti',t:'Switzerland',g:'+06:34'},
{r:27,n:'Morgane Coston',t:'Ma Petite Entreprise',g:'+06:34'},
{r:28,n:'Lea Fuchs',t:'Switzerland',g:'+06:34'},
{r:29,n:'Justine Ghekiere',t:'AG Insurance - Soudal Team',g:'+06:34'},
{r:30,n:'Ana Vitoria Magalhaes',t:'Movistar Team Women',g:'+06:34'},
{r:31,n:'Maeva Squiban',t:'UAE Team ADQ',g:'+06:34'},
{r:32,n:'Justyna Czapla',t:'Canyon//SRAM Racing zondacrypto',g:'+06:34'},
{r:33,n:'Nina Buijsman',t:'Human Powered Health',g:'+06:57'},
{r:34,n:'Loes Adegeest',t:'Lidl - Trek Ladies',g:'+08:34'},
{r:35,n:'Celia Le Mouel',t:'Ma Petite Entreprise',g:'+08:34'},
{r:36,n:'Nadia Gontova',t:'Liv AlUla Jayco',g:'+08:34'},
{r:37,n:'Femke Markus',t:'Team SD Worx - Protime',g:'+08:34'},
{r:38,n:'Maya Kingma',t:'Aromitalia Vaiano',g:'+08:34'},
{r:39,n:'Viktoria Chladonova',t:'Team Visma | Lease a Bike Women',g:'+11:52'},
{r:40,n:'Carlotta Cipressi',t:'Human Powered Health',g:'+12:01'},
{r:41,n:'Lea Curinier',t:'FDJ United - SUEZ',g:'+12:01'},
{r:42,n:'Valentina Venerucci',t:'Aromitalia Vaiano',g:'+12:05'},
{r:43,n:'Henrietta Christie',t:'EF Education - Oatly',g:'+12:34'},
{r:44,n:'Zoe Backstedt',t:'Canyon//SRAM Racing zondacrypto',g:'+14:53'},
{r:45,n:'Babette Van Der Wolf',t:'EF Education - Oatly',g:'+14:56'},
{r:46,n:'Xaydee Van Sinaey',t:'Fenix - Premier Tech',g:'+14:56'},
{r:47,n:'Juliana Londono David',t:'Team Picnic PostNL',g:'+15:02'},
{r:48,n:'Sara Martin Martin',t:'Movistar Team Women',g:'+15:02'},
{r:49,n:'Carina Schrempf',t:'Fenix - Premier Tech',g:'+15:02'},
{r:50,n:'Letizia Paternoster',t:'Liv AlUla Jayco',g:'+15:02'},
{r:51,n:'Solbjork Minke Anderson',t:'EF Education - Oatly',g:'+15:02'},
{r:52,n:'Marta Lach',t:'Team SD Worx - Protime',g:'+15:02'},
{r:53,n:'Marie Le Net',t:'FDJ United - SUEZ',g:'+15:02'},
{r:54,n:'Rasa Leleivyte',t:'Aromitalia Vaiano',g:'+15:02'},
{r:55,n:'Julia Kopecky',t:'Team SD Worx - Protime',g:'+15:02'},
{r:56,n:'Lea Stern',t:'Ma Petite Entreprise',g:'+15:02'},
{r:57,n:'Riejanne Markus',t:'Lidl - Trek Ladies',g:'+15:02'},
{r:58,n:'Mackenzie Coupland',t:'Liv AlUla Jayco',g:'+15:02'},
{r:59,n:'Tess Moerman',t:'AG Insurance - Soudal Team',g:'+15:02'},
{r:60,n:'Titia Ryo',t:'Human Powered Health',g:'+15:02'},
{r:61,n:'Laura Asencio',t:'Ma Petite Entreprise',g:'+15:02'},
{r:62,n:'Letizia Borghesi',t:'AG Insurance - Soudal Team',g:'+15:02'},
{r:63,n:'Ruby Roseman-Gannon',t:'Liv AlUla Jayco',g:'+15:02'},
{r:64,n:'Greta Marturano',t:'UAE Team ADQ',g:'+16:35'},
{r:65,n:'Sofia Bertizzolo',t:'FDJ United - SUEZ',g:'+16:35'},
{r:66,n:'Agnieszka Skalniak-Sojka',t:'Canyon//SRAM Racing zondacrypto',g:'+16:35'},
{r:67,n:'Marta Jaskulska',t:'Human Powered Health',g:'+16:35'},
{r:68,n:'Brodie Chapman',t:'UAE Team ADQ',g:'+16:35'},
{r:69,n:'Lily Williams',t:'Human Powered Health',g:'+16:35'},
{r:70,n:'Inge van der Heijden',t:'Fenix - Premier Tech',g:'+16:38'},
{r:71,n:'Audrey De Keersmaeker',t:'Team Picnic PostNL',g:'+17:07'},
{r:72,n:'Lauretta Hanson',t:'Lidl - Trek Ladies',g:'+18:27'},
{r:73,n:'Margot Vanpachtenbeke',t:'Lidl - Trek Ladies',g:'+18:27'},
{r:74,n:'Josie Talbot',t:'Liv AlUla Jayco',g:'+18:27'},
{r:75,n:'Romina Costantini',t:'Aromitalia Vaiano',g:'+18:30'},
{r:76,n:'Febe Jooris',t:'UAE Team ADQ',g:'+18:30'},
{r:77,n:'Tiffany Cromwell',t:'Canyon//SRAM Racing zondacrypto',g:'+18:30'},
{r:78,n:'Shari Bossuyt',t:'AG Insurance - Soudal Team',g:'+18:30'},
{r:79,n:'Lucia Ruiz Perez',t:'Movistar Team Women',g:'+18:30'},
{r:80,n:'Daniela Hezinova',t:'Team Picnic PostNL',g:'+18:30'},
{r:81,n:'Margot Marasco',t:'Ma Petite Entreprise',g:'+18:30'},
{r:82,n:'Wilma Aintila',t:'Canyon//SRAM Racing zondacrypto',g:'+18:30'},
{r:83,n:'Lucinda Brand',t:'Lidl - Trek Ladies',g:'+23:56'},
{r:84,n:'Lorena Leu',t:'Switzerland',g:'+27:26'},
{r:85,n:'Annika Liehner',t:'Switzerland',g:'+27:26'},
{r:86,n:'Julie De Wilde',t:'Fenix - Premier Tech',g:'+27:26'},
{r:87,n:'Lucia Brillante Romeo',t:'Aromitalia Vaiano',g:'+27:26'},
{r:88,n:'Katharina Sadnik',t:'Team Visma | Lease a Bike Women',g:'+27:26'},
{r:89,n:'Ella Heremans',t:'Team Picnic PostNL',g:'+27:26'},
{r:90,n:'Becky Storrie',t:'Team Picnic PostNL',g:'+27:26'},
];

// === TdS Women Stage 2 GC (92 riders) ===
const TDSW_S2_GC=[
{r:1,n:'Elisa Longo Borghini',t:'UAE Team ADQ',tt:'05:31:26',g:'-'},
{r:2,n:'Lauren Dickson',t:'FDJ United - SUEZ',g:'+27'},
{r:3,n:'Sarah Van Dam',t:'Team Visma | Lease a Bike Women',g:'+34'},
{r:4,n:'Steffi Haberlin',t:'Team SD Worx - Protime',g:'+53'},
{r:5,n:'Marlen Reusser',t:'Movistar Team Women',g:'+57'},
{r:6,n:'Katarzyna Niewiadoma',t:'Canyon//SRAM Racing zondacrypto',g:'+57'},
{r:7,n:'Cedrine Kerbaol',t:'EF Education - Oatly',g:'+01:00'},
{r:8,n:'Kimberley Le Court de Billot',t:'AG Insurance - Soudal Team',g:'+01:13'},
{r:9,n:'Femke de Vries',t:'Team Visma | Lease a Bike Women',g:'+01:37'},
{r:10,n:'Thalita de Jong',t:'Human Powered Health',g:'+02:17'},
{r:11,n:'Yara Kastelijn',t:'Fenix - Premier Tech',g:'+02:22'},
{r:12,n:'Clemence Latimier',t:'Ma Petite Entreprise',g:'+02:52'},
{r:13,n:'Axelle Dubau Prevot',t:'EF Education - Oatly',g:'+02:55'},
{r:14,n:'Ricarda Bauernfeind',t:'Lidl - Trek Ladies',g:'+02:55'},
{r:15,n:'Ginia Caluori',t:'Switzerland',g:'+03:06'},
{r:16,n:'Sara Casasola',t:'Fenix - Premier Tech',g:'+03:29'},
{r:17,n:'Juliette Berthet-Labous',t:'FDJ United - SUEZ',g:'+04:46'},
{r:18,n:'Karlijn Swinkels',t:'UAE Team ADQ',g:'+04:59'},
{r:19,n:'Nienke Vinke',t:'Team SD Worx - Protime',g:'+05:14'},
{r:20,n:'Talia Appleton',t:'Liv AlUla Jayco',g:'+05:30'},
{r:21,n:'Megan Arens',t:'Team Picnic PostNL',g:'+06:05'},
{r:22,n:'Alice Towers',t:'EF Education - Oatly',g:'+07:15'},
{r:23,n:'Jasmin Liechti',t:'Switzerland',g:'+08:00'},
{r:24,n:'Justine Ghekiere',t:'AG Insurance - Soudal Team',g:'+08:00'},
{r:25,n:'Lea Fuchs',t:'Switzerland',g:'+08:09'},
{r:26,n:'Nina Buijsman',t:'Human Powered Health',g:'+08:26'},
{r:27,n:'Morgane Coston',t:'Ma Petite Entreprise',g:'+09:33'},
{r:28,n:'Celia Le Mouel',t:'Ma Petite Entreprise',g:'+10:00'},
{r:29,n:'Ana Vitoria Magalhaes',t:'Movistar Team Women',g:'+10:04'},
{r:30,n:'Maeva Squiban',t:'UAE Team ADQ',g:'+10:13'},
{r:31,n:'Justyna Czapla',t:'Canyon//SRAM Racing zondacrypto',g:'+10:13'},
{r:32,n:'Nadia Gontova',t:'Liv AlUla Jayco',g:'+11:00'},
{r:33,n:'Maya Kingma',t:'Aromitalia Vaiano',g:'+11:11'},
{r:34,n:'Loes Adegeest',t:'Lidl - Trek Ladies',g:'+12:10'},
{r:35,n:'Femke Markus',t:'Team SD Worx - Protime',g:'+12:10'},
{r:36,n:'Francesca Barale',t:'Movistar Team Women',g:'+12:16'},
{r:37,n:'Franziska Koch',t:'FDJ United - SUEZ',g:'+12:25'},
{r:38,n:'Liane Lippert',t:'Movistar Team Women',g:'+13:59'},
{r:39,n:'Lea Curinier',t:'FDJ United - SUEZ',g:'+15:40'},
{r:40,n:'Zoe Backstedt',t:'Canyon//SRAM Racing zondacrypto',g:'+16:19'},
{r:41,n:'Viktoria Chladonova',t:'Team Visma | Lease a Bike Women',g:'+17:25'},
{r:42,n:'Babette Van Der Wolf',t:'EF Education - Oatly',g:'+18:32'},
{r:43,n:'Letizia Paternoster',t:'Liv AlUla Jayco',g:'+18:38'},
{r:44,n:'Lea Stern',t:'Ma Petite Entreprise',g:'+18:38'},
{r:45,n:'Laura Asencio',t:'Ma Petite Entreprise',g:'+18:38'},
{r:46,n:'Tess Moerman',t:'AG Insurance - Soudal Team',g:'+18:38'},
{r:47,n:'Rasa Leleivyte',t:'Aromitalia Vaiano',g:'+18:41'},
{r:48,n:'Titia Ryo',t:'Human Powered Health',g:'+18:41'},
{r:49,n:'Riejanne Markus',t:'Lidl - Trek Ladies',g:'+18:41'},
{r:50,n:'Ruby Roseman-Gannon',t:'Liv AlUla Jayco',g:'+18:41'},
{r:51,n:'Greta Marturano',t:'UAE Team ADQ',g:'+20:14'},
{r:52,n:'Valentina Venerucci',t:'Aromitalia Vaiano',g:'+20:20'},
{r:53,n:'Juliana Londono David',t:'Team Picnic PostNL',g:'+20:58'},
{r:54,n:'Carlotta Cipressi',t:'Human Powered Health',g:'+22:06'},
{r:55,n:'Lily Williams',t:'Human Powered Health',g:'+22:08'},
{r:56,n:'Marie Le Net',t:'FDJ United - SUEZ',g:'+22:29'},
{r:57,n:'Henrietta Christie',t:'EF Education - Oatly',g:'+22:43'},
{r:58,n:'Xaydee Van Sinaey',t:'Fenix - Premier Tech',g:'+23:11'},
{r:59,n:'Carina Schrempf',t:'Fenix - Premier Tech',g:'+23:17'},
{r:60,n:'Solbjork Minke Anderson',t:'EF Education - Oatly',g:'+23:17'},
{r:61,n:'Marta Lach',t:'Team SD Worx - Protime',g:'+23:17'},
{r:62,n:'Sara Martin Martin',t:'Movistar Team Women',g:'+23:17'},
{r:63,n:'Julia Kopecky',t:'Team SD Worx - Protime',g:'+23:17'},
{r:64,n:'Letizia Borghesi',t:'AG Insurance - Soudal Team',g:'+23:23'},
{r:65,n:'Mackenzie Coupland',t:'Liv AlUla Jayco',g:'+23:41'},
{r:66,n:'Agnieszka Skalniak-Sojka',t:'Canyon//SRAM Racing zondacrypto',g:'+24:50'},
{r:67,n:'Marta Jaskulska',t:'Human Powered Health',g:'+24:50'},
{r:68,n:'Audrey De Keersmaeker',t:'Team Picnic PostNL',g:'+25:22'},
{r:69,n:'Daniela Hezinova',t:'Team Picnic PostNL',g:'+25:57'},
{r:70,n:'Sofia Bertizzolo',t:'FDJ United - SUEZ',g:'+26:44'},
{r:71,n:'Tiffany Cromwell',t:'Canyon//SRAM Racing zondacrypto',g:'+26:45'},
{r:72,n:'Febe Jooris',t:'UAE Team ADQ',g:'+26:45'},
{r:73,n:'Margot Marasco',t:'Ma Petite Entreprise',g:'+26:45'},
{r:74,n:'Shari Bossuyt',t:'AG Insurance - Soudal Team',g:'+26:51'},
{r:75,n:'Lauretta Hanson',t:'Lidl - Trek Ladies',g:'+28:05'},
{r:76,n:'Romina Costantini',t:'Aromitalia Vaiano',g:'+28:08'},
{r:77,n:'Lucia Ruiz Perez',t:'Movistar Team Women',g:'+28:08'},
{r:78,n:'Margot Vanpachtenbeke',t:'Lidl - Trek Ladies',g:'+28:30'},
{r:79,n:'Brodie Chapman',t:'UAE Team ADQ',g:'+29:45'},
{r:80,n:'Inge van der Heijden',t:'Fenix - Premier Tech',g:'+29:48'},
{r:81,n:'Wilma Aintila',t:'Canyon//SRAM Racing zondacrypto',g:'+31:40'},
{r:82,n:'Josie Talbot',t:'Liv AlUla Jayco',g:'+32:23'},
{r:83,n:'Lucinda Brand',t:'Lidl - Trek Ladies',g:'+34:05'},
{r:84,n:'Katharina Sadnik',t:'Team Visma | Lease a Bike Women',g:'+34:53'},
{r:85,n:'Lorena Leu',t:'Switzerland',g:'+35:41'},
{r:86,n:'Lucia Brillante Romeo',t:'Aromitalia Vaiano',g:'+35:41'},
{r:87,n:'Ella Heremans',t:'Team Picnic PostNL',g:'+35:41'},
{r:88,n:'Julie De Wilde',t:'Fenix - Premier Tech',g:'+37:04'},
{r:89,n:'Annika Liehner',t:'Switzerland',g:'+37:35'},
{r:90,n:'Becky Storrie',t:'Team Picnic PostNL',g:'+40:36'},
];

// === Women Cycling Day 2026 (69 finishers, no teams available) ===
const WCD_S1=[
{r:1,n:'Marit Raaijmakers',t:'Unattached',time:'03:17:49',g:'+00:00',nat:'NED'},
{r:2,n:'Iurani Blanco Calbet',t:'Unattached',g:'s.t.',nat:'ESP'},
{r:3,n:'Malou Eisen',t:'Unattached',g:'s.t.',nat:'NED'},
{r:4,n:'Kristyna Zemanova',t:'Unattached',g:'s.t.',nat:'CZE'},
{r:5,n:'Lisa Klein',t:'Unattached',g:'+32',nat:'GER'},
{r:6,n:'Maike van der Duin',t:'Unattached',g:'+01:03',nat:'NED'},
{r:7,n:'Chiara Consonni',t:'Unattached',g:'+01:03',nat:'ITA'},
{r:8,n:'Sofia Ungerova',t:'Unattached',g:'+01:03',nat:'SVK'},
{r:9,n:'Maud Rijnbeek',t:'Unattached',g:'+01:03',nat:'NED'},
{r:10,n:'Barbora Nemcova',t:'Unattached',g:'+01:03',nat:'CZE'},
{r:11,n:'Sophie von Berswordt',t:'Unattached',g:'+01:03',nat:'NED'},
{r:12,n:'Nina Andacka',t:'Unattached',g:'+01:03',nat:'SVK'},
{r:13,n:'Jette Aelken',t:'Unattached',g:'+01:12',nat:'GER'},
{r:14,n:'Kathrin Schweinberger',t:'Unattached',g:'+02:06',nat:'AUT'},
{r:15,n:'Laura Sussemilch',t:'Unattached',g:'+02:06',nat:'GER'},
{r:16,n:'Cleo Kiekens',t:'Unattached',g:'+02:06',nat:'BEL'},
{r:17,n:'Clara Jager',t:'Unattached',g:'+02:06',nat:'GER'},
{r:18,n:'Britt De Grave',t:'Unattached',g:'+02:06',nat:'NED'},
{r:19,n:'Aileen Schweikart',t:'Unattached',g:'+02:06',nat:'GER'},
{r:20,n:'Manon De Boer',t:'Unattached',g:'+02:06',nat:'NED'},
{r:21,n:'Caoilinn Littbarski-Gray',t:'Unattached',g:'+02:06',nat:'GER'},
{r:22,n:'Jente Koops',t:'Unattached',g:'+02:06',nat:'NED'},
{r:23,n:'Leni Bauer',t:'Unattached',g:'+02:06',nat:'GER'},
{r:24,n:'Corinna Lechner',t:'Unattached',g:'+02:06',nat:'GER'},
{r:25,n:'Karoline Goldschmidt',t:'Unattached',g:'+02:06',nat:'GER'},
{r:26,n:'Selma Lantzsch',t:'Unattached',g:'+02:06',nat:'GER'},
{r:27,n:'Fenja Gerpott',t:'Unattached',g:'+02:06',nat:'GER'},
{r:28,n:'Jana Meus',t:'Unattached',g:'+02:06',nat:'GER'},
{r:29,n:'Olga Wankiewicz',t:'Unattached',g:'+03:59',nat:'POL'},
{r:30,n:'Maira Susann Jasch',t:'Unattached',g:'+03:59',nat:'GER'},
{r:31,n:'Lena Charlotte Reissner',t:'Unattached',g:'+03:59',nat:'GER'},
{r:32,n:'Florien Bolks',t:'Unattached',g:'+03:59',nat:'NED'},
{r:33,n:'Anna Hanakova',t:'Unattached',g:'+03:59',nat:'CZE'},
{r:34,n:'Anezka Kysilkova',t:'Unattached',g:'+03:59',nat:'CZE'},
{r:35,n:'Urszula Sipko',t:'Unattached',g:'+03:59',nat:'POL'},
{r:36,n:'Eliska Kvasnickova',t:'Unattached',g:'+03:59',nat:'CZE'},
{r:37,n:'Ilse Grit',t:'Unattached',g:'+03:59',nat:'NED'},
{r:38,n:'Mia Williams',t:'Unattached',g:'+03:59',nat:'AUS'},
{r:39,n:'Tomke Windelband',t:'Unattached',g:'+03:59',nat:'GER'},
{r:40,n:'Joelle Amelie Messemer',t:'Unattached',g:'+03:59',nat:'GER'},
{r:41,n:'Veronika Jandova',t:'Unattached',g:'+04:04',nat:'CZE'},
{r:42,n:'Kaya Meier',t:'Unattached',g:'+06:50',nat:'GER'},
{r:43,n:'Anna Gaborska',t:'Unattached',g:'+06:50',nat:'POL'},
{r:44,n:'Kirsty Watts',t:'Unattached',g:'+06:50',nat:'NZL'},
{r:45,n:'Jule Markl',t:'Unattached',g:'+06:54',nat:'GER'},
{r:46,n:'Cynthia Morguet',t:'Unattached',g:'+10:01',nat:'GER'},
{r:47,n:'Madeleine Wasserbaech',t:'Unattached',g:'+10:01',nat:'AUS'},
{r:48,n:'Maria Martins',t:'Unattached',g:'+10:01',nat:'POR'},
{r:49,n:'Katharina Julia Hinz',t:'Unattached',g:'+10:09',nat:'GER'},
{r:50,n:'Petra Sevcikova',t:'Unattached',g:'+10:13',nat:'CZE'},
{r:51,n:'Johanna Rasche',t:'Unattached',g:'+10:13',nat:'GER'},
{r:52,n:'Vendula Strakata',t:'Unattached',g:'+10:13',nat:'CZE'},
{r:53,n:'Tamara Szalinska',t:'Unattached',g:'+10:13',nat:'POL'},
{r:54,n:'Paula Gloning',t:'Unattached',g:'+10:13',nat:'GER'},
{r:55,n:'Meike Kohlenberger',t:'Unattached',g:'+10:13',nat:'GER'},
{r:56,n:'Amy Addlesee',t:'Unattached',g:'+10:13',nat:'GBR'},
{r:57,n:'Sarah Hahn',t:'Unattached',g:'+10:13',nat:'GER'},
{r:58,n:'Jette Simon',t:'Unattached',g:'+10:13',nat:'GER'},
{r:59,n:'Melina Fritz',t:'Unattached',g:'+10:13',nat:'GER'},
{r:60,n:'Sofia Henninger',t:'Unattached',g:'+10:13',nat:'GER'},
{r:61,n:'Jarmila Machacova',t:'Unattached',g:'+10:13',nat:'CZE'},
{r:62,n:'Britt Knaven',t:'Unattached',g:'+10:13',nat:'BEL'},
{r:63,n:'Wiktoria Pikulik',t:'Unattached',g:'+10:17',nat:'POL'},
{r:64,n:'Silvia Zanardi',t:'Unattached',g:'+10:17',nat:'ITA'},
{r:65,n:'Heidi Harting',t:'Unattached',g:'+10:17',nat:'GER'},
{r:66,n:'Marie Zielinski',t:'Unattached',g:'+10:50',nat:'GER'},
{r:67,n:'Mara Becker',t:'Unattached',g:'+10:50',nat:'GER'},
{r:68,n:'Marie Lagershausen',t:'Unattached',g:'+10:50',nat:'GER'},
{r:69,n:'Seana Littbarski-Gray',t:'Unattached',g:'+10:53',nat:'GER'},
];

async function loadIdx(c){const[ri]=await c.query('SELECT id,rider_name FROM riders');const[te]=await c.query('SELECT id,team_name FROM teams');const rn=new Map(),rk=new Map(),tn=new Map(),tk=new Map();for(const r of ri){rn.set(stripD(r.rider_name).toLowerCase(),r);rk.set(cKey(r.rider_name),r)}for(const t of te){tn.set(stripD(t.team_name).toLowerCase(),t);tk.set(cKey(t.team_name),t)}return{rn,rk,tn,tk}}
async function fT(c,ix,nm){const nn=clean(nm),dn=stripD(nn).toLowerCase();let t=ix.tn.get(dn);if(t)return t.id;t=ix.tk.get(cKey(nn));if(t)return t.id;for(const[n,x]of ix.tn){const w=nn.split(' ').filter(w=>w.length>2);if(w.length&&w.filter(w=>n.includes(w.toLowerCase())).length>=Math.min(2,w.length))return x.id}const[f]=await c.query('SELECT id FROM teams WHERE team_name LIKE ? LIMIT 1',['%'+nn.split(' ').slice(0,3).join(' ')+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO teams (id,team_name,team_name_en,category,country) VALUES (?,?,?,?,?)',[id,nn,nn,'Continental',null]);return id}
async function fR(c,ix,nm){const tn=clean(nm),dn=stripD(tn).toLowerCase();let r=ix.rn.get(dn);if(r)return r.id;r=ix.rk.get(cKey(tn));if(r)return r.id;const[f]=await c.query('SELECT id FROM riders WHERE rider_name LIKE ? LIMIT 1',['%'+tn+'%']);if(f.length)return f[0].id;const id=crypto.randomUUID();await c.query('INSERT INTO riders (id,rider_name,nationality) VALUES (?,?,?)',[id,tn,'UNK']);return id}

async function importGC(conn, stageCode, data){
  const[st]=await conn.query('SELECT id FROM stages WHERE stage_code=?',[stageCode]);
  if(!st.length){console.log('Stage not found:',stageCode);return 0}
  await conn.query('DELETE FROM general_classification WHERE stage_id=?',[st[0].id]);
  const ix=await loadIdx(conn);let gI=0;
  for(const r of data){const rid=await fR(conn,ix,r.n),tid=await fT(conn,ix,r.t);await conn.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,total_time,time_gap) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,'UNK',r.tt||null,r.g]);gI++;if(gI%50===0)console.log('  ...',gI);}
  return gI;
}

async function importWCD(conn){
  const[race]=await conn.query('SELECT id FROM races WHERE race_code=?',['women-cycling-day-2026']);
  if(!race.length){console.log('WCD race not found');return 0}
  const[st]=await conn.query('SELECT id FROM stages WHERE race_id=?',[race[0].id]);
  if(!st.length){console.log('WCD stage not found');return 0}
  await conn.query('DELETE FROM stage_results WHERE stage_id=?',[st[0].id]);
  await conn.query('DELETE FROM general_classification WHERE stage_id=?',[st[0].id]);
  const ix=await loadIdx(conn);let sI=0,gI=0;
  for(const r of WCD_S1){
    const rid=await fR(conn,ix,r.n),tid='00000000-0000-0000-0000-000000000000';
    await conn.query('INSERT INTO stage_results (id,stage_id,rank_pos,rider_id,team_id,nationality,time_gap,is_same_time) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,r.nat,r.time||null,(r.g==='s.t.')?1:0]);
    sI++;
    await conn.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,time_gap) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),st[0].id,r.r,rid,tid,r.nat,r.g]);
    gI++;
  }
  console.log('WCD: '+sI+' results, '+gI+' GC');
  return sI;
}

async function main(){
  const c=await mysql.createConnection({host:'localhost',port:13306,user:'root',password:'mysql123456',database:'jersey_db'});
  await c.beginTransaction();
  try{
    console.log('=== Filling missing data ===\n');
    console.log('TdS Women S1 GC...');
    const s1gc=await importGC(c,'tour-de-suisse-women-2026-stage-1',TDSW_S1_GC);
    console.log('  S1 GC:',s1gc);
    console.log('TdS Women S2 GC...');
    const s2gc=await importGC(c,'tour-de-suisse-women-2026-stage-2',TDSW_S2_GC);
    console.log('  S2 GC:',s2gc);
    await importWCD(c);
    await c.commit();
    console.log('\nDone!');
  }catch(e){console.error(e);await c.rollback()}
  await c.end();
}
main();
