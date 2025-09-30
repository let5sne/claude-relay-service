/**
 * 成本追踪功能使用示例
 *
 * 本文件展示如何使用增强的成本追踪功能来处理不透明计价方式
 */

const costTrackingService = require('../src/services/costTrackingService')
const CostCalculator = require('../src/utils/costCalculator')

// ============================================================================
// 示例 1: 配置积分制计费账户
// ============================================================================

async function example1_configurePointBasedAccount() {
  console.log('\n=== 示例 1: 配置积分制计费账户 ===\n')

  const accountId = 'account-123'

  // 场景: 上游账户使用积分计费
  // - 每个请求消耗 1 积分
  // - 每 1000 tokens 消耗 1 积分
  // - 每个积分价值 $0.01

  const profile = {
    accountId,
    billingType: 'point_based',
    costTrackingMode: 'manual_billing',
    currency: 'USD',

    // 积分换算规则
    pointConversion: {
      pointsPerRequest: 1,
      pointsPerToken: 0.001,
      costPerPoint: 0.01
    },

    // 衍生的费率(用于快速计算)
    derivedRates: {
      costPerRequest: 0.01, // 1 point * $0.01
      costPerToken: 0.00001 // 0.001 point * $0.01
    },

    confidenceLevel: 'high',
    notes: '积分制计费,根据官方文档配置',
    metadata: {
      source: 'official_documentation',
      configuredAt: new Date().toISOString()
    }
  }

  const result = await costTrackingService.upsertAccountCostProfile(profile)
  console.log('✅ 积分制账户配置成功:', result)

  // 测试计算
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
    profile: result
  })

  console.log('\n计算结果:')
  console.log('- 标准定价成本:', costResult.costs.total)
  console.log('- 实际积分成本:', actualCostResult.actualCost)
  console.log('- 计算方法:', actualCostResult.calculationMethod)
  console.log('- 置信度:', actualCostResult.confidenceLevel)
}

// ============================================================================
// 示例 2: 配置阶梯定价账户
// ============================================================================

async function example2_configureTieredPricingAccount() {
  console.log('\n=== 示例 2: 配置阶梯定价账户 ===\n')

  const accountId = 'account-456'

  // 场景: 上游账户使用阶梯定价
  // - 0-1M tokens: $3.0/M
  // - 1M-10M tokens: $2.5/M
  // - 10M+ tokens: $2.0/M

  const profile = {
    accountId,
    billingType: 'tiered',
    costTrackingMode: 'manual_billing',
    currency: 'USD',

    // 阶梯定价配置
    tieredPricing: [
      {
        minTokens: 0,
        maxTokens: 1000000,
        costPerMillion: 3.0
      },
      {
        minTokens: 1000001,
        maxTokens: 10000000,
        costPerMillion: 2.5
      },
      {
        minTokens: 10000001,
        maxTokens: null, // 无上限
        costPerMillion: 2.0
      }
    ],

    confidenceLevel: 'high',
    notes: '阶梯定价,根据月度用量累计计算',
    metadata: {
      pricingEffectiveDate: '2025-01-01',
      reviewDate: '2025-07-01'
    }
  }

  const result = await costTrackingService.upsertAccountCostProfile(profile)
  console.log('✅ 阶梯定价账户配置成功:', result)

  // 测试不同用量的计算
  const testCases = [
    { tokens: 500000, desc: '低用量(第一档)' },
    { tokens: 5000000, desc: '中用量(第二档)' },
    { tokens: 15000000, desc: '高用量(第三档)' }
  ]

  console.log('\n不同用量的成本计算:')
  for (const testCase of testCases) {
    const cost = CostCalculator.calculateTieredCost({
      totalTokens: testCase.tokens,
      tieredPricing: profile.tieredPricing
    })
    console.log(
      `- ${testCase.desc} (${testCase.tokens.toLocaleString()} tokens): $${cost.toFixed(4)}`
    )
  }
}

// ============================================================================
// 示例 3: 配置混合计费账户
// ============================================================================

