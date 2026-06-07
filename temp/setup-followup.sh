#!/bin/bash

# ============================================
# 正一领骑 - 后续工作一键执行脚本
# ============================================
# 作者: 开发团队
# 日期: 2026-05-29
# 用途: 自动执行所有后续工作步骤
# ============================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo " 正一领骑 - 后续工作执行脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Node.js
check_nodejs() {
    print_info "检查Node.js..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js未安装，请先安装Node.js 14+"
        exit 1
    fi

    NODE_VERSION=$(node -v)
    print_info "✓ Node.js版本: $NODE_VERSION"

    # 检查npm
    if ! command -v npm &> /dev/null; then
        print_error "npm未安装"
        exit 1
    fi

    NPM_VERSION=$(npm -v)
    print_info "✓ npm版本: $NPM_VERSION"
}

# 检查MySQL
check_mysql() {
    print_info "检查MySQL..."

    if command -v mysql &> /dev/null; then
        MYSQL_CMD="mysql"
    elif command -v msysql &> /dev/null; then
        MYSQL_CMD="msysql"
    else
        print_warn "MySQL命令行工具未找到，跳过MySQL检查"
        return 0
    fi

    if [ -f "server/config/.env" ]; then
        print_info "检测到.env文件"

        # 读取数据库配置
        DB_USER=$(grep "^DB_USER=" server/config/.env | cut -d'=' -f2)
        DB_HOST=$(grep "^DB_HOST=" server/config/.env | cut -d'=' -f2)
        DB_DB=$(grep "^DB_NAME=" server/config/.env | cut -d'=' -f2)

        if [ -z "$DB_USER" ]; then
            print_error "DB_USER未在.env文件中配置"
            return 1
        fi

        print_info "正在尝试连接MySQL..."
        if $MYSQL_CMD -u"$DB_USER" -h"$DB_HOST" -e "SELECT 1" > /dev/null 2>&1; then
            print_info "✓ MySQL连接成功"
            return 0
        else
            print_warn "MySQL连接失败（可能需要密码）"
            return 0
        fi
    else
        print_warn "未找到.env文件，跳过MySQL检查"
        return 0
    fi
}

# 1. 安装依赖
install_dependencies() {
    print_info "=========================================="
    print_info "步骤1/6: 安装依赖"
    print_info "=========================================="

    if [ -d "node_modules" ]; then
        print_warn "node_modules已存在，建议重新安装以获取最新依赖"
        read -p "是否重新安装？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm install
        else
            print_info "跳过依赖安装"
        fi
    else
        npm install
    fi

    print_info "✓ 依赖安装完成"
}

# 2. 检查环境配置
check_env() {
    print_info "\n=========================================="
    print_info "步骤2/6: 检查环境配置"
    print_info "=========================================="

    if [ ! -f "server/config/.env" ]; then
        print_info "未找到.env文件，正在创建..."

        cat > server/config/.env << 'EOF'
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=jersey_db

# 安全配置
SESSION_SECRET=your-secret-key-change-in-production
CORS_ORIGINS=*

# WebSocket配置（如使用WebSocket）
WS_HOST=localhost
WS_PORT=3000

# 日志配置（可选）
LOG_LEVEL=info
EOF

        print_warn "✓ 已创建server/config/.env文件"
        print_warn "⚠ 请编辑.env文件，设置正确的DB_PASSWORD和SESSION_SECRET"
        print_warn ""
        read -p "是否现在编辑.env文件？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} server/config/.env
        fi
    else
        print_info "✓ .env文件已存在"
    fi
}

# 3. 运行数据库迁移
migrate_database() {
    print_info "\n=========================================="
    print_info "步骤3/6: 运行数据库迁移"
    print_info "=========================================="

    if [ ! -f "server/scripts/migrate-auth-tables.js" ]; then
        print_error "数据库迁移脚本不存在: server/scripts/migrate-auth-tables.js"
        return 1
    fi

    node server/scripts/migrate-auth-tables.js

    print_info "✓ 数据库迁移完成"
}

