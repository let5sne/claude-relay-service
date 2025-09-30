# 第三方不透明计费成本追踪方案

## 目标

- 在缺乏官方单价的情况下，仍能准确核算与比较各账户的调用成本。
- 支撑短期（手动录入）与长期（自动学习）的成本管理需求。
- 与现有 PostgreSQL 冷数据层、成本效率服务、Admin UI 无缝集成。

## 数据模型

### 1. `account_cost_profiles`

| 字段                        | 类型                      | 说明                                                            |
| --------------------------- | ------------------------- | --------------------------------------------------------------- |
| `account_id`                | `UUID` PK → `accounts.id` | 账号 ID                                                         |
| `billing_type`              | `TEXT`                    | `standard` / `points` / `quota`                                 |
| `cost_tracking_mode`        | `TEXT`                    | `standard` / `manual_billing` / `estimated`                     |
| `currency`                  | `TEXT` 默认 `USD`         | 记账币种                                                        |
| `derived_rates`             | `JSONB`                   | 反推费率（`costPerToken`、`costPerRequest`、`costPerPoint` 等） |
| `relative_efficiency`       | `NUMERIC(10,4)`           | 相对效率倍数（估算模式）                                        |
| `baseline_account_id`       | `UUID` nullable           | 基准账户                                                        |
| `confidence_level`          | `TEXT`                    | `high` / `medium` / `low`                                       |
| `notes`                     | `TEXT`                    | 维护备注                                                        |
| `metadata`                  | `JSONB`                   | 额外扩展字段                                                    |
| `created_at` / `updated_at` | `TIMESTAMPTZ`             | 自动维护                                                        |

> 一对一表，控制账户级成本策略。

### 2. `account_bills`

| 字段                                          | 类型                     | 说明                                  |
| --------------------------------------------- | ------------------------ | ------------------------------------- |
| `id`                                          | `UUID` PK                | 账单记录                              |
| `account_id`                                  | `UUID` → `accounts.id`   | 关联账户                              |
| `billing_period_start` / `billing_period_end` | `DATE`                   | 覆盖周期（闭区间）                    |
| `total_amount`                                | `NUMERIC(20,8)`          | 实际支付金额                          |
| `currency`                                    | `TEXT`                   | 币种                                  |
| `total_units`                                 | `NUMERIC(20,8)` nullable | 本期积分/额度消耗量                   |
| `unit_name`                                   | `TEXT` nullable          | 积分/额度名称                         |
| `exchange_rate`                               | `NUMERIC(20,8)` nullable | 换算成 USD 时的汇率                   |
| `confidence_level`                            | `TEXT`                   | `confirmed` / `estimated` / `partial` |
| `data_source`                                 | `TEXT`                   | `manual` / `import` / `api`           |
| `document_url`                                | `TEXT`                   | 上传/外链                             |
| `notes`                                       | `TEXT`                   | 备注                                  |
| `created_by`                                  | `TEXT`                   | 操作人                                |
| `metadata`                                    | `JSONB`                  | 额外信息                              |
| `created_at` / `updated_at`                   | `TIMESTAMPTZ`            | 审计字段                              |

> 账单驱动 `manual_billing` 模式的费率反推、成本校准。

### 3. `account_balance_snapshots`

| 字段               | 类型                       | 说明                        |
| ------------------ | -------------------------- | --------------------------- |
| `id`               | `UUID` PK                  | 快照 ID                     |
| `account_id`       | `UUID` → `accounts.id`     | 关联账户                    |
| `captured_at`      | `TIMESTAMPTZ`              | 采集时间                    |
| `balance_units`    | `NUMERIC(20,8)`            | 剩余积分/额度               |
| `unit_name`        | `TEXT`                     | 单位名称                    |
| `currency`         | `TEXT` nullable            | 若余额以货币表示            |
| `confidence_level` | `TEXT`                     | 数据可信度                  |
| `data_source`      | `TEXT`                     | `manual` / `import` / `api` |
| `notes`            | `TEXT`                     | 备注                        |
| `metadata`         | `JSONB`                    | 扩展                        |
| `created_at`       | `TIMESTAMPTZ` 默认 `NOW()` | 记录时间                    |

> 平衡账户积分/额度的变化，辅助反推单位成本。

### 4. `usage_records` 扩展

新增字段：

| 字段               | 类型            | 说明                                  |
| ------------------ | --------------- | ------------------------------------- |
| `actual_cost`      | `NUMERIC(20,8)` | 实际成本（根据模式写入）              |
| `cost_source`      | `TEXT`          | `calculated` / `manual` / `estimated` |
| `billing_period`   | `VARCHAR(10)`   | `YYYY-MM` 或 `YYYY-QQ`                |
| `confidence_level` | `TEXT`          | `high` / `medium` / `low`             |

并为 `billing_period`、`cost_source` 建立索引，方便聚合。

## 服务层改动

1. **成本配置接口**：`accountCostService`（新增）负责读取/写入 `account_cost_profiles`、账单和余额。
2. **CostCalculator**：
   - 新增 `calculateActualCost(usage, model, profile)`，根据 `cost_tracking_mode` 决定路径。
   - 所有写入 `usage_records` 的入口（API Key Service、OpenAI 中转等）写回 `actual_cost` 与 `cost_source`。
3. **CostLearningService（预留）**：接入账单、余额与 usage 聚合，产出 `derivedRates`，更新 profile。

## 前端改动概览

- **账户详情**：展示成本模式、置信度、最新账单；支持切换模式与编辑 derivedRates。
- **成本录入**：新增账单录入表单（支持手动 / 导入 / 备注），展示历史账单列表。
- **仪表盘扩展**：在账户性价比分析中显示“估算 vs 实际”、置信度、上次账单时间。
- **告警提示**：若 `confidence_level` 为 `low` 或账单滞后，给出醒目提示。

## 实施阶段

1. **Phase 1（Week 1-2）**：数据迁移、成本模式配置、账单录入、CostCalculator 兼容、仪表盘基础。
2. **Phase 2（Week 3-6）**：导入工具、相对效率指标、异常告警、数据质量任务。
3. **Phase 3（Week 7-10）**：CostLearningService、预测/情景分析、治理流程。

## 后续注意事项

- 汇率、税费折扣等因素需要在账单数据中记录，以保证反推费率准确。
- 多币种、多产品账单可通过 `metadata` / 子表扩展，后期再细化。
- 成本数据需要审计与权限控制，避免误操作导致成本报表失真。
