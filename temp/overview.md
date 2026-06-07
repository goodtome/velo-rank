# Week 7 完成总结

## 推送通知 + 赛事日历功能

### 新增服务端API（9个）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/races/calendar` | GET | 赛事日历数据（指定月份） |
| `/api/v1/push/settings` | POST | 保存推送设置（openid标识） |
| `/api/v1/push/settings` | GET | 获取推送设置 |
| `/api/v1/push/subscribe` | POST | 订阅推送 |
| `/api/v1/push/unsubscribe` | POST | 取消订阅 |
| `/api/v1/push/subscriptions` | GET | 获取订阅状态 |
| `/api/v1/push/history` | GET | 推送历史 |
| `/api/v1/push/test` | POST | 发送测试推送 |
| `/api/v1/push/send` | POST | 批量发送推送（管理员） |

### 修改的文件

- `server/routes/push.js` — 全部重写（openid替代JWT）
- `server/routes/races.js` — 新增 `/calendar` 端点
- `server/db/migrations/003_create_push_tables.sql` — 重写（openid）
- `miniprogram/pages/push-settings/*` — 全部重写（本地存储优先）
- `miniprogram/pages/race-calendar/*` — 全部重写（新API+颜色标记）
- `miniprogram/pages/profile/*` — 新增日历和推送入口

### 测试结果

- ✅ 赛事日历API：返回环意2026（23天覆盖，status=ongoing）
- ✅ 推送设置保存/获取：8/8端点测试通过
- ✅ 推送订阅/取消/查询：正常工作
- ✅ 推送历史查询：正常工作
- ✅ 测试推送：优雅降级（未配置微信模板ID时仅记录历史）

### 下一步

Week 8：部署上线 + 数据持续录入
