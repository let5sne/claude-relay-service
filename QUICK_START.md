# 🚀 成本精确计算功能 - 快速开始

## 恭喜！迁移已成功完成 ✅

数据库迁移已于 **2025-10-01 02:47** 成功执行。现在您可以开始使用新的成本追踪功能了！

## 立即开始

### 场景1: 配置积分制账户 (5分钟)

假设您有一个上游账户使用积分计费：

- 每个请求消耗 1 积分
- 每 1000 tokens 消耗 1 积分
- 每个积分价值 $0.01

```bash
# 1. 配置账户
curl -X PUT http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/cost-profile \
  -H "Content-Type: application/json" \
  -d '{
    "billingType": "point_based",
    "costTrackingMode": "manual_billing",
    "pointConversion": {
      "pointsPerRequest": 1,
      "pointsPerToken": 0.001,
      "costPerPoint": 0.01
    },
    "confidenceLevel": "high",
    "notes": "积分制计费配置"
  }'

# 2. 录入一个月的账单
curl -X POST http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/bills \
  -H "Content-Type: application/json" \
  -d '{
    "billingPeriodStart": "2025-09-01",
    "billingPeriodEnd": "2025-09-30",
    "totalAmount": 500.00,
    "currency": "USD",
    "totalUnits": 50000,
    "unitName": "points",
    "confidenceLevel": "high",
    "dataSource": "official_bill"
  }'

# 3. 验证成本准确性
curl -X POST http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/validate-costs \
  -H "Content-Type: application/json" \
  -d '{"billingPeriod": "2025-09"}'
```

### 场景2: 配置阶梯定价账户 (5分钟)

假设您的账户使用阶梯定价：

- 0-1M tokens: $3.0/M
- 1M-10M tokens: $2.5/M
- 10M+ tokens: $2.0/M

```bash
# 配置阶梯定价
curl -X PUT http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/cost-profile \
  -H "Content-Type: application/json" \
  -d '{
    "billingType": "tiered",
    "costTrackingMode": "manual_billing",
    "tieredPricing": [
      {"minTokens": 0, "maxTokens": 1000000, "costPerMillion": 3.0},
      {"minTokens": 1000001, "maxTokens": 10000000, "costPerMillion": 2.5},
      {"minTokens": 10000001, "maxTokens": null, "costPerMillion": 2.0}
    ],
    "confidenceLevel": "high",
    "notes": "阶梯定价配置"
  }'
```

### 场景3: 自动推导计价参数 (10分钟)

如果您有3个月以上的历史账单数据：

```bash
# 1. 先录入多个月的账单（重复执行，修改日期和金额）
curl -X POST http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/bills \
  -H "Content-Type: application/json" \
  -d '{
    "billingPeriodStart": "2025-07-01",
    "billingPeriodEnd": "2025-07-31",
    "totalAmount": 450.20,
    "currency": "USD"
  }'

# 2. 自动推导计价参数
curl -X POST http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/infer-pricing

# 3. 查看推导结果（会返回建议的配置）
# 根据返回的 inferredRates 手动应用配置
```

## 查看结果

### 获取账户成本配置

```bash
curl http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/cost-profile
```

### 获取账单列表

```bash
curl http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/bills
```

### 生成成本对比报告

```bash
curl "http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/cost-comparison?startDate=2025-07-01&endDate=2025-09-30"
```

## 在代码中使用

### Node.js 示例

```javascript
const costTrackingService = require('./src/services/costTrackingService')
const CostCalculator = require('./src/utils/costCalculator')

// 1. 获取账户成本配置
const profile = await costTrackingService.getAccountCostProfile(accountId)

// 2. 计算实际成本
const usage = {
  input_tokens: 1000,
  output_tokens: 500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  requests: 1
}

const costResult = CostCalculator.calculateCost(usage, 'claude-3-5-sonnet-20241022')
const actualCostResult = CostCalculator.calculateActualCost({
  usage,
  model: 'claude-3-5-sonnet-20241022',
  fallback: costResult,
  profile
})

console.log('标准成本:', costResult.costs.total)
console.log('实际成本:', actualCostResult.actualCost)
console.log('计算方法:', actualCostResult.calculationMethod)
console.log('置信度:', actualCostResult.confidenceLevel)
```

