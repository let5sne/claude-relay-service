# 代码结构（粗略）

- 根目录
  - `README.md` / `README_EN.md`：项目说明与部署文档
  - `package.json`：脚本、依赖、Node 版本要求（>=18）
  - `Dockerfile` / `docker-compose.yml`：容器化配置
  - `Makefile` / `scripts/`：服务管理、监控、迁移、测试脚本集合
  - `.eslintrc.cjs` / `.prettierrc` / `nodemon.json`：质量与开发工具配置
  - `.env.example`：环境变量样例
  - `resources/model-pricing/`：模型价格与上下文窗口配置
  - `web/admin-spa/`：管理后台前端（Vite 项目），构建产物在 `web/admin-spa/dist`
  - `cli/`：交互式管理 CLI（`cli/index.js`）

- `config/`
  - `config.example.js`：完整配置（拷贝为 `config.js` 后使用）

- `src/`
  - `app.js`：应用主入口（初始化 Redis/服务/路由/健康检查/指标/优雅关闭）
  - `routes/`：
    - `api.js`：Claude 标准 API（`/api` 与 `/claude` 同源）
    - `openaiRoutes.js` / `openaiClaudeRoutes.js` / `openaiGeminiRoutes.js`：OpenAI 兼容端点
    - `geminiRoutes.js`：Gemini 端点
    - `azureOpenaiRoutes.js`：Azure OpenAI 端点
    - `admin.js` / `web.js`：后台与页面路由
    - `apiStats.js` / `webhook.js`：统计与 Webhook
  - `services/`：
    - `*AccountService.js`：Claude/Bedrock/Gemini 账户管理
    - `*RelayService.js` / `*Scheduler.js`：请求中转/调度
    - `apiKeyService.js` / `pricingService.js` / `costInitService.js`：密钥/定价/成本
    - 其他：`ldapService.js`、`webhookService.js`、`tokenRefreshService.js` 等
  - `middleware/`：`auth.js`（CORS/安全/限流/大小限制），可选 `debugInterceptor`
  - `utils/`：`logger.js`、`costCalculator.js`、`proxyHelper.js`、`tokenMask.js` 等
  - `models/redis.js`：Redis 初始化与访问封装
  - `cli/`：命令行子工具（如 `src/cli/initCosts.js`）

- 运行期
  - `logs/`、`data/`：运行生成（日志与管理员初始化文件 `data/init.json`）
