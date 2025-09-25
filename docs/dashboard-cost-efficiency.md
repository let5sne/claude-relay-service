# 仪表盘性价比分析说明

## 背景

为帮助运营人员快速识别“成本低、成功率高”的优质账户，本次迭代在仪表盘新增「账户性价比」模块，并在后端扩展用量数据以支持更精细的成本分析。模块核心目标包括：

- 统一展示各账户的 Tokens 成本、成功率与请求规模。
- 提供多维筛选（时间范围、平台），便于横向比较同类账户。
- 通过气泡图、排行榜等可视化手段突出性价比差异并突出异常账户。

## 指标定义

| 指标                | 说明                                   | 备注                                  |
| ------------------- | -------------------------------------- | ------------------------------------- |
| `tokens_per_dollar` | 每美元可产出的 Token 数量，越高越好    | = `total_tokens ÷ total_cost`         |
| `cost_per_million`  | 生产 100 万 Token 的平均成本，越低越好 | = `total_cost ÷ (total_tokens / 1e6)` |
| `cost_per_request`  | 单次请求的平均费用                     | = `total_cost ÷ total_requests`       |
| `success_rate`      | 请求成功率                             | = `success_requests ÷ total_requests` |
| `avg_latency_ms`    | 平均响应耗时                           | 仅统计非零延迟的数据                  |
| `p95_latency_ms`    | 95 分位延迟                            | 基于 `percentile_cont(0.95)`          |

气泡图中：

- **X 轴** 使用 `cost_per_million`，低成本左移；
- **Y 轴** 使用 `success_rate`，高成功率上移；
- **气泡大小** 与请求量平方根成正比；
- **颜色** 区分平台（Claude、Console、Gemini、Bedrock、OpenAI、Azure）。

## 数据来源与字段扩展

在 `usage_records` 表中新增以下字段以支撑成本分析：

- `request_status`：请求状态 (`success`/`error` 等)，用于成功率统计；
- `response_latency_ms`：响应耗时；
- `http_status`、`error_code`、`retries`、`client_type`、`region`：辅助定位异常。

并创建聚合视图：

- `account_efficiency_daily`
- `account_efficiency_totals`

后端服务根据时间、平台、分组等条件直接聚合 `usage_records`，保证数据实时可信。

## 新增 API

| Endpoint                                        | 说明                                        | 主要查询参数                                                                                                               |
| ----------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/dashboard/cost-efficiency/summary`  | 返回总体指标（总成本、成功率、Tokens/$ 等） | `range` (`today`/`7days`/`30d`/`total`/`custom`)、`start`、`end`、`platform`、`groupId`                                    |
| `GET /admin/dashboard/cost-efficiency/accounts` | 返回账户级性价比列表（支持排序、分页）      | 同上，另含 `sortBy` (`tokensPerDollar` / `costPerMillion` / `successRate` / `cost` / `tokens`)、`order`、`limit`、`offset` |
| `GET /admin/dashboard/cost-efficiency/trends`   | 返回时间序列（成本/成功率等趋势）           | 同上，另含 `interval` (`hour`/`day`/`week`)                                                                                |

所有接口在 PostgreSQL 未启用时返回 `available: false` 的占位结果，确保前端兼容。

## 前端交互

- **筛选**：
  - 时间范围按钮（今日 / 7 天 / 30 天 / 全部）映射 `range` 参数。
  - 平台下拉选择（默认“全部平台”）。
- **展示**：
  - 左侧摘要卡片显示 Tokens/$、$/百万 Tokens、成功率、平均/ P95 延迟等关键指标。
  - 右侧气泡图呈现成本 vs 成功率分布，气泡大小反映请求量。
  - 下方排行榜表格列出费用、Tokens、性价比、成功率、延迟等维度，点击表头快捷切换排序字段。
- **刷新**：每次变更筛选或手动点击刷新按钮都会调用 `loadCostEfficiencyData`，并在全局刷新（自动刷新、手动刷新）时一同更新。

## 兼容与后续

- 旧数据会以默认值补齐（状态=`success`、延迟=0），可通过回填脚本二次清洗。
- 如需接入账户分组筛选，可在 `costEfficiencyFilters` 增加 `groupId` 并复用现有 API 参数。
- 可扩展趋势图，结合 `efficiencyTrends` 数据展示 Tokens/$、$/百万 Tokens 的时间序列。

如需进一步拓展指标或导出报表，可直接基于新增视图和字段进行 SQL 聚合。
