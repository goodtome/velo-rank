/**
 * 从 GC 数据按年龄生成 Youth 分类
 * 
 * TdF 白衫: 26岁以下车手，按 GC 时间排名
 * 
 * 原理: PCS GC 表格 col6 = 年龄, 直接筛选 < 26 岁的车手
 * 用已抓取的 PCS 页面 (每个赛段只需抓一次) 生成所有 21 赛段的 Youth 数据
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

puppeteer.use(StealthPlugin());
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const dbConfig = require('../config/database');

const PCS_BASE = 'https://www.procyclingstats.com';
const TDF2025_RACE_ID = '24a6d4ef-797b-42cb-b23b-ec18732e3d6d';
const YOUTH_AGE_LIMIT = 25; // TdF 白衫: 25岁及以下 (当年12月31日时 ≤ 25)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPCSPage(page, url) {
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  return await page.content();
}

/**
 * 从 GC 表格 (Table 1) 提取车手年龄和成绩
 */
function parseGCWithAge(html) {
  const $ = cheerio.load(html);
  const table = $('table.results').eq(1); // Table 1 = GC
  if (!table.length) return [];

  const rows = table.find('tbody tr');
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const cols = row.find('td');
    if (cols.length < 10) continue;

    const rank = parseInt(cols.eq(0).text().trim());
    if (isNaN(rank)) continue;

    const age = parseInt(cols.eq(6).text().trim()) || 0;

    // Rider
    const riderCell = cols.eq(7);
    const riderLink = riderCell.find('a[href*="rider/"]');
    const riderSlug = riderLink.length ? riderLink.attr('href').replace('rider/', '') : '';
    const riderFullText = riderCell.text().trim();

    // Team
    const teamText = cols.eq(8).text().trim();
    const teamLink = cols.eq(8).find('a[href*="team/"]');
    const teamSlug = teamLink.length
      ? teamLink.attr('href').replace(/team\//, '').replace(/-\d{4}$/, '')
      : '';

    // Extract rider name
    let riderName = riderFullText;
    if (teamText && riderFullText.endsWith(teamText)) {
      riderName = riderFullText.slice(0, -teamText.length).trim();
    }
    if (!riderName && riderLink.length) {
      const linkText = riderLink.text().trim();
      if (teamText && linkText.endsWith(teamText)) {
        riderName = linkText.slice(0, -teamText.length).trim();
      } else {
        riderName = linkText;
      }
    }

    // Time / gap
    const rawTime = cols.eq(11).text().trim() || '';
    const time = rawTime.replace(/(\d{1,2}:\d{2}:\d{2})\1/, '$1');

    let timeGap;
    if (rank === 1) {
      timeGap = '+0:00';
    } else {
      const col12Text = cols.eq(12).text().trim() || '';
      if (col12Text !== '..' && col12Text !== '' && col12Text.includes(':')) {
        timeGap = col12Text;
      } else {
        timeGap = time || '+0:00';
      }
    }

    // 去重
    const dedup = (s) => {
      if (!s) return s;
      const m1 = s.match(/^(\d{1,3}:\d{2}:\d{2})\1$/);
      if (m1) return m1[1];
      const m2 = s.match(/^(\d{1,3}:\d{2})\1$/);
      if (m2) return m2[1];
      return s.replace(/(\d{1,3}:\d{2}:\d{2})\1|(\d{1,3}:\d{2})\2/, (m, g1, g2) => g1 || g2);
    };

    results.push({
      rank, age,
      rider_name: riderName, rider_slug: riderSlug,
      team_name: teamText, team_slug: teamSlug,
      time_gap: dedup(timeGap), time: dedup(time)
    });
  }
  return results;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr || timeStr === '+0:00' || timeStr === '0:00') return 0;
  const cleaned = timeStr.replace('+', '').replace('-', '');
  const parts = cleaned.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 999999;
}

