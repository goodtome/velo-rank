#!/usr/bin/env node
/**
 * 导入 2026 锡比乌环赛：赛事元数据、5 个数据库赛段（1a/1b 拆分）与赛段成绩、GC。
 * 数据源：ProCyclingStats 页面，由 Puppeteer Stealth 渲染后解析。
 *
 * 用法：node scripts/import_sibiu_tour_2026.js [--dry-run]
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const { localDbConfig } = require('./lib/db-config');

puppeteer.use(StealthPlugin());

const RACE_CODE = 'sibiu-tour-2026';
const RACE = {
  name: 'Sibiu Cycling Tour', zh: '锡比乌环赛',
  start: '2026-07-04', end: '2026-07-07', stages: 5,
  country: 'Romania', category: 'Continental', categoryZh: '洲际赛', gender: 'MEN'
};
// 数据库 stage_number 为 INT，故将官方 1a、1b、2、3、4 映射为 1、2、3、4、5；官方编号保留在 stage_name / stage_code。
const STAGES = [
  { n: 1, slug: '1a', official: '1a', date: '2026-07-04', km: 110.5, type: 'flat', start: 'Sibiu', finish: 'Sibiu' },
  { n: 2, slug: '1b', official: '1b (ITT)', date: '2026-07-04', km: 3.2, type: 'itt', start: 'Sibiu', finish: 'Sibiu' },
  { n: 3, slug: '2', official: '2', date: '2026-07-05', km: 157.8, type: 'mountains', start: 'Sibiu', finish: 'Păltiniș Arena' },
  { n: 4, slug: '3', official: '3', date: '2026-07-06', km: 157.4, type: 'mountains', start: 'Sibiu', finish: 'Bâlea Lac' },
  { n: 5, slug: '4', official: '4', date: '2026-07-07', km: 181.0, type: 'flat', start: 'Sibiu', finish: 'Sibiu' }
];
const dryRun = process.argv.includes('--dry-run');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function text(el) { return (el || '').replace(/\s+/g, ' ').trim(); }
function extractRider(td) {
  const a = td.find('a[href*="rider/"]');
  if (!a.length) return null;
  const href = a.attr('href') || '';
  const slug = href.match(/rider\/([^/?#]+)/)?.[1] || '';
  const upper = a.find('.uppercase').first().text().trim();
  let name = text(a.text());
  if (upper) {
    const first = name.replace(upper, '').trim();
    name = `${upper} ${first}`.trim();
  }
  const flag = td.find('.flag').first().attr('class') || '';
  const nationality = (flag.match(/flag\s+([a-z]{2,3})/i)?.[1] || 'UN').toUpperCase();
  return { name, slug, nationality };
}
function extractTeam(td) {
  const a = td.find('a[href*="team/"]');
  if (!a.length) return { name: text(td.text()), slug: '' };
  const href = a.attr('href') || '';
  return { name: text(a.text()), slug: (href.match(/team\/([^/?#]+)/)?.[1] || '').replace(/-2026$/, '') };
}
function cellValue(td) {
  const font = td.find('font').first();
  return text(font.length ? font.text() : td.text());
}
function parseTable($, table, type) {
  const out = [];
  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    const rank = Number(text(cells.eq(0).text()));
    if (!Number.isInteger(rank) || rank < 1) return;
    let riderCell = -1;
    cells.each((i, cell) => { if (riderCell < 0 && $(cell).find('a[href*="rider/"]').length) riderCell = i; });
    if (riderCell < 0) return;
    const rider = extractRider(cells.eq(riderCell));
    if (!rider?.name) return;
    let teamCell = -1;
    cells.each((i, cell) => { if (teamCell < 0 && $(cell).find('a[href*="team/"]').length) teamCell = i; });
    const team = teamCell >= 0 ? extractTeam(cells.eq(teamCell)) : { name: '', slug: '' };
    const values = cells.toArray().map(cell => cellValue($(cell)));
    if (type === 'stage') {
      // 最后一列通常为单日时间；若是带 GC 的 13 列表，最后一列仍为正式用时。
      const time = values[values.length - 1] || '';
      out.push({ rank, rider, team, timeGap: rank === 1 ? '+0:00' : (time.startsWith('+') ? time : '' ) });
    } else {
      // GC 页：车手/车队之后的第一个时间值。榜首是累计时间，后续为差距。
      const tail = values.slice(Math.max(riderCell, teamCell) + 1);
      const candidate = tail.find(v => /^(?:\+|-)?\d{1,3}:\d{2}(?::\d{2}(?:\.\d{1,2})?)?$/.test(v)) || '';
      out.push({ rank, rider, team, totalTime: rank === 1 ? candidate : null, timeGap: rank === 1 ? '+0:00' : (candidate && !candidate.startsWith('+') ? `+${candidate}` : candidate) });
    }
  });
  return out;
}
function chooseTables(html) {
  const $ = cheerio.load(html);
  const tables = $('table.results');
  const candidates = [];
  tables.each((i, table) => {
    const headers = text($(table).find('thead').text());
    const riderRows = $(table).find('tbody tr').filter((_, r) => $(r).find('a[href*="rider/"]').length).length;
    if (riderRows) candidates.push({ i, headers, riderRows, table: $(table) });
  });
  // PCS 主赛段成绩表是首个有车手的表；GC 是包含 Prev 的宽表。若不存在 Prev，第二个车手表作为回退。
  const stage = candidates[0]?.table;
  const gc = candidates.find(x => /\bPrev\b/.test(x.headers) && /\bTime\b/.test(x.headers))?.table || candidates[1]?.table;
  return { $, stage, gc, summary: candidates.map(x => `${x.i}:${x.riderRows}:${x.headers.slice(0, 60)}`).join(' | ') };
}
async function ensureRaceAndStages(conn) {
  const [existing] = await conn.query('SELECT id FROM races WHERE race_code=?', [RACE_CODE]);
  let raceId = existing[0]?.id;
  if (!raceId) {
    raceId = uuidv4();
    await conn.query('INSERT INTO races (id,race_name,race_name_en,race_name_zh,race_code,category,category_zh,gender,season,country,start_date,end_date,total_stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [raceId, RACE.name, RACE.name, RACE.zh, RACE_CODE, RACE.category, RACE.categoryZh, RACE.gender, 2026, RACE.country, RACE.start, RACE.end, RACE.stages]);
  } else {
    await conn.query('UPDATE races SET race_name=?,race_name_en=?,race_name_zh=?,category=?,category_zh=?,gender=?,season=?,country=?,start_date=?,end_date=?,total_stages=? WHERE id=?',
      [RACE.name, RACE.name, RACE.zh, RACE.category, RACE.categoryZh, RACE.gender, 2026, RACE.country, RACE.start, RACE.end, RACE.stages, raceId]);
  }
  for (const s of STAGES) {
    const name = `Stage ${s.official}: ${s.start} - ${s.finish}`;
    const code = `${RACE_CODE}-stage-${s.slug}`;
    const [found] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [raceId, s.n]);
    if (found.length) {
      await conn.query('UPDATE stages SET stage_name=?,stage_name_zh=?,stage_type=?,date=?,distance_km=?,start_city=?,finish_city=?,stage_code=? WHERE id=?',
        [name, `第${s.official}赛段：${s.start} - ${s.finish}`, s.type, s.date, s.km, s.start, s.finish, code, found[0].id]);
    } else {
      await conn.query('INSERT INTO stages (id,race_id,stage_number,stage_name,stage_name_zh,stage_type,date,distance_km,start_city,finish_city,stage_code) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [uuidv4(), raceId, s.n, name, `第${s.official}赛段：${s.start} - ${s.finish}`, s.type, s.date, s.km, s.start, s.finish, code]);
    }
  }
  return raceId;
}
async function riderId(conn, rider) {
  if (rider.slug) { const [r] = await conn.query('SELECT id FROM riders WHERE rider_slug=? LIMIT 1', [rider.slug]); if (r.length) return r[0].id; }
  const [r] = await conn.query('SELECT id FROM riders WHERE rider_name=? LIMIT 1', [rider.name]);
  if (r.length) return r[0].id;
  const id = uuidv4();
  await conn.query('INSERT INTO riders (id,rider_name,rider_slug,nationality) VALUES (?,?,?,?)', [id, rider.name, rider.slug || null, rider.nationality || 'UN']);
  return id;
}
async function teamId(conn, team) {
  if (!team.name) return null;
  if (team.slug) { const [r] = await conn.query('SELECT id FROM teams WHERE team_slug=? LIMIT 1', [team.slug]); if (r.length) return r[0].id; }
  const [r] = await conn.query('SELECT id FROM teams WHERE team_name=? LIMIT 1', [team.name]);
  if (r.length) return r[0].id;
  const id = uuidv4();
  await conn.query('INSERT INTO teams (id,team_name,team_slug) VALUES (?,?,?)', [id, team.name, team.slug || null]);
  return id;
}
async function upsertStage(conn, stageId, rows) {
  let n = 0;
  for (const row of rows) {
    const rid = await riderId(conn, row.rider); const tid = await teamId(conn, row.team); if (!tid) continue;
    const [found] = await conn.query('SELECT id FROM stage_results WHERE stage_id=? AND rider_id=?', [stageId, rid]);
    if (found.length) await conn.query('UPDATE stage_results SET rank_pos=?,team_id=?,nationality=?,time_gap=?,is_same_time=? WHERE id=?', [row.rank,tid,row.rider.nationality,row.timeGap || null,row.rank === 1 ? 1 : 0,found[0].id]);
    else await conn.query('INSERT INTO stage_results (id,stage_id,rank_pos,rider_id,team_id,nationality,time_gap,is_same_time) VALUES (?,?,?,?,?,?,?,?)', [uuidv4(),stageId,row.rank,rid,tid,row.rider.nationality,row.timeGap || null,row.rank === 1 ? 1 : 0]);
    n++;
  } return n;
}
async function upsertGC(conn, stageId, rows) {
  let n = 0;
  for (const row of rows) {
    const rid = await riderId(conn, row.rider); const tid = await teamId(conn, row.team); if (!tid) continue;
    const [found] = await conn.query('SELECT id FROM general_classification WHERE stage_id=? AND rider_id=?', [stageId, rid]);
    if (found.length) await conn.query('UPDATE general_classification SET `rank`=?,team_id=?,nationality=?,total_time=?,time_gap=? WHERE id=?', [row.rank,tid,row.rider.nationality,row.totalTime,row.timeGap || null,found[0].id]);
    else await conn.query('INSERT INTO general_classification (id,stage_id,`rank`,rider_id,team_id,nationality,total_time,time_gap) VALUES (?,?,?,?,?,?,?,?)', [uuidv4(),stageId,row.rank,rid,tid,row.rider.nationality,row.totalTime,row.timeGap || null]);
    n++;
  } return n;
}
async function gotoWithRetry(page, url, label, attempts = 4) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      if (response && response.status() < 400) return response;
      last = new Error(`HTTP ${response?.status()}`);
    } catch (error) { last = error; }
    if (attempt < attempts) {
      console.log(`  ${label}: retry ${attempt}/${attempts - 1} (${last.message})`);
      await sleep(attempt * 3000);
    }
  }
  throw last;
}

async function main() {
  const conn = dryRun ? null : await mysql.createConnection(localDbConfig());
  const raceId = conn ? await ensureRaceAndStages(conn) : null;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
    // PCS 对直接访问赛事页面常返回 Cloudflare 403；先以已结束大型赛事赛段预热 Cookie / 浏览器指纹。
    console.log('Warming up PCS session...');
    const warm = await gotoWithRetry(page, 'https://www.procyclingstats.com/race/tour-de-france/2025/stage-1', 'Warmup');
    if (!warm || warm.status() >= 400) throw new Error(`PCS warmup returned ${warm?.status()}`);
    await sleep(4000);
    for (const s of STAGES) {
      const url = `https://www.procyclingstats.com/race/sibiu-cycling-tour/2026/stage-${s.slug}`;
      console.log(`Fetching official stage ${s.official}: ${url}`);
      const response = await gotoWithRetry(page, url, `Stage ${s.official}`);
      const html = await page.content();
      if (!response || response.status() >= 400) throw new Error(`PCS returned ${response?.status()} for Stage ${s.official}`);
      const tables = chooseTables(html);
      const stageRows = tables.stage ? parseTable(tables.$, tables.stage, 'stage') : [];
      const gcRows = tables.gc ? parseTable(tables.$, tables.gc, 'gc') : [];
      console.log(`  tables: ${tables.summary}`);
      console.log(`  parsed: stage=${stageRows.length}, gc=${gcRows.length}`);
      if (!stageRows.length) throw new Error(`No stage rows parsed for official Stage ${s.official}`);
      if (!dryRun) {
        const [st] = await conn.query('SELECT id FROM stages WHERE race_id=? AND stage_number=?', [raceId, s.n]);
        const sr = await upsertStage(conn, st[0].id, stageRows);
        const gc = gcRows.length ? await upsertGC(conn, st[0].id, gcRows) : 0;
        console.log(`  saved: stage=${sr}, gc=${gc}`);
      }
      await sleep(2500);
    }
  } finally { await browser.close(); if (conn) await conn.end(); }
}
main().catch(err => { console.error('FAIL:', err.stack || err.message); process.exit(1); });
