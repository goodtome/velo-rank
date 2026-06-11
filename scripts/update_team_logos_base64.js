const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const DB_CONFIG = isProd
  ? {
      host: process.env.DB_HOST_PROD || process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT_PROD || process.env.DB_PORT, 10) || 4000,
      user: process.env.DB_USER_PROD || process.env.DB_USER,
      password: process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD,
      database: process.env.DB_NAME_PROD || process.env.DB_NAME || 'jersey_db',
      charset: 'utf8mb4',
      ssl: { rejectUnauthorized: true }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 13306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'mysql123456',
      database: process.env.DB_NAME || 'jersey_db',
      charset: 'utf8mb4'
    };

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36';
const MAX_IMAGE_BYTES = 250 * 1024;
const MAX_CANDIDATES_PER_TEAM = 14;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

const TEAM_SOURCES = [
  { name: 'Alpecin-Premier Tech', codes: ['APC'], keywords: ['Alpecin', 'Premier Tech'], homepage: 'https://www.alpecin-deceuninck.com/' },
  { name: 'Bahrain Victorious', codes: ['TBV'], keywords: ['Bahrain Victorious'], homepage: 'https://bahraincyclingteam.com/', logoCandidates: ['https://bahraincyclingteam.com/wp-content/uploads/2021/01/cropped-bahrain-victorious-favicon-264x264.png'] },
  {
    name: 'Decathlon CMA CGM',
    codes: ['DCT'],
    keywords: ['Decathlon', 'CMA CGM'],
    homepage: 'https://decathloncmacgmteam.com/',
    logoCandidates: ['https://decathloncmacgmteam.com/wp-content/uploads/2025/12/DCT_RVB_WT_Couleurs1.png']
  },
  {
    name: 'EF Education-EasyPost',
    codes: ['EFE'],
    keywords: ['EF Education', 'EasyPost'],
    homepage: 'https://efprocycling.com/',
    logoCandidates: ['https://www.efprocycling.com/apple-touch-icon.png']
  },
  { name: 'Groupama-FDJ United', codes: ['GFC'], keywords: ['Groupama', 'FDJ'], homepage: 'https://www.equipecycliste-groupama-fdj.fr/', logoCandidates: ['https://www.equipecycliste-groupama-fdj.fr/favicon/favicon-96x96.png'] },
  { name: 'INEOS Grenadiers', codes: ['IGD', 'NCI'], keywords: ['INEOS Grenadiers', 'Netcompany INEOS'], homepage: 'https://www.ineosgrenadiers.com/', logoCandidates: ['https://netcompanyineos.com/apple-touch-icon.png'] },
  { name: 'Lidl-Trek', codes: ['LTK'], keywords: ['Lidl', 'Trek'], homepage: 'https://racing.trekbikes.com/teams/lidl-trek' },
  { name: 'Lotto-Intermarche', codes: ['LOI'], keywords: ['Lotto', 'Intermarche'], homepage: 'https://www.lottocyclingteam.be/', logoCandidates: ['https://www.lotto-intermarche.be/front/favicon/2025/lotto-dstny/favicon-96x96.png?v=2026'] },
  { name: 'Movistar Team', codes: ['MOV'], keywords: ['Movistar'], homepage: 'https://movistarteam.com/', logoCandidates: ['https://movistarteam.com/wp-content/themes/movistar-team/images/touch-icon-iphone-precomposed.png'] },
  { name: 'NSN Cycling Team', codes: ['NSN'], keywords: ['NSN Cycling'], homepage: 'https://nsncyclingteam.com/', logoCandidates: ['https://nsncyclingteam.com/wp-content/uploads/2025/11/NSN-Cycling-Team-crunch-400x151.png'] },
  { name: 'Red Bull-BORA-hansgrohe', codes: ['RBH'], keywords: ['Red Bull', 'BORA'], homepage: 'https://www.redbullborahansgrohe.com/', logoCandidates: ['https://img.redbull.com/images/c_limit,w_4000/e_trim:1:transparent/w_450/bo_5px_solid_rgb:00000000/q_auto:best,f_png/redbullcom/2025/3/14/qwq0yjmirydknydnumip/red-bull-bora-hansgrohe-logo-light'] },
  { name: 'Soudal Quick-Step', codes: ['SOQ'], keywords: ['Soudal', 'Quick-Step'], homepage: 'https://www.soudal-quickstepteam.com/', logoCandidates: ['https://soudal-quickstepteam.com/dist/img/favicon/apple-touch-icon.png'] },
  { name: 'Team Jayco AlUla', codes: ['JAY'], keywords: ['Jayco', 'AlUla'], homepage: 'https://greenedgecycling.com/', logoCandidates: ['https://greenedgecycling.com/2026/wp-content/uploads/2026/01/G_logo-300x300.png'] },
  { name: 'Team Picnic PostNL', codes: ['TPP'], keywords: ['Picnic', 'PostNL'], homepage: 'https://www.teampicnicpostnl.com/', logoCandidates: ['https://www.teampicnicpostnl.com/wp-content/uploads/2026/06/2026-Team-Logo-1-scaled.png'] },
  { name: 'Team Visma Lease a Bike', codes: ['TVL'], keywords: ['Visma', 'Lease a Bike'], homepage: 'https://www.teamvismaleaseabike.com/', logoCandidates: ['https://www.teamvismaleaseabike.com/images/favicons/apple-touch-icon.png'] },
  { name: 'UAE Team Emirates XRG', codes: ['UAE'], keywords: ['UAE Team Emirates'], homepage: 'https://www.uaeteamemirates.com/', logoCandidates: ['https://www.uaeteamemirates.com/wp-content/uploads/2017/03/logo-uae.png'] },
  { name: 'Uno-X Mobility', codes: ['UXM'], keywords: ['Uno-X'], homepage: 'https://www.unoxteam.com/', logoCandidates: ['http://static1.squarespace.com/static/61dc2bca9c37a3548736f95e/t/65841ded6e6be81769036315/1736158612352/uno-x_rgb.png?format=1500w'] },
  { name: 'XDS Astana Team', codes: ['XAT'], keywords: ['Astana'], homepage: 'https://www.astana-qazaqstan.com/' },
  { name: 'Bardiani CSF', codes: ['VBF'], keywords: ['Bardiani'], homepage: 'https://www.vfgroupbardianicsffaizane.com/', logoCandidates: ['https://bardianicsf7saber.com/wp-content/uploads/2026/01/logo_web_bardianicsf7saber.png'] },
  { name: 'Burgos BH', codes: ['BBH'], keywords: ['Burgos', 'BH'], homepage: 'https://www.burgosproteam.com/' },
  { name: 'Caja Rural-Seguros RGA', codes: ['CJR'], keywords: ['Caja Rural', 'Seguros RGA'], homepage: 'https://www.teamcajarural-segurosrga.com/', logoCandidates: ['https://teamcajarural-segurosrga.com/wp-content/themes/teamcajarural/img/team-cajarural-segurosrga-logo.jpg'] },
  { name: 'Cofidis', codes: ['COF'], keywords: ['Cofidis'], homepage: 'https://www.equipecofidis.com/', logoCandidates: ['https://www.equipecofidis.com/medias/_site/header/logo-cofidis-100.png'] },
  { name: 'Equipo Kern Pharma', codes: ['EKP'], keywords: ['Kern Pharma'], homepage: 'https://equipokernpharma.com/' },
  { name: 'Euskaltel-Euskadi', codes: ['EUS'], keywords: ['Euskaltel', 'Euskadi'], homepage: 'https://www.fundacioneuskadi.eus/', logoCandidates: ['https://api.clupik.com/clubs/15582/images/splash.png'] },
  { name: 'Team Flanders-Baloise', codes: ['TFB'], keywords: ['Flanders', 'Baloise'], homepage: 'https://www.teamflanders-baloise.be/', logoCandidates: ['https://res.cloudinary.com/evb-web/image/upload/v1740427084/2025/logo-teamtfb-small-notext_d0sii5.png'] },
  { name: 'Team Novo Nordisk', codes: ['TNN'], keywords: ['Novo Nordisk'], homepage: 'https://www.teamnovonordisk.com/', logoCandidates: ['https://www.teamnovonordisk.com/wp-content/uploads/2017/11/NovoNordisk.png'] },
  { name: 'Q36.5 Pro Cycling Team', codes: ['Q36'], keywords: ['Q36.5'], homepage: 'https://www.q36-5procycling.com/' },
  { name: 'Team Polti VisitMalta', codes: ['PTK'], keywords: ['Polti', 'VisitMalta'], homepage: 'https://www.teampoltikometa.com/' },
  { name: 'TotalEnergies', codes: ['TEN'], keywords: ['TotalEnergies'], homepage: 'https://teamtotalenergies.com/', logoCandidates: ['https://teamtotalenergies.com/wp-content/uploads/2021/09/total-energies-pro-cycling-logo-rgb-e1630606239379.png'] },
  { name: 'Tudor Pro Cycling', codes: ['TUD'], keywords: ['Tudor Pro Cycling'], homepage: 'https://www.tudorprocycling.com/', logoCandidates: ['https://static.wixstatic.com/media/ded0b9_bce04b839aca430f91ccca43a14e5a92%7Emv2.jpg/v1/fill/w_192%2Ch_192%2Clg_1%2Cusm_0.66_1.00_0.01/ded0b9_bce04b839aca430f91ccca43a14e5a92%7Emv2.jpg'] },
  { name: 'Unibet Rose Rockets', codes: ['URR'], keywords: ['Unibet', 'Rose Rockets'], homepage: 'https://www.unibetcycling.com/' }
];

