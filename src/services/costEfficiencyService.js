const db = require('../models/db')
const logger = require('../utils/logger')
const { getRangeBounds } = require('../repositories/postgresUsageRepository')
const accountGroupService = require('./accountGroupService')

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/**
 * 计算时间加权成本分析
 * @param {Object} params 参数对象
 * @returns {Object} 时间加权分析结果
 */
function computeTimeWeightedCosts({
  recentTokens,
  recentCost,
  recentRequests,
  historicalTokens,
  historicalCost,
  historicalRequests
}) {
  // 近期成本效率（最近7天）
  const recentCostPerMillion = recentTokens > 0 ? recentCost / (recentTokens / 1000000) : null
  const recentCostPerRequest = recentRequests > 0 ? recentCost / recentRequests : null
  const recentTokensPerDollar = recentCost > 0 ? recentTokens / recentCost : null

  // 历史平均成本效率
  const historicalCostPerMillion =
    historicalTokens > 0 ? historicalCost / (historicalTokens / 1000000) : null
  const historicalCostPerRequest =
    historicalRequests > 0 ? historicalCost / historicalRequests : null
  const historicalTokensPerDollar = historicalCost > 0 ? historicalTokens / historicalCost : null

  // 成本趋势分析
  let costTrend = null
  let costTrendPercent = null
  let efficiencyImprovement = null

  if (
    recentCostPerMillion !== null &&
    historicalCostPerMillion !== null &&
    historicalCostPerMillion > 0
  ) {
    costTrend = recentCostPerMillion / historicalCostPerMillion
    costTrendPercent =
      ((recentCostPerMillion - historicalCostPerMillion) / historicalCostPerMillion) * 100
    efficiencyImprovement = costTrend < 1 // 成本下降表示效率提升
  }

  // 使用频率变化
  let usageFrequencyChange = null
  if (recentRequests !== null && historicalRequests !== null && historicalRequests > 0) {
    usageFrequencyChange = ((recentRequests - historicalRequests) / historicalRequests) * 100
  }

  return {
    // 近期指标
    recentCostPerMillion,
    recentCostPerRequest,
    recentTokensPerDollar,

    // 历史指标
    historicalCostPerMillion,
    historicalCostPerRequest,
    historicalTokensPerDollar,

    // 趋势分析
    costTrend,
    costTrendPercent,
    efficiencyImprovement,
    usageFrequencyChange
  }
}

/**
 * 模型分类映射
 */
const MODEL_CATEGORIES = {
  'claude-3-5-sonnet': 'intelligent',
  'claude-3-5-sonnet-20241022': 'intelligent',
  'claude-3-5-sonnet-20240620': 'intelligent',
  'claude-3-opus': 'intelligent',
  'claude-3-opus-20240229': 'intelligent',
  'claude-3-sonnet': 'balanced',
  'claude-3-sonnet-20240229': 'balanced',
  'claude-3-haiku': 'economic',
  'claude-3-haiku-20240307': 'economic',
  'claude-3-5-haiku': 'economic',
  'claude-3-5-haiku-20241022': 'economic',
  'gpt-4': 'intelligent',
  'gpt-4-turbo': 'intelligent',
  'gpt-4o': 'intelligent',
  'gpt-4o-mini': 'balanced',
  'gpt-3.5-turbo': 'economic',
  'gemini-1.5-pro': 'intelligent',
  'gemini-1.5-flash': 'balanced',
  'gemini-1.0-pro': 'economic'
}

/**
 * 获取模型类别
 * @param {string} modelName 模型名称
 * @returns {string} 模型类别
 */
function getModelCategory(modelName) {
  if (!modelName) {
    return 'unknown'
  }

  // 移除1M标记和其他变体标记
  const cleanModel = modelName
    .replace(/\[1m\]/g, '')
    .replace(/-\d+k?$/, '')
    .trim()

  // 检查精确匹配
  if (MODEL_CATEGORIES[cleanModel]) {
    return MODEL_CATEGORIES[cleanModel]
  }

  // 检查部分匹配
  for (const [model, category] of Object.entries(MODEL_CATEGORIES)) {
    if (cleanModel.includes(model) || model.includes(cleanModel)) {
      return category
    }
  }

  // 基于模型名称的启发式分类
  if (modelName.includes('opus') || modelName.includes('gpt-4') || modelName.includes('1.5-pro')) {
    return 'intelligent'
  }
  if (
    modelName.includes('haiku') ||
    modelName.includes('3.5-turbo') ||
    modelName.includes('flash')
  ) {
    return 'economic'
  }
  if (
    modelName.includes('sonnet') ||
    modelName.includes('4o-mini') ||
    modelName.includes('1.0-pro')
  ) {
    return 'balanced'
  }

  return 'unknown'
}

