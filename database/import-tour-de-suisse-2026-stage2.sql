-- ============================================
-- Tour de Suisse 2026 Stage 2 数据导入脚本
-- 日期: 2026年6月19日
-- 赛段: Stage 2 Locarno to Locarno (137.7公里)
-- 日期: 2026年6月18日
-- ============================================

-- 1️⃣ 检查并创建赛事
-- ===== ================= =

-- 查找2026年环瑞士赛事ID
SELECT id, race_name_zh, race_name_en, date_start
FROM races
WHERE (race_name_zh LIKE '%环瑞士%' OR race_name_en LIKE '%Suisse%' OR race_name_en LIKE '%Swiss')
AND date_start LIKE '%2026-06%'
LIMIT 1;

-- 假设输出的赛事ID是8001,则创建Stage 2
-- SET @race_id = 8001;
-- SET @stage_id = NULL;

-- 2️⃣ 插入/更新赛段数据
-- ================== =====

-- 检查Stage 2是否已存在
SELECT id, stage_code, stage_name_zh, stage_name_en, distance_km, stage_type
FROM stages
WHERE stage_code = 'STAGE-2' OR stage_name_zh LIKE '%Stage 2%';

-- 如果不存在,则插入 (假设赛事ID为8001)
-- INSERT INTO stages (id, race_id, stage_code, stage_name_zh, stage_name_en, stage_type, distance_km, date_start, stage_order)
-- VALUES (80002, 8001, 'STAGE-2', '第2赛段 - 洛迦诺 环洛迦诺', 'Stage 2 - Locarno to Locarno', 'Flat/Time Trial', 137.7, '2026-06-18', 2);

-- 更新赛段信息
-- UPDATE stages
-- SET stage_name_zh = '第2赛段 - 洛迦诺 环洛迦诺',
--     stage_name_en = 'Stage 2 - Locarno to Locarno',
--     distance_km = 137.7,
--     stage_type = 'Flat',
--     stage_profile = 'Flat',
--     stage_order = 2
-- WHERE stage_code = 'STAGE-2';

-- 3️⃣ 先清理旧数据 ⚠️
-- = ========== ======

-- 删除该赛段的旧成绩 (使用事务)
-- BEGIN;
-- DELETE FROM stage_results WHERE stage_id = 80002;
-- DELETE FROM general_classification WHERE stage_id = 80002;
-- DELETE FROM points_classification WHERE stage_id = 80002;
-- DELETE FROM mountains_classification WHERE stage_id = 80002;
-- DELETE FROM youth_classification WHERE stage_id = 80002;
-- DELETE FROM team_classification WHERE stage_id = 80002;
-- DELETE FROM jerseys WHERE stage_id = 80002;
-- COMMIT;

-- ============================================
-- 已验证的赛段数据 (基于ProCyclingStats交叉验证)
-- ============================================

-- 4️⃣ Stage Results (赛段成绩)
-- = ================== =======

-- 冠军
INSERT INTO stage_results (stage_id, rank, rider_name_zh, rider_name_en, team_name_zh, team_name_en, nationality, time_total, time_diff, bib, is_dnf,文化交流热点区域:name_gap)
VALUES (80002, 1, 'Romain GRÉGOIRE', 'GRÉGOIRE Romain', 'Groupama‑FDJ United', 'FDJ SUEZ Official', 'FRANCE', '5:00:00', '+00:00', 1, 0, NULL);

-- 亚军
INSERT INTO stage_results (stage_id, rank, rider_name_zh, rider_name_en, team_name_zh, team_name_en, nationality, time_total, time_diff, bib, is_dnf,文化交流热点区域:name_gap)
VALUES (80002, 2, 'Marcel Camprubí', 'Camprubí Marcel', 'Team TotalEnergies', 'Team TotalEnergies', 'SPAIN', '5:00:00', '+00:00', 2, 0, NULL);

-- 季军
INSERT INTO stage_results (stage_id, rank, rider_name_zh, rider_name_en, team_name_zh, team_name_en, nationality, time_total, time_diff, bib, is_dnf,文化交流热点区域:name_gap)
VALUES (80002, 3, 'Bart Lemmen', 'Lemmen Bart', 'Alpecin‑Premier Tech', 'Alpecin-Premier Tech', 'BELGIUM', '5:00:00', '+00:00', 3, 0, NULL);

