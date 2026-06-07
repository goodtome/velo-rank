const cheerio = require('cheerio');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const dbConfig = {
  host: 'localhost', port: 13306, user: 'root', password: 'mysql123456', database: 'jersey_db'
};

const GC_MAP = {
  1: { id: 'dae5a35c-7cc3-4f67-8cec-5249adfa381a', file: 'giro_women_stage1.html' },
  2: { id: '6afcb9c4-762d-471a-8bda-90318970dd24', file: 'giro_women_stage2_gc.html' }
};

function extractGC($, type = 'gc') {
  const results = [];
  const table = $('table.results').first();
  if (!table.length) return [];

  table.find('tbody tr').each((i, row) => {
    const $row = $(row);
    const cols = $row.find('td');
    if (cols.length < 5) return;

    const rank = cols.eq(0).text().trim();
    if (isNaN(parseInt(rank))) return;

    const riderCell = $row.find('.ridername');
    const riderName = riderCell.find('a').first().text().trim();
    const riderSlug = riderCell.find('a').first().attr('href')?.replace('rider/', '');
    const nationality = riderCell.find('span.flag').attr('class')?.split(' ').find(c => c.length === 2)?.toUpperCase();

    const teamCell = cols.filter((j, cell) => $(cell).find('a[href^="team/"]').length > 0).first();
    const teamName = teamCell.find('a').first().text().trim();
    const teamSlug = teamCell.find('a').first().attr('href')?.replace('team/', '');

    const time = cols.eq(cols.length - 2).text().trim();
    const gap = cols.eq(cols.length - 1).text().trim();

    results.push({ rank, riderName, riderSlug, teamName, teamSlug, nationality, time, gap });
  });
  return results;
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  
  for (const [num, info] of Object.entries(GC_MAP)) {
    console.log(`\nImporting GC for Stage ${num}...`);
    const html = fs.readFileSync(info.file, 'utf8');
    const $ = cheerio.load(html);
    const results = extractGC($);

    console.log(`  Extracted ${results.length} GC entries.`);
    if (results.length === 0) continue;

    await conn.query('DELETE FROM general_classification WHERE stage_id = ?', [info.id]);

    for (const res of results) {
      let riderId;
      const [riders] = await conn.query('SELECT id FROM riders WHERE rider_slug = ?', [res.riderSlug]);
      if (riders.length > 0) riderId = riders[0].id;
      else {
        riderId = uuidv4();
        await conn.query('INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())', [riderId, res.riderName, res.riderSlug, res.nationality]);
      }

      let teamId;
      const normalizedTeamSlug = res.teamSlug?.replace(/-20\d{2}$/, '');
      const [teams] = await conn.query('SELECT id FROM teams WHERE team_slug = ? OR team_name = ?', [normalizedTeamSlug, res.teamName]);
      if (teams.length > 0) teamId = teams[0].id;
      else {
        teamId = uuidv4();
        await conn.query('INSERT INTO teams (id, team_name, team_slug, created_at) VALUES (?, ?, ?, NOW())', [teamId, res.teamName, normalizedTeamSlug]);
      }

      await conn.query(
        'INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, total_time, time_gap, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [uuidv4(), info.id, parseInt(res.rank), riderId, teamId, res.nationality, res.time, res.gap]
      );
    }
  }

  await conn.end();
  process.exit();
}

run();