/**
 * 获取模型类别的显示名称
 * @param {string} category 模型类别
 * @returns {string} 显示名称
 */
function getModelCategoryLabel(category) {
  const labels = {
    intelligent: '智能模型',
    balanced: '平衡模型',
    economic: '经济模型',
    unknown: '未知模型'
  }
  return labels[category] || labels.unknown
}

/**
 * 计算缓存效率指标
 * @param {Object} params 缓存相关数据
 * @returns {Object} 缓存效率统计
 */
function computeCacheEfficiency({
  cacheCreateTokens = 0,
  cacheReadTokens = 0,
  inputTokens = 0,
  cacheCreateCost = 0,
  cacheReadCost = 0,
  model = null
}) {
  const totalInputTokens = inputTokens + cacheCreateTokens + cacheReadTokens
  const totalCacheCost = cacheCreateCost + cacheReadCost

  // 缓存命中率
  const cacheHitRate = totalInputTokens > 0 ? cacheReadTokens / totalInputTokens : null

  // 缓存利用率（缓存token占总输入的比例）
  const cacheUtilizationRate =
    totalInputTokens > 0 ? (cacheCreateTokens + cacheReadTokens) / totalInputTokens : null

  // 缓存成本节省计算
  let cacheSavings = null
  let cacheSavingsPercent = null
  let normalCostWithoutCache = null

  if (cacheReadTokens > 0 && model) {
    // 假设这些缓存读取token如果不使用缓存需要按正常input价格计费
    try {
      const CostCalculator = require('../utils/costCalculator')
      const normalUsage = {
        input_tokens: cacheReadTokens,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0
      }
      const normalCostResult = CostCalculator.calculateCost(normalUsage, model)
      normalCostWithoutCache = normalCostResult.costs.total

      cacheSavings = normalCostWithoutCache - cacheReadCost
      cacheSavingsPercent =
        normalCostWithoutCache > 0 ? (cacheSavings / normalCostWithoutCache) * 100 : null
    } catch (error) {
      // 如果计算失败，使用简化估算
      console.warn('Failed to calculate cache savings:', error)
    }
  }

  // 缓存效率评级
  let cacheEfficiencyRating = 'unknown'
  if (cacheHitRate !== null) {
    if (cacheHitRate >= 0.5) {
      cacheEfficiencyRating = 'excellent' // 优秀：50%以上
    } else if (cacheHitRate >= 0.3) {
      cacheEfficiencyRating = 'good' // 良好：30-50%
    } else if (cacheHitRate >= 0.1) {
      cacheEfficiencyRating = 'fair' // 一般：10-30%
    } else if (cacheHitRate > 0) {
      cacheEfficiencyRating = 'poor' // 较差：1-10%
    } else {
      cacheEfficiencyRating = 'none' // 无缓存使用
    }
  }

  return {
    cacheHitRate,
    cacheUtilizationRate,
    cacheSavings,
    cacheSavingsPercent,
    normalCostWithoutCache,
    cacheEfficiencyRating,
    cacheMetrics: {
      cacheCreateTokens,
      cacheReadTokens,
      totalCacheTokens: cacheCreateTokens + cacheReadTokens,
      totalCacheCost,
      cacheCreateCost,
      cacheReadCost
    }
  }
}

/**
 * 分析使用模式
 * @param {Object} params 使用数据
 * @returns {Object} 使用模式分析结果
 */
