const db = require('../models/db')
const logger = require('../utils/logger')

function getRangeBounds(range = 'total', options = {}) {
  const now = new Date()

  if (range === 'custom') {
    if (!options.start || !options.end) {
      return {}
    }
    return { start: new Date(options.start), end: new Date(options.end) }
  }

  if (range === 'month' && options.month) {
    const [year, month] = options.month.split('-').map((v) => parseInt(v, 10))
    if (!year || !month) {
      return {}
    }
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 1))
    return { start, end }
  }

  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  switch (range) {
    case 'today':
      return {
        start: startOfToday,
        end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
      }
    case '7d':
    case '7days':
      return {
        start: new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000),
        end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
      }
    case '30d':
    case '30days':
      return {
        start: new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000),
        end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
      }
    default:
      return {}
  }
}

async function upsertAccount(account) {
  if (!db.isEnabled()) {
    return null
  }

  const {
    id,
    name,
    type = 'generic',
    platform = null,
    description = null,
    status = 'active',
    priority = 50,
    metadata = {}
  } = account

  if (!id || !name) {
    throw new Error('Account id and name are required for upsertAccount')
  }

  const query = `
    INSERT INTO accounts (id, name, type, platform, description, status, priority, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb))
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      platform = EXCLUDED.platform,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      metadata = accounts.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING *
  `

  const values = [id, name, type, platform, description, status, priority, JSON.stringify(metadata)]

  const result = await db.query(query, values)
  logger.database?.(`🐘 Upserted account ${id}`)
  return result.rows[0]
}

async function markAccountDeleted(accountId) {
  if (!db.isEnabled()) {
    return null
  }

  await db.query(`UPDATE accounts SET status = 'deleted', updated_at = NOW() WHERE id = $1`, [
    accountId
  ])
}

async function getAccountById(accountId) {
  if (!db.isEnabled()) {
    return null
  }

  const result = await db.query('SELECT * FROM accounts WHERE id = $1', [accountId])
  return result.rows[0] || null
}

async function upsertApiKey(apiKey) {
  if (!db.isEnabled()) {
    return null
  }

  const {
    id,
    accountId = null,
    name,
    description = null,
    status = 'active',
    hashedKey = null,
    dailyCostLimit = 0,
    totalCostLimit = 0,
    lastUsedAt = null,
    createdBy = null,
    metadata = {}
  } = apiKey

  if (!id || !name) {
    throw new Error('API key id and name are required for upsertApiKey')
  }

  const query = `
    INSERT INTO api_keys (
      id,
      account_id,
      name,
      description,
      status,
      hashed_key,
      daily_cost_limit,
      total_cost_limit,
      last_used_at,
      created_by,
      metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::jsonb, '{}'::jsonb)
    )
    ON CONFLICT (id) DO UPDATE
    SET
      account_id = EXCLUDED.account_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      hashed_key = COALESCE(EXCLUDED.hashed_key, api_keys.hashed_key),
      daily_cost_limit = EXCLUDED.daily_cost_limit,
      total_cost_limit = EXCLUDED.total_cost_limit,
      last_used_at = COALESCE(EXCLUDED.last_used_at, api_keys.last_used_at),
      created_by = COALESCE(EXCLUDED.created_by, api_keys.created_by),
      metadata = api_keys.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING *
  `

  const values = [
    id,
    accountId,
    name,
    description,
    status,
    hashedKey,
    dailyCostLimit,
    totalCostLimit,
    lastUsedAt,
    createdBy,
    JSON.stringify(metadata)
  ]

  const result = await db.query(query, values)
  logger.database?.(`🐘 Upserted API key ${id}`)
  return result.rows[0]
}

async function markApiKeyDeleted(apiKeyId, deletedAt = new Date()) {
  if (!db.isEnabled()) {
    return null
  }

  await db.query(
    `UPDATE api_keys SET status = 'deleted', deleted_at = $2, updated_at = NOW() WHERE id = $1`,
    [apiKeyId, deletedAt]
  )
}

async function deleteApiKey(apiKeyId) {
  if (!db.isEnabled()) {
    return null
  }

  await db.query('DELETE FROM api_keys WHERE id = $1', [apiKeyId])
}

