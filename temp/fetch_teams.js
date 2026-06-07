const { fetchPage } = require('../server/scripts/scrape-pcs');
const fs = require('fs');

async function run() {
  const html = await fetchPage('https://www.procyclingstats.com/race/giro-d-italia/2026/stage-18/teams');
  fs.writeFileSync('debug_stage18_teams_robust.html', html);
}

run();
