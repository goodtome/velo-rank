const { fetchPage } = require('../server/scripts/scrape-pcs');
const fs = require('fs');

async function run() {
  const html1 = await fetchPage('https://www.procyclingstats.com/race/giro-d-italia-women/2026/stage-1');
  fs.writeFileSync('giro_women_stage1.html', html1);
  const html2 = await fetchPage('https://www.procyclingstats.com/race/giro-d-italia-women/2026/stage-2');
  fs.writeFileSync('giro_women_stage2.html', html2);
}

run();
