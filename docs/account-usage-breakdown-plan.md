# 账户用量分解架构说明

## 背景

随着 API Key 与账户数量的增长，原先基于 Redis 的实时统计方案在以下场景下逐渐吃紧：

- **长期统计**：Redis 主要缓存短期窗口数据，无法高效回溯历史用量与费用。
- **多维聚合**：需要按账户/Key/时间范围做灵活组合查询时，`SCAN` + `HASH` 的方案难以支撑。
- **数据自治**：希望生成离线报表或与第三方 BI 对接，需要一个结构化、可持久化的数据源。

因此本次迭代引入 PostgreSQL 作为冷数据存储，用于承载用量明细与聚合查询，同时保留 Redis 的实时优势。

## 数据流概览

```
┌───────────────┐        ┌───────────────┐        ┌────────────────────┐
│  接口层 / UI  │  -->   │   服务层 (Node) │  -->   │ Redis (热路径缓存) │
│               │        │                 │        └────────────────────┘
│ - 账户管理    │        │ - API Key 服务   │                   │
│ - 用量统计    │        │ - 账户服务       │                   ▼
│               │        │                 │        ┌────────────────────┐
└───────────────┘        └───────────────┘        │ Postgres (冷数据仓库) │
                                                   └────────────────────┘
```

- **Redis**：继续处理实时限流、热数据与缓存。
- **PostgreSQL**：持久化账户、API Key 元信息和用量明细，提供跨时间范围、跨维度的聚合能力。
- **双写策略**：业务层在写入 Redis 的同时调用仓库模块写入 Postgres，保证数据最终一致。

## 数据模型

| 表名                | 说明                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| `accounts`          | 账户主表，记录账户的基础信息、平台类型、优先级等元数据                   |
| `api_keys`          | API Key 主表，存储 Key 的关联账户、限额、累计费用等                      |
| `usage_records`     | 用量明细表，每条记录代表一次请求的聚合结果（含 Token、费用、模型信息等） |
| `schema_migrations` | 迁移记录表，用于跟踪已经执行的 SQL 脚本                                  |

### 关键字段

- `usage_records` 采用按事件写入的方式，额外维护 `usage_date`、`usage_hour` 方便做时间维度聚合。
- `api_keys.total_cost_accumulated` 会在每次写入用量时自增，方便前端直接展示。
- 通过 `FILTER` 聚合列在单条 SQL 中得到“今日 / 本月 / 累计”三个窗口指标，减少重复查询。

## 迁移与脚本

- 新增脚本：
  - `npm run db:migrate`：执行 `sql/migrations/*.sql`
  - `npm run db:seed`：导入 `sql/seed.sql` 演示数据（方便本地验证 E2E）
- 引入 `scripts/pg-migrate.js`：
  - 自动建表并记录迁移状态
  - 支持 `--dry-run`、`--list`、`--seed` 等参数
  - 通过 `src/models/db/index.js` 管理连接池、重试与优雅关闭

## 服务层改动

- `src/models/db/index.js`：集中处理 PostgreSQL 连接、事务封装以及关闭逻辑。
- `src/repositories/postgresUsageRepository.js`：提供账户/API Key upsert、用量写入与聚合查询能力。
- `apiKeyService`、`claudeAccountService`：在原有 Redis 操作的同时调用仓库层，维护双写一致性。
- `accountUsageService`：面向路由层的聚合服务，优先使用 Postgres，未启用时回退到 Redis。

## 前端与接口

- 新接口：
  - `GET /admin/accounts/usage-stats`：返回账户级“今日/本月/累计”汇总及全局概要
  - `GET /admin/accounts/:id/usage-stats`：返回单账户的聚合摘要
  - `GET /admin/accounts/:id/usage-breakdown`：返回按 API Key 维度的细分明细
- `web/admin-spa` 的账户列表页增加“总用量”列，并在“详情”面板中使用新的接口数据。
- Playwright 用例 `tests/e2e/account-breakdown.spec.ts` 使用 `scripts/generate-breakdown-demo.js` 生成的演示数据做回归验证。

## 运行提示

1. `.env` 中默认开启 PostgreSQL：如暂时未部署，可将 `POSTGRES_ENABLED=false` 禁用。
2. 初始化顺序推荐：
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed      # 可选
   npm run install:web
   npm run build:web
   npm run dev
   ```
3. 当 PostgreSQL 不可用时，日志会提示降级；账户汇总相关功能将仅呈现 Redis 即时统计。

## 后续可选优化

- 为 `usage_records` 添加物化视图或分区，进一步提升长时间窗口的查询性能。
- 引入后台批处理任务（如每日离线汇总），减少实时写入压力。
- 与外部 BI 工具对接（Superset / Metabase），让运营侧可以自助分析。