async function recordUsage(usage) {
  if (!db.isEnabled()) {
    return null
  }

  const {
    occurredAt = new Date(),
    accountId = null,
    apiKeyId = null,
    model = 'unknown',
    requests = 1,
    inputTokens = 0,
    outputTokens = 0,
    cacheCreateTokens = 0,
    cacheReadTokens = 0,
    ephemeral5mTokens = 0,
    ephemeral1hTokens = 0,
    totalTokens = 0,
    totalCost = 0,
    actualCost = null,
    costSource = null,
    billingPeriod = null,
    confidenceLevel = null,
    costBreakdown = {},
    metadata = {},
    requestStatus = 'success',
    responseLatencyMs = 0,
    httpStatus = null,
    errorCode = null,
    retries = 0,
    clientType = null,
    region = null
  } = usage

  const occurred = new Date(occurredAt)
  const usageDate = new Date(
    Date.UTC(occurred.getUTCFullYear(), occurred.getUTCMonth(), occurred.getUTCDate())
  )
  const usageHour = occurred.getUTCHours()

  return db.withTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO usage_records (
        occurred_at,
        usage_date,
        usage_hour,
        account_id,
        api_key_id,
        model,
        requests,
        input_tokens,
        output_tokens,
        cache_create_tokens,
        cache_read_tokens,
        ephemeral_5m_tokens,
        ephemeral_1h_tokens,
        total_tokens,
        total_cost,
        cost_breakdown,
        metadata,
        actual_cost,
        cost_source,
        billing_period,
        confidence_level,
        request_status,
        response_latency_ms,
        http_status,
        error_code,
        retries,
        client_type,
        region
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        COALESCE($16::jsonb, '{}'::jsonb),
        COALESCE($17::jsonb, '{}'::jsonb),
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        $26,
        $27,
        $28
      )
    `,
      [
        occurred,
        usageDate,
        usageHour,
        accountId,
        apiKeyId,
        model,
        requests,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        ephemeral5mTokens,
        ephemeral1hTokens,
        totalTokens,
        totalCost,
        JSON.stringify(costBreakdown),
        JSON.stringify(metadata),
        actualCost,
        costSource,
        billingPeriod,
        confidenceLevel,
        requestStatus,
        responseLatencyMs,
        httpStatus,
        errorCode,
        retries,
        clientType,
        region
      ]
    )

    if (apiKeyId) {
      await client.query(
        `
        UPDATE api_keys
        SET
          total_cost_accumulated = total_cost_accumulated + $2,
          last_used_at = GREATEST(COALESCE(last_used_at, $1), $1),
          updated_at = NOW()
        WHERE id = $3
      `,
        [occurred, totalCost, apiKeyId]
      )
    }
  })
}

async function getAccountUsageSummary(accountId, options = {}) {
  if (!db.isEnabled()) {
    return null
  }

  const { range = 'total', start, end, month } = options
  const bounds = getRangeBounds(range, { start, end, month })
  const params = [accountId]
  let whereClause = 'account_id = $1'

  if (bounds.start && bounds.end) {
    params.push(bounds.start, bounds.end)
    whereClause += ` AND occurred_at >= $${params.length - 1} AND occurred_at < $${params.length}`
  }

  const query = `
    SELECT
      COALESCE(SUM(requests), 0) AS requests,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cache_create_tokens), 0) AS cache_create_tokens,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(ephemeral_5m_tokens), 0) AS ephemeral_5m_tokens,
      COALESCE(SUM(ephemeral_1h_tokens), 0) AS ephemeral_1h_tokens,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(total_cost), 0) AS total_cost
    FROM usage_records
    WHERE ${whereClause}
  `

  const result = await db.query(query, params)
  return result.rows[0]
}

async function getAccountsTotals(options = {}) {
  if (!db.isEnabled()) {
    return []
  }

  const {
    range = 'total',
    start,
    end,
    month,
    limit = 100,
    offset = 0,
    orderBy = 'total_tokens'
  } = options
  const bounds = getRangeBounds(range, { start, end, month })
  const params = []

  let whereClause = '1=1'
  if (bounds.start && bounds.end) {
    params.push(bounds.start, bounds.end)
    whereClause = `ur.occurred_at >= $${params.length - 1} AND ur.occurred_at < $${params.length}`
  }

  const orderField = ['total_cost', 'total_tokens', 'requests'].includes(orderBy)
    ? orderBy
    : 'total_tokens'

  const query = `
    SELECT
      a.id,
      a.name,
      a.type,
      a.platform,
      a.status,
      a.priority,
      a.metadata,
      a.created_at,
      COALESCE(SUM(ur.requests), 0) AS requests,
      COALESCE(SUM(ur.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(ur.total_cost), 0) AS total_cost,
      COALESCE(SUM(ur.requests) FILTER (WHERE ur.usage_date = CURRENT_DATE), 0) AS daily_requests,
      COALESCE(SUM(ur.total_tokens) FILTER (WHERE ur.usage_date = CURRENT_DATE), 0) AS daily_tokens,
      COALESCE(SUM(ur.total_cost) FILTER (WHERE ur.usage_date = CURRENT_DATE), 0) AS daily_cost,
      COALESCE(
        SUM(ur.requests)
        FILTER (WHERE date_trunc('month', ur.usage_date::timestamp) = date_trunc('month', CURRENT_DATE::timestamp)),
        0
      ) AS monthly_requests,
      COALESCE(
        SUM(ur.total_tokens)
        FILTER (WHERE date_trunc('month', ur.usage_date::timestamp) = date_trunc('month', CURRENT_DATE::timestamp)),
        0
      ) AS monthly_tokens,
      COALESCE(
        SUM(ur.total_cost)
        FILTER (WHERE date_trunc('month', ur.usage_date::timestamp) = date_trunc('month', CURRENT_DATE::timestamp)),
        0
      ) AS monthly_cost
    FROM accounts a
    LEFT JOIN usage_records ur ON ur.account_id = a.id
      ${whereClause !== '1=1' ? `AND ${whereClause}` : ''}
    GROUP BY a.id, a.created_at
    ORDER BY ${orderField} DESC
    LIMIT ${Math.max(1, Math.min(500, limit))}
    OFFSET ${Math.max(0, offset)}
  `

  const result = await db.query(query, params)
  return result.rows
}

async function getAccountUsageBreakdown(accountId, options = {}) {
  if (!db.isEnabled()) {
    return []
  }

  const { range = 'total', start, end, month, limit = 20, offset = 0, order = 'desc' } = options

  const bounds = getRangeBounds(range, { start, end, month })

  const params = [accountId]
  let whereClause = 'ur.account_id = $1'

  if (bounds.start && bounds.end) {
    params.push(bounds.start, bounds.end)
    whereClause += ` AND ur.occurred_at >= $${params.length - 1} AND ur.occurred_at < $${params.length}`
  }

  const orderDirection = order === 'asc' ? 'ASC' : 'DESC'

  const query = `
    SELECT
      ur.api_key_id AS api_key_id,
      ak.name AS api_key_name,
      COALESCE(SUM(ur.requests), 0) AS requests,
      COALESCE(SUM(ur.input_tokens), 0) AS input_tokens,
      COALESCE(SUM(ur.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(ur.cache_create_tokens), 0) AS cache_create_tokens,
      COALESCE(SUM(ur.cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(ur.total_tokens), 0) AS total_tokens,
      COALESCE(SUM(ur.total_cost), 0) AS total_cost,
      (ARRAY_AGG(ur.model ORDER BY ur.occurred_at DESC))[1] AS last_model,
      (ARRAY_AGG(ur.occurred_at ORDER BY ur.occurred_at DESC))[1] AS last_occurred_at,
      MAX(ak.total_cost_limit) AS total_cost_limit,
      MAX(ak.daily_cost_limit) AS daily_cost_limit,
      MAX(ak.total_cost_accumulated) AS total_cost_accumulated,
      MAX(ak.last_used_at) AS last_used_at
    FROM usage_records ur
    LEFT JOIN api_keys ak ON ak.id = ur.api_key_id
    WHERE ${whereClause}
    GROUP BY ur.api_key_id, ak.name
    ORDER BY total_tokens ${orderDirection}
    LIMIT ${Math.max(1, Math.min(200, limit))}
    OFFSET ${Math.max(0, offset)}
  `

  const result = await db.query(query, params)
  return result.rows
}

module.exports = {
  getRangeBounds,
  upsertAccount,
  markAccountDeleted,
  getAccountById,
  upsertApiKey,
  markApiKeyDeleted,
  deleteApiKey,
  recordUsage,
  getAccountUsageSummary,
  getAccountUsageBreakdown,
  getAccountsTotals
}
