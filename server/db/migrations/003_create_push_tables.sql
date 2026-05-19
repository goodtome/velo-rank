-- 推送通知相关表（v1.0简化版）
-- 使用 openid 替代 user_id，不依赖 users 表
-- 创建于 2026-05-19

-- 用户推送设置表
CREATE TABLE IF NOT EXISTS `user_push_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openid` varchar(128) NOT NULL COMMENT '微信openid',
  `push_enabled` tinyint(1) DEFAULT 1 COMMENT '推送总开关',
  `notify_race_start` tinyint(1) DEFAULT 1 COMMENT '赛事开始提醒',
  `notify_stage_end` tinyint(1) DEFAULT 1 COMMENT '赛段结束通知',
  `notify_rider_change` tinyint(1) DEFAULT 1 COMMENT '关注车手排名变化',
  `notify_key_events` tinyint(1) DEFAULT 0 COMMENT '关键事件通知',
  `dnd_enabled` tinyint(1) DEFAULT 0 COMMENT '免打扰开关',
  `dnd_start` varchar(10) DEFAULT '22:00' COMMENT '免打扰开始时间(HH:MM)',
  `dnd_end` varchar(10) DEFAULT '07:00' COMMENT '免打扰结束时间(HH:MM)',
  `push_frequency` varchar(20) DEFAULT 'realtime' COMMENT '推送频率: realtime, 30min, daily',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户推送设置';

-- 用户推送订阅记录表
CREATE TABLE IF NOT EXISTS `user_push_subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openid` varchar(128) NOT NULL COMMENT '微信openid',
  `template_id` varchar(255) DEFAULT NULL COMMENT '微信模板消息ID',
  `subscribe_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '订阅时间',
  `is_valid` tinyint(1) DEFAULT 1 COMMENT '是否有效',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid_template` (`openid`, `template_id`),
  KEY `idx_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户推送订阅记录';

-- 推送历史记录表
CREATE TABLE IF NOT EXISTS `push_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openid` varchar(128) DEFAULT NULL COMMENT '微信openid',
  `title` varchar(255) NOT NULL COMMENT '推送标题',
  `content` text NOT NULL COMMENT '推送内容',
  `type` varchar(50) DEFAULT NULL COMMENT '推送类型: race_start, stage_end, rider_change, key_event, test',
  `race_id` varchar(36) DEFAULT NULL COMMENT '关联赛事ID',
  `stage_id` varchar(36) DEFAULT NULL COMMENT '关联赛段ID',
  `send_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `status` varchar(20) DEFAULT 'sent' COMMENT '状态: sent, delivered, failed, pending',
  `error_msg` text DEFAULT NULL COMMENT '错误信息',
  PRIMARY KEY (`id`),
  KEY `idx_openid` (`openid`),
  KEY `idx_send_time` (`send_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送历史记录';
