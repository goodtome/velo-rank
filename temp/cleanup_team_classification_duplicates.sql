-- 清理 team_classification 表中的重复数据
-- 执行日期: 2026-06-01
-- 策略：保留 id 最小的记录，删除其他重复记录

USE jersey_db;

-- 设置字符集
SET NAMES utf8mb4;

-- ========================================
-- 第1步：查看重复数据统计
-- ========================================

-- 统计重复组数和额外记录数
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT CONCAT(stage_id, team_id)) as unique_pairs,
    COUNT(*) - COUNT(DISTINCT CONCAT(stage_id, team_id)) as duplicate_records
FROM team_classification;

-- 查看重复的具体示例（前10组）
SELECT stage_id, team_id, COUNT(*) as cnt
FROM team_classification
GROUP BY stage_id, team_id
HAVING COUNT(*) > 1
LIMIT 10;

-- ========================================
-- 第2步：创建临时表保存需要保留的记录
-- ========================================

-- 创建临时表，保存每个 (stage_id, team_id) 组中 id 最小的记录
CREATE TEMPORARY TABLE temp_keep_team_class AS
SELECT MIN(id) as keep_id
FROM team_classification
GROUP BY stage_id, team_id;

-- 查看临时表记录数（应该等于 unique_pairs）
SELECT COUNT(*) as records_to_keep FROM temp_keep_team_class;

-- ========================================
-- 第3步：删除重复记录（保留临时表中的记录）
-- ========================================

-- 删除不在临时表中的记录
DELETE FROM team_classification
WHERE id NOT IN (SELECT keep_id FROM temp_keep_team_class);

-- 查看删除后的统计
SELECT 
    COUNT(*) as total_records_after,
    COUNT(DISTINCT CONCAT(stage_id, team_id)) as unique_pairs_after
FROM team_classification;

-- 验证是否还有重复
SELECT stage_id, team_id, COUNT(*) as cnt
FROM team_classification
GROUP BY stage_id, team_id
HAVING COUNT(*) > 1;

-- 如果上面的查询返回空结果，说明重复已清除

-- ========================================
-- 第4步：清理临时表
-- ========================================

DROP TEMPORARY TABLE temp_keep_team_class;

-- ========================================
-- 第5步：（可选）添加唯一索引防止未来重复
-- ========================================

-- 注意：如果表中已有重复数据，添加唯一索引会失败
-- 只有在确认无重复后，才能执行以下语句：

-- ALTER TABLE team_classification 
-- ADD UNIQUE INDEX idx_stage_team (stage_id, team_id);

-- 查看最终数据示例（前10条）
SELECT * FROM team_classification LIMIT 10;