function analyzeUsagePattern({
  totalRequests = 0,
  totalTokens = 0,
  totalCost = 0,
  avgLatencyMs = null,
  cacheHitRate = null,
  recentRequests = 0,
  historicalRequests = 0,
  timeSpanDays = 30
}) {
  const avgRequestsPerDay = timeSpanDays > 0 ? totalRequests / timeSpanDays : 0
  const avgTokensPerRequest = totalRequests > 0 ? totalTokens / totalRequests : 0
  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0

  // 使用频率分类
  let usageFrequency = 'unknown'
  if (avgRequestsPerDay >= 100) {
    usageFrequency = 'high' // 高频：每天100+请求
  } else if (avgRequestsPerDay >= 10) {
    usageFrequency = 'medium' // 中频：每天10-100请求
  } else if (avgRequestsPerDay >= 1) {
    usageFrequency = 'low' // 低频：每天1-10请求
  } else if (avgRequestsPerDay > 0) {
    usageFrequency = 'sporadic' // 偶尔使用
  } else {
    usageFrequency = 'inactive' // 无活动
  }

  // 成本效率分类
  let costEfficiency = 'unknown'
  if (avgCostPerRequest <= 0.001) {
    costEfficiency = 'excellent' // 优秀：每请求<$0.001
  } else if (avgCostPerRequest <= 0.01) {
    costEfficiency = 'good' // 良好：每请求$0.001-0.01
  } else if (avgCostPerRequest <= 0.1) {
    costEfficiency = 'fair' // 一般：每请求$0.01-0.1
  } else {
    costEfficiency = 'expensive' // 昂贵：每请求>$0.1
  }

  // 延迟表现分类
  let latencyPerformance = 'unknown'
  if (avgLatencyMs !== null) {
    if (avgLatencyMs <= 1000) {
      latencyPerformance = 'excellent' // 优秀：<1秒
    } else if (avgLatencyMs <= 3000) {
      latencyPerformance = 'good' // 良好：1-3秒
    } else if (avgLatencyMs <= 10000) {
      latencyPerformance = 'fair' // 一般：3-10秒
    } else {
      latencyPerformance = 'slow' // 较慢：>10秒
    }
  }

  // 综合使用模式识别
  let usagePattern = 'unknown'

  if (usageFrequency === 'high' && costEfficiency === 'excellent') {
    usagePattern = 'high_efficiency' // 高频低成本
  } else if (usageFrequency === 'low' && avgCostPerRequest > 0.05) {
    usagePattern = 'low_freq_high_cost' // 低频高成本
  } else if (cacheHitRate !== null && cacheHitRate > 0.3) {
    usagePattern = 'cache_optimized' // 缓存优化型
  } else if (avgTokensPerRequest > 50000) {
    usagePattern = 'long_context' // 长上下文型
  } else if (usageFrequency === 'medium' && costEfficiency === 'good') {
    usagePattern = 'balanced' // 平衡型
  } else if (usageFrequency === 'sporadic') {
    usagePattern = 'experimental' // 实验型
  } else {
    usagePattern = 'standard' // 标准型
  }

  // 使用趋势
  let usageTrend = 'stable'
  if (recentRequests > 0 && historicalRequests > 0) {
    const trendRatio = recentRequests / (historicalRequests / 7) // 近期vs历史平均
    if (trendRatio >= 1.5) {
      usageTrend = 'increasing'
    } else if (trendRatio <= 0.5) {
      usageTrend = 'decreasing'
    }
  }

  return {
    usageFrequency,
    usagePattern,
    usageTrend,
    costEfficiency,
    latencyPerformance,
    metrics: {
      avgRequestsPerDay,
      avgTokensPerRequest,
      avgCostPerRequest
    }
  }
}

/**
 * 检测成本异常
 * @param {Object} params 成本数据
 * @returns {Object} 异常检测结果
 */
function detectCostAnomalies({
  costPerMillion = null,
  recentCostPerMillion = null,
  historicalCostPerMillion = null,
  model = null,
  platform = null,
  successRate = null
}) {
  const anomalies = []
  let severityLevel = 'normal' // normal, warning, critical

  // 1. 成本偏离预期范围检测
  if (costPerMillion !== null && model) {
    const expectedRanges = getExpectedCostRanges(model, platform)
    if (expectedRanges && costPerMillion > expectedRanges.max * 1.5) {
      anomalies.push({
        type: 'cost_too_high',
        severity: 'critical',
        message: `成本异常偏高: $${costPerMillion.toFixed(2)}/M tokens，预期范围 $${expectedRanges.min.toFixed(2)}-$${expectedRanges.max.toFixed(2)}`,
        currentValue: costPerMillion,
        expectedRange: expectedRanges
      })
      severityLevel = 'critical'
    } else if (expectedRanges && costPerMillion > expectedRanges.max * 1.2) {
      anomalies.push({
        type: 'cost_elevated',
        severity: 'warning',
        message: `成本略高于预期: $${costPerMillion.toFixed(2)}/M tokens`,
        currentValue: costPerMillion,
        expectedRange: expectedRanges
      })
      if (severityLevel === 'normal') {
        severityLevel = 'warning'
      }
    }
  }

  // 2. 成本急剧变化检测
  if (
    recentCostPerMillion !== null &&
    historicalCostPerMillion !== null &&
    historicalCostPerMillion > 0
  ) {
    const changeRatio = recentCostPerMillion / historicalCostPerMillion
    if (changeRatio >= 2.0) {
      anomalies.push({
        type: 'cost_spike',
        severity: 'critical',
        message: `近期成本急剧上升 ${((changeRatio - 1) * 100).toFixed(1)}%`,
        recentCost: recentCostPerMillion,
        historicalCost: historicalCostPerMillion,
        changeRatio
      })
      severityLevel = 'critical'
    } else if (changeRatio >= 1.5) {
      anomalies.push({
        type: 'cost_increase',
        severity: 'warning',
        message: `成本上升明显 ${((changeRatio - 1) * 100).toFixed(1)}%`,
        recentCost: recentCostPerMillion,
        historicalCost: historicalCostPerMillion,
        changeRatio
      })
      if (severityLevel === 'normal') {
        severityLevel = 'warning'
      }
    }
  }

  // 3. 成功率异常检测
  if (successRate !== null && successRate < 0.9) {
    anomalies.push({
      type: 'low_success_rate',
      severity: successRate < 0.7 ? 'critical' : 'warning',
      message: `成功率偏低: ${(successRate * 100).toFixed(1)}%`,
      successRate
    })
    if (successRate < 0.7) {
      severityLevel = 'critical'
    } else if (severityLevel === 'normal') {
      severityLevel = 'warning'
    }
  }

  return {
    hasAnomalies: anomalies.length > 0,
    severityLevel,
    anomalies,
    anomalyCount: anomalies.length
  }
}

