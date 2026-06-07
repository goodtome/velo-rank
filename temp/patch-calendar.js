const fs = require('fs');

function replaceCalendarRoute(path) {
  let text = fs.readFileSync(path, 'utf8');

  if (!text.includes('function toDateOnly(value)')) {
    const marker = "const log = routeLog('races');\r\n";
    const helper = `\r\nfunction toDateOnly(value) {\r\n  if (!value) return '';\r\n\r\n  if (typeof value === 'string') {\r\n    const match = value.match(/^(\\d{4}-\\d{2}-\\d{2})/);\r\n    if (match) return match[1];\r\n  }\r\n\r\n  const date = new Date(value);\r\n  if (Number.isNaN(date.getTime())) return '';\r\n\r\n  const year = date.getFullYear();\r\n  const month = String(date.getMonth() + 1).padStart(2, '0');\r\n  const day = String(date.getDate()).padStart(2, '0');\r\n  return `${year}-${month}-${day}`;\r\n}\r\n\r\nfunction parseDateOnly(value) {\r\n  const dateOnly = toDateOnly(value);\r\n  if (!dateOnly) return null;\r\n\r\n  const [year, month, day] = dateOnly.split('-').map(Number);\r\n  return new Date(year, month - 1, day);\r\n}\r\n\r\nfunction isFinishedAfterEndOfDay(endDateValue, now = new Date()) {\r\n  const endDate = parseDateOnly(endDateValue);\r\n  if (!endDate) return false;\r\n\r\n  endDate.setHours(23, 59, 59, 999);\r\n  return now.getTime() > endDate.getTime();\r\n}\r\n\r\nfunction buildRaceDays(startDateValue, endDateValue) {\r\n  const start = parseDateOnly(startDateValue);\r\n  const end = parseDateOnly(endDateValue);\r\n  if (!start || !end) return [];\r\n\r\n  const raceDays = [];\r\n  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());\r\n  while (current <= end) {\r\n    raceDays.push(toDateOnly(current));\r\n    current.setDate(current.getDate() + 1);\r\n  }\r\n\r\n  return raceDays;\r\n}\r\n`;
    if (!text.includes(marker)) throw new Error('helper marker not found in ' + path);
    text = text.replace(marker, marker + helper);
  }

  const startMarker = "// GET /api/v1/races/calendar";
  const endMarker = "// GET /api/v1/races/active -";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) throw new Error('calendar markers not found in ' + path);

  const replacement = `// GET /api/v1/races/calendar - 获取赛事日历数据（指定月份）\r\nrouter.get('/calendar', asyncHandler(async (req, res) => {\r\n  const { year, month } = req.query;\r\n\r\n  const yearNum = parseInt(year, 10) || new Date().getFullYear();\r\n  const monthNum = parseInt(month, 10) || (new Date().getMonth() + 1);\r\n\r\n  if (monthNum < 1 || monthNum > 12) {\r\n    throw new AppError('月份必须在1-12之间', ERROR_CODE.BAD_REQUEST);\r\n  }\r\n  if (yearNum < 2020 || yearNum > 2030) {\r\n    throw new AppError('年份必须在2020-2030之间', ERROR_CODE.BAD_REQUEST);\r\n  }\r\n\r\n  const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;\r\n  const lastDay = new Date(yearNum, monthNum, 0).getDate();\r\n  const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;\r\n\r\n  const [races] = await pool.query(`\r\n    SELECT id, race_name, race_name_zh, race_name_en, race_code, category, gender,\r\n           season, country, start_date, end_date, total_stages, logo_url\r\n    FROM races\r\n    WHERE is_active = 1\r\n      AND start_date <= ?\r\n      AND end_date >= ?\r\n    ORDER BY start_date ASC\r\n  `, [monthEnd, monthStart]);\r\n\r\n  const now = new Date();\r\n  const today = toDateOnly(now);\r\n  const racesWithStatus = races.map((race) => {\r\n    const startDate = toDateOnly(race.start_date);\r\n    const endDate = toDateOnly(race.end_date);\r\n    let status = 'upcoming';\r\n\r\n    if (startDate && endDate) {\r\n      if (startDate <= today && !isFinishedAfterEndOfDay(endDate, now)) {\r\n        status = 'ongoing';\r\n      } else if (isFinishedAfterEndOfDay(endDate, now)) {\r\n        status = 'finished';\r\n      }\r\n    }\r\n\r\n    return {\r\n      ...race,\r\n      start_date: startDate,\r\n      end_date: endDate,\r\n      status,\r\n      raceDays: buildRaceDays(startDate, endDate)\r\n    };\r\n  });\r\n\r\n  res.json({\r\n    code: 200,\r\n    data: {\r\n      year: yearNum,\r\n      month: monthNum,\r\n      races: racesWithStatus\r\n    }\r\n  });\r\n}));\r\n\r\n`;

  text = text.slice(0, startIdx) + replacement + text.slice(endIdx);
  fs.writeFileSync(path, text, 'utf8');
}