## 数据库查询示例

### 查看成本准确性概览

```sql
-- 在 Docker 中执行
docker exec postgres13 psql -U claude -d crs -c "
SELECT * FROM v_account_cost_accuracy;
"
```

### 查看验证历史

```sql
docker exec postgres13 psql -U claude -d crs -c "
SELECT
  billing_period,
  bill_amount,
  calculated_cost,
  deviation_percent,
  validation_status
FROM cost_validation_history
WHERE account_id = 'YOUR_ACCOUNT_ID'
ORDER BY created_at DESC
LIMIT 10;
"
```

### 查看推导历史

```sql
docker exec postgres13 psql -U claude -d crs -c "
SELECT
  inferred_billing_type,
  quality_score,
  confidence_level,
  created_at
FROM pricing_inference_history
WHERE account_id = 'YOUR_ACCOUNT_ID'
ORDER BY created_at DESC
LIMIT 5;
"
```

## 常见问题

### Q1: 如何找到我的账户ID？

```bash
# 查看所有账户
docker exec postgres13 psql -U claude -d crs -c "SELECT id, name, type FROM accounts;"
```

### Q2: 如何修改已有的配置？

直接使用 PUT 请求更新配置，系统会自动合并：

```bash
curl -X PUT http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/cost-profile \
  -H "Content-Type: application/json" \
  -d '{
    "confidenceLevel": "medium",
    "notes": "更新配置"
  }'
```

### Q3: 如何查看成本计算是否生效？

查看 usage_records 表的 calculation_method 字段：

```sql
docker exec postgres13 psql -U claude -d crs -c "
SELECT
  created_at,
  model,
  total_cost,
  actual_cost,
  calculation_method,
  confidence_level
FROM usage_records
WHERE account_id = 'YOUR_ACCOUNT_ID'
ORDER BY created_at DESC
LIMIT 10;
"
```

### Q4: 成本偏差太大怎么办？

1. 检查配置是否正确
2. 确认是否有隐藏费用（固定月费等）
3. 尝试使用自动推导功能
4. 查看验证报告中的建议

## 监控建议

### 设置定期验证

建议每月验证一次成本准确性：

```bash
# 添加到 crontab
0 0 1 * * curl -X POST http://localhost:3000/api/admin/accounts/YOUR_ACCOUNT_ID/validate-costs \
  -H "Content-Type: application/json" \
  -d "{\"billingPeriod\": \"$(date -d 'last month' +%Y-%m)\"}"
```

### 查看成本趋势

```sql
docker exec postgres13 psql -U claude -d crs -c "
SELECT
  billing_period,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(COALESCE(actual_cost, total_cost)) as total_cost,
  AVG(COALESCE(actual_cost, total_cost)) as avg_cost_per_request
FROM usage_records
WHERE account_id = 'YOUR_ACCOUNT_ID'
  AND billing_period >= '2025-07'
GROUP BY billing_period
ORDER BY billing_period;
"
```

## 完整文档

- 📖 [详细设计方案](./ACCURATE_COST_CALCULATION_PLAN.md)
- 📘 [快速入门指南](./docs/COST_TRACKING_GUIDE.md)
- 💻 [代码示例](./examples/cost_tracking_examples.js)
- 🐳 [Docker 迁移指南](./DOCKER_MIGRATION_GUIDE.md)
- ✅ [实施清单](./IMPLEMENTATION_CHECKLIST.md)
- 📊 [迁移成功报告](./MIGRATION_SUCCESS_REPORT.md)

## 获取帮助

1. 查看应用日志
2. 查看数据库日志: `docker logs postgres13`
3. 参考完整文档
4. 提交 Issue

---

**祝您使用愉快！** 🎉

如有任何问题，请随时查阅文档或寻求帮助。
