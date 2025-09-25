#!/usr/bin/env node

/**
 * Backfill Redis data into PostgreSQL.
 *
 * Usage:
 *   POSTGRES_ENABLED=true node scripts/postgres-backfill.js [--dry-run] [--skip-usage] [--force-usage]
 */

const postgres = require('../src/models/db')
const redis = require('../src/models/redis')
const logger = require('../src/utils/logger')
const postgresRepo = require('../src/repositories/postgresUsageRepository')
const apiKeyService = require('../src/services/apiKeyService')
const claudeAccountService = require('../src/services/claudeAccountService')
const claudeConsoleAccountService = require('../src/services/claudeConsoleAccountService')
const geminiAccountService = require('../src/services/geminiAccountService')
const bedrockAccountService = require('../src/services/bedrockAccountService')
const openaiAccountService = require('../src/services/openaiAccountService')
const azureOpenaiAccountService = require('../src/services/azureOpenaiAccountService')
const openaiResponsesAccountService = require('../src/services/openaiResponsesAccountService')
const ccrAccountService = require('../src/services/ccrAccountService')

const args = process.argv.slice(2)
const options = {
  dryRun: args.includes('--dry-run'),
  skipUsage: args.includes('--skip-usage'),
  forceUsage: args.includes('--force-usage')
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function inferStatus(raw) {
  if (raw.status) {
    return raw.status
  }
  if (raw.isActive !== undefined) {
    return raw.isActive === true || raw.isActive === 'true' ? 'active' : 'inactive'
  }
  if (raw.schedulable !== undefined) {
    return raw.schedulable === true || raw.schedulable === 'true' ? 'active' : 'inactive'
  }
  return 'unknown'
}

function normalizeAccounts(raw) {
  if (!raw) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
  }
  if (Array.isArray(raw.data)) {
    return raw.data
  }
  if (raw.success && Array.isArray(raw.accounts)) {
    return raw.accounts
  }
  if (Array.isArray(raw.items)) {
    return raw.items
  }
  return []
}

const ensuredAccountIds = new Set()

const platformFetchers = [
  {
    platform: 'claude',
    fetch: (id) => claudeAccountService.getAccount(id)
  },
  {
    platform: 'claude-console',
    fetch: async (id) => {
      const result = await claudeConsoleAccountService.getAccount(id)
      return result && result.success ? result.data : null
    }
  },
  {
    platform: 'gemini',
    fetch: async (id) => {
      const result = await geminiAccountService.getAccount(id)
      return result && result.success ? result.data : result
    }
  },
  {
    platform: 'bedrock',
    fetch: async (id) => {
      const result = await bedrockAccountService.getAccount(id)
      return result && result.success ? result.data : null
    }
  },
  {
    platform: 'openai',
    fetch: async (id) => {
      const result = await openaiAccountService.getAccount(id)
      return result && result.success ? result.data : result
    }
  },
  {
    platform: 'azure-openai',
    fetch: async (id) => {
      const result = await azureOpenaiAccountService.getAccount(id)
      return result && result.success ? result.data : result
    }
  },
  {
    platform: 'openai-responses',
    fetch: async (id) => {
      const result = await openaiResponsesAccountService.getAccount(id)
      return result && result.success ? result.data : result
    }
  },
  {
    platform: 'ccr',
    fetch: async (id) => {
      const result = await ccrAccountService.getAccount(id)
      return result && result.success ? result.data : result
    }
  }
]

