const { fetchPage } = require('../server/scripts/scrape-pcs');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrape(url, filename) {
  console.log(`Fetching ${url}...`);
  const html = await fetchPage(url);
  if (!html) {
    console.error('Failed to fetch page');
    return;
  }
  const $ = cheerio.load(html);
  const results = [];
  
  // The table is usually .results > table
  $('.results table tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 6) return;
    
    // PCS usually has: Rank, Bib, Rider, Team, UCI, Time, ...
    const rank = cols.eq(0).text().trim();
    const riderName = cols.eq(2).find('a').first().text().trim();
    const riderSlug = cols.eq(2).find('a').first().attr('href')?.replace('rider/', '');
    const teamName = cols.eq(3).find('a').first().text().trim();
    const teamUci = cols.eq(3).find('a').first().attr('href')?.replace('team/', '').split('-')[0].toUpperCase();
    const nationality = cols.eq(2).find('span.flag').attr('class')?.split(' ').find(c => c.length === 2)?.toUpperCase();
    const time = cols.eq(5).text().trim();
    
    if (rank && riderName) {
      results.push({
        rank,
        riderName,
        riderSlug,
        teamName,
        teamUci,
        nationality,
        time
      });
    }
  });
  
  console.log(`Extracted ${results.length} results.`);
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
}

async function run() {
  await scrape('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-19', 'stage19_full.json');
  await scrape('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-20', 'stage20_full.json');
}

run();