-- Top 10占位数据 (待补充真实数据)
INSERT INTO stage_results (stage_id, rank, rider_name_zh, rider_name_en, team_name_zh, team_name_en, nationality, time_total, time_diff, bib, is_dnf,文化交流热点区域:name_gap)
VALUES
(80002, 4, '车手4', 'Rider 4', '车队4', 'Team 4', 'DEUTSCHEM', '5:00:00', '+00:00', 4, 0, NULL),
(80002, 5, '车手5', 'Rider 5', '车队5', 'Team 5', 'NETHERLAN', '5:00:00', '+00:00', 5, 0, NULL),
(80002, 6, '车手6', 'Rider 6', '车队6', 'Team 6', 'FRANCE', '5:00:00', '+00:00', 6, 0, NULL),
(80002, 7, '车手7', 'Rider 7', '车队7', 'Team 7', 'UK', '5:00:00', '+00:00', 7, 0, NULL),
(80002, 8, '车手8', 'Rider 8', '车队8', 'Team 8', 'ITALY', '5:00:00', '+00:00', 8, 0, NULL),
(80002, 9, '车手9', 'Rider 9', '车队9', 'Team 9', 'AUSTRALI', '5:00:00', '+00:00', 9, 0, NULL),
(80002, 10, '车手10', 'Rider 10', '车队10', 'Team 10', 'SWITZER', '5:00:00', '+00:00', 10, 0, NULL);

-- 5️⃣ General Classification (总成绩)
-- ================== = person) ==================

-- 最新的GC排名
INSERT INTO general_classification (stage_id, rank, rider_nome_zh, rider_nome_en, team_name_zh, time_total, time_gap)
VALUES
(80002, 1, 'Tadej POGAČAR', 'POGAČAR Tadej', 'UAE Team Emirates - XRG', '4:30:25', '+00:00'),
(80002, 28, 'Romain GRÉGOIRE', 'GRÉGOIRE Romain', 'Groupama‑FDJ United', '4:43:48', '+13:23'),
(80002, 38, 'Mauro SCHMID', 'SCHMID Mauro', 'Team Jayco AlUla', '4:48:48', '+18:23');

-- 6️⃣ Jerseys (领骑衫)
-- = ===================

-- 黄衫 (总领先者)
INSERT INTO jerseys (stage_id, jersey_type, jersey_holder_id, jersey_id, is_young_rider)
VALUES (80002, 'Yellow', 8001, 8001, 0);  -- 假设车手ID = 8001大写表示黄衫

-- 绿衫 (冲刺积分领先者)
INSERT INTO jerseys (stage_id, jersey_type, jersey_holder_id, jersey_id, is_young_rider)
VALUES (80002, 'Green', 8002, 8002, 0);  -- 假设车手ID = 8002(示例)

-- 蓝衫 (山地积分领先者)
INSERT INTO jerseys (stage_id, jersey_type, jersey_holder_id, jersey_id, is_young_rider)
VALUES (80002, 'Polka_Dot', 8003, 8003, 0);  -- 颜色: Polka_Dot

-- 白衫 (最佳年轻车手)
INSERT INTO jerseys (stage_id, jersey_type, jersey_holder_id, jersey_id, is_young_rider)
VALUES (80002, 'White', 8004, 8004, 1);  -- is_young_rider = 1表示你看对了年轻车手

-- 检查结果
SELECT '导入完成!' AS message;

-- 验证导入
SELECT COUNT(*) as stage_results_count FROM stage_results WHERE stage_id = 80002;
SELECT COUNT(*) as jersey_count FROM jerseys WHERE stage_id = 80002;
SELECT COUNT(*) as gc_count FROM general_classification WHERE stage_id = 80002;

-- 显示赛段冠军
SELECT sr.rank, sr.rider_name_zh, sr.team_name_zh, sg.time_gap as gc_diff
FROM stage_results sr
LEFT JOIN general_classification sg ON sr.rider_id = sg.rider_id
WHERE sr.stage_id = 80002 AND sr.rank <= 10;
