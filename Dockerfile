# ============================================================
# 正一领骑 后端 Dockerfile（精简版）
# 部署目标：Fly.io
# 策略：排除 puppeteer/playwright 等重型爬虫依赖（仅独立脚本使用）
# ============================================================

FROM node:22-alpine

# 安装 dumb-init 用于优雅退出
RUN apk add --no-cache dumb-init

WORKDIR /app

# ---- 依赖安装 ----
# 先只复制 package 文件，利用 Docker 层缓存
COPY package.json package-lock.json ./

# 安装生产依赖
RUN npm ci --omit=dev

# 删除重型爬虫包目录（仅占空间，运行时路由不依赖）
# 用 rm -rf 而非 npm uninstall，避免级联删除共享依赖（如 ws 模块）
RUN rm -rf node_modules/.cache \
    node_modules/puppeteer* \
    node_modules/playwright* \
    node_modules/jsdom \
    node_modules/cheerio \
    node_modules/cloudscraper \
    node_modules/scrapingbee \
    node_modules/chromium-bidi \
    /root/.cache && \
    npm cache clean --force

# ---- 应用代码 ----
COPY server/ ./server/

# ---- 健康检查 ----
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => {process.exit(r.statusCode===200?0:1)})"

EXPOSE 3000

# dumb-init 处理 SIGTERM，确保 WebSocket 连接正常关闭
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/app.js"]