function replaceFallback(path) {
  let text = fs.readFileSync(path, 'utf8');

  if (!text.includes('function toDateOnly(value)')) {
    const insertAfter = "const { formatDate, navigateTo } = require('../../utils/util');\n";
    const helper = `\nfunction toDateOnly(value) {\n  if (!value) return '';\n\n  if (typeof value === 'string') {\n    const match = value.match(/^(\\d{4}-\\d{2}-\\d{2})/);\n    if (match) return match[1];\n  }\n\n  const date = new Date(value);\n  if (Number.isNaN(date.getTime())) return '';\n\n  const year = date.getFullYear();\n  const month = String(date.getMonth() + 1).padStart(2, '0');\n  const day = String(date.getDate()).padStart(2, '0');\n  return `${year}-${month}-${day}`;\n}\n\nfunction parseDateOnly(value) {\n  const dateOnly = toDateOnly(value);\n  if (!dateOnly) return null;\n\n  const [year, month, day] = dateOnly.split('-').map(Number);\n  return new Date(year, month - 1, day);\n}\n\nfunction isFinishedAfterEndOfDay(endDateValue, now = new Date()) {\n  const endDate = parseDateOnly(endDateValue);\n  if (!endDate) return false;\n\n  endDate.setHours(23, 59, 59, 999);\n  return now.getTime() > endDate.getTime();\n}\n\nfunction buildRaceDays(startDateValue, endDateValue) {\n  const start = parseDateOnly(startDateValue);\n  const end = parseDateOnly(endDateValue);\n  if (!start || !end) return [];\n\n  const raceDays = [];\n  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());\n  while (current <= end) {\n    raceDays.push(toDateOnly(current));\n    current.setDate(current.getDate() + 1);\n  }\n\n  return raceDays;\n}\n`;
    if (!text.includes(insertAfter)) throw new Error('helper insert marker not found in ' + path);
    text = text.replace(insertAfter, insertAfter + helper);
  }

  const oldBlock = `      if (res && res.code === 200) {\n        const today = new Date().toISOString().split('T')[0];\n        const races = (res.data || []).map(r => {\n          let status = 'upcoming';\n          if (r.start_date <= today && r.end_date >= today) status = 'ongoing';\n          else if (r.end_date < today) status = 'finished';\n          // 璁＄畻璧涗簨瑕嗙洊鏃ユ湡\n          const raceDays = [];\n          if (r.start_date && r.end_date) {\n            const start = new Date(r.start_date);\n            const end = new Date(r.end_date);\n            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {\n              raceDays.push(d.toISOString().split('T')[0]);\n            }\n          }\n          return { ...r, status, raceDays };\n        });\n`;
  const newBlock = `      if (res && res.code === 200) {\n        const now = new Date();\n        const today = toDateOnly(now);\n        const races = (res.data || []).map(r => {\n          const startDate = toDateOnly(r.start_date);\n          const endDate = toDateOnly(r.end_date);\n          let status = 'upcoming';\n          if (startDate && endDate) {\n            if (startDate <= today && !isFinishedAfterEndOfDay(endDate, now)) status = 'ongoing';\n            else if (isFinishedAfterEndOfDay(endDate, now)) status = 'finished';\n          }\n          const raceDays = buildRaceDays(startDate, endDate);\n          return { ...r, start_date: startDate, end_date: endDate, status, raceDays };\n        });\n`;
  if (!text.includes(newBlock)) {
    if (!text.includes(oldBlock)) throw new Error('fallback block not found in ' + path);
    text = text.replace(oldBlock, newBlock);
  }

  fs.writeFileSync(path, text, 'utf8');
}

replaceCalendarRoute('D:/codes/velo-rank/server/routes/races.js');
replaceFallback('D:/codes/velo-rank/miniprogram/pages/race-calendar/race-calendar.js');
console.log('updated calendar date handling');
