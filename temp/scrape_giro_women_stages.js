const { fetchPage } = require('../server/scripts/scrape-pcs');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeStages() {
  const url = 'https://www.procyclingstats.com/race/giro-d-italia-women/2026';
  console.log(`Fetching ${url}...`);
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const stages = [];

  $('.mt10 table.basic tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 3) return;

    const dateStr = cols.eq(0).text().trim(); // e.g. 30/05
    const stageName = cols.eq(2).text().trim(); // e.g. Stage 1 | Cesenatico - Ravenna
    const km = cols.eq(3).text().trim();

    if (stageName.startsWith('Stage')) {
      stages.push({
        date: dateStr,
        name: stageName,
        distance: km
      });
    }
  });

  console.log(`Extracted ${stages.length} stages.`);
  fs.writeFileSync('giro_women_stages.json', JSON.stringify(stages, null, 2));
}

scrapeStages();
