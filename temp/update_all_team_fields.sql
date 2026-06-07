-- 补齐 teams 表的所有缺失字段
-- 执行日期: 2026-05-31

USE jersey_db;

-- 设置字符集为 utf8mb4
SET NAMES utf8mb4;

-- ========================================
-- 1. 修复 team_name_zh 字段（重新更新所有可能乱码的）
-- ========================================

UPDATE teams SET team_name_zh = '帝舵职业自行车队' WHERE id = '03fb8177-e426-4499-9266-76b23658aaca';
UPDATE teams SET team_name_zh = '荷兰邮政车队' WHERE id = '1e2547e7-4125-4a93-ae02-c0a89d556164';
UPDATE teams SET team_name_zh = '迪卡侬达飞车队' WHERE id = '28ec796b-4011-478b-812f-5ab44026faff';
UPDATE teams SET team_name_zh = 'EF教育-易邮车队' WHERE id = '2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5';
UPDATE teams SET team_name_zh = '维斯玛-租赁自行车车队' WHERE id = '3d083159-c637-4c74-b07f-365bdbb34415';
UPDATE teams SET team_name_zh = '欧倍青-博泰车队' WHERE id = '3f06a960-172f-4568-b732-ac4fa83384a1';
UPDATE teams SET team_name_zh = '尤尼贝特玫瑰火箭车队' WHERE id = '426c7350-1bec-4746-a7a0-d85c2f038444';
UPDATE teams SET team_name_zh = '波尔蒂-马耳他旅游车队' WHERE id = '4dce9ed8-ee21-4b89-8c22-681e58981c59';
UPDATE teams SET team_name_zh = 'NSN自行车队' WHERE id = '57b60836-e5cf-420e-aabb-9bfd1221ac8a';
UPDATE teams SET team_name_zh = '杰科-埃尔奥拉车队' WHERE id = '68a16336-e2ef-4a0a-9ba9-b64a479a3cd0';
UPDATE teams SET team_name_zh = '红牛-博拉-汉斯格雅车队' WHERE id = '77f24194-6c34-4039-862f-1872f3d7416c';
UPDATE teams SET team_name_zh = '移动之星车队' WHERE id = '850bf439-8b06-4ac6-8632-565e6a20cd07';
UPDATE teams SET team_name_zh = 'Pinarello Q36.5职业自行车队' WHERE id = '8fd7e4f8-d7ee-4fd4-9ea0-64a75a132372';
UPDATE teams SET team_name_zh = '乐透-英特马诗车队' WHERE id = '901107b4-1cc5-4e6e-8d8d-02dff9fbf980';
UPDATE teams SET team_name_zh = '历德-崔克车队' WHERE id = 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56';
UPDATE teams SET team_name_zh = '速达尔-快步车队' WHERE id = 'b65ff584-6a4f-4860-92ea-6d78fc656bf0';
UPDATE teams SET team_name_zh = 'Laboral Kutxa - Fundación Euskadi' WHERE id = 'bcd0ac23-3fe6-455a-be98-ec836b619987';
UPDATE teams SET team_name_zh = '阿联酋航空-XRG车队' WHERE id = 'c2d833ef-5f71-4f42-b385-c4ca6e117028';
UPDATE teams SET team_name_zh = 'UNO-X移动车队' WHERE id = 'cd69a84c-4296-40f9-8f22-688b3804abcf';
UPDATE teams SET team_name_zh = '巴迪亚尼CSF车队' WHERE id = 'd644eac3-43bb-4d86-a193-15ffd82b9eb1';
UPDATE teams SET team_name_zh = '安盟-FDJ联合车队' WHERE id = 'deb71fe1-d67e-40d7-b2d9-d0c28422ee7f';
UPDATE teams SET team_name_zh = 'XDS阿斯坦纳车队' WHERE id = 'e57f7ea5-4a9b-40aa-9c1d-c1c2af15c854';
UPDATE teams SET team_name_zh = '巴林胜利车队' WHERE id = 'efdb61df-6ead-41bf-ad36-606229f2216a';

