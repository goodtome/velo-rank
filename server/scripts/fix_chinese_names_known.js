const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

function extractObjectLiteral(fileText, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`);
  const match = fileText.match(re);
  if (!match) {
    throw new Error(`Cannot find object literal for ${constName}`);
  }
  return Function(`"use strict"; return ({${match[1]}\n});`)();
}

function extractArrayLiteral(fileText, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`);
  const match = fileText.match(re);
  if (!match) {
    throw new Error(`Cannot find array literal for ${constName}`);
  }
  return Function(`"use strict"; return ([${match[1]}\n]);`)();
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const root = path.join(__dirname, 'update-chinese-names.js');
  const teamRuleFile = path.join(__dirname, 'update_team_zh.js');

  const exactText = fs.readFileSync(root, 'utf8');
  const teamRuleText = fs.readFileSync(teamRuleFile, 'utf8');
  const exactTeamMap = extractObjectLiteral(exactText, 'TEAM_NAME_ZH_MAP');
  const riderMap = extractObjectLiteral(exactText, 'RIDER_NAME_ZH_MAP');
  const teamRules = extractArrayLiteral(teamRuleText, 'mapping');

  const conn = await mysql.createConnection({
    ...dbConfig.development,
    dateStrings: true
  });

  try {
    const report = {
      exactTeamUpdated: [],
      ruleTeamUpdated: [],
      riderUpdated: [],
      skippedTeams: [],
      skippedRiders: []
    };

    const [teams] = await conn.query(
      'SELECT id, team_name, team_name_zh, team_slug, uci_code, country FROM teams'
    );
    const [riders] = await conn.query(
      'SELECT id, rider_name, rider_name_zh, rider_slug, nationality, uci_id FROM riders'
    );

    const teamById = new Map(teams.map(t => [t.id, t]));
    const riderById = new Map(riders.map(r => [r.id, r]));

    for (const team of teams) {
      if (team.team_name_zh && String(team.team_name_zh).trim()) continue;

      const exactZh = exactTeamMap[team.team_name];
      if (exactZh) {
        report.exactTeamUpdated.push({ id: team.id, team_name: team.team_name, team_name_zh: exactZh });
        continue;
      }

      const normTeam = normalizeName(team.team_name);
      const matchedRule = teamRules.find(rule => {
        return rule.keywords.every(keyword => normTeam.includes(normalizeName(keyword)));
      });
      if (matchedRule) {
        report.ruleTeamUpdated.push({ id: team.id, team_name: team.team_name, team_name_zh: matchedRule.zh });
      } else {
        report.skippedTeams.push({ id: team.id, team_name: team.team_name });
      }
    }

    for (const rider of riders) {
      if (rider.rider_name_zh && String(rider.rider_name_zh).trim()) continue;

      const zh = riderMap[rider.rider_name];
      if (zh) {
        report.riderUpdated.push({ id: rider.id, rider_name: rider.rider_name, rider_name_zh: zh });
      } else {
        report.skippedRiders.push({ id: rider.id, rider_name: rider.rider_name, nationality: rider.nationality });
      }
    }

    console.log(JSON.stringify({
      dryRun,
      teamExactCount: report.exactTeamUpdated.length,
      teamRuleCount: report.ruleTeamUpdated.length,
      riderCount: report.riderUpdated.length,
      skippedTeams: report.skippedTeams.length,
      skippedRiders: report.skippedRiders.length,
      sampleTeams: report.exactTeamUpdated.slice(0, 10).concat(report.ruleTeamUpdated.slice(0, 10)),
      sampleRiders: report.riderUpdated.slice(0, 15)
    }, null, 2));

    if (dryRun) {
      return;
    }

    let updatedTeams = 0;
    for (const row of report.exactTeamUpdated) {
      const [result] = await conn.query(
        'UPDATE teams SET team_name_zh = ? WHERE id = ?',
        [row.team_name_zh, row.id]
      );
      updatedTeams += result.affectedRows;
    }
    for (const row of report.ruleTeamUpdated) {
      const [result] = await conn.query(
        'UPDATE teams SET team_name_zh = ? WHERE id = ?',
        [row.team_name_zh, row.id]
      );
      updatedTeams += result.affectedRows;
    }

    let updatedRiders = 0;
    for (const row of report.riderUpdated) {
      const [result] = await conn.query(
        'UPDATE riders SET rider_name_zh = ? WHERE id = ?',
        [row.rider_name_zh, row.id]
      );
      updatedRiders += result.affectedRows;
    }

    console.log(JSON.stringify({ updatedTeams, updatedRiders }, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
