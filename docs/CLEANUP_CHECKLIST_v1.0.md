# 清理项目前的清单分析

## 2026-06-03 清理分析报告

### 📊 清理统计

| 类型 | 数量 | 总大小 |
|-----|------|--------|
| 临时脚本(.js) | 2 | ~800行 |
| 调试文件(.html) | 12 | ~5 MB |
| 调试图片(.png) | 6 | ~500 KB |
| 日志文件 | 2 | ~1.5 MB |
| 调试JSON文件 | 3 | ~300 KB |
| 临时文档/text | 6 | ~2 KB |
| **总计** | **31个文件** | **~7.1 MB** |

---

## 一、需要删除的文件清单

### 1.1 根目录临时脚本（2个）

```
./debug_fetch.js                    # 调试脚本
./test_prod_conn.js                 # 测试脚本
```

**理由**: 调试用临时文件，生产环境不需要

---

### 1.2 根目录调试HTML（12个）

```
./debug_stage18_teams.html
./debug_stage18_teams_robust.html
./debug_stage19.html
./debug_stage21.html
./debug_stage21_result.html
./debug_stage10_gc.html
./debug_stage10_mountains.html
./debug_stage10_points.html
./debug_stage10_teams.html
./debug_stage10_youth.html
./stage5-all-classifications.json
./stage5-results.json
```

**理由**:
- ✅ stage*.json 为导入过程中的临时数据文件
- ❌ debug_*.html 为调试输出，截图用过后无需保存

**注意**: stage5-all-classifications.json 如果是用于测试的可以保留或移到 data/ 目录

---

### 1.3 根目录JSON数据文件（3个）

```
./stage19_full.json
./stage20_full.json
./stage21_full.json
```

**理由**: 历史赛段的临时导入文件，重要数据已在数据库

---

### 1.4 日志文件（2个）

```
./server.log                        # 服务运行日志
./server.log (在根目录)
```

**理由**: 服务重启后会写入新日志，旧日志可删除

---

### 1.5 调试图片（6个）

```
server/debug-gc.png
server/debug-mountains.png
server/debug-points.png
server/debug-stage-1.png
server/debug-stage.png
server/debug-youth.png
```

**理由**: 调试时生成的截图，用完后可删除

---

### 1.6 根目录临时text文件（6个）

```
./alter-output.txt
./debug-api-output.txt
./debug-city-zh-output.txt
./debug-json-output.txt
./git_stderr.txt
./git_stdout.txt
./query-stage-names-output.txt
```

**理由**: Git或调试命令的临时输出，可删除

---

## 二、需要保留的重要文件

### 2.1 保留的调试HTML（6个）

```
./giro2026.html                     # 环意2026完整展示页
./giro2026_robust.html              # 环意2026完整展示页(鲁棒版)
./giro_women_main.html              # 女子环意主页
./giro_women_stage1.html            # 女子环意第1赛段
./giro_women_stage2.html            # 女子环意第2赛段
./giro_women_stage2_gc.html         # 女子环意第2赛段GC页
```

**理由**: 这些是示例页面或用户展示用的文档页面，可保留

---

### 2.2 保留的脚本（12个爬虫脚本）

```
./fetch_giro.js
./scrape_giro_dnf*.py
./scrape_all_classifications.js
./import_giro_women*.js
./batch_import_toj.sh (如果用于生产)
```

**理由**: 这些是爬虫和数据导入脚本，生产环境可能会用到

---

### 2.3 保留的验证和测试脚本

```
./verify-pagination.js              # ⭐ 分页验证脚本（生产需要）
./Check_JERSEYS_VALIDATION_REPORT.md # 环服衫验证报告
```

**理由**: 可能是后续验证用

---

### 2.4 保留的文档

```
当前目录的所有.md文件
```

**理由**: 项目文档需要保留

---

### 2.5 保留的备份文件

```
server/races.js.backup
server/realtime.js.backup2
server/scripts/backup-db.js
server/scripts/backup_stage_results_20260529.sql
```

**理由**: 备份文件在紧急情况下可能需要

---

## 三、清理建议

### 3.1 立即清理（大胆删除）

