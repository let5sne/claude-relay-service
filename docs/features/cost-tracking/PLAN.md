# 账户成本精确计算改进方案

## 背景与问题

### 当前架构分析

系统目前支持三种成本计算模式:

1. **标准计算模式** (`standard`): 基于模型定价表计算
2. **手动账单模式** (`manual_billing`): 基于实际账单反推成本率
3. **估算模式** (`estimated`): 基于相对效率系数估算

### 核心挑战

上游账户可能采用**不透明的计价方式**,包括:

- **积分制计费**: 使用积分而非直接货币计费
- **阶梯定价**: 根据用量区间采用不同价格
- **混合计费**: 同时按请求数、token数、积分等多维度计费
- **动态折扣**: 根据时间、用量等因素动态调整价格
- **打包套餐**: 固定费用包含一定用量
- **隐藏费用**: API调用费、数据传输费等额外成本

---

## 改进方案设计

### 🎯 目标

1. **提高准确性**: 支持多种不透明计价方式的精确建模
2. **增强可追溯性**: 记录成本来源和置信度
3. **支持验证**: 提供实际账单与计算成本的对比分析
4. **灵活扩展**: 易于适配新的计价模式

### 📊 多层次成本计算架构

```
┌─────────────────────────────────────────────────────────┐
│                    成本计算层次                          │
├─────────────────────────────────────────────────────────┤
│ L1: 实际账单数据 (最高优先级)                           │
│     - 真实账单金额                                       │
│     - 置信度: high                                       │
├─────────────────────────────────────────────────────────┤
│ L2: 账户级自定义计价规则                                │
│     - 手动配置的计费公式                                 │
│     - 置信度: medium-high                                │
├─────────────────────────────────────────────────────────┤
│ L3: 历史数据反推计价                                     │
│     - 基于历史账单自动推导                               │
│     - 置信度: medium                                     │
├─────────────────────────────────────────────────────────┤
│ L4: 标准模型定价                                         │
│     - 公开的模型价格表                                   │
│     - 置信度: low-medium                                 │
├─────────────────────────────────────────────────────────┤
│ L5: 相对效率估算                                         │
│     - 基于基准账户的相对系数                             │
│     - 置信度: low                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 详细改进措施

### 1️⃣ 扩展账户成本配置 (account_cost_profiles)

#### 新增字段

```sql
ALTER TABLE account_cost_profiles
  -- 计价公式配置
  ADD COLUMN IF NOT EXISTS pricing_formula JSONB DEFAULT '{}'::jsonb,

  -- 阶梯定价配置
  ADD COLUMN IF NOT EXISTS tiered_pricing JSONB DEFAULT '[]'::jsonb,

  -- 固定费用配置
  ADD COLUMN IF NOT EXISTS fixed_costs JSONB DEFAULT '{}'::jsonb,

  -- 积分换算配置
  ADD COLUMN IF NOT EXISTS point_conversion JSONB DEFAULT '{}'::jsonb,

  -- 历史推导的计价参数
  ADD COLUMN IF NOT EXISTS inferred_rates JSONB DEFAULT '{}'::jsonb,

  -- 推导置信度指标
  ADD COLUMN IF NOT EXISTS inference_quality JSONB DEFAULT '{}'::jsonb,

  -- 最后验证时间
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,

  -- 验证状态
  ADD COLUMN IF NOT EXISTS verification_status TEXT;
```

#### 配置示例

**积分制计费账户**:

```json
{
  "accountId": "account-123",
  "costTrackingMode": "manual_billing",
  "billingType": "point_based",
  "pointConversion": {
    "pointsPerRequest": 1,
    "pointsPerToken": 0.001,
    "costPerPoint": 0.01,
    "currency": "USD"
  },
  "derivedRates": {
    "costPerRequest": 0.01,
    "costPerToken": 0.00001
  },
  "confidenceLevel": "high"
}
```

**阶梯定价账户**:

```json
{
  "accountId": "account-456",
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
  "confidenceLevel": "medium"
}
```

**混合计费账户**:

```json
{
  "accountId": "account-789",
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
    "monthly_base": 50.0,
    "api_access_fee": 10.0
  },
  "confidenceLevel": "medium-high"
}
```

---

### 2️⃣ 增强成本计算逻辑

#### 新增计算方法

**文件**: `src/utils/costCalculator.js`

```javascript
/**
 * 计算阶梯定价成本
 */
