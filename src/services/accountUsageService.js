const db = require('../models/db')
const redis = require('../models/redis')
const logger = require('../utils/logger')
const postgresUsageRepository = require('../repositories/postgresUsageRepository')
const claudeAccountService = require('./claudeAccountService')
const apiKeyService = require('./apiKeyService')

function normalizeNumber(value) {
  if (value === null || value === undefined) {
    return 0
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

async function getAccountInfo(accountId) {
  try {
    if (db.isEnabled()) {
      const accountRow = await postgresUsageRepository.getAccountById(accountId)
      if (accountRow) {
        return {
          id: accountRow.id,
          name: accountRow.name,
          type: accountRow.type,
          platform: accountRow.platform,
          status: accountRow.status,
          priority: accountRow.priority,
          metadata: accountRow.metadata || {}
        }
      }
    }

    // Fallback to Claude account service (primary provider)
    const claudeAccount = await claudeAccountService.getAccount(accountId)
    if (claudeAccount) {
      return {
        id: claudeAccount.id,
        name: claudeAccount.name,
        type: claudeAccount.accountType || 'claude',
        platform: claudeAccount.platform || 'claude',
        status: claudeAccount.status || (claudeAccount.isActive ? 'active' : 'disabled'),
        priority: claudeAccount.priority ? parseInt(claudeAccount.priority, 10) : undefined,
        metadata: {
          schedulable: claudeAccount.schedulable,
          autoStopOnWarning: claudeAccount.autoStopOnWarning,
          useUnifiedUserAgent: claudeAccount.useUnifiedUserAgent,
          useUnifiedClientId: claudeAccount.useUnifiedClientId
        }
      }
    }
  } catch (error) {
    logger.debug(`Failed to fetch account info for ${accountId}:`, error.message)
  }

  return {
    id: accountId,
    name: accountId,
    type: 'unknown',
    status: 'unknown'
  }
}

async function getAccountsWithUsage(options = {}) {
  if (db.isEnabled()) {
    const rows = await postgresUsageRepository.getAccountsTotals(options)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      platform: row.platform,
      status: row.status,
      priority: row.priority,
      metadata: row.metadata || {},
      usage: {
        daily: {
          requests: normalizeNumber(row.daily_requests),
          allTokens: normalizeNumber(row.daily_tokens),
          cost: normalizeNumber(row.daily_cost)
        },
        monthly: {
          requests: normalizeNumber(row.monthly_requests),
          allTokens: normalizeNumber(row.monthly_tokens),
          cost: normalizeNumber(row.monthly_cost)
        },
        total: {
          requests: normalizeNumber(row.requests),
          allTokens: normalizeNumber(row.total_tokens),
          cost: normalizeNumber(row.total_cost)
        }
      }
    }))
  }

  const fallbackStats = await redis.getAllAccountsUsageStats()
  return fallbackStats.map((item) => ({
    id: item.accountId,
    name: item.name || item.accountName || item.accountId,
    type: item.platform || item.accountType || 'claude',
    status: item.status || (item.isActive ? 'active' : 'disabled'),
    usage: {
      daily: {
        requests: normalizeNumber(item.daily?.requests),
        allTokens: normalizeNumber(item.daily?.allTokens),
        cost: normalizeNumber(item.daily?.cost)
      },
      monthly: {
        requests: normalizeNumber(item.monthly?.requests),
        allTokens: normalizeNumber(item.monthly?.allTokens),
        cost: normalizeNumber(item.monthly?.cost)
      },
      total: {
        requests: normalizeNumber(item.total?.requests),
        allTokens: normalizeNumber(item.total?.allTokens),
        cost: normalizeNumber(item.total?.cost)
      }
    }
  }))
}

async function getAccountSummary(accountId, options = {}) {
  const accountInfo = await getAccountInfo(accountId)

  if (db.isEnabled()) {
    const summary = await postgresUsageRepository.getAccountUsageSummary(accountId, options)
    return {
      account: accountInfo,
      usage: {
        requests: normalizeNumber(summary?.requests),
        tokens: normalizeNumber(summary?.total_tokens),
        inputTokens: normalizeNumber(summary?.input_tokens),
        outputTokens: normalizeNumber(summary?.output_tokens),
        cacheCreateTokens: normalizeNumber(summary?.cache_create_tokens),
        cacheReadTokens: normalizeNumber(summary?.cache_read_tokens),
        cost: normalizeNumber(summary?.total_cost)
      }
    }
  }

  const fallback = await redis.getAccountUsageStats(accountId)
  return {
    account: accountInfo,
    usage: {
      requests: normalizeNumber(fallback?.total?.requests),
      tokens: normalizeNumber(fallback?.total?.allTokens),
      inputTokens: normalizeNumber(fallback?.total?.inputTokens),
      outputTokens: normalizeNumber(fallback?.total?.outputTokens),
      cacheCreateTokens: normalizeNumber(fallback?.total?.cacheCreateTokens),
      cacheReadTokens: normalizeNumber(fallback?.total?.cacheReadTokens),
      cost: normalizeNumber(fallback?.total?.cost)
    }
  }
}

async function getAccountBreakdown(accountId, options = {}) {
  if (db.isEnabled()) {
    const rows = await postgresUsageRepository.getAccountUsageBreakdown(accountId, options)

    if (!rows || rows.length === 0) {
      return []
    }

    const apiKeyNameCache = new Map()

    return Promise.all(
      rows.map(async (row) => {
        let apiKeyName = row.api_key_name
        if (!apiKeyName && row.api_key_id) {
          if (!apiKeyNameCache.has(row.api_key_id)) {
            try {
              const key = await apiKeyService.getApiKeyById(row.api_key_id)
              apiKeyNameCache.set(row.api_key_id, key ? key.name : row.api_key_id)
            } catch (error) {
              apiKeyNameCache.set(row.api_key_id, row.api_key_id)
            }
          }
          apiKeyName = apiKeyNameCache.get(row.api_key_id)
        }

        return {
          apiKeyId: row.api_key_id,
          apiKeyName: apiKeyName || row.api_key_id,
          requests: normalizeNumber(row.requests),
          inputTokens: normalizeNumber(row.input_tokens),
          outputTokens: normalizeNumber(row.output_tokens),
          totalTokens: normalizeNumber(row.total_tokens),
          totalCost: normalizeNumber(row.total_cost),
          totalCostLimit: row.total_cost_limit,
          dailyCostLimit: row.daily_cost_limit,
          totalCostAccumulated: row.total_cost_accumulated,
          lastUsedAt: row.last_used_at
        }
      })
    )
  }

  const fallback = await redis.getAccountKeyUsageBreakdown(accountId, options)
  if (!fallback) {
    return []
  }
  if (Array.isArray(fallback)) {
    return fallback
  }
  return fallback.items || []
}

module.exports = {
  getAccountsWithUsage,
  getAccountSummary,
  getAccountBreakdown
}
