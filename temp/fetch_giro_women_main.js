const { fetchPage } = require('../server/scripts/scrape-pcs');
const fs = require('fs');

async function run() {
  const html = await fetchPage('https://www.procyclingstats.com/race/giro-d-italia-women/2026');
  fs.writeFileSync('giro_women_main.html', html);
}

run();