static calculateTieredCost({ totalTokens, tieredPricing }) {
  let remainingTokens = totalTokens
  let totalCost = 0

  for (const tier of tieredPricing) {
    const tierMin = tier.minTokens
    const tierMax = tier.maxTokens || Infinity
    const tierSize = tierMax - tierMin

    if (remainingTokens <= 0) break

    const tokensInTier = Math.min(remainingTokens, tierSize)
    const tierCost = (tokensInTier / 1000000) * tier.costPerMillion

    totalCost += tierCost
    remainingTokens -= tokensInTier
  }

  return totalCost
}

/**
 * 计算积分制成本
 */
static calculatePointBasedCost({ usage, pointConversion }) {
  const { pointsPerRequest, pointsPerToken, costPerPoint } = pointConversion

  const totalTokens =
    (usage.input_tokens || 0) +
    (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0)

  const requests = usage.requests || 1

  let totalPoints = 0

  if (pointsPerRequest) {
    totalPoints += requests * pointsPerRequest
  }

  if (pointsPerToken) {
    totalPoints += totalTokens * pointsPerToken
  }

  return totalPoints * costPerPoint
}

/**
 * 计算混合计费成本
 */
static calculateHybridCost({ usage, pricingFormula }) {
  const { components } = pricingFormula
  let totalCost = 0

  for (const component of components) {
    let componentCost = 0

    switch (component.type) {
      case 'per_request':
        componentCost = (usage.requests || 1) * component.rate
        break
      case 'per_token':
        const totalTokens =
          (usage.input_tokens || 0) +
          (usage.output_tokens || 0) +
          (usage.cache_creation_input_tokens || 0) +
          (usage.cache_read_input_tokens || 0)
        componentCost = totalTokens * component.rate
        break
      case 'per_million_tokens':
        const totalTokensMillion =
          ((usage.input_tokens || 0) +
          (usage.output_tokens || 0) +
          (usage.cache_creation_input_tokens || 0) +
          (usage.cache_read_input_tokens || 0)) / 1000000
        componentCost = totalTokensMillion * component.rate
        break
    }

    totalCost += componentCost * (component.weight || 1)
  }

  return totalCost
}

/**
 * 增强的实际成本计算
 */
static calculateActualCost({ usage, model, fallback, profile }) {
  const defaultResult = {
    actualCost: fallback?.costs?.total ?? 0,
    costSource: 'calculated',
    confidenceLevel: fallback?.confidenceLevel || null,
    billingPeriod: this.getCurrentBillingPeriod(),
    calculationMethod: 'standard'
  }

  if (!profile) {
    return defaultResult
  }

  const trackingMode = profile.costTrackingMode || 'standard'
  const billingType = profile.billingType || 'standard'
  const confidenceLevel = profile.confidenceLevel || 'low'

  // 处理阶梯定价
  if (billingType === 'tiered' && profile.tieredPricing?.length > 0) {
    const totalTokens =
      (usage.input_tokens || 0) +
      (usage.output_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.cache_read_input_tokens || 0)

    const actualCost = this.calculateTieredCost({
      totalTokens,
      tieredPricing: profile.tieredPricing
    })

    return {
      actualCost,
      costSource: 'manual',
      confidenceLevel,
      billingPeriod: this.getCurrentBillingPeriod(),
      calculationMethod: 'tiered_pricing'
    }
  }

  // 处理积分制计费
  if (billingType === 'point_based' && profile.pointConversion) {
    const actualCost = this.calculatePointBasedCost({
      usage,
      pointConversion: profile.pointConversion
    })

    return {
      actualCost,
      costSource: 'manual',
      confidenceLevel,
      billingPeriod: this.getCurrentBillingPeriod(),
      calculationMethod: 'point_based'
    }
  }

  // 处理混合计费
  if (billingType === 'hybrid' && profile.pricingFormula) {
    const actualCost = this.calculateHybridCost({
      usage,
      pricingFormula: profile.pricingFormula
    })

    // 添加固定费用(按比例分摊到每个请求)
    if (profile.fixedCosts && profile.metadata?.estimatedMonthlyRequests) {
      const fixedCostPerRequest =
        Object.values(profile.fixedCosts).reduce((sum, cost) => sum + cost, 0) /
        profile.metadata.estimatedMonthlyRequests
      actualCost += fixedCostPerRequest
    }

    return {
      actualCost,
      costSource: 'manual',
      confidenceLevel,
      billingPeriod: this.getCurrentBillingPeriod(),
      calculationMethod: 'hybrid'
    }
  }

  // 回退到原有逻辑
  // ... (保留现有的 manual_billing, estimated 等逻辑)
}
```

---

### 3️⃣ 账单验证与成本推导

#### 新增服务: `costInferenceService.js`

```javascript
/**
 * 基于历史账单自动推导计价参数
 */
