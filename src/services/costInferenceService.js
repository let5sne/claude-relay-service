const db = require('../models/db')
const costTrackingService = require('./costTrackingService')
const { v4: uuidv4 } = require('uuid')

/**
 * 基于历史账单自动推导计价参数
 * @param {string} accountId - 账户ID
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 推导结果
 */
async function inferPricingFromBills(accountId, options = {}) {
  if (!db.isEnabled()) {
    return {
      success: false,
      reason: 'database_disabled',
      message: '数据库未启用'
    }
  }

  const { minBills = 3, maxBills = 12 } = options

  // 1. 获取历史账单数据
  const bills = await costTrackingService.listAccountBills(accountId, {
    limit: maxBills
  })

  if (bills.length < minBills) {
    return {
      success: false,
      reason: 'insufficient_data',
      message: `需要至少${minBills}个月的账单数据，当前只有${bills.length}个`
    }
  }

  // 2. 获取对应时期的使用量数据
  const usageData = await getUsageDataForBillingPeriods(accountId, bills)

  if (usageData.length < minBills) {
    return {
      success: false,
      reason: 'insufficient_usage_data',
      message: '使用量数据不足'
    }
  }

  // 3. 分析计费模式
  const billingPattern = analyzeBillingPattern(bills, usageData)

  // 4. 推导计价参数
  const inferredRates = deriveRates(billingPattern, usageData)

  // 5. 计算推导质量
  const quality = calculateInferenceQuality(bills, usageData, inferredRates)

  const confidenceLevel = quality.score > 0.9 ? 'high' : quality.score > 0.7 ? 'medium' : 'low'

  // 6. 保存推导历史
  await savePricingInferenceHistory({
    accountId,
    inferredBillingType: billingPattern.type,
    inferredRates,
    qualityScore: quality.score,
    confidenceLevel,
    rSquared: quality.r_squared,
    meanAbsoluteError: quality.mean_absolute_error,
    billsAnalyzed: bills.length,
    dateRangeStart: bills[bills.length - 1].billingPeriodStart,
    dateRangeEnd: bills[0].billingPeriodEnd,
    inferenceMethod: 'linear_regression'
  })

  return {
    success: true,
    billingType: billingPattern.type,
    inferredRates,
    quality,
    confidenceLevel,
    billsAnalyzed: bills.length
  }
}

/**
 * 验证计算成本与实际账单的偏差
 * @param {string} accountId - 账户ID
 * @param {string} billingPeriod - 账单周期 (YYYY-MM)
 * @returns {Promise<Object>} 验证结果
 */
async function validateCostAccuracy(accountId, billingPeriod) {
  if (!db.isEnabled()) {
    return {
      validated: false,
      reason: 'database_disabled'
    }
  }

  // 1. 获取该周期的实际账单
  const bill = await getAccountBillForPeriod(accountId, billingPeriod)

  if (!bill) {
    return {
      validated: false,
      reason: 'no_bill_data',
      message: `未找到${billingPeriod}的账单数据`
    }
  }

  // 2. 获取该周期的计算成本总和
  const calculatedCost = await getCalculatedCostForPeriod(accountId, billingPeriod)

  // 3. 计算偏差
  const deviationAmount = Math.abs(bill.totalAmount - calculatedCost)
  const deviationPercent = bill.totalAmount > 0 ? (deviationAmount / bill.totalAmount) * 100 : 0

  // 4. 评估准确性
  const validationStatus =
    deviationPercent < 5
      ? 'excellent'
      : deviationPercent < 10
        ? 'good'
        : deviationPercent < 20
          ? 'acceptable'
          : 'poor'

  const accuracy = {
    billAmount: bill.totalAmount,
    calculatedAmount: calculatedCost,
    deviationAmount,
    deviationPercent,
    status: validationStatus
  }

  // 5. 保存验证历史
  await saveCostValidationHistory({
    accountId,
    billingPeriod,
    billAmount: bill.totalAmount,
    billCurrency: bill.currency,
    calculatedCost,
    deviationAmount,
    deviationPercent,
    validationStatus,
    adjustmentNeeded: deviationPercent > 10
  })

  // 6. 更新账户配置的验证状态
  await costTrackingService.upsertAccountCostProfile({
    accountId,
    verificationStatus: validationStatus,
    lastVerifiedAt: new Date()
  })

  return {
    validated: true,
    accuracy,
    needsAdjustment: deviationPercent > 10,
    billingPeriod
  }
}

/**
 * 生成成本对比报告
 * @param {string} accountId - 账户ID
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {Promise<Object>} 对比报告
 */
