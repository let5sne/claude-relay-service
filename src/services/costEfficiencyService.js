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

function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function computeDerivedMetrics({ totalTokens, totalCost, totalRequests, successRequests }) {
  const cost = toNumber(totalCost, 0)
  const tokens = toNumber(totalTokens, 0)
  const requests = toNumber(totalRequests, 0)
  const success = toNumber(successRequests, 0)

  const tokensPerDollar = cost > 0 ? tokens / cost : null
  const costPerMillion = tokens > 0 ? cost / (tokens / 1000000) : null
  const costPerRequest = requests > 0 ? cost / requests : null
  const tokensPerRequest = requests > 0 ? tokens / requests : null
  const successRate = requests > 0 ? success / requests : null
  const errorRate = successRate !== null ? 1 - successRate : null

  return {
    tokensPerDollar,
    costPerMillion,
    costPerRequest,
    tokensPerRequest,
    successRate,
    errorRate
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
      COALESCE(SUM(f.total_cost), 0) AS total_cost,
      COALESCE(SUM(f.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(f.requests), 0) AS total_requests,
      COALESCE(SUM(CASE WHEN f.request_status = 'success' THEN f.requests ELSE 0 END), 0) AS success_requests,
      COALESCE(SUM(CASE WHEN f.request_status <> 'success' THEN f.requests ELSE 0 END), 0) AS error_requests,
      AVG(NULLIF(f.response_latency_ms, 0)) AS avg_latency_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(f.response_latency_ms, 0)) AS p95_latency_ms,
      COUNT(DISTINCT f.api_key_id) FILTER (WHERE f.api_key_id IS NOT NULL) AS api_key_count,
      MAX(f.occurred_at) AS last_activity_at,
      (ARRAY_AGG(f.model ORDER BY f.occurred_at DESC))[1] AS last_model,
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

    const derivedFallback = computeDerivedMetrics({
      totalTokens: baseMetrics.totalTokens,
      totalCost: baseMetrics.totalCost,
      totalRequests: baseMetrics.totalRequests,
      successRequests: baseMetrics.successRequests
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
        tokensPerDollar:
          baseMetrics.tokensPerDollar !== null
            ? baseMetrics.tokensPerDollar
            : derivedFallback.tokensPerDollar,
        costPerMillion:
          baseMetrics.costPerMillion !== null
            ? baseMetrics.costPerMillion
            : derivedFallback.costPerMillion,
        costPerRequest:
          baseMetrics.costPerRequest !== null
            ? baseMetrics.costPerRequest
            : derivedFallback.costPerRequest,
        tokensPerRequest:
          baseMetrics.tokensPerRequest !== null
            ? baseMetrics.tokensPerRequest
            : derivedFallback.tokensPerRequest,
        successRate:
          baseMetrics.successRate !== null ? baseMetrics.successRate : derivedFallback.successRate,
        errorRate: derivedFallback.errorRate
      },
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
