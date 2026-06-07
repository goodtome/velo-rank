-- 合并重复的男子/女子车队记录
-- 执行日期: 2026-06-01
-- 策略：保留男子组记录（无WTW后缀），删除女子组重复记录

USE jersey_db;

-- 设置字符集
SET NAMES utf8mb4;

-- ========================================
-- 第1步：更新所有引用表，将女子组team_id指向男子组team_id
-- ========================================

-- 1. Team Picnic PostNL
-- KEEP: 1e2547e7-4125-4a93-ae02-c0a89d556164 (男子组)
-- DELETE: 03451c49-db93-49be-a5b0-2401d74580e2 (女子组 WTW)
UPDATE stage_results SET team_id = '1e2547e7-4125-4a93-ae02-c0a89d556164' WHERE team_id = '03451c49-db93-49be-a5b0-2401d74580e2';
UPDATE jerseys SET team_id = '1e2547e7-4125-4a93-ae02-c0a89d556164' WHERE team_id = '03451c49-db93-49be-a5b0-2401d74580e2';
UPDATE general_classification SET team_id = '1e2547e7-4125-4a93-ae02-c0a89d556164' WHERE team_id = '03451c49-db93-49be-a5b0-2401d74580e2';
UPDATE team_classification SET team_id = '1e2547e7-4125-4a93-ae02-c0a89d556164' WHERE team_id = '03451c49-db93-49be-a5b0-2401d74580e2';

-- 2. EF Education
-- KEEP: 2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5 (男子组)
-- DELETE: 2219216e-7add-40d8-8228-a797660612d3 (女子组 WTW)
UPDATE stage_results SET team_id = '2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5' WHERE team_id = '2219216e-7add-40d8-8228-a797660612d3';
UPDATE jerseys SET team_id = '2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5' WHERE team_id = '2219216e-7add-40d8-8228-a797660612d3';
UPDATE general_classification SET team_id = '2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5' WHERE team_id = '2219216e-7add-40d8-8228-a797660612d3';
UPDATE team_classification SET team_id = '2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5' WHERE team_id = '2219216e-7add-40d8-8228-a797660612d3';

-- 3. Team Visma | Lease a Bike
-- KEEP: 3d083159-c637-4c74-b07f-365bdbb34415 (男子组)
-- DELETE: a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa (女子组 WTW)
UPDATE stage_results SET team_id = '3d083159-c637-4c74-b07f-365bdbb34415' WHERE team_id = 'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa';
UPDATE jerseys SET team_id = '3d083159-c637-4c74-b07f-365bdbb34415' WHERE team_id = 'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa';
UPDATE general_classification SET team_id = '3d083159-c637-4c74-b07f-365bdbb34415' WHERE team_id = 'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa';
UPDATE team_classification SET team_id = '3d083159-c637-4c74-b07f-365bdbb34415' WHERE team_id = 'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa';

-- 4. Movistar Team
-- KEEP: 850bf439-8b06-4ac6-8632-565e6a20cd07 (男子组)
-- DELETE: 3e47ba55-555e-4362-994e-880f88d07934 (女子组 WTW)
UPDATE stage_results SET team_id = '850bf439-8b06-4ac6-8632-565e6a20cd07' WHERE team_id = '3e47ba55-555e-4362-994e-880f88d07934';
UPDATE jerseys SET team_id = '850bf439-8b06-4ac6-8632-565e6a20cd07' WHERE team_id = '3e47ba55-555e-4362-994e-880f88d07934';
UPDATE general_classification SET team_id = '850bf439-8b06-4ac6-8632-565e6a20cd07' WHERE team_id = '3e47ba55-555e-4362-994e-880f88d07934';
UPDATE team_classification SET team_id = '850bf439-8b06-4ac6-8632-565e6a20cd07' WHERE team_id = '3e47ba55-555e-4362-994e-880f88d07934';

-- 5. Lidl - Trek
-- KEEP: ad10ffe6-b665-41bc-b0c6-ca621deb4b56 (男子组)
-- DELETE: 85a0e7cb-fbca-49d4-a583-d0bc43e994a8 (女子组 WTW)
UPDATE stage_results SET team_id = 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56' WHERE team_id = '85a0e7cb-fbca-49d4-a583-d0bc43e994a8';
UPDATE jerseys SET team_id = 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56' WHERE team_id = '85a0e7cb-fbca-49d4-a583-d0bc43e994a8';
UPDATE general_classification SET team_id = 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56' WHERE team_id = '85a0e7cb-fbca-49d4-a583-d0bc43e994a8';
UPDATE team_classification SET team_id = 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56' WHERE team_id = '85a0e7cb-fbca-49d4-a583-d0bc43e994a8';