/**
 * 获取模型的预期成本范围（参考值）
 * @param {string} model 模型名称
 * @param {string} platform 平台
 * @returns {Object|null} 成本范围
 */
function getExpectedCostRanges(model, _platform) {
  // 基于模型类型的预期成本范围（每百万token）
  const modelRanges = {
    'claude-3-5-sonnet': { min: 3, max: 15 },
    'claude-3-opus': { min: 15, max: 75 },
    'claude-3-haiku': { min: 0.25, max: 1.25 },
    'gpt-4': { min: 10, max: 30 },
    'gpt-4o': { min: 2.5, max: 10 },
    'gpt-3.5-turbo': { min: 0.5, max: 2 },
    'gemini-1.5-pro': { min: 1.25, max: 5 },
    'gemini-1.5-flash': { min: 0.075, max: 0.3 }
  }

  if (!model) {
    return null
  }

  // 寻找匹配的模型
  for (const [modelPattern, range] of Object.entries(modelRanges)) {
    if (model.includes(modelPattern)) {
      return range
    }
  }

  // 基于模型类别的默认范围
  const category = getModelCategory(model)
  const categoryRanges = {
    intelligent: { min: 5, max: 30 },
    balanced: { min: 1, max: 10 },
    economic: { min: 0.1, max: 3 },
    unknown: { min: 0.1, max: 50 }
  }

  return categoryRanges[category] || categoryRanges.unknown
}

function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function computeDerivedMetrics({
  totalTokens,
  totalCost,
  totalRequests,
  successRequests,
  recentTokens,
  recentCost,
  recentRequests,
  historicalTokens,
  historicalCost,
  historicalRequests
}) {
  const cost = toNumber(totalCost, 0)
  const tokens = toNumber(totalTokens, 0)
  const requests = toNumber(totalRequests, 0)
  const success = toNumber(successRequests, 0)

  // 基础指标
  const tokensPerDollar = cost > 0 ? tokens / cost : null
  const costPerMillion = tokens > 0 ? cost / (tokens / 1000000) : null
  const costPerRequest = requests > 0 ? cost / requests : null
  const tokensPerRequest = requests > 0 ? tokens / requests : null
  const successRate = requests > 0 ? success / requests : null
  const errorRate = successRate !== null ? 1 - successRate : null

  // 时间加权成本分析
  const recentCostAnalysis = computeTimeWeightedCosts({
    recentTokens: toNumber(recentTokens, 0),
    recentCost: toNumber(recentCost, 0),
    recentRequests: toNumber(recentRequests, 0),
    historicalTokens: toNumber(historicalTokens, 0),
    historicalCost: toNumber(historicalCost, 0),
    historicalRequests: toNumber(historicalRequests, 0)
  })

  return {
    tokensPerDollar,
    costPerMillion,
    costPerRequest,
    tokensPerRequest,
    successRate,
    errorRate,
    ...recentCostAnalysis
  }
}

async function resolveAccountIds({ groupId }) {
  if (!groupId) {
    return []
  }

  try {
    const members = await accountGroupService.getGroupMembers(groupId)
    return Array.from(new Set((members || []).filter(Boolean)))
  } catch (error) {
    logger.error('❌ Failed to resolve account group members:', error)
    return []
  }
}