async function example3_configureHybridBillingAccount() {
  console.log('\n=== 示例 3: 配置混合计费账户 ===\n')

  const accountId = 'account-789'

  // 场景: 上游账户使用混合计费
  // - 30% 按请求数计费: $0.002/请求
  // - 70% 按token数计费: $0.000003/token
  // - 固定月费: $50

  const profile = {
    accountId,
    billingType: 'hybrid',
    costTrackingMode: 'manual_billing',
    currency: 'USD',

    // 混合计费公式
    pricingFormula: {
      type: 'composite',
      components: [
        {
          type: 'per_request',
          rate: 0.002,
          weight: 0.3,
          description: '请求计费部分'
        },
        {
          type: 'per_token',
          rate: 0.000003,
          weight: 0.7,
          description: 'Token计费部分'
        }
      ]
    },

    // 固定费用
    fixedCosts: {
      monthly_base: 50.0,
      api_access_fee: 10.0
    },

    confidenceLevel: 'medium-high',
    notes: '混合计费模式,包含固定月费',
    metadata: {
      estimatedMonthlyRequests: 10000, // 用于分摊固定费用
      contractType: 'enterprise',
      contractEndDate: '2025-12-31'
    }
  }

  const result = await costTrackingService.upsertAccountCostProfile(profile)
  console.log('✅ 混合计费账户配置成功:', result)

  // 测试计算
  const usage = {
    input_tokens: 5000,
    output_tokens: 2000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    requests: 1
  }

  const hybridCost = CostCalculator.calculateHybridCost({
    usage,
    pricingFormula: profile.pricingFormula
  })

  const fixedCostPerRequest =
    (profile.fixedCosts.monthly_base + profile.fixedCosts.api_access_fee) /
    profile.metadata.estimatedMonthlyRequests

  const totalCost = hybridCost + fixedCostPerRequest

  console.log('\n成本计算明细:')
  console.log('- 变动成本:', `$${hybridCost.toFixed(6)}`)
  console.log('- 固定成本分摊:', `$${fixedCostPerRequest.toFixed(6)}`)
  console.log('- 总成本:', `$${totalCost.toFixed(6)}`)
}

// ============================================================================
// 示例 4: 录入账单并验证成本准确性
// ============================================================================

async function example4_validateCostAccuracy() {
  console.log('\n=== 示例 4: 录入账单并验证成本准确性 ===\n')

  const accountId = 'account-123'

  // 1. 录入实际账单数据
  const bill = {
    accountId,
    billingPeriodStart: '2025-01-01',
    billingPeriodEnd: '2025-01-31',
    totalAmount: 456.78,
    currency: 'USD',
    totalUnits: 45678, // 积分数
    unitName: 'points',
    confidenceLevel: 'high',
    dataSource: 'official_bill',
    documentUrl: 'https://example.com/bills/2025-01.pdf',
    notes: '2025年1月账单',
    createdBy: 'admin',
    metadata: {
      invoiceNumber: 'INV-2025-01-001',
      paymentStatus: 'paid'
    }
  }

  const billResult = await costTrackingService.createAccountBill(bill)
  console.log('✅ 账单录入成功:', billResult.id)

  // 2. 获取该周期的计算成本
  // (这里需要从数据库查询,示例中简化处理)
  const calculatedCost = 445.3 // 假设从 usage_records 汇总得到

  // 3. 计算偏差
  const deviation = Math.abs(bill.totalAmount - calculatedCost) / bill.totalAmount
  const deviationPercent = deviation * 100

  const validationStatus =
    deviationPercent < 5
      ? 'excellent'
      : deviationPercent < 10
        ? 'good'
        : deviationPercent < 20
          ? 'acceptable'
          : 'poor'

  console.log('\n成本验证结果:')
  console.log('- 账单金额:', `$${bill.totalAmount}`)
  console.log('- 计算成本:', `$${calculatedCost}`)
  console.log('- 偏差:', `${deviationPercent.toFixed(2)}%`)
  console.log('- 状态:', validationStatus)

  // 4. 更新账户配置的验证状态
  await costTrackingService.upsertAccountCostProfile({
    accountId,
    verificationStatus: validationStatus,
    lastVerifiedAt: new Date()
  })

  console.log('✅ 验证状态已更新')
}

