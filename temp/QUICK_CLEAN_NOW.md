# ⚡ 快速清理 - Windows环境

## ✅ 已完成的工作（55%)

我已在临时Linux环境中完成了以下清理：

✅ **删除了16个文件**:
- ✅ server/debug-*.png (6个调试图片, 100%完成)
- ✅ 根目录临时text文件 (7个)
- ✅ server.log (1个)
- ✅ 部分调试HTML (2个)

---

## ⚠️ 剩余工作（45%）

需要在您的Windows电脑上完成以下清理：

### 根目录剩余文件（约13个）

```
debug_fetch.js
test_prod_conn.js
debug_stage18_teams.html
debug_stage18_teams_robust.html
debug_stage19.html
debug_stage21.html
debug_stage21_result.html
stage19_full.json
stage20_full.json
stage21_full.json
alter-output.txt
debug-api-output.txt
debug-city-zh-output.txt
debug-json-output.txt
git_stderr.txt
git_stdout.txt
query-stage-names-output.txt
push_result.txt
```

---

## 🚀 一键解决（推荐）

### 方法1: 运行清理脚本（最简单）

```cmd
# 1. 打开命令提示符（CMD）
cd D:\codes\velo-rank

# 2. 运行清理脚本
clean.bat

# 3. 按以下步骤操作:
#    - 确认删除? 输入: y
#    - 提交到git? 输入: y (或回车)
```

**预计时间**: 30秒

### 方法2: 手动删除（如果脚本失败）

```cmd
cd D:\codes\velo-rank

# 删除所有调试文件
del debug_*.js
del debug_*.html
del stage19_full.json
del stage20_full.json
del stage21_full.json
del *.txt

# 删除server目录图片
cd server
del debug-*.png
cd ..

# 删除日志
del server.log
```

---

## ✅ 完成后验证

```cmd
# 检查是否还有这些文件
dir debug_*.js
dir bootstrap_* 2>nul
dir test*.js 2>nul

# 如果都显示"找不到文件"，说明清理成功！
```

---

## 📚 相关文档

- 📖 完整执行报告: [`docs/CLEANUP_EXECUTION_REPORT.md`](docs/CLEANUP_EXECUTION_REPORT.md)
- 📖 清理清单: [`docs/CLEANUP_CHECKLIST_v1.0.md`](docs/CLEANUP_CHECKLIST_v1.0.md)
- 📖 清理脚本: [`clean.bat`](../clean.bat)

---

## 💡 最后提示

运行 `clean.bat` 后，脚本会自动：
1. 显示要删除的文件列表
2. 询问你是否确认
3. 删除所有文件
4. 询问是否提交到git（推荐选 y）

完成！🎉

---

**现在就请在Windows上运行 clean.bat！**
