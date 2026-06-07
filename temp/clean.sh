#!/bin/bash

# 正一领骑项目清理脚本
# 版本: v1.0
# 日期: 2026-06-03
# 用途: 清理临时文件、调试文件、旧版本控制文件

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  正一领骑项目清理工具${NC}"
echo -e "${GREEN}=========================================${NC}\n"

# 统计文件数量
echo -e "${YELLOW}正在扫描临时文件...${NC}"

# 统计要删除的文件
declare -a FILES_TO_DELETE

# 1. 调试JS脚本
FILES_TO_DELETE+=("debug_fetch.js")
FILES_TO_DELETE+=("test_prod_conn.js")

# 2. 调试HTML文件
FILES_TO_DELETE+=("debug_*.html")

# 3. 历史赛段JSON文件
FILES_TO_DELETE+=("stage19_full.json")
FILES_TO_DELETE+=("stage20_full.json")
FILES_TO_DELETE+=("stage21_full.json")

# 4. 其他临时JSON文件
FILES_TO_DELETE+=("stage5-*.json")

# 5. 临时输出文件
FILES_TO_DELETE+=("alter-output.txt")
FILES_TO_DELETE+=("debug-api-output.txt")
FILES_TO_DELETE+=("debug-city-zh-output.txt")
FILES_TO_DELETE+=("debug-json-output.txt")
FILES_TO_DELETE+=("git_stderr.txt")
FILES_TO_DELETE+=("git_stdout.txt")
FILES_TO_DELETE+=("query-stage-names-output.txt")
FILES_TO_DELETE+=("push_result.txt")

# 6. 日志文件
FILES_TO_DELETE+=("server.log")

# 7. 调试图片（在server目录）
if [ -d "server" ]; then
  cd server
  FILES_TO_DELETE+=("debug-*.png")
  cd ..
fi

echo "找到 ${#FILES_TO_DELETE[@]} 个要删除的文件类型\n"

# 显示文件列表
echo -e "${YELLOW}以下文件将被删除:${NC}"
for pattern in "${FILES_TO_DELETE[@]}"; do
  find . -maxdepth 1 -name "$pattern" 2>/dev/null | head -5
done

if [ -d "server" ]; then
  cd server
  find . -name "debug-*.png" 2>/dev/null | head -5
  cd ..
fi

echo ""
read -p "确认删除吗？(y/N) " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ 清理已取消${NC}"
  exit 0
fi

echo ""
echo -e "${GREEN}开始清理...${NC}\n"

# 执行删除
DELETED_COUNT=0

# 删除根目录文件
for pattern in "${FILES_TO_DELETE[@]}"; do
  while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then
      rm -f "$file"
      echo -e "${GREEN}✓${NC} 删除: $file"
      ((DELETED_COUNT++))
    fi
  done < <(find . -maxdepth 1 -name "$pattern" -print0 2>/dev/null)
done

# 删除server目录下的调试图片
if [ -d "server" ]; then
  cd server
  while IFS= read -r -d ''; file; do
    if [ -f "$file" ]; then
      rm -f "$file"
      echo -e "${GREEN}✓${NC} 删除: $file"
      ((DELETED_COUNT++))
    fi
  done < <(find . -maxdepth 1 -name "debug-*.png" -print0 2>/dev/null)
  cd ..
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  清理完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}总计删除 ${DELETED_COUNT} 个文件${NC}\n"

# 询问是否提交到git
echo -e "${YELLOW}是否要提交更改到 git? (Y/n)${NC}"
read -p " " git_confirm

if [[ "$git_confirm" =~ ^[Yy]$ ]] || [ -z "$git_confirm" ]; then
  echo ""
  echo "正在提交到 git..."
  git add -A
  git commit -m "清理临时文件和调试代码 - 2026-06-03

清理内容:
- 删除调试JS脚本
- 删除调试HTML文件
- 删除历史赛段JSON文件
- 删除调试图片
- 删除日志和临时输出文件

节省空间: ~5MB"
fi

echo ""
echo -e "${GREEN}✓ 项目清理完成！${NC}"
echo ""
echo "建议后续操作:"
echo "1. 测试后端服务: npm run dev"
echo "2. 运行验证: node verify-pagination.js"
echo "3. 查看文档: docs/ 目录"
echo ""
