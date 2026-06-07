const { fetchPage } = require('../server/scripts/scrape-pcs');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeGC(raceCode, stageNum) {
  const url = `https://www.procyclingstats.com/race/${raceCode}/2026/stage-${stageNum}/gc`;
  console.log(`Fetching GC for Stage ${stageNum}: ${url}...`);
  const html = await fetchPage(url);
  if (!html) {
    console.error(`Failed to fetch GC for Stage ${stageNum}`);
    return [];
  }
  const $ = cheerio.load(html);
  const results = [];
  
  const table = $('table.results').first();
  if (!table.length) {
    console.error(`No GC table found for Stage ${stageNum}`);
    return [];
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
    
    // GC table columns: Rank, Prev, Rider, Team, Time, Gap
    const timeCell = cols.eq(4); 
    const time = timeCell.text().trim();
    
    const gapCell = cols.eq(5);
    const gap = gapCell.text().trim();

    if (rank && riderName && !isNaN(parseInt(rank))) {
      results.push({
        rank,
        riderName,
        riderSlug,
        teamName,
        teamSlug,
        nationality,
        time,
        gap
      });
    }
  });
  
  console.log(`Extracted ${results.length} GC results for Stage ${stageNum}.`);
  return results;
}

async function run() {
  const raceCode = 'giro-d-italia';
  const stageNums = [10, 11, 12, 13, 14, 15, 19, 20]; // Missing stages
  for (const stageNum of stageNums) {
    const results = await scrapeGC(raceCode, stageNum);
    if (results.length > 0) {
      fs.writeFileSync(`giro2026_stage${stageNum}_gc.json`, JSON.stringify(results, null, 2));
    }
    // Sleep to avoid rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
}

run();