function buildFilters({ platform, accountIds, bounds }) {
  const conditions = ['ur.account_id IS NOT NULL']
  const params = []
  let index = 1

  if (bounds?.start && bounds?.end) {
    conditions.push(`ur.occurred_at >= $${index} AND ur.occurred_at < $${index + 1}`)
    params.push(bounds.start)
    params.push(bounds.end)
    index += 2
  }

  if (platform) {
    conditions.push(`COALESCE(a.platform, a.type) = $${index}`)
    params.push(platform)
    index += 1
  }

  if (accountIds && accountIds.length > 0) {
    conditions.push(`ur.account_id = ANY($${index}::uuid[])`)
    params.push(accountIds)
    index += 1
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

async function getCostEfficiencySummary(options = {}) {
  if (!db.isEnabled()) {
    return {
      available: false,
      range: { start: null, end: null },
      totals: {
        accountCount: 0,
        apiKeyCount: 0,
        totalCost: 0,
        totalTokens: 0,
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        avgLatencyMs: null,
        p95LatencyMs: null,
        tokensPerDollar: null,
        costPerMillion: null,
        costPerRequest: null,
        tokensPerRequest: null,
        successRate: null,
        errorRate: null
      }
    }
  }

  const {
    range = '30d',
    start = null,
    end = null,
    month = null,
    platform = null,
    groupId = null
  } = options

  const bounds = getRangeBounds(range, { start, end, month })
  const accountIds = await resolveAccountIds({ groupId })

  if (groupId && accountIds.length === 0) {
    return {
      available: true,
      range: { start: bounds.start || null, end: bounds.end || null },
      totals: {
        accountCount: 0,
        apiKeyCount: 0,
        totalCost: 0,
        totalTokens: 0,
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        avgLatencyMs: null,
        p95LatencyMs: null,
        tokensPerDollar: null,
        costPerMillion: null,
        costPerRequest: null,
        tokensPerRequest: null,
        successRate: null,
        errorRate: null
      }
    }
  }

  const { whereClause, params } = buildFilters({ platform, accountIds, bounds })

  const query = `
    SELECT
      COUNT(DISTINCT ur.account_id) AS account_count,
      COUNT(DISTINCT ur.api_key_id) FILTER (WHERE ur.api_key_id IS NOT NULL) AS api_key_count,
      COALESCE(SUM(ur.total_cost), 0) AS total_cost,
      COALESCE(SUM(ur.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(ur.requests), 0) AS total_requests,
      COALESCE(SUM(CASE WHEN ur.request_status = 'success' THEN ur.requests ELSE 0 END), 0) AS success_requests,
      COALESCE(SUM(CASE WHEN ur.request_status <> 'success' THEN ur.requests ELSE 0 END), 0) AS error_requests,
      AVG(NULLIF(ur.response_latency_ms, 0)) AS avg_latency_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(ur.response_latency_ms, 0)) AS p95_latency_ms
    FROM usage_records ur
    LEFT JOIN accounts a ON a.id = ur.account_id
    ${whereClause}
  `

  const { rows } = await db.query(query, params)
  const row = rows[0] || {}

  const totals = {
    accountCount: toNumber(row.account_count, 0),
    apiKeyCount: toNumber(row.api_key_count, 0),
    totalCost: toNumber(row.total_cost, 0),
    totalTokens: toNumber(row.total_tokens, 0),
    totalRequests: toNumber(row.total_requests, 0),
    successRequests: toNumber(row.success_requests, 0),
    errorRequests: toNumber(row.error_requests, 0),
    avgLatencyMs: toNullableNumber(row.avg_latency_ms),
    p95LatencyMs: toNullableNumber(row.p95_latency_ms)
  }

  const derived = computeDerivedMetrics({
    totalTokens: totals.totalTokens,
    totalCost: totals.totalCost,
    totalRequests: totals.totalRequests,
    successRequests: totals.successRequests
  })

  return {
    available: true,
    range: {
      start: bounds.start || null,
      end: bounds.end || null,
      label: range
    },
    totals: {
      ...totals,
      ...derived
    }
  }
}

const SORT_FIELD_MAP = {
  cost: 'total_cost',
  tokens: 'total_tokens',
  requests: 'total_requests',
  tokensPerDollar: 'tokens_per_dollar',
  costPerMillion: 'cost_per_million',
  costPerRequest: 'cost_per_request',
  tokensPerRequest: 'tokens_per_request',
  successRate: 'success_rate',
  avgLatency: 'avg_latency_ms',
  p95Latency: 'p95_latency_ms'
}

async function getCostEfficiencyAccounts(options = {}) {
  if (!db.isEnabled()) {
    return {
      available: false,
      items: [],
      total: 0,
      nextOffset: 0,
      hasMore: false
    }
  }

  const {
    range = '30d',
    start = null,
    end = null,
    month = null,
    platform = null,
    groupId = null,
    limit = 20,
    offset = 0,
    sortBy = 'costPerMillion',
    order = 'asc'
  } = options

  const bounds = getRangeBounds(range, { start, end, month })
  const accountIds = await resolveAccountIds({ groupId })

  if (groupId && accountIds.length === 0) {
    return {
      available: true,
      items: [],
      total: 0,
      nextOffset: offset,
      hasMore: false
    }
  }

  const { whereClause, params } = buildFilters({ platform, accountIds, bounds })

  // 计算近期时间边界（最近7天）
  const now = new Date()
  const recentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const recentStartParam = params.length + 1
  const recentEndParam = params.length + 2
  params.push(recentStart.toISOString(), now.toISOString())

  const sortField = SORT_FIELD_MAP[sortBy] || 'cost_per_million'
  const sortDirection = order === 'desc' ? 'DESC' : 'ASC'
  const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 20))
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0)

  const query = `
    WITH filtered AS (
      SELECT
        ur.account_id,
        ur.api_key_id,
        ur.total_cost,
        ur.total_tokens,
        ur.requests,
        ur.request_status,
        ur.response_latency_ms,
        ur.model,
        ur.occurred_at,
        a.id AS ref_account_id,
        a.name AS ref_account_name,
        a.platform AS ref_platform,
        a.type AS ref_type,
        a.status AS ref_status,
        a.priority AS ref_priority
      FROM usage_records ur
      LEFT JOIN accounts a ON a.id = ur.account_id
      ${whereClause}
    )
    SELECT
      COALESCE(f.ref_account_id, f.account_id) AS id,
      COALESCE(f.ref_account_name, f.account_id::text) AS name,
      COALESCE(f.ref_platform, f.ref_type, 'unknown') AS platform,
      COALESCE(f.ref_type, 'unknown') AS type,
      COALESCE(f.ref_status, 'unknown') AS status,
      COALESCE(f.ref_priority, 0) AS priority,
      -- 总体指标
      COALESCE(SUM(f.total_cost), 0) AS total_cost,
      COALESCE(SUM(f.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(f.requests), 0) AS total_requests,
      COALESCE(SUM(CASE WHEN f.request_status = 'success' THEN f.requests ELSE 0 END), 0) AS success_requests,
      COALESCE(SUM(CASE WHEN f.request_status <> 'success' THEN f.requests ELSE 0 END), 0) AS error_requests,
      -- 近期指标（最近7天）
      COALESCE(SUM(CASE WHEN f.occurred_at >= $${recentStartParam} AND f.occurred_at <= $${recentEndParam} THEN f.total_cost ELSE 0 END), 0) AS recent_cost,
      COALESCE(SUM(CASE WHEN f.occurred_at >= $${recentStartParam} AND f.occurred_at <= $${recentEndParam} THEN f.total_tokens ELSE 0 END), 0) AS recent_tokens,
      COALESCE(SUM(CASE WHEN f.occurred_at >= $${recentStartParam} AND f.occurred_at <= $${recentEndParam} THEN f.requests ELSE 0 END), 0) AS recent_requests,
      -- 历史指标（7天前的数据）
      COALESCE(SUM(CASE WHEN f.occurred_at < $${recentStartParam} THEN f.total_cost ELSE 0 END), 0) AS historical_cost,
      COALESCE(SUM(CASE WHEN f.occurred_at < $${recentStartParam} THEN f.total_tokens ELSE 0 END), 0) AS historical_tokens,
      COALESCE(SUM(CASE WHEN f.occurred_at < $${recentStartParam} THEN f.requests ELSE 0 END), 0) AS historical_requests,
      -- 其他统计指标
      AVG(NULLIF(f.response_latency_ms, 0)) AS avg_latency_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(f.response_latency_ms, 0)) AS p95_latency_ms,
      COUNT(DISTINCT f.api_key_id) FILTER (WHERE f.api_key_id IS NOT NULL) AS api_key_count,
      MAX(f.occurred_at) AS last_activity_at,
      (ARRAY_AGG(f.model ORDER BY f.occurred_at DESC))[1] AS last_model,
      -- 计算的指标
      CASE WHEN SUM(f.total_cost) > 0 THEN SUM(f.total_tokens) / SUM(f.total_cost) ELSE NULL END AS tokens_per_dollar,
      CASE WHEN SUM(f.total_tokens) > 0 THEN SUM(f.total_cost) / (SUM(f.total_tokens) / 1000000) ELSE NULL END AS cost_per_million,
      CASE WHEN SUM(f.requests) > 0 THEN SUM(f.total_cost) / SUM(f.requests) ELSE NULL END AS cost_per_request,
      CASE WHEN SUM(f.requests) > 0 THEN SUM(f.total_tokens) / SUM(f.requests) ELSE NULL END AS tokens_per_request,
      CASE WHEN SUM(f.requests) > 0 THEN SUM(CASE WHEN f.request_status = 'success' THEN f.requests ELSE 0 END) / SUM(f.requests)::numeric ELSE NULL END AS success_rate
    FROM filtered f
    GROUP BY id, name, platform, type, status, priority
    ORDER BY ${sortField} ${sortDirection}, name ASC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `

  const { rows } = await db.query(query, params)

  const items = rows.map((row) => {
    const baseMetrics = {
      totalCost: toNumber(row.total_cost, 0),
      totalTokens: toNumber(row.total_tokens, 0),
      totalRequests: toNumber(row.total_requests, 0),
      successRequests: toNumber(row.success_requests, 0),
      errorRequests: toNumber(row.error_requests, 0),
      avgLatencyMs: toNullableNumber(row.avg_latency_ms),
      p95LatencyMs: toNullableNumber(row.p95_latency_ms),
      tokensPerDollar: toNullableNumber(row.tokens_per_dollar),
      costPerMillion: toNullableNumber(row.cost_per_million),
      costPerRequest: toNullableNumber(row.cost_per_request),
      tokensPerRequest: toNullableNumber(row.tokens_per_request),
      successRate: toNullableNumber(row.success_rate)
    }

    // 计算包含时间维度的衍生指标
    const derivedMetrics = computeDerivedMetrics({
      totalTokens: baseMetrics.totalTokens,
      totalCost: baseMetrics.totalCost,
      totalRequests: baseMetrics.totalRequests,
      successRequests: baseMetrics.successRequests,
      recentTokens: toNumber(row.recent_tokens, 0),
      recentCost: toNumber(row.recent_cost, 0),
      recentRequests: toNumber(row.recent_requests, 0),
      historicalTokens: toNumber(row.historical_tokens, 0),
      historicalCost: toNumber(row.historical_cost, 0),
      historicalRequests: toNumber(row.historical_requests, 0)
    })

    // 使用模式分析（集成了从derivedMetrics获取的successRate）
    const usageAnalysis = analyzeUsagePattern({
      totalRequests: baseMetrics.totalRequests,
      totalTokens: baseMetrics.totalTokens,
      totalCost: baseMetrics.totalCost,
      avgLatencyMs: baseMetrics.avgLatencyMs,
      cacheHitRate: null, // 需要从usage_records中获取缓存数据
      recentRequests: toNumber(row.recent_requests, 0),
      historicalRequests: toNumber(row.historical_requests, 0),
      timeSpanDays: 30
    })

    // 缓存效率分析（为将来的缓存数据集成预留）
    const cacheAnalysis = computeCacheEfficiency({
      cacheCreateTokens: 0, // 待集成实际缓存数据
      cacheReadTokens: 0, // 待集成实际缓存数据
      inputTokens: baseMetrics.totalTokens,
      cacheCreateCost: 0, // 待集成实际缓存成本数据
      cacheReadCost: 0, // 待集成实际缓存成本数据
      model: row.last_model
    })

    // 异常检测
    const anomalyDetection = detectCostAnomalies({
      costPerMillion: derivedMetrics.costPerMillion,
      recentCostPerMillion: derivedMetrics.recentCostPerMillion,
      historicalCostPerMillion: derivedMetrics.historicalCostPerMillion,
      model: row.last_model,
      platform: row.platform,
      successRate: derivedMetrics.successRate
    })

    return {
      account: {
        id: row.id,
        name: row.name,
        platform: row.platform,
        type: row.type,
        status: row.status,
        priority: row.priority
      },
      metrics: {
        ...baseMetrics,
        // 使用数据库计算值优先，否则使用衍生计算值
        tokensPerDollar:
          baseMetrics.tokensPerDollar !== null
            ? baseMetrics.tokensPerDollar
            : derivedMetrics.tokensPerDollar,
        costPerMillion:
          baseMetrics.costPerMillion !== null
            ? baseMetrics.costPerMillion
            : derivedMetrics.costPerMillion,
        costPerRequest:
          baseMetrics.costPerRequest !== null
            ? baseMetrics.costPerRequest
            : derivedMetrics.costPerRequest,
        tokensPerRequest:
          baseMetrics.tokensPerRequest !== null
            ? baseMetrics.tokensPerRequest
            : derivedMetrics.tokensPerRequest,
        successRate:
          baseMetrics.successRate !== null ? baseMetrics.successRate : derivedMetrics.successRate,
        errorRate: derivedMetrics.errorRate,

        // 新增时间维度分析
        recentCostPerMillion: derivedMetrics.recentCostPerMillion,
        historicalCostPerMillion: derivedMetrics.historicalCostPerMillion,
        costTrend: derivedMetrics.costTrend,
        costTrendPercent: derivedMetrics.costTrendPercent,
        efficiencyImprovement: derivedMetrics.efficiencyImprovement,
        usageFrequencyChange: derivedMetrics.usageFrequencyChange
      },
      // 模型分类信息
      modelInfo: {
        lastModel: row.last_model || null,
        modelCategory: getModelCategory(row.last_model),
        modelCategoryLabel: getModelCategoryLabel(getModelCategory(row.last_model))
      },
      // 使用模式分析
      usageAnalysis,
      // 缓存效率分析
      cacheAnalysis,
      // 异常检测结果
      anomalyDetection,
      apiKeyCount: toNumber(row.api_key_count, 0),
      lastActivityAt: row.last_activity_at || null,
      lastModel: row.last_model || null
    }
  })

  return {
    available: true,
    items,
    total: safeOffset + items.length,
    nextOffset: safeOffset + items.length,
    hasMore: items.length === safeLimit
  }
}

