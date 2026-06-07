const cheerio = require('cheerio');
const fs = require('fs');

async function scrape() {
  const html = fs.readFileSync('giro_women_startlist.html', 'utf8');
  const $ = cheerio.load(html);
  const teams = [];

  $('li.slxl_iv, li.slxl_iii, li.slxl_ii').each((i, teamEl) => {
    const $teamEl = $(teamEl);
    const $teamLink = $teamEl.find('a.team');
    if (!$teamLink.length) return;

    const teamName = $teamLink.text().trim();
    const teamSlug = $teamLink.attr('href').replace('team/', '');
    const riders = [];

    $teamEl.find('ul li').each((j, riderEl) => {
      const $riderEl = $(riderEl);
      const bib = $riderEl.find('.bib').text().trim();
      const $riderLink = $riderEl.find('a[href^="rider/"]');
      const riderName = $riderLink.text().trim();
      const riderSlug = $riderLink.attr('href').replace('rider/', '');
      const nationality = $riderEl.find('span.flag').attr('class').split(' ').find(c => c.length === 2).toUpperCase();

      if (riderName) {
        riders.push({
          bib,
          riderName,
          riderSlug,
          nationality
        });
      }
    });

    if (teamName && riders.length > 0) {
      teams.push({
        teamName,
        teamSlug,
        riders
      });
    }
  });

  console.log(`Extracted ${teams.length} teams and ${teams.reduce((acc, t) => acc + t.riders.length, 0)} riders.`);
  fs.writeFileSync('giro_women_startlist.json', JSON.stringify(teams, null, 2));
}

scrape();
