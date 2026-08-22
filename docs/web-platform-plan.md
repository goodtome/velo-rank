# 正一领骑 · 网页端（H5）建设方案

> 版本：v0.1（方案评审稿）｜日期：2026-08-14｜作者：WorkBuddy（应陈鹏要求，先方案后开发）

## 1. 需求概述

| 约束项 | 结论 |
|---|---|
| 平台 | 仅网页端（H5），不做安卓 |
| 登录方式 | **仅支持邮箱注册/登录**（验证码邮件） |
| 权限模型 | 免登录可浏览基础数据；登录后解锁全部功能 |
| 小程序 | 保持现状，互不影响 |

## 2. 总体架构

```
┌─────────────────────┐      ┌──────────────────────────────┐
│   H5（Vue3 + Vite）  │─────▶│  EdgeOne Pages（静态托管）    │
│  web/ 目录，独立构建  │      │  免费公测：10GB/月流量+免备案  │
└─────────────────────┘      └──────────────────────────────┘
                │ HTTPS /api/v1/*
                ▼
┌────────────────────────────────────────────────────────────┐
│  现有 Node/Express API（Fly.io 不动）                        │
│  races / stages / riders / teams / search / realtime / ws  │
│  ＋ 新增 /api/v1/auth/web/*（邮箱注册登录）                   │
└────────────────────────────────────────────────────────────┘
                │
                ▼
        MySQL / TiDB（新增 web_users、web_email_codes 两表）
```

**核心优势**：现有 12+ 路由全部复用，后端改动收敛在"认证体系扩展"，前端是全新独立工程（`web/` 目录），与 `miniprogram/` 完全隔离。

---

## 3. 后端改造方案

### 3.1 新增数据表（DDL，待实施）

```sql
-- 网页端用户表（id 用 web_ 前缀，与微信 openid 天然隔离）
CREATE TABLE IF NOT EXISTS web_users (
  id              VARCHAR(64)  PRIMARY KEY COMMENT 'web_<uuid>',
  email           VARCHAR(255) NOT NULL UNIQUE COMMENT '登录邮箱',
  password_hash   VARCHAR(255) NOT NULL COMMENT 'bcrypt 哈希',
  nickname        VARCHAR(50)  DEFAULT NULL,
  email_verified  TINYINT(1)   DEFAULT 0,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='网页端用户表';

-- 邮箱验证码表（5 分钟有效、60s 冷却、5 次失败作废）
CREATE TABLE IF NOT EXISTS web_email_codes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code        VARCHAR(6)   NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used        TINYINT(1)   DEFAULT 0,
  attempts    INT          DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱验证码表';
```

### 3.2 认证 API 设计（新增 `server/routes/webAuth.js`，挂载 `/api/v1/auth/web`）

| 接口 | 方法 | 说明 |
|---|---|---|
| `/auth/web/send-code` | POST | body `{email}`；校验格式 → 60s 冷却 → 生成 6 位码（5 分钟有效，单邮箱单行 upsert）→ SMTP 发信；**开发模式打印验证码到日志**便于联调 |
| `/auth/web/register` | POST | body `{email, code, password}`；校验验证码（5 次失败作废）→ 密码强度 → bcrypt(cost=10) → 建 `web_users` → 签发 token |
| `/auth/web/login` | POST | body `{email, password}`；校验 → 签发 token（复用 `user_tokens`，30 天） |
| `/auth/logout` | POST | 现有接口，直接复用 |
| `/auth/check` | GET | 现有接口；扩展返回 `{uid, email}`（Web 用户）或 `{openid}`（微信用户） |
| `/auth/account` | DELETE | 现有注销接口；对 Web uid 同样生效（删收藏/推送/日志） |

### 3.3 token 与中间件兼容（关键设计）

