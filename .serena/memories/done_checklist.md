# 完成任务前的检查清单

- 代码质量：
  - 运行 `npm run lint:check` 确保无 ESLint 错误
  - 运行 `npm run format:check` 确保 Prettier 格式通过
  - 如含测试，运行 `npm test` 并确保全部通过

- 功能验证：
  - 本地启动：`npm run dev` 或 `npm start`
  - 打开 `http://HOST:PORT/health` 返回 `healthy`
  - 管理界面正常：`/admin-next/` 能加载 `index.html`（需先 `npm run build:web`）
  - 关键端点联通：`/api/v1/messages`（或 `/claude/v1/messages`、`/openai/claude/v1/messages`）可用

- 配置与安全：
  - `.env` 与 `config/config.js` 按需更新（`JWT_SECRET`、`ENCRYPTION_KEY`、Redis 等）
  - 生产环境建议前置 Caddy/Nginx 并启用 HTTPS，SSE 配置到位
  - 根据需要开启 `TRUST_PROXY`、CORS 策略、速率限制（生产自动启用）

- 数据与迁移：
  - 管理员初始化：`npm run setup`（更新后需重启服务加载）
  - 如涉及价格/模型：`npm run update:pricing` 与 `npm run init:costs`
  - 如涉及数据结构：评估是否需运行 `npm run migrate:*` 或导出/导入数据

- 文档与脚本：
  - 如更改端点、配置项或部署方式，更新 `README.md`/脚本注释
  - 若影响前端，记得 `npm run build:web`
