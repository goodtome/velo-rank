-- 补齐 teams 表的 team_name_zh 字段
-- 执行日期: 2026-05-31

USE jersey_db;

-- 设置字符集为 utf8mb4
SET NAMES utf8mb4;

-- 更新缺失 team_name_zh 的车队
UPDATE teams SET team_name_zh = '皮克尼克波斯塔车队' WHERE id = '03451c49-db93-49be-a5b0-2401d74580e2';
UPDATE teams SET team_name_zh = '阿联酋ADQ车队' WHERE id = '0cdd67c7-2b2d-4674-bd0c-7b541bbd4bb1';
UPDATE teams SET team_name_zh = 'SD沃克斯-普罗时间车队' WHERE id = '140a5433-b7fc-499c-8d9a-56716fd6e750';
UPDATE teams SET team_name_zh = '菲尼克斯-博锐科技车队' WHERE id = '149af05b-efc7-4bf3-8069-0724a2824828';
UPDATE teams SET team_name_zh = 'EF教育-燕麦车队' WHERE id = '2219216e-7add-40d8-8228-a797660612d3';
UPDATE teams SET team_name_zh = '移动之星女子车队' WHERE id = '3e47ba55-555e-4362-994e-880f88d07934';
UPDATE teams SET team_name_zh = 'ATOM 6自行车队' WHERE id = '430355ad-7f78-49d5-bb81-e3694762b3cb';
UPDATE teams SET team_name_zh = '门德尔施佩克E工作队' WHERE id = '5137af95-41fc-4704-963e-1e0d9cc995c5';
UPDATE teams SET team_name_zh = '利德尔-崔克女子车队' WHERE id = '85a0e7cb-fbca-49d4-a583-d0bc43e994a8';
UPDATE teams SET team_name_zh = '维尼法蒂尼-粉红车队' WHERE id = '861f78be-eef7-452a-8118-04e4ac7b473f';
UPDATE teams SET team_name_zh = 'AG保险-速达尔女子车队' WHERE id = '8c85ec92-c190-463e-aa8c-5074bf2bce11';
UPDATE teams SET team_name_zh = '维斯玛|租赁自行车女子车队' WHERE id = 'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa';
UPDATE teams SET team_name_zh = '伊索曼特-普雷马克-维多利亚车队' WHERE id = 'a39a810e-991c-4beb-ae4c-f41f4c129ca1';
UPDATE teams SET team_name_zh = 'FDJ联合-苏伊士女子车队' WHERE id = 'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586';
UPDATE teams SET team_name_zh = '圣米歇尔-偏好家居-欧贝尔93车队' WHERE id = 'b677ef34-6720-4bc5-b7c1-1c6363f926af';
UPDATE teams SET team_name_zh = '阿尔科车队' WHERE id = 'b6db1978-ec69-4abd-894b-d3ecd5c2ac52';
UPDATE teams SET team_name_zh = 'Canyon//SRAM女子车队' WHERE id = 'ba9ee25d-e126-48e7-86a9-9de7fb0d177f';
UPDATE teams SET team_name_zh = 'Uno-X移动女子车队' WHERE id = 'bb710668-3e7e-4c60-b6af-431ab452e22b';
UPDATE teams SET team_name_zh = '人类动力健康女子车队' WHERE id = 'd3b58149-5b45-47bd-a5dc-faf2c21a24ee';
UPDATE teams SET team_name_zh = '顶级女子法萨博尔托洛车队' WHERE id = 'd8ed753c-1a85-40ae-9f9b-0fee8c3c6193';
UPDATE teams SET team_name_zh = '阿罗马意大利亚瓦亚诺车队' WHERE id = 'ea42f930-1736-4b65-bc23-5cd6c867befd';
UPDATE teams SET team_name_zh = 'Liv阿卢拉贾科女子车队' WHERE id = 'f1c6253a-2597-4425-a1d1-d3b7da093bc5';

