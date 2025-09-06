# 常用命令（建议收藏）

- 初始化与安装：
  - `npm install`：安装后端依赖
  - `cp config/config.example.js config/config.js && cp .env.example .env`：生成本地配置
  - `npm run install:web`：安装管理后台前端依赖
  - `npm run build:web`：构建管理后台（生成 `web/admin-spa/dist`）
  - `npm run setup`：初始化管理员（生成 `data/init.json`）

- 开发与运行：
  - `npm run dev`：开发模式（`nodemon` 监听 + 先 `lint`）
  - `npm start`：生产运行（先 `lint` 再 `node src/app.js`）
  - `npm run service:start` / `:daemon`：脚本化后台运行
  - `npm run service:status` / `npm run service:logs`：查询状态与日志
  - `npm run monitor` / `npm run status` / `npm run status:detail`：综合监控脚本

- 质量与校验：
  - `npm run lint` / `npm run lint:check`：ESLint（含 Prettier 插件）
  - `npm run format` / `npm run format:check`：Prettier 格式化
  - `npm test`：Jest 测试（如有测试用例）

- CLI 工具（管理员/API Key/Bedrock）：
  - `npm run cli`：打开交互式 CLI 主入口
  - 常用子命令：`npm run cli -- admin` / `keys` / `status` / `bedrock`

- 数据与迁移：
  - `npm run data:export` / `data:import`：JSON 导出/导入
  - `npm run data:export:sanitized`：脱敏导出
  - `npm run data:export:enhanced` / `data:import:enhanced`：增强版数据迁移
  - `npm run data:export:encrypted`：导出（不解密）
  - `npm run migrate:apikey-expiry` / `:dry`：过期字段迁移
  - `npm run migrate:fix-usage-stats`：修复统计

- 定价与模型：
  - `npm run update:pricing`：更新模型定价（`resources/model-pricing/*`）
  - `npm run init:costs`：初始化/检查 Key 成本数据

- Docker：
  - `npm run docker:build`：本地构建镜像
  - `npm run docker:up` / `npm run docker:down`：Compose 启停

- 端点快捷检查：
  - 健康：`curl http://HOST:PORT/health`
  - 指标：`curl http://HOST:PORT/metrics`
  - 管理界面：浏览器访问 `http://HOST:PORT/admin-next/`
