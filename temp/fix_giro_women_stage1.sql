-- 修复环意女子赛2026第一赛段的数据问题
-- 执行日期: 2026-06-01

USE jersey_db;

-- ========== 问题1: 清理车队名称的 (WTW) 后缀 ==========

-- 更新7支女子车队名称（去掉 WTW 后缀）
UPDATE teams SET team_name = 'UAE Team ADQ' WHERE team_name = 'UAE Team ADQ (WTW)';
UPDATE teams SET team_name = 'Team SD Worx - Protime' WHERE team_name = 'Team SD Worx - Protime (WTW)';
UPDATE teams SET team_name = 'Fenix-Premier Tech' WHERE team_name = 'Fenix-Premier Tech (WTW)';
UPDATE teams SET team_name = 'AG Insurance - Soudal Team' WHERE team_name = 'AG Insurance - Soudal Team (WTW)';
UPDATE teams SET team_name = 'CANYON//SRAM' WHERE team_name = 'CANYON//SRAM (WTW)';
UPDATE teams SET team_name = 'Human Powered Health' WHERE team_name = 'Human Powered Health (WTW)';
UPDATE teams SET team_name = 'Liv AlUla Jayco' WHERE team_name = 'Liv AlUla Jayco (WTW)';

-- ========== 问题2: 修复 time_gap 格式 ==========

-- 查看当前 time_gap 格式（用于确认问题）
-- SELECT rank_pos, time_gap FROM stage_results WHERE stage_id = 'dae5a35c-7cc3-4f67-8cec-5249adfa381a' ORDER BY rank_pos LIMIT 10;

-- 修复时间格式：
-- 获胜者的 time_gap 应该是 '+ 0:00' 或 '0:00'
-- 其他人的 time_gap 应该是 '+ X:XX'（与获胜者的时间差）

-- 先查看实际的时间数据格式
-- SELECT rank_pos, time_gap FROM stage_results WHERE stage_id = 'dae5a35c-7cc3-4f67-8cec-5249adfa381a' ORDER BY rank_pos LIMIT 20;

-- ========== 问题3: 补齐赛段信息 ==========

-- 更新 stage_name_zh（中文名称）
UPDATE stages SET
    stage_name_zh = '第1赛段 | 切塞纳蒂科 - 拉文纳',
    start_city_zh = '切塞纳蒂科',
    finish_city_zh = '拉文纳'
WHERE id = 'dae5a35c-7cc3-4f67-8cec-5249adfa381a';

-- ========== 验证修复结果 ==========

-- 验证车队名称已清理
SELECT '修复后车队名称检查' as check, team_name, team_name_zh FROM teams WHERE team_name LIKE '%WTW%' OR team_name LIKE '%(W%';

-- 验证赛段信息已补齐
SELECT '修复后赛段信息' as check, stage_name, stage_name_zh, start_city_zh, finish_city_zh
FROM stages WHERE id = 'dae5a35c-7cc3-4f67-8cec-5249adfa381a';

-- 查看前10名成绩（验证 time_gap 格式）
SELECT sr.rank_pos, r.rider_name, t.team_name, sr.time_gap
FROM stage_results sr
JOIN riders r ON sr.rider_id = r.id
JOIN teams t ON sr.team_id = t.id
WHERE sr.stage_id = 'dae5a35c-7cc3-4f67-8cec-5249adfa381a'
ORDER BY sr.rank_pos LIMIT 10;