(async () => {
  console.log('=== Generate Youth Classification from GC Age Data ===\n');

  // Step 1: Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Step 2: Connect DB
  const conn = await mysql.createConnection(dbConfig.development);

  // Step 3: Get stages
  const [stages] = await conn.execute(
    'SELECT id, stage_number FROM stages WHERE race_id = ? ORDER BY stage_number',
    [TDF2025_RACE_ID]
  );
  console.log(`Found ${stages.length} stages`);

  // Step 4: Clear existing youth data for TdF 2025
  const stageIds = stages.map(s => s.id);
  const [delResult] = await conn.execute(
    `DELETE FROM youth_classification WHERE stage_id IN (${stageIds.map(() => '?').join(',')})`,
    stageIds
  );
  console.log(`Cleared ${delResult.affectedRows} existing youth records`);

  // Also clear youth jerseys
  const [delJ] = await conn.execute(
    `DELETE FROM jerseys WHERE jersey_type = 'WHITE' AND stage_id IN (${stageIds.map(() => '?').join(',')})`,
    stageIds
  );
  console.log(`Cleared ${delJ.affectedRows} WHITE jersey records\n`);

  // Warmup
  await fetchPCSPage(page, `${PCS_BASE}/race/tour-de-france/2025/stage-1`);
  await sleep(3000);

  let totalYouth = 0;
  let totalJerseys = 0;

  for (const stage of stages) {
    const stageNum = stage.stage_number;
    const stageId = stage.id;

    // Fetch stage page
    try {
      try { await page.evaluate('1'); } catch {
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
      }

      const html = await fetchPCSPage(page, `${PCS_BASE}/race/tour-de-france/2025/stage-${stageNum}`);
      const allGC = parseGCWithAge(html);

      // Filter youth (age <= 25)
      const youthRiders = allGC.filter(r => r.age > 0 && r.age <= YOUTH_AGE_LIMIT);

      if (youthRiders.length === 0) {
        console.log(`Stage ${String(stageNum).padStart(2)}: 0 youth riders (GC had ${allGC.length} riders)`);
        await sleep(3000);
        continue;
      }

      // Sort by GC time_gap (ascending) to get youth ranking
      youthRiders.sort((a, b) => parseTimeToSeconds(a.time_gap) - parseTimeToSeconds(b.time_gap));

      // The youth leader gets +0:00, others keep their gap relative to GC leader
      // But we need youth-specific gaps: each youth rider's gap from the youth leader
      const leaderGapSec = parseTimeToSeconds(youthRiders[0].time_gap);

      let inserted = 0;
      for (let i = 0; i < youthRiders.length; i++) {
        const r = youthRiders[i];

        // Get or create rider
        let riderId = null;
        if (r.rider_slug) {
          const [rows] = await conn.query(
            'SELECT id FROM riders WHERE rider_slug = ? LIMIT 1', [r.rider_slug]
          );
          if (rows.length) riderId = rows[0].id;
        }
        if (!riderId) {
          const [rows] = await conn.query(
            'SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [r.rider_name]
          );
          if (rows.length) riderId = rows[0].id;
        }
        if (!riderId) {
          riderId = uuidv4();
          await conn.query(
            'INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (?, ?, ?, ?)',
            [riderId, r.rider_name, r.rider_slug || null, 'UNK']
          );
        }

        // Youth-specific time_gap: relative to youth leader
        const riderGapSec = parseTimeToSeconds(r.time_gap);
        const youthGapSec = riderGapSec - leaderGapSec;
        const youthGap = youthGapSec === 0 ? '+0:00' : `+${Math.floor(youthGapSec / 60)}:${String(youthGapSec % 60).padStart(2, '0')}`;

        // Insert youth classification
        await conn.query(
          `INSERT INTO youth_classification (stage_id, rider_id, \`rank\`, time, time_gap, jersey_type)
           VALUES (?, ?, ?, ?, ?, 'WHITE')`,
          [stageId, riderId, i + 1,
           r.time ? String(r.time).substring(0, 20) : null,
           youthGap]
        );
        inserted++;
      }

      // Generate WHITE jersey for this stage
      if (inserted > 0) {
        const youthLeader = youthRiders[0];
        let leaderRiderId = null;
        if (youthLeader.rider_slug) {
          const [rows] = await conn.query(
            'SELECT id FROM riders WHERE rider_slug = ? LIMIT 1', [youthLeader.rider_slug]
          );
          if (rows.length) leaderRiderId = rows[0].id;
        }
        if (!leaderRiderId) {
          const [rows] = await conn.query(
            'SELECT id FROM riders WHERE rider_name = ? LIMIT 1', [youthLeader.rider_name]
          );
          if (rows.length) leaderRiderId = rows[0].id;
        }

        if (leaderRiderId) {
          // Get team_id from stage_results
          let teamId = null;
          const [teamRows] = await conn.query(
            'SELECT team_id FROM stage_results WHERE stage_id = ? AND rider_id = ? LIMIT 1',
            [stageId, leaderRiderId]
          );
          if (teamRows.length) teamId = teamRows[0].team_id;
          if (!teamId) {
            const [gcRows] = await conn.query(
              'SELECT team_id FROM general_classification WHERE stage_id = ? AND rider_id = ? LIMIT 1',
              [stageId, leaderRiderId]
            );
            if (gcRows.length) teamId = gcRows[0].team_id;
          }

          if (teamId) {
            const jerseyId = uuidv4();
            await conn.query(
              'INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id) VALUES (?, ?, ?, ?, ?)',
              [jerseyId, stageId, 'WHITE', leaderRiderId, teamId]
            );
            totalJerseys++;
          }
        }
      }

      const leader = youthRiders[0];
      console.log(`Stage ${String(stageNum).padStart(2)}: ${inserted} youth | Leader: ${leader.rider_name} (age ${leader.age})`);
      totalYouth += inserted;

      await sleep(3000);
    } catch (e) {
      console.log(`Stage ${stageNum} error: ${e.message}`);
    }
  }

  console.log(`\nDone! Total youth records: ${totalYouth}, WHITE jerseys: ${totalJerseys}`);

  await browser.close();
  await conn.end();
})();
