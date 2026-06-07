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
  
  const table = $('table.results').first();
  if (!table.length) {
    console.error('No table found');
    return;
  }

  table.find('tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 5) return;
    
    const rank = cols.eq(0).text().trim();
    const riderCell = $row.find('.ridername');
    const riderName = riderCell.find('a').first().text().trim();
    const riderSlug = riderCell.find('a').first().attr('href')?.replace('rider/', '');
    
    const teamCell = cols.filter((j, cell) => $(cell).find('a[href^="team/"]').length > 0).first();
    const teamName = teamCell.find('a').first().text().trim();
    const teamSlug = teamCell.find('a').first().attr('href')?.replace('team/', '');
    
    const nationality = riderCell.find('span.flag').attr('class')?.split(' ').find(c => c.length === 2)?.toUpperCase();
    
    const timeCell = $row.find('.time');
    const time = timeCell.find('font').text().trim() || timeCell.text().trim();
    
    if (rank && riderName) {
      results.push({
        rank,
        riderName,
        riderSlug,
        teamName,
        teamSlug,
        nationality,
        time
      });
    }
  });
  
  console.log(`Extracted ${results.length} results.`);
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
}

async function run() {
  await scrape('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-21', 'stage21_full.json');
}

run();