function normalizeContentType(contentType) {
  return String(contentType || '').split(';')[0].trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveUrl(value, baseUrl) {
  if (!value || value.startsWith('data:')) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch (err) {
    return null;
  }
}

function rootIconCandidates(homepage) {
  const root = new URL(homepage);
  root.pathname = '/';
  root.search = '';
  root.hash = '';
  return [
    '/apple-touch-icon.png',
    '/favicon-192x192.png',
    '/favicon-96x96.png',
    '/favicon-32x32.png',
    '/favicon.png'
  ].map(path => new URL(path, root).toString());
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: 8000,
    maxRedirects: 5,
    responseType: 'text',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' }
  });
  return { html: res.data, finalUrl: res.request?.res?.responseUrl || url };
}

function collectImageCandidates(html, finalUrl) {
  const $ = cheerio.load(html);
  const logoImages = [];
  const icons = [];
  const socialImages = [];

  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, el) => {
    socialImages.push(resolveUrl($(el).attr('content'), finalUrl));
  });

  $('link[rel]').each((_, el) => {
    const rel = String($(el).attr('rel') || '').toLowerCase();
    if (rel.includes('icon')) icons.push(resolveUrl($(el).attr('href'), finalUrl));
  });

  $('img, source').each((_, el) => {
    const node = $(el);
    const text = [
      node.attr('alt'),
      node.attr('class'),
      node.attr('id'),
      node.attr('src'),
      node.attr('srcset'),
      node.attr('data-src')
    ].filter(Boolean).join(' ').toLowerCase();

    if (!/(logo|brand|header|team|crest)/.test(text)) return;

    const srcset = node.attr('srcset') || '';
    srcset.split(',').forEach(item => {
      const src = item.trim().split(/\s+/)[0];
      logoImages.push(resolveUrl(src, finalUrl));
    });
    logoImages.push(resolveUrl(node.attr('data-src') || node.attr('src'), finalUrl));
  });

  return {
    logoImages: unique(logoImages),
    icons: unique(icons),
    socialImages: unique(socialImages)
  };
}

