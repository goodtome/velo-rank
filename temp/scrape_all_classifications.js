const { fetchPage } = require('../server/scripts/scrape-pcs');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeClassification(raceCode, stageNum, type) {
  const url = `https://www.procyclingstats.com/race/${raceCode}/2026/stage-${stageNum}/${type}`;
  console.log(`Fetching ${type} for Stage ${stageNum}: ${url}...`);
  const html = await fetchPage(url);
  if (!html) {
    console.error(`Failed to fetch ${type} for Stage ${stageNum}`);
    return [];
  }
  const $ = cheerio.load(html);
  const results = [];
  
  // Find the table with class 'results'
  let table = null;

  if (type === 'teams') {
    // Look for a table that has a column with data-code="teamline"
    $('table.results').each((i, t) => {
      if ($(t).find('th[data-code="teamline"]').length > 0) {
        table = $(t);
      }
    });
  } else if (type === 'points' || type === 'mountains' || type === 'youth') {
    // For these, we want the "Overall standing" or the one with "prev" column
    $('table.results').each((i, t) => {
      const hasPrev = $(t).find('th[data-code="prev"]').length > 0;
      const header = $(t).prevAll('h3').first().text().toLowerCase();
      if (hasPrev && (header.includes('standing') || header.includes('points') || header.includes('mountains') || header.includes('youth'))) {
        table = $(t);
      }
    });
  }

  // Fallback to first table if still null
  if (!table || !table.length) {
    table = $('table.results').first();
  }

  if (!table || !table.length) {
    console.error(`No ${type} table found for Stage ${stageNum}`);
    return [];
  }

  table.find('tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    
    const rank = cols.eq(0).text().trim();
    if (isNaN(parseInt(rank))) return;

    if (type === 'teams') {
      const teamCell = $row.find('a[href^="team/"]').first();
      const teamName = teamCell.text().trim();
      const teamSlug = teamCell.attr('href')?.replace('team/', '');
      
      // For Team class, time and gap are usually in the last columns
      const time = cols.eq(cols.length - 2).text().trim();
      const gap = cols.eq(cols.length - 1).text().trim();
      results.push({ rank, teamName, teamSlug, time, gap });
    } else {
      // Rider based tables
      const valCell = cols.eq(cols.length - 2);
      timeOrPoints = valCell.text().trim();
      const gapCell = cols.eq(cols.length - 1);
      gap = gapCell.text().trim();

      results.push({
        rank,
        riderName,
        riderSlug,
        teamName,
        teamSlug,
        nationality,
        value: timeOrPoints,
        gap
      });
    }
  });
  
  console.log(`Extracted ${results.length} ${type} results for Stage ${stageNum}.`);
  return results;
}

async function run() {
  const raceCode = 'giro-d-italia';
  const stageNums = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const types = ['gc', 'points', 'mountains', 'youth', 'teams'];

  for (const stageNum of stageNums) {
    for (const type of types) {
      const filename = `giro2026_stage${stageNum}_${type}.json`;
      // Overwrite teams, but skip others if exist
      if (type !== 'teams' && fs.existsSync(filename)) continue;

      const results = await scrapeClassification(raceCode, stageNum, type);
      if (results.length > 0) {
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
      }
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

run();
