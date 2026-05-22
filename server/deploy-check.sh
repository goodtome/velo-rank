#!/bin/bash
# 部署前检查脚本
# 用于检查服务器是否准备好部署

echo "=== 部署前检查 ==="
echo ""

# 1. 检查 Node.js 版本
echo "1. 检查 Node.js 版本..."
node --version
if [ $? -ne 0 ]; then
  echo "❌ Node.js 未安装或不可用"
  exit 1
fi

# 2. 检查 npm 版本
echo "2. 检查 npm 版本..."
npm --version
if [ $? -ne 0 ]; then
  echo "❌ npm 未安装或不可用"
  exit 1
fi

# 3. 检查 MySQL 连接
echo "3. 检查 MySQL 连接..."
node -e "const pool = require('./config/db-pool'); pool.getConnection().then(conn => { console.log('✅ MySQL 连接成功'); conn.release(); process.exit(0); }).catch(err => { console.error('❌ MySQL 连接失败:', err.message); process.exit(1); });"
if [ $? -ne 0 ]; then
  echo "❌ MySQL 连接失败"
  exit 1
fi

# 4. 检查环境变量文件
echo "4. 检查环境变量文件..."
if [ ! -f .env ]; then
  echo "❌ .env 文件不存在，请先创建（参考 .env.example）"
  exit 1
else
  echo "✅ .env 文件存在"
fi

# 5. 检查依赖是否安装
echo "5. 检查依赖是否安装..."
if [ ! -d node_modules ]; then
  echo "⚠️  node_modules 不存在，正在安装依赖..."
  npm install --production
else
  echo "✅ 依赖已安装"
fi

# 6. 检查端口是否被占用
echo "6. 检查端口 3000..."
netstat -ano | grep ":3000" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "⚠️  端口 3000 已被占用，将重启服务"
else
  echo "✅ 端口 3000 可用"
fi

# 7. 测试 API 端点
echo "7. 测试 API 端点..."
curl -s http://localhost:3000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ API 健康检查通过"
else
  echo "⚠️  API 健康检查失败（服务器可能未启动）"
fi

echo ""
echo "=== 检查完成 ==="
echo "✅ 服务器已准备好部署"
echo ""
echo "下一步："
echo "1. 运行 npm start 启动服务器"
echo "2. 或使用 PM2: pm2 start server/app.js --name velo-rank-api"
