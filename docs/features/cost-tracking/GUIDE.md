# 成本追踪快速入门指南

## 概述

本指南介绍如何使用增强的成本追踪功能,准确计算采用不透明计价方式的上游账户成本。

## 支持的计价方式

### 1. 标准计价 (Standard)

基于公开的模型价格表计算,适用于透明定价的账户。

### 2. 积分制计费 (Point-Based)

上游使用积分而非直接货币计费。

**适用场景**:

- 每个请求消耗固定积分
- 每个token消耗固定积分
- 积分与货币有固定兑换率

### 3. 阶梯定价 (Tiered)

根据用量区间采用不同价格。

**适用场景**:

- 月度用量越大,单价越低
- 不同用量档位有不同价格

### 4. 混合计费 (Hybrid)

同时按多个维度计费。

**适用场景**:

- 部分按请求数计费,部分按token数计费
- 包含固定月费
- 多种计费方式组合

### 5. 估算模式 (Estimated)

基于相对效率系数估算。

**适用场景**:

- 无法获取准确计价信息
- 基于基准账户进行估算

## 快速开始

### 步骤1: 录入账单数据

首先录入实际账单数据,用于后续验证和推导。

```bash
POST /api/admin/accounts/{accountId}/bills
Content-Type: application/json

{
  "billingPeriodStart": "2025-01-01",
  "billingPeriodEnd": "2025-01-31",
  "totalAmount": 500.00,
  "currency": "USD",
  "totalUnits": 50000,
  "unitName": "points",
  "confidenceLevel": "high",
  "dataSource": "official_bill",
  "notes": "2025年1月账单"
}
```

### 步骤2: 配置计价规则

根据上游账户的计价方式,选择合适的配置。

#### 配置积分制账户

```bash
PUT /api/admin/accounts/{accountId}/cost-profile
Content-Type: application/json

{
  "costTrackingMode": "manual_billing",
  "billingType": "point_based",
  "pointConversion": {
    "pointsPerRequest": 1,
    "pointsPerToken": 0.001,
    "costPerPoint": 0.01
  },
  "confidenceLevel": "high"
}
```

#### 配置阶梯定价账户

```bash
PUT /api/admin/accounts/{accountId}/cost-profile
Content-Type: application/json

{
  "costTrackingMode": "manual_billing",
  "billingType": "tiered",
  "tieredPricing": [
    {
      "minTokens": 0,
      "maxTokens": 1000000,
      "costPerMillion": 3.0
    },
    {
      "minTokens": 1000001,
      "maxTokens": 10000000,
      "costPerMillion": 2.5
    },
    {
      "minTokens": 10000001,
      "maxTokens": null,
      "costPerMillion": 2.0
    }
  ],
  "confidenceLevel": "high"
}
```

#### 配置混合计费账户

```bash
PUT /api/admin/accounts/{accountId}/cost-profile
Content-Type: application/json

{
  "costTrackingMode": "manual_billing",
  "billingType": "hybrid",
  "pricingFormula": {
    "type": "composite",
    "components": [
      {
        "type": "per_request",
        "rate": 0.002,
        "weight": 0.3
      },
      {
        "type": "per_token",
        "rate": 0.000003,
        "weight": 0.7
      }
    ]
  },
  "fixedCosts": {
    "monthly_base": 50.0
  },
  "confidenceLevel": "medium-high",
  "metadata": {
    "estimatedMonthlyRequests": 10000
  }
}
```

### 步骤3: 验证成本准确性

配置完成后,验证计算成本与实际账单的偏差。

```bash
POST /api/admin/accounts/{accountId}/validate-costs
Content-Type: application/json

{
  "billingPeriod": "2025-01"
}
```

**响应示例**:

```json
{
  "validated": true,
  "accuracy": {
    "billAmount": 500.0,
    "calculatedAmount": 488.5,
    "deviation": 2.3,
    "status": "excellent"
  },
  "needsAdjustment": false
}
```

### 步骤4: 自动推导计价参数(可选)

如果有3个月以上的历史账单数据,可以尝试自动推导计价参数。

```bash
POST /api/admin/accounts/{accountId}/infer-pricing
```

**响应示例**:

```json
{
  "success": true,
  "billingType": "tiered",
  "inferredRates": {
    "tieredPricing": [
      {
        "minTokens": 0,
        "maxTokens": 1000000,
        "costPerMillion": 3.2
      }
    ]
  },
  "quality": {
    "score": 0.92,
    "meanAbsoluteError": 0.05
  },
  "confidenceLevel": "high"
}
```

## 置信度说明

系统使用置信度来标识成本数据的可靠性:

- **high**: 基于官方账单或文档配置,偏差<5%
- **medium-high**: 基于可靠数据推导,偏差5-10%
- **medium**: 基于历史数据推导,偏差10-15%
- **low**: 基于估算或不完整数据,偏差>15%

## 验证状态说明

- **excellent**: 偏差<5%,计算非常准确
- **good**: 偏差5-10%,计算准确性良好
- **acceptable**: 偏差10-20%,可接受但建议优化
- **poor**: 偏差>20%,需要重新配置
- **unverified**: 未验证

