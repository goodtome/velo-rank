# 🔧 正一领骑分页功能验证 - 运行指南

## 快速开始

### 步骤 1: 启动后端服务

```bash
# 进入项目目录
cd D:\codes\velo-rank

# 启动开发服务器（如果已启动但报错，先确保端口3000未被占用）
npm run dev
```

**预期输出**:
```
正一领骑后端服务启动成功 - http://localhost:3000
WebSocket服务已启动 - ws://localhost:3000/ws/realtime
API文档：http://localhost:3000/api/v1
```

> ⚠️ **注意**: 首次启动可能需要等几秒钟连接数据库

---

### 步骤 2: 获取测试用的赛段ID

您可以选择两种方式之一：

#### 方法A：从数据库查询（推荐）

```bash
# 查询最近完成的赛事赛段
mysql -u root -p jersey_db -e "
SELECT id, stage_number, stage_name,
       s.race_id, r.race_name_zh, r.race_name
FROM stages s
JOIN races r ON s.race_id = r.id
WHERE s.stage_date < NOW()
  OR s.stage_number < 21
ORDER BY r.end_date DESC, s.stage_number
LIMIT 5;
"
```

#### 方法B：从小程序查看

1. 打开微信开发者工具
2. 进入"赛事详情"页面
3. 选择一个完成的赛事
4. 在地址栏看到 `?id=xxx-xxx`，这个就是赛段ID

---

### 步骤 3: 设置环境变量并运行验证脚本

#### Windows CMD

```cmd
SET STAGE_ID=你的赛段ID
node verify-pagination.js
```

#### Windows PowerShell

```powershell
$env:STAGE_ID="你的赛段ID"
node verify-pagination.js
```

#### Linux/Mac

```bash
export STAGE_ID="你的赛段ID"
node verify-pagination.js
```

---

### 步骤 4: 查看验证结果

**或功的预期输出**:
```
🚀 开始测试分页加载功能

📋 基础URL: http://localhost:3000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
测试 1: 获取赛段points分类数据（分页）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 测试 GET /api/v1/stages/xxx/points?page=1&limit=10
   状态码: 200

   ✅ 请求成功

   📦 数据量: 10 条记录
   📄 分页信息:
      current page: 1
      limit: 10
      total: 50
      pages: 5
      ✅ 还有下一页 (page 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
测试 2: 获取赛段mountains分类数据（分页）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 测试 GET /api/v1/stages/xxx/mountains?page=1&limit=10
   状态码: 200

   ✅ 请求成功

   📦 数据量: 10 条记录
   📄 分页信息:
      current page: 1
      limit: 10
      total: 30
      pages: 3

✓ 分页加载功能验证通过！

📊 验证总结:

✅ 后端已正确实现分页功能 (page, limit参数)
✅ 返回格式包含 pagination 对象

✅ points/mountains查询使用DENSE_RANK()计算rank

✅ 前端classification页面已实现loadMore()和onReachBottom()

📌 下一步：在实际小程序中测试loadMore()实际效果
```

---

## 如果验证失败

### 问题1: 端口被占用

**错误信息**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方法**:

```bash
# Windows - 查找并杀死占用端口的进程
netstat -ano | findstr :3000
taskkill /PID <端口号> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### 问题2: 数据库连接失败

**错误信息**:
```
Error: connect ECONNREFUSED
```

**解决方法**:

1. 确认MySQL服务已启动
2. 检查 `.env` 配置:

```bash
# 编辑 server/config/.env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=jersey_db
DB_USER=root
DB_PASSWORD=你的密码
```

### 问题3: 赛段ID不存在

**错误信息**:
```
❌ 赛段不存在
```

**解决方法**: 查询有效的赛段ID（参考步骤2）

---

## 完整测试流程（可选）

### 测试1: 手动调用API

```bash
# 获取赛段points数据
curl "http://localhost:3000/api/v1/stages/YOUR-STAGE-ID/points?page=1&limit=20"

# 获取赛段mountains数据
curl "http://localhost:3000/api/v1/stages/YOUR-STAGE-ID/mountains?page=1&limit=20"

# 预期返回格式
{
  "code": 200,
  "data": [
    {
      "id": "uuid",
      "stage_id": "uuid",
      "rider_id": "uuid",
      "rider_name": "Peter Sagan",
      "rider_name_zh": "彼得·萨甘",
      "points": 150,
      "rank": 1,
      "team_name": "Bora–Hansgrohe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### 测试2: 小程序端到端测试

1. 打开微信开发者工具
2. 导航到赛事详情页 → 选择一个完成的赛事 → 选择一个已完成赛段
3. 点击"冲刺积分榜"或"爬坡积分榜"
4. 向下滚动到底部
5. 观察：
   - ✅ 自动加载下一页
   - ✅ 数据正确合并
   - ✅ "没有更多数据"提示

---

## 验证清单

### 后端验证

- [ ] `/api/v1/stages/:id/points` 返回正确的分页数据
- [ ] `/api/v1/stages/:id/points` 包含 `rank` 字段
- [ ] `/api/v1/stages/:id/points` 返回 `pagination` 对象
- [ ] `/api/v1/stages/:id/mountains` 同样正常
- [ ] SQL查询使用 `DENSE_RANK()` 正确计算排名

### 前端验证

- [ ] 触底加载功能正常
- [ ] `loadMore()` 正确合并数据
- [ ] `hasMore` 状态判断正确
- [ ] `loadingMore` 状态正确显示
- [ ] 错误状态显示重试按钮（如果有）

---

## 相关文件

- **验证脚本**: [`verify-pagination.js`](../verify-pagination.js)
- **分页方案**: [`docs/OPTIMIZATION_PLAN_v1.0.md`](OPTIMIZATION_PLAN_v1.0.md)
- **验证指南**: [`docs/PAGINATION_VERIFICATION.md`](PAGINATION_VERIFICATION.md)
- **方案总结**: [`docs/OPTIMIZATION_SUMMARY_v1.0.md`](OPTIMIZATION_SUMMARY_v1.0.md)

---

## 联系与反馈

如果遇到问题，请检查：

1. 日志输出：查看 `server.log`
2. 数据库连接：确认 `.env` 配置正确
3. 服务状态：确认服务在 3000 端口正常运行
4. 赛段ID：确认使用的是有效赛段ID

---

**最后更新**: 2026-06-03
**版本**: v1.0.0-verify-2026-06-03