const ALLOWED_INTERVALS = new Set(['hour', 'day', 'week'])

async function getCostEfficiencyTrends(options = {}) {
  if (!db.isEnabled()) {
    return {
      available: false,
      interval: 'day',
      range: { start: null, end: null },
      data: []
    }
  }

  const {
    range = '30d',
    start = null,
    end = null,
    month = null,
    platform = null,
    groupId = null,
    interval = 'day'
  } = options

  const bounds = getRangeBounds(range, { start, end, month })
  const accountIds = await resolveAccountIds({ groupId })

  if (groupId && accountIds.length === 0) {
    return {
      available: true,
      interval,
      range: { start: bounds.start || null, end: bounds.end || null },
      data: []
    }
  }

  const resolvedInterval = ALLOWED_INTERVALS.has(interval) ? interval : 'day'
  const bucketExpression = `date_trunc('${resolvedInterval}', ur.occurred_at)`

  const { whereClause, params } = buildFilters({ platform, accountIds, bounds })

  const query = `
    SELECT
      ${bucketExpression} AS bucket,
      COALESCE(SUM(ur.total_cost), 0) AS total_cost,
      COALESCE(SUM(ur.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(ur.requests), 0) AS total_requests,
      COALESCE(SUM(CASE WHEN ur.request_status = 'success' THEN ur.requests ELSE 0 END), 0) AS success_requests,
      COALESCE(SUM(CASE WHEN ur.request_status <> 'success' THEN ur.requests ELSE 0 END), 0) AS error_requests,
      AVG(NULLIF(ur.response_latency_ms, 0)) AS avg_latency_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(ur.response_latency_ms, 0)) AS p95_latency_ms
    FROM usage_records ur
    LEFT JOIN accounts a ON a.id = ur.account_id
    ${whereClause}
    GROUP BY bucket
    ORDER BY bucket ASC
  `

  const { rows } = await db.query(query, params)

  const data = rows.map((row) => {
    const totalCost = toNumber(row.total_cost, 0)
    const totalTokens = toNumber(row.total_tokens, 0)
    const totalRequests = toNumber(row.total_requests, 0)
    const successRequests = toNumber(row.success_requests, 0)

    const derived = computeDerivedMetrics({
      totalTokens,
      totalCost,
      totalRequests,
      successRequests
    })

    return {
      timestamp: row.bucket,
      totalCost,
      totalTokens,
      totalRequests,
      successRequests,
      errorRequests: toNumber(row.error_requests, 0),
      avgLatencyMs: toNullableNumber(row.avg_latency_ms),
      p95LatencyMs: toNullableNumber(row.p95_latency_ms),
      tokensPerDollar: derived.tokensPerDollar,
      costPerMillion: derived.costPerMillion,
      costPerRequest: derived.costPerRequest,
      tokensPerRequest: derived.tokensPerRequest,
      successRate: derived.successRate,
      errorRate: derived.errorRate
    }
  })

  return {
    available: true,
    interval: resolvedInterval,
    range: {
      start: bounds.start || null,
      end: bounds.end || null,
      label: range
    },
    data
  }
}

module.exports = {
  getCostEfficiencySummary,
  getCostEfficiencyAccounts,
  getCostEfficiencyTrends
}