-- 同时补齐其他可能缺失的字段（country, team_name_en等）
-- 根据 team_name 推断国家
UPDATE teams SET country = 'Netherlands' WHERE id = '03451c49-db93-49be-a5b0-2401d74580e2' AND country IS NULL;
UPDATE teams SET country = 'United Arab Emirates' WHERE id = '0cdd67c7-2b2d-4674-bd0c-7b541bbd4bb1' AND country IS NULL;
UPDATE teams SET country = 'Netherlands' WHERE id = '140a5433-b7fc-499c-8d9a-56716fd6e750' AND country IS NULL;
UPDATE teams SET country = 'Belgium' WHERE id = '149af05b-efc7-4bf3-8069-0724a2824828' AND country IS NULL;
UPDATE teams SET country = 'United States' WHERE id = '2219216e-7add-40d8-8228-a797660612d3' AND country IS NULL;
UPDATE teams SET country = 'Spain' WHERE id = '3e47ba55-555e-4362-994e-880f88d07934' AND country IS NULL;
UPDATE teams SET country = 'Australia' WHERE id = '430355ad-7f78-49d5-bb81-e3694762b3cb' AND country IS NULL;
UPDATE teams SET country = 'Italy' WHERE id = '5137af95-41fc-4704-963e-1e0d9cc995c5' AND country IS NULL;
UPDATE teams SET country = 'United States' WHERE id = '85a0e7cb-fbca-49d4-a583-d0bc43e994a8' AND country IS NULL;
UPDATE teams SET country = 'Italy' WHERE id = '861f78be-eef7-452a-8118-04e4ac7b473f' AND country IS NULL;
UPDATE teams SET country = 'Belgium' WHERE id = '8c85ec92-c190-463e-aa8c-5074bf2bce11' AND country IS NULL;
UPDATE teams SET country = 'Netherlands' WHERE id = 'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa' AND country IS NULL;
UPDATE teams SET country = 'Italy' WHERE id = 'a39a810e-991c-4beb-ae4c-f41f4c129ca1' AND country IS NULL;
UPDATE teams SET country = 'France' WHERE id = 'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586' AND country IS NULL;
UPDATE teams SET country = 'France' WHERE id = 'b677ef34-6720-4bc5-b7c1-1c6363f926af' AND country IS NULL;
UPDATE teams SET country = 'Belgium' WHERE id = 'b6db1978-ec69-4abd-894b-d3ecd5c2ac52' AND country IS NULL;
UPDATE teams SET country = 'Germany' WHERE id = 'ba9ee25d-e126-48e7-86a9-9de7fb0d177f' AND country IS NULL;
UPDATE teams SET country = 'Norway' WHERE id = 'bb710668-3e7e-4c60-b6af-431ab452e22b' AND country IS NULL;
UPDATE teams SET country = 'United States' WHERE id = 'd3b58149-5b45-47bd-a5dc-faf2c21a24ee' AND country IS NULL;
UPDATE teams SET country = 'Italy' WHERE id = 'd8ed753c-1a85-40ae-9f9b-0fee8c3c6193' AND country IS NULL;
UPDATE teams SET country = 'Italy' WHERE id = 'ea42f930-1736-4b65-bc23-5cd6c867befd' AND country IS NULL;
UPDATE teams SET country = 'Australia' WHERE id = 'f1c6253a-2597-4425-a1d1-d3b7da093bc5' AND country IS NULL;

-- 补齐 team_name_en (如果没有的话，用 team_name 去掉括号内容)
UPDATE teams SET team_name_en = TRIM(SUBSTRING_INDEX(team_name, '(', 1)) WHERE (team_name_en IS NULL OR team_name_en = '') AND team_name LIKE '%(%)%';

-- 查看更新结果
SELECT id, team_name, team_name_zh, country FROM teams WHERE id IN (
    '03451c49-db93-49be-a5b0-2401d74580e2',
    '0cdd67c7-2b2d-4674-bd0c-7b541bbd4bb1',
    '140a5433-b7fc-499c-8d9a-56716fd6e750',
    '149af05b-efc7-4bf3-8069-0724a2824828',
    '2219216e-7add-40d8-8228-a797660612d3',
    '3e47ba55-555e-4362-994e-880f88d07934',
    '430355ad-7f78-49d5-bb81-e3694762b3cb',
    '5137af95-41fc-4704-963e-1e0d9cc995c5',
    '85a0e7cb-fbca-49d4-a583-d0bc43e994a8',
    '861f78be-eef7-452a-8118-04e4ac7b473f',
    '8c85ec92-c190-463e-aa8c-5074bf2bce11',
    'a10b3e9f-a0aa-4a87-a9dc-818bc0eb37fa',
    'a39a810e-991c-4beb-ae4c-f41f4c129ca1',
    'afe8bf1a-5b4d-41b7-8e00-da8ec9efe586',
    'b677ef34-6720-4bc5-b7c1-1c6363f926af',
    'b6db1978-ec69-4abd-894b-d3ecd5c2ac52',
    'ba9ee25d-e126-48e7-86a9-9de7fb0d177f',
    'bb710668-3e7e-4c60-b6af-431ab452e22b',
    'd3b58149-5b45-47bd-a5dc-faf2c21a24ee',
    'd8ed753c-1a85-40ae-9f9b-0fee8c3c6193',
    'ea42f930-1736-4b65-bc23-5cd6c867befd',
    'f1c6253a-2597-4425-a1d1-d3b7da093bc5'
) ORDER BY id;