- **复用 `user_tokens` 表**：token 生成逻辑（uuidv4 + 30 天）与小程序完全一致，`authMiddleware` 零改动。
- **用户标识统一存入 `user_tokens.openid` 列**：Web 用户写入 `web_<uuid>`（与微信 openid 的 28 位字符格式不同，无冲突风险）。
- **可选加列**（更严谨，推荐实施时一并加）：`ALTER TABLE user_tokens ADD COLUMN subject_type VARCHAR(16) DEFAULT 'wechat';`（`'wechat'|'web'`），便于将来排查与扩展（如微信开放平台 App 登录）。
- 收藏等以 `user_id` 关联的功能（`riders_favorites.user_id`）对 Web 用户存 `web_<uuid>`，天然兼容，无需改表。

### 3.4 权限功能矩阵

| 功能 | 免登录 | 登录后 | 说明 |
|---|---|---|---|
| 赛事列表 / 赛事详情 / 赛段成绩（五榜） | ✅ | ✅ | 现有公开只读接口 |
| 车手详情 / 车队详情 / 百科 / 搜索 / 日历 | ✅ | ✅ | 现有公开只读接口 |
| 车手/赛事收藏（收藏列表、添加、删除） | ❌ | ✅ | 复用 `favorites` 路由 |
| 个人中心 / 提醒偏好设置 | ❌ | ✅ | H5 端"提醒设置"简化为偏好保存；微信订阅消息在 H5 无对应，**标注不可用** |
| 实时成绩 WebSocket | ✅（只读广播） | ✅ | `/ws/realtime` 现有广播 |
| 意见反馈 | ✅ | ✅ | H5 用邮件/表单替代剪贴板方案 |

> 结论：绝大多数接口已是"公开只读 + 登录写"结构（`optionalAuth` / `authMiddleware`），H5 只需前端按登录态控制入口，后端仅需为 Web 用户补认证路由。

### 3.5 安全设计

| 项 | 方案 |
|---|---|
| 密码存储 | bcryptjs，cost=10（新依赖） |
| 密码策略 | ≥8 位且含字母+数字（对齐现有 `passwordConfig`） |
| 验证码 | 6 位数字、5 分钟有效、60s 发送冷却、每日每邮箱 ≤10 次、验证失败 5 次作废 |
| 接口限流 | send-code / register / login 单独 rate-limit（`express-rate-limit` 已有），如 15 分钟 20 次/IP |
| 邮件 | nodemailer（新依赖）＋ SMTP 环境变量；QQ 邮箱授权码（免费）即可 |
| CORS | 生产白名单 `configuredOrigins` 增加 H5 域名（`server/config/security.js` 环境变量） |
| 邮箱校验 | Joi 格式 + 发送前验证存在性（登录/注册区分提示，防枚举可模糊处理） |

### 3.6 新增依赖与配置

```
npm i bcryptjs nodemailer
```

`.env`（服务端）新增：
```
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=你的QQ邮箱
SMTP_PASS=QQ邮箱授权码（非登录密码）
SMTP_FROM=正一领骑 <你的QQ邮箱>
WEB_ORIGIN_ALLOWED=https://你的H5域名   # 追加进 CORS 白名单
```

---

## 4. 前端方案（`web/` 独立工程）

### 4.1 技术栈与结构

```
web/
├── index.html
├── package.json          # vue3 / vue-router / pinia / axios
├── vite.config.js        # dev proxy → 本地 3000；build 产物静态
└── src/
    ├── main.js
    ├── App.vue
    ├── router/index.js   # 公共路由 + 登录守卫
    ├── stores/user.js    # Pinia：token / user 信息 / 登录态
    ├── api/request.js    # axios 封装：注入 token、401 跳登录、统一错误
    ├── api/              # races.js / stages.js / riders.js / teams.js / auth.js …
    ├── views/            # 页面组件
    └── components/       # 通用组件（榜单项、筛选器、骨架屏…）
```

### 4.2 页面与路由清单（对应小程序 17 页）