-- 6. FDJ United
-- KEEP: deb71fe1-d67e-40d7-b2d9-d0c28422ee7f (男子组)
-- DELETE: afe8bf1a-5b4d-41b7-8e00-da8ec9efe586 (女子组 WTW)
UPDATE stage_results SET team_id = 'deb71fe1-d67e-40d7-b2d9-d0c28422ee7f' WHERE team_id = 'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586';
UPDATE jerseys SET team_id = 'deb71fe1-d67e-40d7-b2d9-d0c28422ee7f' WHERE team_id = 'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586';
UPDATE general_classification SET team_id = 'deb71fe1-d67e-40d7-b2d9-d0c28422ee7f' WHERE team_id = 'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586';
UPDATE team_classification SET team_id = 'deb71fe1-d67e-40d7-b2d9-d0c28422ee7f' WHERE team_id = 'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586';

-- 7. Uno-X Mobility
-- KEEP: cd69a84c-4296-40f9-8f22-688b3804abcf (男子组)
-- DELETE: bb710668-3e7e-4c60-b6af-431ab452e22b (女子组 WTW)
UPDATE stage_results SET team_id = 'cd69a84c-4296-40f9-8f22-688b3804abcf' WHERE team_id = 'bb710668-3e7e-4c60-b6af-431ab452e22b';
UPDATE jerseys SET team_id = 'cd69a84c-4296-40f9-8f22-688b3804abcf' WHERE team_id = 'bb710668-3e7e-4c60-b6af-431ab452e22b';
UPDATE general_classification SET team_id = 'cd69a84c-4296-40f9-8f22-688b3804abcf' WHERE team_id = 'bb710668-3e7e-4c60-b6af-431ab452e22b';
UPDATE team_classification SET team_id = 'cd69a84c-4296-40f9-8f22-688b3804abcf' WHERE team_id = 'bb710668-3e7e-4c60-b6af-431ab452e22b';

-- ========================================
-- 第2步：删除女子组重复车队记录
-- ========================================

DELETE FROM teams WHERE id IN (
    '03451c49-db93-49be-a5b0-2401d74580e2',  -- Team Picnic PostNL (WTW)
    '2219216e-7add-40d8-8228-a797660612d3',  -- EF Education-Oatly (WTW)
    'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa',  -- Team Visma | Lease a Bike (WTW)
    '3e47ba55-555e-4362-994e-880f88d07934',  -- Movistar Team (WTW)
    '85a0e7cb-fbca-49d4-a583-d0bc43e994a8',  -- Lidl - Trek (WTW)
    'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586',  -- FDJ United - SUEZ (WTW)
    'bb710668-3e7e-4c60-b6af-431ab452e22b'   -- Uno-X Mobility (WTW)
);

-- ========================================
-- 第3步：验证合并结果
-- ========================================

-- 查看合并后的车队总数
SELECT COUNT(*) as total_teams_after_merge FROM teams;

-- 验证重复车队是否已清除
SELECT 
    SUBSTRING_INDEX(SUBSTRING_INDEX(team_name, ' (', 1), ' - ', 1) as base_name,
    COUNT(*) as cnt
FROM teams 
WHERE team_name LIKE '%(WTW)%' OR team_name IN (
    'TEAM PICNIC POSTNL RAISIN',
    'EF EDUCATION - EASYPOST',
    'Team Visma | Lease a Bike',
    'MOVISTAR TEAM',
    'Lidl - Trek',
    'Groupama - FDJ United',
    'UNO-X MOBILITY'
)
GROUP BY SUBSTRING_INDEX(SUBSTRING_INDEX(team_name, ' (', 1), ' - ', 1)
HAVING COUNT(*) > 1;

-- 如果上面的查询返回空结果，说明重复已成功合并

-- 查看合并后的示例数据
SELECT id, team_name, team_name_zh, country FROM teams 
WHERE team_name LIKE '%Picnic%' 
   OR team_name LIKE '%Visma%' 
   OR team_name LIKE '%Movistar%'
ORDER BY team_name;