async function generateCostComparisonReport(accountId, startDate, endDate) {
  if (!db.isEnabled()) {
    return {
      success: false,
      reason: 'database_disabled'
    }
  }

  // 1. 获取账单数据
  const bills = await db.query(
    `
      SELECT 
        TO_CHAR(billing_period_start, 'YYYY-MM') as period,
        total_amount,
        currency
      FROM account_bills
      WHERE account_id = $1
        AND billing_period_start >= $2
        AND billing_period_end <= $3
      ORDER BY billing_period_start
    `,
    [accountId, startDate, endDate]
  )

  // 2. 获取计算成本数据
  const monthlyData = []
  let totalBill = 0
  let totalCalculated = 0

  for (const bill of bills.rows) {
    const calculatedCost = await getCalculatedCostForPeriod(accountId, bill.period)
    const deviation = (Math.abs(bill.total_amount - calculatedCost) / bill.total_amount) * 100

    monthlyData.push({
      period: bill.period,
      billAmount: parseFloat(bill.total_amount),
      calculatedCost,
      deviation
    })

    totalBill += parseFloat(bill.total_amount)
    totalCalculated += calculatedCost
  }

  // 3. 计算统计数据
  const avgDeviation = monthlyData.reduce((sum, d) => sum + d.deviation, 0) / monthlyData.length
  const overallDeviation = (Math.abs(totalBill - totalCalculated) / totalBill) * 100

  const status =
    overallDeviation < 5
      ? 'excellent'
      : overallDeviation < 10
        ? 'good'
        : overallDeviation < 20
          ? 'acceptable'
          : 'poor'

  // 4. 生成建议
  const recommendations = []

  if (status === 'excellent') {
    recommendations.push('成本计算准确性优秀，建议继续使用当前配置')
  } else if (status === 'good') {
    recommendations.push('成本计算准确性良好，可以考虑微调计价参数')
  } else {
    recommendations.push('成本计算偏差较大，建议:')
    recommendations.push('  1. 检查计价配置是否正确')
    recommendations.push('  2. 确认是否有特殊计费规则未配置')
    recommendations.push('  3. 考虑使用自动推导功能重新计算计价参数')
  }

  // 找出偏差最大的月份
  const maxDeviationMonth = monthlyData.reduce((max, data) =>
    data.deviation > max.deviation ? data : max
  )

  if (maxDeviationMonth.deviation > 10) {
    recommendations.push(
      `${maxDeviationMonth.period} 偏差较大(${maxDeviationMonth.deviation.toFixed(2)}%)，建议检查该月是否有特殊情况`
    )
  }

  return {
    success: true,
    summary: {
      totalBillAmount: totalBill,
      totalCalculatedCost: totalCalculated,
      avgDeviation,
      overallDeviation,
      status
    },
    monthlyComparison: monthlyData,
    recommendations
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取账单周期的使用量数据
 */
async function getUsageDataForBillingPeriods(accountId, bills) {
  const usageData = []

  for (const bill of bills) {
    const period = bill.billingPeriodStart.toISOString().substring(0, 7)

    const result = await db.query(
      `
        SELECT 
          COUNT(*) as request_count,
          SUM(total_tokens) as total_tokens,
          SUM(COALESCE(actual_cost, total_cost)) as total_cost
        FROM usage_records
        WHERE account_id = $1
          AND billing_period = $2
      `,
      [accountId, period]
    )

    if (result.rows[0].request_count > 0) {
      usageData.push({
        period,
        requestCount: parseInt(result.rows[0].request_count),
        totalTokens: parseInt(result.rows[0].total_tokens) || 0,
        totalCost: parseFloat(result.rows[0].total_cost) || 0,
        billAmount: parseFloat(bill.totalAmount)
      })
    }
  }

  return usageData
}

/**
 * 分析计费模式
 */
function analyzeBillingPattern(bills, usageData) {
  // 简单的启发式分析
  // 检查成本与token数的关系

  const tokenCostRatios = usageData.map((d) => d.billAmount / d.totalTokens)
  const avgRatio = tokenCostRatios.reduce((sum, r) => sum + r, 0) / tokenCostRatios.length
  const variance =
    tokenCostRatios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / tokenCostRatios.length

  // 如果方差很小，可能是固定费率
  if (variance < avgRatio * 0.1) {
    return { type: 'standard', pattern: 'fixed_rate' }
  }

  // 否则可能是阶梯定价或其他复杂模式
  return { type: 'tiered', pattern: 'variable_rate' }
}

/**
 * 推导计价参数
 */
function deriveRates(billingPattern, usageData) {
  // 使用简单的线性回归
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0
  const n = usageData.length

  for (const data of usageData) {
    sumX += data.totalTokens
    sumY += data.billAmount
    sumXY += data.totalTokens * data.billAmount
    sumX2 += data.totalTokens * data.totalTokens
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const costPerToken = slope
  const costPerMillion = costPerToken * 1000000
  const fixedCostPerMonth = intercept

  return {
    costPerToken,
    costPerMillion,
    fixedCostPerMonth,
    derivedAt: new Date().toISOString()
  }
}

/**
 * 计算推导质量
 */
function calculateInferenceQuality(bills, usageData, inferredRates) {
  let totalError = 0
  let totalSquaredError = 0
  const meanBill = usageData.reduce((sum, d) => sum + d.billAmount, 0) / usageData.length

  for (const data of usageData) {
    const predicted =
      inferredRates.costPerToken * data.totalTokens + inferredRates.fixedCostPerMonth
    const error = Math.abs(predicted - data.billAmount) / data.billAmount
    totalError += error
    totalSquaredError += Math.pow(data.billAmount - predicted, 2)
  }

  const meanAbsoluteError = totalError / usageData.length
  const totalVariance = usageData.reduce((sum, d) => sum + Math.pow(d.billAmount - meanBill, 2), 0)
  const rSquared = 1 - totalSquaredError / totalVariance

  const score = 1 - meanAbsoluteError

  return {
    score: Math.max(0, Math.min(1, score)),
    r_squared: Math.max(0, Math.min(1, rSquared)),
    mean_absolute_error: meanAbsoluteError
  }
}

/**
 * 获取指定周期的账单
 */
async function getAccountBillForPeriod(accountId, billingPeriod) {
  const result = await db.query(
    `
      SELECT *
      FROM account_bills
      WHERE account_id = $1
        AND TO_CHAR(billing_period_start, 'YYYY-MM') = $2
      LIMIT 1
    `,
    [accountId, billingPeriod]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    accountId: row.account_id,
    billingPeriodStart: row.billing_period_start,
    billingPeriodEnd: row.billing_period_end,
    totalAmount: parseFloat(row.total_amount),
    currency: row.currency,
    totalUnits: row.total_units,
    unitName: row.unit_name
  }
}

/**
 * 获取指定周期的计算成本
 */
async function getCalculatedCostForPeriod(accountId, billingPeriod) {
  const result = await db.query(
    `
      SELECT SUM(COALESCE(actual_cost, total_cost)) as total_cost
      FROM usage_records
      WHERE account_id = $1
        AND billing_period = $2
    `,
    [accountId, billingPeriod]
  )

  return parseFloat(result.rows[0].total_cost) || 0
}

/**
 * 保存推导历史
 */
async function savePricingInferenceHistory(data) {
  const {
    accountId,
    inferredBillingType,
    inferredRates,
    qualityScore,
    confidenceLevel,
    rSquared,
    meanAbsoluteError,
    billsAnalyzed,
    dateRangeStart,
    dateRangeEnd,
    inferenceMethod
  } = data

  await db.query(
    `
      INSERT INTO pricing_inference_history (
        id,
        account_id,
        inferred_billing_type,
        inferred_rates,
        quality_score,
        confidence_level,
        r_squared,
        mean_absolute_error,
        bills_analyzed,
        date_range_start,
        date_range_end,
        inference_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `,
    [
      uuidv4(),
      accountId,
      inferredBillingType,
      JSON.stringify(inferredRates),
      qualityScore,
      confidenceLevel,
      rSquared,
      meanAbsoluteError,
      billsAnalyzed,
      dateRangeStart,
      dateRangeEnd,
      inferenceMethod
    ]
  )
}

/**
 * 保存验证历史
 */
async function saveCostValidationHistory(data) {
  const {
    accountId,
    billingPeriod,
    billAmount,
    billCurrency,
    calculatedCost,
    deviationAmount,
    deviationPercent,
    validationStatus,
    adjustmentNeeded
  } = data

  // 获取该周期的请求和token统计
  const stats = await db.query(
    `
      SELECT 
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens
      FROM usage_records
      WHERE account_id = $1
        AND billing_period = $2
    `,
    [accountId, billingPeriod]
  )

  await db.query(
    `
      INSERT INTO cost_validation_history (
        id,
        account_id,
        billing_period,
        bill_amount,
        bill_currency,
        calculated_cost,
        total_requests,
        total_tokens,
        deviation_amount,
        deviation_percent,
        validation_status,
        adjustment_needed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `,
    [
      uuidv4(),
      accountId,
      billingPeriod,
      billAmount,
      billCurrency,
      calculatedCost,
      parseInt(stats.rows[0].total_requests) || 0,
      parseInt(stats.rows[0].total_tokens) || 0,
      deviationAmount,
      deviationPercent,
      validationStatus,
      adjustmentNeeded
    ]
  )
}

module.exports = {
  inferPricingFromBills,
  validateCostAccuracy,
  generateCostComparisonReport
}