# 4. 配合app.js更新（如果有需要）
verify_app_js() {
    print_info "\n=========================================="
    print_info "步骤4/6: 验证app.js配置"
    print_info "=========================================="

    if grep -q "'/api/v1/favorites'" server/app.js; then
        print_info "✓ app.js已包含favorites路由"
    else
        print_warn "⚠ app.js中未包含favorites路由，请手动添加："
        print_warn ""
        print_warn '  app.use("/api/v1/favorites", rateLimit(apiLimiter, { skip: (req) => req.path.startsWith("/health") }), require("./routes/favorites"));'
        echo ""
        read -p "是否继续？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 5. 启动服务测试
start_service() {
    print_info "\n=========================================="
    print_info "步骤5/6: 启动服务测试"
    print_info "=========================================="

    print_info "检查端口 ${PORT:-3000} 是否被占用..."
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 -o PID +D >/dev/null 2>&1; then
        print_warn "端口3000已被占用，请先停止现有服务"
        print_warn "查看占用进城的命令: lsof -i :3000"
        return 1
    fi

    print_info "启动开发服务器按 Ctrl+C 停止..."
    print_info ""
    print_info "=========================================="
    read -p "是否立即启动服务？(y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run dev
    else
        print_info "服务已准备就绪，可手动启动："
        print_info "  cd D:\\codes\\velo-rank"
        print_info "  npm run dev"
    fi
}

# 6. 生成测试报告
generate_report() {
    print_info "\n=========================================="
    print_info "步骤6/6: 生成后续工作完成报告"
    print_info "=========================================="

    REPORT_FILE="完成报告-$(date +%Y%m%d_%H%M%S).md"

    cat > "$REPORT_FILE" << 'EOF'
# 正一领骑 - 后续工作完成报告

## 执行时间
$(date '+%Y年%m月%d日 %H:%M:%S')

## 已完成工作
1. ✅ 依赖安装
2. ✅ 环境配置检查
3. ✅ 数据库迁移
4. ✅ 路由验证
5. ⏳ 服务启动（需手动完成）

## 下一步操作

### 立即执行
1. 编辑 server/config/.env 文件，设置数据库密码
   ```bash
   # 打开 .env 文件
   nano server/config/.env

   # 设置正确的密码
   DB_PASSWORD=your_actual_password
   SESSION_SECRET=另一个强密码
   ```

2. 启动服务
   ```bash
   npm run dev
   ```

3. 验证服务是否正常启动
   ```bash
   curl http://localhost:3000/health
   ```

### 访问服务
- 后端API: http://localhost:3000/api/v1
- API文档: http://localhost:3000/api/v1
- WebSocket: ws://localhost:3000/ws/realtime

### 测试功能
1. 健康检查
2. 测试登录API
3. 测试关注功能
4. 测试WebSocket连接

## 常见问题

### 数据库连接失败
- 检查DB_PASSWORD是否正确
- 确认MySQL服务正在运行

### 端口被占用
- 改变.env中的PORT配置
- 或者占用端口的进程

### 文件未找到
- 重新运行此脚本
- 检查文件路径是否正确

## 重要提醒
⚠️ 生产环境部署前务必：
1. 修改SESSION_SECRET为强密码
2. 修改CORS_ORIGINS为具体域名
3. 设置正确的数据库密码
4. 启用HTTPS
5. 配置防火墙规则
6. 定期备份数据库

## 技术支持
- 详细文档: FOLLOWUP_GUIDE.md
- BUG报告: BUG_REPORT.md
- 修复记录: HIGH_PRIORITY_FIXES.md

---
报告生成时间: $(date)
EOF

    print_info "✓ 完成报告已保存到: $REPORT_FILE"
}

# 主流程
main() {
    echo ""
    check_nodejs
    check_mysql
    install_dependencies
    check_env
    migrate_database
    verify_app_js
    start_service
    generate_report

    echo ""
    print_info "=========================================="
    print_info "后续工作准备完成！"
    print_info "=========================================="
    echo ""
    print_info "下一步："
    print_info "  1. 编辑 server/config/.env 设置配置"
    print_info "  2. 运行: npm run dev"
    print_info "  3. 访问: http://localhost:3000/health"
    print_info "  4. 详细指南: 看FOLLOWUP_GUIDE.md"
    echo ""
}

# 执行主流程
main