-- ========================================
-- 2. 补齐 team_name_en 字段
-- ========================================

-- 从 team_name 提取英文名的通用方法（去掉括号内容）
UPDATE teams 
SET team_name_en = TRIM(SUBSTRING_INDEX(team_name, '(', 1))
WHERE (team_name_en IS NULL OR team_name_en = '') 
AND team_name LIKE '%(%)%';

-- 对于没有括号的 team_name，直接使用 team_name
UPDATE teams 
SET team_name_en = team_name
WHERE (team_name_en IS NULL OR team_name_en = '') 
AND (team_name IS NOT NULL AND team_name != '');

-- ========================================
-- 3. 补齐 country 字段（根据常见车队设置）
-- ========================================

UPDATE teams SET country = 'Switzerland' WHERE id = '03fb8177-e426-4499-9266-76b23658aaca' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Netherlands' WHERE id = '1e2547e7-4125-4a93-ae02-c0a89d556164' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'France' WHERE id = '28ec796b-4011-478b-812f-5ab44026faff' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'United States' WHERE id = '2a5e77d6-8636-49ba-bff8-bfbdd8ca6cc5' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Netherlands' WHERE id = '3d083159-c637-4c74-b07f-365bdbb34415' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Belgium' WHERE id = '3f06a960-172f-4568-b732-ac4fa83384a1' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Netherlands' WHERE id = '426c7350-1bec-4746-a7a0-d85c2f038444' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Italy' WHERE id = '4dce9ed8-ee21-4b89-8c22-681e58981c59' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Switzerland' WHERE id = '57b60836-e5cf-420e-aabb-9bfd1221ac8a' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Australia' WHERE id = '68a16336-e2ef-4a0a-9ba9-b64a479a3cd0' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Germany' WHERE id = '77f24194-6c34-4039-862f-1872f3d7416c' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Spain' WHERE id = '850bf439-8b06-4ac6-8632-565e6a20cd07' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Switzerland' WHERE id = '8fd7e4f8-d7ee-4fd4-9ea0-64a75a132372' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Belgium' WHERE id = '901107b4-1cc5-4e6e-8d8d-02dff9fbf980' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'United States' WHERE id = 'ad10ffe6-b665-41bc-b0c6-ca621deb4b56' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Belgium' WHERE id = 'b65ff584-6a4f-4860-92ea-6d78fc656bf0' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Spain' WHERE id = 'bcd0ac23-3fe6-455a-be98-ec836b619987' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'United Arab Emirates' WHERE id = 'c2d833ef-5f71-4f42-b385-c4ca6e117028' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Norway' WHERE id = 'cd69a84c-4296-40f9-8f22-688b3804abcf' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Italy' WHERE id = 'd644eac3-43bb-4d86-a193-15ffd82b9eb1' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'France' WHERE id = 'deb71fe1-d67e-40d7-b2d9-d0c28422ee7f' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Kazakhstan' WHERE id = 'e57f7ea5-4a9b-40aa-9c1d-c1c2af15c854' AND (country IS NULL OR country = '');
UPDATE teams SET country = 'Bahrain' WHERE id = 'efdb61df-6ead-41bf-ad36-606229f2216a' AND (country IS NULL OR country = '');

-- ========================================
-- 4. 验证更新结果
-- ========================================

-- 查看最终统计
SELECT 
    'team_name_zh' as field,
    COUNT(*) as total,
    COUNT(team_name_zh) as has_value,
    COUNT(*) - COUNT(team_name_zh) as missing
FROM teams
UNION ALL
SELECT 
    'team_name_en' as field,
    COUNT(*) as total,
    COUNT(team_name_en) as has_value,
    COUNT(*) - COUNT(team_name_en) as missing
FROM teams
UNION ALL
SELECT 
    'country' as field,
    COUNT(*) as total,
    COUNT(country) as has_value,
    COUNT(*) - COUNT(country) as missing
FROM teams;

-- 查看所有车队的最终状态（前10条）
SELECT id, team_name, team_name_zh, team_name_en, country 
FROM teams 
ORDER BY team_name 
LIMIT 10;
