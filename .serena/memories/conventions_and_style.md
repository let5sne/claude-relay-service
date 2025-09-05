# 代码规范与风格

- 语言与模块：
  - Node.js 18+，CommonJS（`require`/`module.exports`）
  - 目标环境为服务端（ES2021），`eslintrc.cjs` 已配置

- ESLint：
  - 基于 `eslint:recommended` 与 `plugin:prettier/recommended`
  - 重要规则：`no-unused-vars`（忽略 `_` 前缀），`prefer-const`，`no-var`，`no-shadow`，`eqeqeq`，`curly`，`no-throw-literal`，`prefer-template` 等
  - 生产环境 `no-debugger` 为 `error`；CLI/脚本允许 `process.exit`

- Prettier：
  - 无分号（`semi: false`），单引号，`printWidth: 100`，`trailingComma: none`
  - `indent/quotes/semi` 由 Prettier 负责；`format`/`format:check` 命令配套

- 结构与命名：
  - 路由放在 `src/routes/`，服务放在 `src/services/`，通用工具放在 `src/utils/`
  - Redis 访问封装在 `src/models/redis.js`
  - 配置集中在 `config/config.js`，优先从 `.env` 读取

- 日志与监控：
  - 使用 `src/utils/logger.js`（winston + 日志轮转），统一 `logger.info/success/warn/error/start/timer` API
  - 健康检查 `/health`、指标 `/metrics`，并在启动和优雅关闭时记录重要日志

- 安全与中间件：
  - `helmet`、CORS（可切换全开或细粒度策略）、请求大小限制、生产环境速率限制
  - 支持调试拦截器（`DEBUG_HTTP_TRAFFIC=true` 时输出 HTTP 细节至日志文件）

- 前端构建：
  - 管理后台位于 `web/admin-spa`，使用 Vite 构建；开发后需 `npm run build:web`

- 其他：
  - API Key 统一前缀 `cr_`；支持识别 Claude CLI / Gemini CLI 的 `User-Agent`
  - 版本优先来自 `APP_VERSION`/`VERSION` 文件，回退到 `package.json`，默认 `1.0.0`
