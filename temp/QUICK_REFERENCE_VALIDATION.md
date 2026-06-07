# 🎯 验证脚本快速参考

## 核心信息

| 项目 | 内容 |
|------|------|
| 脚本位置 | `verify-pagination.js` |
| 验证内容 | 分页API + rank字段 + 前端逻辑 |
| 预计耗时 | 1分钟 |
| 预期结果 | ✅ 全部验证通过 |

---

## 一键运行命令

### Windows
```cmd
SET STAGE_ID=替换为赛段ID && node verify-pagination.js
```

### Linux/Mac
```bash
export STAGE_ID="替换为赛段ID" && node verify-pagination.js
```

---

## 获取赛段ID（3种方法）

### 方法1: 浏览器直接访问
```
http://localhost:3000/api/v1/stages
```
查看JSON，找到赛段ID

### 方法2: SQL查询
```sql
SELECT id FROM stages WHERE stage_date < NOW() LIMIT 1;
```

### 方法3: 从已有数据
环意2026已完成：
- 赛段ID存储在 `server/import-giro2026-stages.js` 中

---

## 常见问题速查

| 问题 | 解决方法 |
|------|----------|
| 端口被占用 | `netstat -ano | findstr :3000` 杀掉进程 |
| 数据库连接失败 | 检查 `server/config/.env` |
| 赛段ID错误 | 用SQL查有效ID |
| npm模块丢失 | `npm install` |

---

## 验证成功标准

✅ **所有测试显示 "✅ 请求成功"**
✅ **数据量 ≥ 10**
✅ **包含 pagination 对象**
✅ **rank字段排序正确**
✅ **分页增量加载**

---

## 预期测试流程

```
启动服务 → 获取赛段ID → 设置环境变量 → 运行脚本 → 查看结果
  ↓         ↓              ↓              ↓          ↓
npm run dev  SQL查ID    SET/EXPORT ID  运行验证   查看成功日志
```

---

## 重要输出解读

### ✅ 成功标志
```
✅ 还有下一页 (page 2)
📦 数据量: 10 条记录
```

### ⚠️ 警告
```
⚠️  警告: 第1名和第2名排名相同 (1)
```
（如果积分相同，这是正常的）

### ❌ 失败
```
❌ 请求失败
状态码: 404
消息: 赛段不存在
```
→ 检查赛段ID是否正确

---

## 相关文档

- [完整运行指南](RUN_VALIDATION_GUIDE.md)
- [分页验证详解](PAGINATION_VERIFICATION.md)
- [优化方案](OPTIMIZATION_PLAN_v1.0.md)

---

**提示**: 运行前确保：
1. ✅ 服务在 `http://localhost:3000` 运行
2. ✅ 数据库连接正常
3. ✅ 已设置 `STAGE_ID`

**快速开始**:
```bash
cd D:\codes\velo-rank
npm run dev
# 新开终端
SET STAGE_ID=xxx
node verify-pagination.js
```

🎉 **运行后根据结果判断是否通过验证！**
