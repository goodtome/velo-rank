const { fetchPage } = require('./server/scripts/scrape-pcs');
const fs = require('fs');

async function run() {
  const html = await fetchPage('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-19');
  fs.writeFileSync('debug_stage19.html', html);
  console.log('Saved debug_stage19.html');
}

run();