## 最佳实践

### 1. 定期录入账单

建议每月录入实际账单数据,用于:

- 验证成本计算准确性
- 及时发现计价变化
- 提供推导数据基础

### 2. 设置合理的置信度

根据数据来源设置置信度:

- 官方文档/账单 → high
- 客服确认 → medium-high
- 自行测试 → medium
- 估算 → low

### 3. 定期验证

建议每月验证一次成本准确性:

- 偏差<5%: 继续使用当前配置
- 偏差5-10%: 考虑微调参数
- 偏差>10%: 重新配置或推导

### 4. 记录详细信息

在配置中记录:

- 数据来源(官方文档/客服/测试)
- 配置时间
- 特殊说明
- 复核时间

### 5. 使用自动推导

如果有足够的历史数据(≥3个月):

1. 先尝试自动推导
2. 检查推导质量
3. 人工审核确认
4. 应用配置
5. 持续验证

## 常见问题

### Q1: 如何处理计价规则变化?

**A**: 上游计价规则变化时:

1. 更新 `account_cost_profiles` 配置
2. 在 `notes` 中记录变更时间和原因
3. 重新验证成本准确性
4. 历史数据保持不变(除非需要重算)

### Q2: 偏差较大怎么办?

**A**: 如果验证偏差>10%:

1. 检查配置是否正确
2. 确认是否有隐藏费用(API调用费、数据传输费等)
3. 检查是否有特殊计费规则(节假日、促销等)
4. 考虑使用混合计费模式
5. 联系上游确认计价细节

### Q3: 如何处理固定费用?

**A**: 固定费用(月费、年费)处理方式:

1. 在 `fixedCosts` 中配置固定费用
2. 在 `metadata.estimatedMonthlyRequests` 中设置预估月度请求数
3. 系统会自动将固定费用分摊到每个请求

### Q4: 可以同时使用多种计价方式吗?

**A**: 可以,使用混合计费模式:

- 配置 `billingType: "hybrid"`
- 在 `pricingFormula.components` 中定义多个计费维度
- 设置每个维度的权重

### Q5: 历史数据会自动重算吗?

**A**: 不会自动重算。修改配置后:

- 新的请求使用新配置计算
- 历史数据保持不变
- 如需重算,需要手动触发(功能待开发)

## 监控与告警

### 查看成本准确性概览

```bash
GET /api/admin/accounts/{accountId}/cost-profile
```

返回包含:

- 当前配置
- 最近验证结果
- 置信度
- 验证状态

### 生成成本对比报告

```bash
GET /api/admin/accounts/{accountId}/cost-comparison?startDate=2024-07-01&endDate=2025-01-31
```

返回:

- 月度账单vs计算成本对比
- 总体偏差统计
- 优化建议

### 设置告警(待开发)

未来将支持:

- 偏差超过阈值时告警
- 计价规则变化检测
- 异常成本波动告警

## 数据库查询示例

### 查询账户成本配置

```sql
SELECT * FROM account_cost_profiles
WHERE account_id = 'account-123';
```

### 查询成本验证历史

```sql
SELECT * FROM cost_validation_history
WHERE account_id = 'account-123'
ORDER BY created_at DESC
LIMIT 10;
```

### 查询计价推导历史

```sql
SELECT * FROM pricing_inference_history
WHERE account_id = 'account-123'
ORDER BY created_at DESC
LIMIT 10;
```

### 查询账户成本准确性概览

```sql
SELECT * FROM v_account_cost_accuracy
WHERE account_id = 'account-123';
```

## 进阶用法

### 使用计算详情进行调试

每条 `usage_records` 都包含 `calculation_details` 字段,记录了详细的计算过程:

```sql
SELECT
  id,
  created_at,
  calculation_method,
  actual_cost,
  calculation_details
FROM usage_records
WHERE account_id = 'account-123'
  AND created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;
```

### 批量验证多个账户

```sql
SELECT
  account_id,
  account_name,
  verification_status,
  (latest_validation->>'deviation_percent')::numeric as deviation_percent,
  last_verified_at
FROM v_account_cost_accuracy
WHERE verification_status IN ('poor', 'unverified')
ORDER BY last_verified_at ASC NULLS FIRST;
```

### 分析成本趋势

```sql
SELECT
  billing_period,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(COALESCE(actual_cost, total_cost)) as total_cost,
  AVG(COALESCE(actual_cost, total_cost)) as avg_cost_per_request
FROM usage_records
WHERE account_id = 'account-123'
  AND billing_period >= '2024-07'
GROUP BY billing_period
ORDER BY billing_period;
```

## 技术支持

如有问题,请:

1. 查看 `ACCURATE_COST_CALCULATION_PLAN.md` 了解详细设计
2. 查看 `examples/cost_tracking_examples.js` 了解代码示例
3. 查看日志中的 `calculation_details` 进行调试
4. 提交 Issue 或联系技术支持

## 更新日志

- **2025-01-15**: 初始版本,支持积分制、阶梯定价、混合计费
- 后续版本将支持更多功能(机器学习推导、自动告警等)