```bash
# 根目录临时脚本
rm debug_fetch.js test_prod_conn.js

# 根目录调试HTML
rm debug_*.html
rm *.json  # 删除所有stage*.json

# 日志文件
rm server.log
rm *.txt

# 调试图片
rm server/debug-*.png
```

### 3.2 可选清理（谨慎判断）

```bash
# 保留demo页面但可以移到 docs/ 文档目录
mv giro*.html docs/
mv giro_women*.html docs/

# 将stage5数据移到 data/test/ 目录
mkdir -p data/test
mv stage5-*.json data/test/
```

### 3.3 安全清理（使用git管理）

所有文件删除前，先commit到git：
```bash
git add .
git commit -m "清理临时文件和调试代码 - 2026-06-03"
```

---

## 四、清理后的目录结构

```
velo-rank/
├── server/                           # 后端
│   ├── app.js
│   ├── routes/
│   ├── middleware/
│   ├── scripts/                      # 脚本
│   │   ├── backup-db.js              # 备份脚本
│   │   └── import-giro*.js           # 导入脚本
│   ├── debug-*.png                   # 🗑️ 删除这些
│   └── debug-*.html                  # 🗑️ 删除这些
├── miniprogram/                      # 小程序
│   └── pages/
├── docs/                             # 📚 文档
│   ├── IRONCLAD_README.md
│   ├── PAGINATION_VERIFICATION.md
│   ├── OPTIMIZATION_*.md
│   ├── giro*.html                    # ⭐ demo页面
│   └── giro_women*.html              # ⭐ demo页面
├── verify-pagination.js              # ⭐ 验证脚本
├── node_modules/                     # 依赖
├── package.json
├── README.md
└── 各类.md文档                         # 保留
```

---

## 五、清理前后对比

| 项目 | 清理前 | 清理后 | 减少 |
|-----|--------|--------|------|
| 临时文件 | 31个 | 0个 | 100% |
| 代码体积 | ~7.1 MB | ~2 MB | -72% |
| 项目复杂度 | 高 | 低 | ↓ |
| 维护成本 | 高 | 低 | ↓ |

---

## 六、清理执行方案

### 方案A: 完全清理（推荐）

```bash
# 1. 备份重要数据
mysqldump -u root -p jersey_db > backup_$(date +%Y%m%d).sql

# 2. 提交当前代码
git add .
git commit -m "清理前的完整备份"

# 3. 删除临时文件
# 参考上面的删除命令

# 4. 提交清理
git add .
git commit -m "清理临时文件和调试代码 - 2026-06-03"
```

### 方案B: 创建clean.sh脚本

创建一个清理脚本，第一步就询问确认：
```bash
#!/bin/bash
echo "即将删除以下类型文件："
echo "- debug_*.js"
echo "- debug_*.html"
echo "- *.log"
echo "- *.txt"
echo "- 临时JSON文件"
read -p "确认删除吗？(y/n) " confirm
if [ "$confirm" = "y" ]; then
  rm debug_*.js debug_*.html *.log *.txt stage*.json
  echo "清理完成！"
fi
```

---

## 七、清理后监控

清理后建议监控：
1. ✅ 后端服务是否正常启动
2. ✅ 数据库连接是否正常
3. ✅ 爬虫脚本是否需要这些文件
4. ✅ 验证脚本是否仍然可运行
5. ✅ 小程序功能是否完整

---

## 八、恢复预案

如果删除后发现问题：
```bash
# 1. 从git恢复
git reset --hard HEAD^

# 2. 或者从备份恢复
mysql -u root -p jersey_db < backup_20260603.sql
```

---

## 九、清理任务清单

- [ ] 备份数据库
- [ ] 提交当前代码到git
- [ ] 删除临时JS脚本
- [ ] 删除调试HTML文件
- [ ] 删除调试图片
- [ ] 删除日志文件
- [ ] 删除临时text文件
- [ ] 提交清理后的代码
- [ ] 测试服务启动
- [ ] 测试验证脚本
- [ ] 验证小程序功能

---

**创建日期**: 2026-06-03
**预计清理时间**: 10-15分钟
**风险等级**: ⚠️ 中等（建议备份数据）
**预计节省空间**: ~5 MB
**维护性提升**: 大幅提升
