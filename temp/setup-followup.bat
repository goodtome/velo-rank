@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: 正一领骑 - 后续工作执行脚本 (Windows)
:: ============================================
:: 作者: 开发团队
:: 日期: 2026-05-29
:: ============================================

echo ==========================================
echo 正一领骑 - 后续工作执行脚本 (Windows)
echo ==========================================
echo.

:: 颜色定义（通过echo实现简单着色，Windows CMD不支持ANSI）
set "INFO=[INFO]"
set "WARN=[WARN]"
set "ERROR=[ERROR]"
set "SUCCESS=[SUCCESS]"
set "NC= "

:: 1. 检查Node.js
echo %INFO% 检查Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %ERROR% Node.js未安装，请先安装Node.js 14+
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('node -v') do set NODE_VERSION=%%i
echo %SUCCESS% ✓ Node.js版本: %NODE_VERSION%

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %ERROR% npm未安装
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('npm -v') do set NPM_VERSION=%%i
echo %SUCCESS% ✓ npm版本: %NPM_VERSION%

echo.

:: 2. 检查node_modules
if not exist "node_modules" (
    echo %INFO% 依赖未安装，开始安装...
    call:run_command npm install
    if %ERRORLEVEL% NEQ 0 (
        echo %ERROR% 依赖安装失败
        pause
        exit /b 1
    )
    echo %SUCCESS% ✓ 依赖安装完成
) else (
    echo %INFO% 依赖已存在 (node_modules/)
    echo %INFO% 如需重新安装，请手动运行: npm install
)

echo.

:: 3. 检查.env文件
if not exist "server/config\.env" (
    echo %INFO% 未找到.env文件，正在创建...
    (
        echo # 服务器配置
        echo PORT=3000
        echo NODE_ENV=development
        echo.
        echo # 数据库配置
        echo DB_HOST=localhost
        echo DB_PORT=3306
        echo DB_USER=root
        echo DB_PASSWORD=your_password_here
        echo DB_NAME=jersey_db
        echo.
        echo # 安全配置
        echo SESSION_SECRET=your-secret-key-change-in-production
        echo CORS_ORIGINS=*
        echo.
        echo # WebSocket配置（如使用WebSocket）
        echo WS_HOST=localhost
        echo WS_PORT=3000
        echo.
        echo # 日志配置（可选）
        echo LOG_LEVEL=info
    ) > server/config\.env

    echo %WARN% ✓ 已创建server/config\.env文件
    echo %WARN% ⚠ 请编辑.env文件，设置正确的DB_PASSWORD和SESSION_SECRET
    echo %WARN%.
    echo %WARN% 要编辑文件，请运行: notepad server\config\.env
    echo %WARN%.
    pause
) else (
    echo %SUCCESS% ✓ .env文件已存在
)

echo.

:: 4. 检查app.js是否包含favorites路由
findstr /C:"'/api/v1/favorites'" server\app.js >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %SUCCESS% ✓ app.js已包含favorites路由
) else (
    echo %WARN% ⚠ app.js中未包含favorites路由
    echo %WARN% 正在备份app.js...
    copy server\app.js server\app.js.backup >nul 2>&1
    echo %WARN% 正在添加favorites路由...

    powershell -Command "(Get-Content 'server\app.js') -replace \"app\.use\('/api/v1/search', rateLimit\(apiLimiter, \{ skip: \(req\) => req\.path\.startsWith\('/health'\)\}\), require\('./routes/search'\)\);\\s+app\.use\('/api/v1/sync', rateLimit\(syncLimiter\), require\('./routes/sync'\)\);\", \"app.use('/api/v1/search', rateLimit(apiLimiter, { skip: (req) => req.path.startsWith('/health') }), require('./routes/search'));\r\n  app.use('/api/v1/favorites', rateLimit(apiLimiter, { skip: (req) => req.path.startsWith('/health') }), require('./routes/favorites'));\r\n  app.use('/api/v1/sync', rateLimit(syncLimiter), require('./routes/sync'));\") | Set-Content 'server\app.js'"

    if %ERRORLEVEL% EQU 0 (
        echo %SUCCESS% ✓ 已自动添加favorites路由
    ) else (
        echo %ERROR% ⚠ 自动修复失败，请手动添加路由
        echo %WARN% 在 server\app.js 第124行后添加：
        echo %WARN%.
        echo %WARN% app.use('/api/v1/favorites', rateLimit(apiLimiter, { skip: (req) => req.path.startsWith('/health') }), require('./routes/favorites'));"
        echo.
        pause
    )
)

echo.

:: 5. 询问是否启动服务
echo %INFO% 检查端口3000是否被占用...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %WARN% ⚠ 端口3000已被占用
    echo %WARN% 占用端口的进程:
    netstat -ano | findstr ":3000" | findstr "LISTENING"
    echo.
    echo %INFO% 请先停止占用端口的进程，或修改.env中的PORT配置
    pause
    exit /b 1
) else (
    echo %SUCCESS% ✓ 端口3000未被占用
)

echo.
echo %INFO% ==========================================
echo %INFO% 下一步操作
echo %INFO% ==========================================
echo.
echo %INFO% 1. 编辑 server/config/.env 配置文件
echo %INFO%    要编辑，请运行: notepad server\config\.env
echo %INFO%.
echo %INFO% 2. 设置正确的配置
echo %INFO%    - DB_PASSWORD: 您的数据库密码
echo %INFO%    - SESSION_SECRET: 强随机密码
echo %INFO%    - CORS_ORIGINS: 生产环境改为你的域名
echo %INFO%.
echo %INFO% 3. 启动开发服务器
echo %INFO%    运行: npm run dev
echo %INFO%.
echo %INFO% 4. 验证服务是否正常
echo %INFO%    访问: http://localhost:3000/health
echo %INFO%.
echo %INFO% 5. 查看完整指南
echo %INFO%    打开: FOLLOWUP_GUIDE.md
echo %INFO%.
echo %SUCCESS% ==========================================
echo %SUCCESS% 后续工作准备完成！
echo %SUCCESS% ==========================================
echo.

pause