async function fetchImageDataUri(url) {
  const res = await axios.get(url, {
    timeout: 8000,
    maxRedirects: 5,
    responseType: 'arraybuffer',
    maxContentLength: MAX_IMAGE_BYTES,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*'
    },
    validateStatus: status => status >= 200 && status < 400
  });

  const contentType = normalizeContentType(res.headers['content-type']);
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error(`unsupported image type: ${contentType || 'unknown'}`);
  }

  const bytes = Buffer.from(res.data);
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(`invalid image size: ${bytes.length}`);
  }

  return {
    dataUri: `data:${contentType};base64,${bytes.toString('base64')}`,
    contentType,
    bytes: bytes.length
  };
}

async function findLogo(source, includeAuto) {
  const tried = [];
  let pageCandidates = { logoImages: [], icons: [], socialImages: [] };

  if (includeAuto) {
    try {
      const { html, finalUrl } = await fetchHtml(source.homepage);
      pageCandidates = collectImageCandidates(html, finalUrl);
    } catch (err) {
      console.warn(`  HTML fetch failed: ${err.message}`);
    }
  }

  const candidates = unique([
    ...(source.logoCandidates || []),
    ...pageCandidates.logoImages,
    ...pageCandidates.icons,
    ...(includeAuto ? rootIconCandidates(source.homepage) : []),
    ...pageCandidates.socialImages
  ]).slice(0, MAX_CANDIDATES_PER_TEAM);

  for (const imageUrl of unique(candidates)) {
    tried.push(imageUrl);
    try {
      const image = await fetchImageDataUri(imageUrl);
      return { ...image, imageUrl, tried };
    } catch (err) {
      // Try the next candidate. Sites often expose SVG or protected variants first.
    }
  }

  throw new Error(`no usable png/jpg/webp/gif image found (${tried.length} candidates)`);
}

