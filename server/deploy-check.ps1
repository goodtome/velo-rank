# 部署前检查脚本（Windows PowerShell 版本）
# 用于检查服务器是否准备好部署

Write-Host "=== 部署前检查 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js 版本
Write-Host "1. 检查 Node.js 版本..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 未安装或不可用" -ForegroundColor Red
    exit 1
}

# 2. 检查 npm 版本
Write-Host "2. 检查 npm 版本..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm 未安装或不可用" -ForegroundColor Red
    exit 1
}

# 3. 检查 MySQL 连接
Write-Host "3. 检查 MySQL 连接..." -ForegroundColor Yellow
$dbTest = node -e "const pool = require('./config/db-pool'); pool.getConnection().then(conn => { console.log('SUCCESS'); conn.release(); process.exit(0); }).catch(err => { console.error('FAILED:', err.message); process.exit(1); });"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MySQL 连接成功" -ForegroundColor Green
} else {
    Write-Host "❌ MySQL 连接失败" -ForegroundColor Red
    exit 1
}

# 4. 检查环境变量文件
Write-Host "4. 检查环境变量文件..." -ForegroundColor Yellow
if (Test-Path .env) {
    Write-Host "✅ .env 文件存在" -ForegroundColor Green
} else {
    Write-Host "❌ .env 文件不存在，请先创建（参考 .env.example）" -ForegroundColor Red
    exit 1
}

# 5. 检查依赖是否安装
Write-Host "5. 检查依赖是否安装..." -ForegroundColor Yellow
if (Test-Path node_modules) {
    Write-Host "✅ 依赖已安装" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules 不存在，正在安装依赖..." -ForegroundColor Yellow
    npm install --production
}

# 6. 检查端口是否被占用
Write-Host "6. 检查端口 3000..." -ForegroundColor Yellow
$portCheck = netstat -ano | findstr ":3000"
if ($portCheck) {
    Write-Host "⚠️  端口 3000 已被占用，将重启服务" -ForegroundColor Yellow
} else {
    Write-Host "✅ 端口 3000 可用" -ForegroundColor Green
}

# 7. 测试 API 端点
Write-Host "7. 测试 API 端点..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API 健康检查通过" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  API 健康检查失败（服务器可能未启动）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 检查完成 ===" -ForegroundColor Cyan
Write-Host "✅ 服务器已准备好部署" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：" -ForegroundColor Cyan
Write-Host "1. 运行 npm start 启动服务器" -ForegroundColor White
Write-Host "2. 或使用 PM2: pm2 start server/app.js --name velo-rank-api" -ForegroundColor White
