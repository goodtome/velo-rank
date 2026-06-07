const cheerio = require('cheerio');
const fs = require('fs');

async function scrape() {
  const html = fs.readFileSync('giro_women_main.html', 'utf8');
  const $ = cheerio.load(html);
  const stages = [];

  $('table.basic tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 4) return;

    const dateStr = cols.eq(0).text().trim(); // e.g. 30/05
    const $link = cols.eq(3).find('a');
    const stageName = $link.text().trim();
    const distance = cols.eq(4).text().trim();

    if (stageName.includes('Stage')) {
      const stageNumMatch = stageName.match(/Stage (\d+)/);
      const stageNumber = stageNumMatch ? parseInt(stageNumMatch[1]) : (stages.length + 1);
      
      // Convert 30/05 to 2026-05-30
      const [day, month] = dateStr.split('/');
      const startDate = `2026-${month}-${day}`;

      stages.push({
        stageNumber,
        stageName,
        startDate,
        distance: parseInt(distance) || null
      });
    }
  });

  console.log(`Extracted ${stages.length} stages.`);
  fs.writeFileSync('giro_women_stages.json', JSON.stringify(stages, null, 2));
}

scrape();