function buildWhere(source) {
  const clauses = [];
  const values = [];

  for (const code of source.codes || []) {
    clauses.push('uci_code = ?');
    values.push(code);
  }

  for (const keyword of source.keywords || []) {
    clauses.push('team_name LIKE ?');
    values.push(`%${keyword}%`);
  }

  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : '(1 = 0)', values };
}

async function updateTeamLogo(conn, source, dataUri) {
  const where = buildWhere(source);
  const [result] = await conn.query(
    `UPDATE teams SET logo_url = ? WHERE ${where.sql}`,
    [dataUri, ...where.values]
  );
  return result.affectedRows;
}

async function countMatches(conn, source) {
  const where = buildWhere(source);
  const [[row]] = await conn.query(`SELECT COUNT(*) AS cnt FROM teams WHERE ${where.sql}`, where.values);
  return row.cnt;
}

async function clearNonBase64Logos(conn, dryRun) {
  const where = `
    logo_url IS NOT NULL
    AND logo_url <> ''
    AND logo_url NOT LIKE 'data:image/%;base64,%'
  `;

  if (dryRun) {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS cnt FROM teams WHERE ${where}`);
    return row.cnt;
  }

  const [result] = await conn.query(`UPDATE teams SET logo_url = NULL WHERE ${where}`);
  return result.affectedRows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const includeAuto = process.argv.includes('--include-auto');
  const conn = await mysql.createConnection(DB_CONFIG);

  await conn.query('ALTER TABLE teams MODIFY logo_url MEDIUMTEXT NULL');

  let updatedTeams = 0;
  let successfulSources = 0;
  const failures = [];

  for (const source of TEAM_SOURCES) {
    console.log(`\n${source.name}`);
    try {
      const logo = await findLogo(source, includeAuto);
      const rows = dryRun ? await countMatches(conn, source) : await updateTeamLogo(conn, source, logo.dataUri);
      updatedTeams += rows;
      successfulSources += 1;
      console.log(`  ${dryRun ? 'would update' : 'updated'} ${rows} row(s), ${logo.contentType}, ${logo.bytes} bytes`);
      console.log(`  source: ${logo.imageUrl}`);
    } catch (err) {
      failures.push({ name: source.name, error: err.message });
      console.warn(`  skipped: ${err.message}`);
    }
  }

  const [stats] = await conn.query(`
    SELECT
      COUNT(*) AS total,
      SUM(logo_url IS NOT NULL AND logo_url <> '') AS with_logo,
      SUM(logo_url LIKE 'data:image/%;base64,%') AS with_base64_logo
    FROM teams
  `);

  console.log('\nSummary');
  console.table(stats);
  console.log(`sources ok: ${successfulSources}/${TEAM_SOURCES.length}`);
  console.log(`rows updated: ${updatedTeams}`);

  if (failures.length > 0) {
    console.log('\nFailures');
    console.table(failures);
  }

  const cleared = await clearNonBase64Logos(conn, dryRun);
  console.log(`\n${dryRun ? 'would clear' : 'cleared'} non-base64 logo_url rows: ${cleared}`);

  await conn.end();
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