async function inferPricingFromBills(accountId) {
  // 1. 获取历史账单数据
  const bills = await costTrackingService.listAccountBills(accountId, {
    limit: 12 // 最近12个月
  })

  if (bills.length < 3) {
    return {
      success: false,
      reason: 'insufficient_data',
      message: '需要至少3个月的账单数据'
    }
  }

  // 2. 获取对应时期的使用量数据
  const usageData = await getUsageDataForBillingPeriods(accountId, bills)

  // 3. 分析计费模式
  const billingPattern = analyzeBillingPattern(bills, usageData)

  // 4. 推导计价参数
  const inferredRates = deriveRates(billingPattern, usageData)

  // 5. 计算推导质量指标
  const quality = calculateInferenceQuality(bills, usageData, inferredRates)

  return {
    success: true,
    billingType: billingPattern.type,
    inferredRates,
    quality,
    confidenceLevel: quality.score > 0.9 ? 'high' : quality.score > 0.7 ? 'medium' : 'low'
  }
}

/**
 * 验证计算成本与实际账单的偏差
 */
async function validateCostAccuracy(accountId, billingPeriod) {
  // 1. 获取该周期的实际账单
  const bill = await getAccountBillForPeriod(accountId, billingPeriod)

  if (!bill) {
    return {
      validated: false,
      reason: 'no_bill_data'
    }
  }

  // 2. 获取该周期的计算成本总和
  const calculatedCost = await getCalculatedCostForPeriod(accountId, billingPeriod)

  // 3. 计算偏差
  const deviation = Math.abs(bill.totalAmount - calculatedCost) / bill.totalAmount
  const deviationPercent = deviation * 100

  // 4. 评估准确性
  const accuracy = {
    billAmount: bill.totalAmount,
    calculatedAmount: calculatedCost,
    deviation: deviationPercent,
    status:
      deviationPercent < 5
        ? 'excellent'
        : deviationPercent < 10
          ? 'good'
          : deviationPercent < 20
            ? 'acceptable'
            : 'poor'
  }

  return {
    validated: true,
    accuracy,
    needsAdjustment: deviationPercent > 10
  }
}
```

---

### 4️⃣ 成本追踪增强

#### 扩展 usage_records 表

```sql
ALTER TABLE usage_records
  -- 计算方法标识
  ADD COLUMN IF NOT EXISTS calculation_method TEXT,

  -- 计算详情(JSON格式,记录计算过程)
  ADD COLUMN IF NOT EXISTS calculation_details JSONB,

  -- 验证状态
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,

  -- 验证时间
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usage_records_calculation_method
  ON usage_records(calculation_method);

CREATE INDEX IF NOT EXISTS idx_usage_records_verified
  ON usage_records(verified);
```

#### 记录详细计算信息

```javascript
// 在保存 usage_record 时记录详细信息
const usageRecord = {
  // ... 现有字段
  actual_cost: actualCostResult.actualCost,
  cost_source: actualCostResult.costSource,
  billing_period: actualCostResult.billingPeriod,
  confidence_level: actualCostResult.confidenceLevel,
  calculation_method: actualCostResult.calculationMethod,
  calculation_details: {
    profile_used: profile
      ? {
          billing_type: profile.billingType,
          tracking_mode: profile.costTrackingMode
        }
      : null,
    pricing_data: {
      input_rate: costResult.pricing.input,
      output_rate: costResult.pricing.output,
      cache_write_rate: costResult.pricing.cacheWrite,
      cache_read_rate: costResult.pricing.cacheRead
    },
    token_breakdown: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache_create: usage.cache_creation_input_tokens,
      cache_read: usage.cache_read_input_tokens
    },
    cost_breakdown: {
      input_cost: costResult.costs.input,
      output_cost: costResult.costs.output,
      cache_write_cost: costResult.costs.cacheWrite,
      cache_read_cost: costResult.costs.cacheRead
    }
  }
}
```

---

### 5️⃣ 管理界面增强

#### 新增API端点

**文件**: `src/routes/admin.js`

```javascript
// 获取账户成本配置
router.get('/api/admin/accounts/:accountId/cost-profile', async (req, res) => {
  const { accountId } = req.params
  const profile = await costTrackingService.getAccountCostProfile(accountId)
  res.json({ profile })
})

