#!/usr/bin/env node

const redis = require('../src/models/redis')
const postgres = require('../src/models/db')
const logger = require('../src/utils/logger')
const claudeAccountService = require('../src/services/claudeAccountService')
const apiKeyService = require('../src/services/apiKeyService')
const accountGroupService = require('../src/services/accountGroupService')

const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

const ACCOUNT_PREFIX = 'Test Breakdown Account'
const KEY_PREFIX = 'Test Breakdown Key'

async function createTestData() {
  const createdAccounts = []
  const createdKeys = []

  for (let i = 1; i <= 2; i++) {
    const accountName = `${ACCOUNT_PREFIX} ${i}`
    logger.info(`🏢 Creating test account: ${accountName}`)
    const account = await claudeAccountService.createAccount({
      name: accountName,
      description: 'Demo account for API key breakdown testing',
      email: `test-breakdown-${i}@example.com`,
      password: 'dummy-password',
      accountType: 'shared',
      priority: 40 + i,
      schedulable: true
    })
    createdAccounts.push(account)

    for (let k = 1; k <= 3; k++) {
      const keyName = `${KEY_PREFIX} ${i}-${k}`
      logger.info(`🔑 Creating test API Key: ${keyName}`)
      const key = await apiKeyService.generateApiKey({
        name: keyName,
        description: 'Demo api key for breakdown testing',
        claudeAccountId: account.id,
        tokenLimit: 1_000_000,
        concurrencyLimit: 5,
        rateLimitWindow: 60,
        rateLimitRequests: 120
      })
      createdKeys.push({ ...key, accountId: account.id })
    }
  }

  logger.info('📡 Generating usage records...')
  const models = [
    'claude-3-opus-20240229',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022'
  ]

  for (const { id: keyId, accountId } of createdKeys) {
    for (let i = 0; i < 12; i++) {
      const inputTokens = Math.floor(Math.random() * 1500) + 500
      const outputTokens = Math.floor(Math.random() * 2000) + 800
      const cacheCreateTokens = Math.random() > 0.6 ? Math.floor(Math.random() * 500) : 0
      const cacheReadTokens = Math.random() > 0.4 ? Math.floor(Math.random() * 300) : 0
      const model = models[Math.floor(Math.random() * models.length)]

      await apiKeyService.recordUsage(
        keyId,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        accountId
      )
    }
  }

  logger.success('✅ Test usage data created successfully.')
  logger.info('\n📋 Summary:')
  createdAccounts.forEach((account, idx) => {
    logger.info(`- Account ${idx + 1}: ${account.name} (${account.id})`)
    const accountKeys = createdKeys.filter((item) => item.accountId === account.id)
    accountKeys.forEach((key) => {
      logger.info(`   • API Key: ${key.name} (${key.id})`)
    })
  })

  logger.info('\nℹ️ 打开管理后台账户详情，即可在“API Key 明细”中查看这些数据。')
}

async function cleanTestData() {
  logger.info('🧹 Cleaning test breakdown data...')

  const allKeys = await apiKeyService.getAllApiKeys(true)
  const cleanupKeys = allKeys.filter((key) => key.name && key.name.startsWith(KEY_PREFIX))
  for (const key of cleanupKeys) {
    try {
      await apiKeyService.deleteApiKey(key.id)
      logger.info(`🗑️ Deleted API Key ${key.name}`)
    } catch (error) {
      logger.warn(`⚠️ Failed to delete API Key ${key.name}: ${error.message}`)
    }
  }

  const allAccounts = await redis.getAllClaudeAccounts()
  const cleanupAccounts = allAccounts.filter(
    (acc) => acc.name && acc.name.startsWith(ACCOUNT_PREFIX)
  )
  for (const account of cleanupAccounts) {
    try {
      await accountGroupService.removeAccountFromAllGroups(account.id)
    } catch (error) {
      logger.warn(`⚠️ Failed to remove account ${account.name} from groups: ${error.message}`)
    }
    try {
      await claudeAccountService.deleteAccount(account.id)
      logger.info(`🗑️ Deleted account ${account.name}`)
    } catch (error) {
      logger.warn(`⚠️ Failed to delete account ${account.name}: ${error.message}`)
    }
  }

  logger.success('✅ Test data cleaned.')
}

async function main() {
  try {
    if (postgres.isEnabled()) {
      try {
        await postgres.initialize()
      } catch (error) {
        logger.warn('⚠️ PostgreSQL 未就绪，将使用 Redis 降级模式生成测试数据：', error.message)
      }
    }
    await redis.connect()

    if (shouldClean) {
      await cleanTestData()
    } else {
      await cleanTestData()
      await createTestData()
    }
  } catch (error) {
    logger.error('❌ generate-breakdown-demo error:', error)
    process.exitCode = 1
  } finally {
    await redis.disconnect()
    if (postgres.isEnabled()) {
      await postgres.shutdown()
    }
    // 由于服务层在加载时会注册 setInterval，这里显式退出，避免阻塞调用方
    const exitCode = process.exitCode || 0
    process.exit(exitCode)
  }
}

main()