function inferPlatformsForKey(key, accountId) {
  const candidates = []
  if (key.claudeAccountId && key.claudeAccountId === accountId) {
    candidates.push('claude')
  }
  if (key.claudeConsoleAccountId && key.claudeConsoleAccountId === accountId) {
    candidates.push('claude-console')
  }
  if (key.geminiAccountId && key.geminiAccountId === accountId) {
    candidates.push('gemini')
  }
  if (key.bedrockAccountId && key.bedrockAccountId === accountId) {
    candidates.push('bedrock')
  }
  if (key.openaiAccountId && key.openaiAccountId === accountId) {
    candidates.push('openai')
  }
  if (key.azureOpenaiAccountId && key.azureOpenaiAccountId === accountId) {
    candidates.push('azure-openai')
  }
  if (key.accountPlatform && typeof key.accountPlatform === 'string') {
    candidates.push(key.accountPlatform)
  }
  return candidates
}

async function ensureAccountForKey(key, accountId) {
  if (!accountId) {
    return
  }

  if (ensuredAccountIds.has(accountId)) {
    return
  }

  const existing = await postgres.query('SELECT 1 FROM accounts WHERE id = $1', [accountId])
  if (existing.rowCount > 0) {
    ensuredAccountIds.add(accountId)
    return
  }

  const platformHints = inferPlatformsForKey(key, accountId)
  const tried = new Set()
  let selectedPlatform = platformHints[0] || 'unknown'
  let accountData = null

  const orderedPlatforms = [...platformHints, ...platformFetchers.map((p) => p.platform)]

  for (const platform of orderedPlatforms) {
    if (!platform || tried.has(platform)) {
      continue
    }
    tried.add(platform)
    const fetcher = platformFetchers.find((p) => p.platform === platform)
    if (!fetcher) {
      continue
    }
    try {
      const data = await fetcher.fetch(accountId)
      if (data) {
        accountData = data
        selectedPlatform = platform
        break
      }
    } catch (error) {
      logger.debug(`⚠️ Unable to fetch ${platform} account ${accountId}: ${error.message}`)
    }
  }

  let record
  if (accountData) {
    record = {
      id: accountId,
      name: accountData.name || `${selectedPlatform}-${accountId}`,
      type: accountData.accountType || accountData.type || 'generic',
      platform: selectedPlatform,
      description: accountData.description || '',
      status: inferStatus(accountData),
      priority: parseNumber(accountData.priority, 50),
      metadata: accountData
    }
  } else {
    record = {
      id: accountId,
      name: `Recovered Account ${accountId}`,
      type: 'generic',
      platform: selectedPlatform,
      description: '',
      status: 'unknown',
      priority: 50,
      metadata: {
        source: 'backfill',
        note: 'Account not found in Redis during backfill'
      }
    }
  }

  await postgresRepo.upsertAccount(record)
  ensuredAccountIds.add(accountId)
}

async function backfillAccounts() {
  const accountSources = [
    {
      name: 'claude',
      loader: () => claudeAccountService.getAllAccounts()
    },
    {
      name: 'claude-console',
      loader: () => claudeConsoleAccountService.getAllAccounts()
    },
    {
      name: 'gemini',
      loader: () => geminiAccountService.getAllAccounts()
    },
    {
      name: 'bedrock',
      loader: () => bedrockAccountService.getAllAccounts()
    },
    {
      name: 'openai',
      loader: () => openaiAccountService.getAllAccounts()
    },
    {
      name: 'azure-openai',
      loader: () => azureOpenaiAccountService.getAllAccounts()
    },
    {
      name: 'openai-responses',
      loader: () => openaiResponsesAccountService.getAllAccounts()
    },
    {
      name: 'ccr',
      loader: () => ccrAccountService.getAllAccounts()
    }
  ]

  let total = 0
  for (const source of accountSources) {
    let accounts = []
    try {
      const result = await source.loader()
      accounts = normalizeAccounts(result)
    } catch (error) {
      logger.warn(`⚠️ Failed to load ${source.name} accounts: ${error.message}`)
      continue
    }

    if (!accounts || accounts.length === 0) {
      logger.info(`ℹ️ No ${source.name} accounts found`)
      continue
    }

    logger.info(`🔄 Backfilling ${accounts.length} ${source.name} accounts...`)
    for (const account of accounts) {
      const record = {
        id: account.id,
        name: account.name || `${source.name}-${account.id}`,
        type: account.accountType || account.type || 'generic',
        platform: source.name,
        description: account.description || '',
        status: inferStatus(account),
        priority: parseNumber(account.priority, 50),
        metadata: account
      }

      if (options.dryRun) {
        logger.info(`📝 [dry-run] Would upsert account ${record.id} (${record.platform})`)
        continue
      }

      try {
        await postgresRepo.upsertAccount(record)
        total += 1
      } catch (error) {
        logger.error(`❌ Failed to upsert account ${record.id}:`, error)
      }
    }
  }

  logger.success(`✅ Account backfill completed (${total} records)`)
}