| 路由 | 页面 | 登录要求 |
|---|---|---|
| `/` | 首页（赛事列表 + 进行中/即将开始 Tab） | 公开 |
| `/races/:id` | 赛事详情（信息 + 赛段列表 + 各榜入口 + 收藏按钮） | 公开（收藏需登录） |
| `/races/:id/stage/:n` | 赛段成绩（成绩/GC/积分/爬坡/青年/车队 六 Tab，复用现有接口） | 公开 |
| `/riders/:id` | 车手详情（生涯统计/近期状态/收藏） | 公开（收藏需登录） |
| `/teams/:id` | 车队详情 | 公开 |
| `/calendar` | 赛事日历 | 公开 |
| `/encyclopedia` | 赛事百科 | 公开 |
| `/search` | 搜索（赛事/车手/车队） | 公开 |
| `/login`、`/register` | 登录 / 邮箱注册（验证码） | 免登录可访问 |
| `/profile` | 个人中心（用户信息/收藏入口/注销） | 登录 |
| `/favorites` | 我的收藏 | 登录 |
| `/settings` | 提醒/偏好设置 | 登录 |
| `/privacy`、`/agreement` | 隐私政策 / 用户协议 | 公开 |

> 明确不做：`admin-sync`（管理端）、`push-settings` 的微信订阅逻辑（H5 无微信环境）、实时页单独入口（赛事详情内嵌）。

### 4.3 鉴权流程

- 登录/注册成功后：token 存 `localStorage`（key `auth_token`），Pinia store 同步用户信息。
- `axios` 拦截器：请求带 `Authorization: Bearer <token>`；响应 401 → 清登录态 → 跳 `/login?redirect=...`。
- 路由守卫：`/profile`、`/favorites`、`/settings` 需登录，未登录跳转登录页并记录回跳地址。
- 收藏按钮：未登录点击 → 提示登录并跳转；登录后直接调用 `favorites` API。

---

## 5. 部署方案（EdgeOne Pages）

| 项 | 方案 |
|---|---|
| 平台 | 腾讯云 EdgeOne Pages（公测免费：10GB/月 CDN + 100 万次边缘函数，**可免备案二级域名**，绑定仓库自动部署） |
| 域名 | 优先用平台提供的免备案二级域名；后续可绑自定义域名（国内访问需备案） |
| CI | GitHub 仓库 `web/` 目录触发构建（`npm ci && npm run build`），产物 `web/dist` |
| API 地址 | 前端构建时注入 `VITE_API_BASE`（生产=https://velo-rank-api.fly.dev） |
| 备用 | CloudBase 静态托管 / GitHub Pages（国内访问慢，仅备用） |

---

## 6. 实施计划

| 阶段 | 内容 | 验收 |
|---|---|---|
| **A 后端认证** | 建表 + webAuth 路由 + 依赖 + SMTP 配置 + CORS 白名单 | 本地 curl 全流程：发码→注册→登录→check→收藏→注销 |
| **B H5 骨架+公共页** | Vite 工程、路由、API 封装、首页/赛事详情/赛段成绩/车手/车队/百科/日历/搜索 | 免登录浏览全流程可用 |
| **C 登录+个人中心** | 登录/注册页、收藏、设置、路由守卫 | 登录/未登录权限差异正确 |
| **D 部署上线** | EdgeOne Pages 托管 + 域名 + 生产验证 | H5 线上可用，CORS 正常 |

预计工作量：A≈2-3 天，B≈5-7 天，C≈3-4 天，D≈1 天。

## 7. 风险与注意事项

1. **账号体系隔离（产品决策）**：Web 邮箱账号与小程序微信账号是两套独立用户，收藏数据不互通。如需打通（同一人微信+邮箱合并），需另设计绑定流程（如小程序内"绑定邮箱"），本期不建议做。
2. **邮件送达**：QQ 邮箱 SMTP 免费但对个人号发送频率有限制，验证码场景（低频）够用；正式运营可换企业邮箱/SendGrid。
3. **备案**：使用 EdgeOne Pages 平台二级域名免备案；若绑自定义域名且解析国内，需 ICP 备案。
4. **CORS**：上线前必须把 H5 域名加入服务端 CORS 白名单，否则浏览器跨域拦截。
5. **注销/数据删除**：复用现有 `DELETE /auth/account`，已覆盖 web uid；隐私政策页需补充邮箱账号说明（H5 端独立声明页）。
6. **前端提审无关**：H5 与小程序发布解耦，不影响当前小程序审核流程。