// 更新账户成本配置
router.put('/api/admin/accounts/:accountId/cost-profile', async (req, res) => {
  const { accountId } = req.params
  const profile = req.body

  const result = await costTrackingService.upsertAccountCostProfile({
    accountId,
    ...profile
  })

  res.json({ success: true, profile: result })
})

// 推导计价参数
router.post('/api/admin/accounts/:accountId/infer-pricing', async (req, res) => {
  const { accountId } = req.params
  const result = await costInferenceService.inferPricingFromBills(accountId)
  res.json(result)
})

// 验证成本准确性
router.post('/api/admin/accounts/:accountId/validate-costs', async (req, res) => {
  const { accountId } = req.params
  const { billingPeriod } = req.body

  const result = await costInferenceService.validateCostAccuracy(accountId, billingPeriod)

  res.json(result)
})

// 录入账单数据
router.post('/api/admin/accounts/:accountId/bills', async (req, res) => {
  const { accountId } = req.params
  const billData = req.body

  const bill = await costTrackingService.createAccountBill({
    accountId,
    ...billData
  })

  res.json({ success: true, bill })
})

// 获取成本对比报告
router.get('/api/admin/accounts/:accountId/cost-comparison', async (req, res) => {
  const { accountId } = req.params
  const { startDate, endDate } = req.query

  const report = await costInferenceService.generateCostComparisonReport(
    accountId,
    startDate,
    endDate
  )

  res.json(report)
})
```

---

### 6️⃣ 仪表盘展示增强

#### 成本准确性指标

在账户性价比分析中新增:

```javascript
{
  costAccuracy: {
    confidenceLevel: 'high',        // 成本置信度
    calculationMethod: 'tiered_pricing',  // 计算方法
    lastVerified: '2025-01-15',     // 最后验证时间
    verificationStatus: 'excellent', // 验证状态
    deviation: 2.3,                 // 与实际账单偏差%
    needsReview: false              // 是否需要复核
  },
  billingInfo: {
    billingType: 'tiered',          // 计费类型
    hasCustomPricing: true,         // 是否有自定义定价
    lastBillAmount: 1234.56,        // 最近账单金额
    lastBillPeriod: '2025-01'       // 最近账单周期
  }
}
```

---

## 实施步骤

### Phase 1: 数据库扩展 (1-2天)

1. ✅ 执行数据库迁移脚本
2. ✅ 更新 repository 层代码
3. ✅ 添加数据验证逻辑

### Phase 2: 核心计算逻辑 (3-4天)

1. ✅ 实现阶梯定价计算
2. ✅ 实现积分制计费计算
3. ✅ 实现混合计费计算
4. ✅ 增强 `calculateActualCost` 方法
5. ✅ 添加单元测试

### Phase 3: 推导与验证 (3-4天)

1. ✅ 实现 `costInferenceService`
2. ✅ 实现账单验证逻辑
3. ✅ 实现成本对比报告
4. ✅ 添加集成测试

### Phase 4: API与界面 (2-3天)

1. ✅ 添加管理API端点
2. ✅ 更新仪表盘展示
3. ✅ 添加成本配置界面
4. ✅ 添加账单录入界面

### Phase 5: 测试与优化 (2-3天)

1. ✅ 端到端测试
2. ✅ 性能优化
3. ✅ 文档完善
4. ✅ 生产环境部署

**总计**: 11-16天

---

## 使用场景示例

### 场景1: 积分制账户配置

```bash
# 1. 录入账单数据
POST /api/admin/accounts/account-123/bills
{
  "billingPeriodStart": "2025-01-01",
  "billingPeriodEnd": "2025-01-31",
  "totalAmount": 500.00,
  "totalUnits": 50000,
  "unitName": "points",
  "confidenceLevel": "high",
  "dataSource": "official_bill"
}

# 2. 配置积分换算规则
PUT /api/admin/accounts/account-123/cost-profile
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

# 3. 验证成本准确性
POST /api/admin/accounts/account-123/validate-costs
{
  "billingPeriod": "2025-01"
}
```

### 场景2: 自动推导计价

```bash
# 1. 录入多个月的账单数据
# (重复录入3-12个月的账单)