async function backfillApiKeys() {
  let apiKeys = []
  try {
    apiKeys = await apiKeyService.getAllApiKeys(true)
  } catch (error) {
    logger.error('❌ Failed to load API Keys:', error)
    return
  }

  if (!apiKeys || apiKeys.length === 0) {
    logger.info('ℹ️ No API Keys found for backfill')
    return
  }

  logger.info(`🔄 Backfilling ${apiKeys.length} API Keys...`)

  for (const key of apiKeys) {
    const candidateAccountIds = new Set()
    if (apiKeyService._resolvePrimaryAccountId) {
      const resolved = apiKeyService._resolvePrimaryAccountId(key)
      if (resolved) {
        candidateAccountIds.add(resolved)
      }
    }

    const accountFieldCandidates = [
      'claudeAccountId',
      'claudeConsoleAccountId',
      'geminiAccountId',
      'bedrockAccountId',
      'openaiAccountId',
      'azureOpenaiAccountId',
      'accountId'
    ]

    for (const field of accountFieldCandidates) {
      if (key[field]) {
        candidateAccountIds.add(key[field])
      }
    }

    for (const accountId of candidateAccountIds) {
      try {
        await ensureAccountForKey(key, accountId)
      } catch (error) {
        logger.warn(`⚠️ Failed to ensure account ${accountId} for key ${key.id}: ${error.message}`)
      }
    }

    const record = {
      id: key.id,
      accountId: candidateAccountIds.values().next().value || null,
      name: key.name || `API Key ${key.id}`,
      description: key.description || '',
      status:
        key.isDeleted === 'true' ? 'deleted' : key.isActive === 'true' ? 'active' : 'inactive',
      hashedKey: key.apiKey,
      dailyCostLimit: parseNumber(key.dailyCostLimit),
      totalCostLimit: parseNumber(key.totalCostLimit),
      lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt) : null,
      createdBy: key.createdBy || key.userUsername || null,
      metadata: apiKeyService._buildApiKeyMetadata ? apiKeyService._buildApiKeyMetadata(key) : key
    }

    if (options.dryRun) {
      logger.info(`📝 [dry-run] Would upsert API Key ${record.id}`)
      continue
    }

    try {
      await postgresRepo.upsertApiKey(record)

      // 更新累计成本
      const costStats = await redis.getCostStats(key.id)
      if (costStats && Number.isFinite(costStats.total)) {
        await postgres.query('UPDATE api_keys SET total_cost_accumulated = $1 WHERE id = $2', [
          costStats.total || 0,
          key.id
        ])
      }
    } catch (error) {
      logger.error(`❌ Failed to upsert API key ${key.id}:`, error)
    }
  }

  logger.success('✅ API Key metadata backfill completed')
}

