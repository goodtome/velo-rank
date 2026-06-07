const { fetchPage } = require('../server/scripts/scrape-pcs');
const fs = require('fs');

async function run() {
  const html = await fetchPage('https://www.procyclingstats.com/race/giro-d-italia/2026');
  if (html) {
    fs.writeFileSync('giro2026_robust.html', html);
    console.log('Saved giro2026_robust.html');
  }
}

run();