# 2. 自动推导计价参数
POST /api/admin/accounts/account-456/infer-pricing

# 响应示例:
{
  "success": true,
  "billingType": "tiered",
  "inferredRates": {
    "tieredPricing": [
      { "minTokens": 0, "maxTokens": 1000000, "costPerMillion": 3.2 },
      { "minTokens": 1000001, "maxTokens": null, "costPerMillion": 2.5 }
    ]
  },
  "quality": {
    "score": 0.92,
    "r_squared": 0.89,
    "mean_absolute_error": 0.05
  },
  "confidenceLevel": "high"
}

# 3. 应用推导的配置
PUT /api/admin/accounts/account-456/cost-profile
{
  "costTrackingMode": "manual_billing",
  "billingType": "tiered",
  "tieredPricing": [...],
  "confidenceLevel": "high",
  "inferredRates": {...}
}
```

### 场景3: 成本对比分析

```bash
# 获取成本对比报告
GET /api/admin/accounts/account-789/cost-comparison?startDate=2024-07-01&endDate=2025-01-31

# 响应示例:
{
  "summary": {
    "totalBillAmount": 5432.10,
    "totalCalculatedCost": 5289.45,
    "deviation": 2.6,
    "status": "excellent"
  },
  "monthlyComparison": [
    {
      "period": "2024-07",
      "billAmount": 450.20,
      "calculatedCost": 445.30,
      "deviation": 1.1
    },
    // ...
  ],
  "recommendations": [
    "成本计算准确性良好,建议继续使用当前配置",
    "8月份偏差较大(5.2%),建议检查该月是否有特殊计费"
  ]
}
```

---

## 预期效果

### 准确性提升

- ✅ 支持积分制、阶梯定价等不透明计价方式
- ✅ 成本计算偏差从 20-30% 降低到 5% 以内
- ✅ 提供置信度评级,明确成本数据可靠性

### 可追溯性增强

- ✅ 记录详细的计算方法和参数
- ✅ 支持历史成本数据的审计和回溯
- ✅ 提供成本来源标识(calculated/manual/inferred)

### 运维便利性

- ✅ 自动推导计价参数,减少手动配置工作
- ✅ 账单验证功能,及时发现计价配置问题
- ✅ 成本对比报告,直观展示准确性

### 灵活性

- ✅ 易于扩展新的计费模式
- ✅ 支持多种计费方式的组合
- ✅ 可针对不同账户采用不同策略

---

## 风险与注意事项

### 数据隐私

- ⚠️ 账单数据可能包含敏感信息,需要严格的访问控制
- ⚠️ 计价参数可能涉及商业机密,需要加密存储

### 计算性能

- ⚠️ 复杂计费公式可能影响性能,需要缓存优化
- ⚠️ 历史数据推导需要大量计算,应异步执行

### 数据一致性

- ⚠️ 修改计价配置后,历史数据不会自动重算
- ⚠️ 需要提供批量重算功能(可选)

### 用户体验

- ⚠️ 配置界面需要清晰的说明和示例
- ⚠️ 推导结果需要人工审核确认

---

## 后续优化方向

### 短期 (1-3个月)

1. **机器学习增强**: 使用ML模型自动识别计费模式
2. **异常检测**: 自动检测成本异常波动
3. **预测分析**: 基于历史数据预测未来成本

### 中期 (3-6个月)

1. **多币种支持**: 支持不同货币的汇率转换
2. **成本归因**: 细化到API Key、用户、项目维度
3. **预算管理**: 设置预算阈值和告警

### 长期 (6-12个月)

1. **智能优化建议**: 基于成本分析提供优化建议
2. **成本预测模型**: 更精确的成本预测和规划
3. **自动化对账**: 与上游账单系统自动对账

---

## 总结

本改进方案通过**多层次成本计算架构**、**灵活的计价配置**、**自动推导与验证机制**,显著提升了系统对不透明计价方式的支持能力。核心优势包括:

1. **高准确性**: 支持多种复杂计费模式的精确建模
2. **强可追溯**: 完整记录成本计算过程和来源
3. **易维护**: 自动推导减少手动配置工作量
4. **可验证**: 账单对比功能确保计算准确性

通过分阶段实施,可以在 2-3 周内完成核心功能,并持续优化迭代。