async function backfillUsageRecords() {
  if (options.skipUsage) {
    logger.info('⏭️ Skipping usage record backfill (--skip-usage)')
    return
  }

  const { rows } = await postgres.query('SELECT id FROM api_keys')
  if (!rows || rows.length === 0) {
    logger.info('ℹ️ No API Keys present in PostgreSQL, skip usage backfill')
    return
  }

  logger.info(`🔄 Backfilling usage records for ${rows.length} API Keys...`)

  for (const { id: keyId } of rows) {
    if (!options.forceUsage) {
      const existing = await postgres.query(
        'SELECT COUNT(1)::int AS count FROM usage_records WHERE api_key_id = $1',
        [keyId]
      )
      if (existing.rows[0].count > 0) {
        logger.info(
          `ℹ️ Usage records already exist for ${keyId}, skipping (use --force-usage to append)`
        )
        continue
      }
    }

    const usageRecords = await redis.getUsageRecords(keyId, 500)
    if (!usageRecords || usageRecords.length === 0) {
      continue
    }

    logger.info(`   • API Key ${keyId}: importing ${usageRecords.length} records`)
    const recordsInChronoOrder = [...usageRecords].reverse()

    for (const record of recordsInChronoOrder) {
      if (options.dryRun) {
        logger.info(
          `      📝 [dry-run] Would insert usage record for ${keyId} at ${record.timestamp}`
        )
        continue
      }

      try {
        const requestStatus =
          record.requestStatus ||
          record.request_status ||
          record.status ||
          (record.error || record.error_code ? 'error' : 'success')

        const responseLatencyMs =
          record.responseLatencyMs ||
          record.response_latency_ms ||
          record.latencyMs ||
          record.latency_ms ||
          record.durationMs ||
          record.duration_ms ||
          0

        const httpStatus =
          record.httpStatus ||
          record.http_status ||
          record.status_code ||
          record.response_status ||
          null

        const errorCode =
          record.errorCode ||
          record.error_code ||
          (record.error && record.error.code) ||
          record.error_type ||
          null

        const retries = record.retries || record.retry_count || record.attempts || 0

        const clientType = record.clientType || record.client_type || null
        const region = record.region || record.zone || null

        await postgresRepo.recordUsage({
          occurredAt: record.timestamp,
          accountId: record.accountId || null,
          apiKeyId: keyId,
          model: record.model || 'unknown',
          requests: record.requests || 1,
          inputTokens: record.inputTokens || record.input_tokens || 0,
          outputTokens: record.outputTokens || record.output_tokens || 0,
          cacheCreateTokens: record.cacheCreateTokens || record.cache_creation_input_tokens || 0,
          cacheReadTokens: record.cacheReadTokens || record.cache_read_input_tokens || 0,
          ephemeral5mTokens: record.ephemeral5mTokens || 0,
          ephemeral1hTokens: record.ephemeral1hTokens || 0,
          totalTokens:
            record.totalTokens ||
            record.total_tokens ||
            (record.inputTokens || 0) +
              (record.outputTokens || 0) +
              (record.cacheCreateTokens || 0) +
              (record.cacheReadTokens || 0),
          totalCost: record.cost || record.totalCost || 0,
          costBreakdown: record.costBreakdown || {},
          metadata: { source: 'redis-backfill' },
          requestStatus,
          responseLatencyMs,
          httpStatus,
          errorCode,
          retries,
          clientType,
          region
        })
      } catch (error) {
        logger.error(`❌ Failed to insert usage record for ${keyId}:`, error)
      }
    }
  }

  logger.success('✅ Usage record backfill completed')
}

async function main() {
  if (!postgres.isEnabled()) {
    logger.error(
      '❌ PostgreSQL support is disabled. Please set POSTGRES_ENABLED=true before running this script.'
    )
    process.exit(1)
  }

  try {
    await postgres.initialize()
    await redis.connect()

    await backfillAccounts()
    await backfillApiKeys()
    await backfillUsageRecords()

    logger.success('🎉 PostgreSQL backfill finished')
  } catch (error) {
    logger.error('💥 PostgreSQL backfill failed:', error)
    process.exitCode = 1
  } finally {
    await redis.disconnect()
    await postgres.shutdown()
    if (options.dryRun) {
      logger.info('📝 Dry-run completed. No data was written to PostgreSQL.')
    }
  }
}

main()