// ============================================================================
// 示例 5: 自动推导计价参数
// ============================================================================

async function example5_inferPricingFromBills() {
  console.log('\n=== 示例 5: 自动推导计价参数 ===\n')

  const accountId = 'account-456'

  // 场景: 已录入多个月的账单数据,尝试自动推导计价规则

  // 1. 获取历史账单
  const bills = await costTrackingService.listAccountBills(accountId, {
    limit: 12
  })

  console.log(`📊 找到 ${bills.length} 个历史账单`)

  if (bills.length < 3) {
    console.log('⚠️  账单数据不足,需要至少3个月的数据')
    return
  }

  // 2. 获取对应时期的使用量数据
  // (这里需要从 usage_records 查询,示例中简化)
  const usageData = [
    { period: '2024-10', totalTokens: 2500000, totalCost: 7500 },
    { period: '2024-11', totalTokens: 3200000, totalCost: 9100 },
    { period: '2024-12', totalTokens: 4100000, totalCost: 11050 }
  ]

  // 3. 简单的线性回归推导
  // 假设: cost = a * tokens + b

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0
  const n = usageData.length

  for (const data of usageData) {
    sumX += data.totalTokens
    sumY += data.totalCost
    sumXY += data.totalTokens * data.totalCost
    sumX2 += data.totalTokens * data.totalTokens
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const costPerToken = slope
  const costPerMillion = costPerToken * 1000000
  const fixedCostPerMonth = intercept

  console.log('\n📈 推导结果:')
  console.log('- 每百万token成本:', `$${costPerMillion.toFixed(2)}`)
  console.log('- 固定月费:', `$${fixedCostPerMonth.toFixed(2)}`)

  // 4. 计算推导质量
  let totalError = 0
  for (const data of usageData) {
    const predicted = slope * data.totalTokens + intercept
    const error = Math.abs(predicted - data.totalCost) / data.totalCost
    totalError += error
  }
  const meanError = totalError / n
  const qualityScore = 1 - meanError

  console.log('- 平均误差:', `${(meanError * 100).toFixed(2)}%`)
  console.log('- 质量评分:', qualityScore.toFixed(3))

  const confidenceLevel = qualityScore > 0.9 ? 'high' : qualityScore > 0.7 ? 'medium' : 'low'

  console.log('- 置信度:', confidenceLevel)

  // 5. 应用推导的配置
  if (qualityScore > 0.7) {
    const profile = {
      accountId,
      billingType: 'standard',
      costTrackingMode: 'manual_billing',
      derivedRates: {
        costPerMillion: costPerMillion,
        costPerToken: costPerToken
      },
      inferredRates: {
        costPerMillion: costPerMillion,
        fixedCostPerMonth: fixedCostPerMonth,
        inferredAt: new Date().toISOString(),
        dataPoints: n
      },
      inferenceQuality: {
        score: qualityScore,
        meanAbsoluteError: meanError,
        method: 'linear_regression'
      },
      confidenceLevel,
      notes: '基于历史账单自动推导的计价参数'
    }

    await costTrackingService.upsertAccountCostProfile(profile)
    console.log('\n✅ 推导的计价参数已应用')
  } else {
    console.log('\n⚠️  推导质量不足,建议手动配置')
  }
}

// ============================================================================
// 示例 6: 生成成本对比报告
// ============================================================================

async function example6_generateCostComparisonReport() {
  console.log('\n=== 示例 6: 生成成本对比报告 ===\n')

  const accountId = 'account-123'
  const startDate = '2024-07-01'
  const endDate = '2025-01-31'

  // 1. 获取账单数据
  const bills = await costTrackingService.listAccountBills(accountId, {
    startDate,
    endDate
  })

  // 2. 获取计算成本数据
  // (这里需要从 usage_records 查询,示例中简化)
  const monthlyData = [
    { period: '2024-07', bill: 450.2, calculated: 445.3 },
    { period: '2024-08', bill: 523.45, calculated: 550.12 },
    { period: '2024-09', bill: 489.3, calculated: 485.67 },
    { period: '2024-10', bill: 512.8, calculated: 508.45 },
    { period: '2024-11', bill: 545.6, calculated: 542.33 },
    { period: '2024-12', bill: 578.9, calculated: 575.2 },
    { period: '2025-01', bill: 601.25, calculated: 598.45 }
  ]

  // 3. 计算统计数据
  let totalBill = 0
  let totalCalculated = 0
  let totalDeviation = 0

  console.log('\n📊 月度成本对比:')
  console.log('期间 | 账单金额 | 计算成本 | 偏差')
  console.log('-----|----------|----------|------')

  for (const data of monthlyData) {
    const deviation = (Math.abs(data.bill - data.calculated) / data.bill) * 100
    totalBill += data.bill
    totalCalculated += data.calculated
    totalDeviation += deviation

    console.log(
      `${data.period} | $${data.bill.toFixed(2)} | $${data.calculated.toFixed(2)} | ${deviation.toFixed(2)}%`
    )
  }

  const avgDeviation = totalDeviation / monthlyData.length
  const overallDeviation = (Math.abs(totalBill - totalCalculated) / totalBill) * 100

  console.log('\n📈 汇总统计:')
  console.log('- 总账单金额:', `$${totalBill.toFixed(2)}`)
  console.log('- 总计算成本:', `$${totalCalculated.toFixed(2)}`)
  console.log('- 平均月度偏差:', `${avgDeviation.toFixed(2)}%`)
  console.log('- 总体偏差:', `${overallDeviation.toFixed(2)}%`)

  const status =
    overallDeviation < 5
      ? 'excellent'
      : overallDeviation < 10
        ? 'good'
        : overallDeviation < 20
          ? 'acceptable'
          : 'poor'

  console.log('- 准确性评级:', status)

  // 4. 生成建议
  console.log('\n💡 优化建议:')

  if (status === 'excellent') {
    console.log('- 成本计算准确性优秀,建议继续使用当前配置')
  } else if (status === 'good') {
    console.log('- 成本计算准确性良好,可以考虑微调计价参数')
  } else {
    console.log('- 成本计算偏差较大,建议:')
    console.log('  1. 检查计价配置是否正确')
    console.log('  2. 确认是否有特殊计费规则未配置')
    console.log('  3. 考虑使用自动推导功能重新计算计价参数')
  }

  // 找出偏差最大的月份
  const maxDeviationMonth = monthlyData.reduce((max, data) => {
    const deviation = (Math.abs(data.bill - data.calculated) / data.bill) * 100
    const maxDeviation = (Math.abs(max.bill - max.calculated) / max.bill) * 100
    return deviation > maxDeviation ? data : max
  })

  const maxDeviation =
    (Math.abs(maxDeviationMonth.bill - maxDeviationMonth.calculated) / maxDeviationMonth.bill) * 100

  if (maxDeviation > 10) {
    console.log(
      `- ${maxDeviationMonth.period} 偏差较大(${maxDeviation.toFixed(2)}%),建议检查该月是否有特殊情况`
    )
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║        成本追踪功能使用示例                                ║')
  console.log('║        Enhanced Cost Tracking Examples                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    // 运行所有示例
    await example1_configurePointBasedAccount()
    await example2_configureTieredPricingAccount()
    await example3_configureHybridBillingAccount()
    await example4_validateCostAccuracy()
    await example5_inferPricingFromBills()
    await example6_generateCostComparisonReport()

    console.log('\n✅ 所有示例执行完成!')
  } catch (error) {
    console.error('\n❌ 执行出错:', error.message)
    console.error(error.stack)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error)
}

module.exports = {
  example1_configurePointBasedAccount,
  example2_configureTieredPricingAccount,
  example3_configureHybridBillingAccount,
  example4_validateCostAccuracy,
  example5_inferPricingFromBills,
  example6_generateCostComparisonReport
}
