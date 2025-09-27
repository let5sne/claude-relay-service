#!/usr/bin/env node

/**
 * 测试数据清理脚本
 * 清理 Redis 和 PostgreSQL 中的测试数据
 *
 * 使用方法:
 * node scripts/clean-test-data.js [--redis-only|--postgres-only|--dry-run]
 *
 * 选项:
 * --redis-only: 只清理 Redis 数据
 * --postgres-only: 只清理 PostgreSQL 数据
 * --dry-run: 预览模式，只显示将要删除的数据，不实际删除
 * --confirm: 跳过确认提示，直接执行
 */

const redis = require('../src/models/redis')
const db = require('../src/models/db')
const logger = require('../src/utils/logger')

// 解析命令行参数
const args = process.argv.slice(2)
const options = {
  redisOnly: args.includes('--redis-only'),
  postgresOnly: args.includes('--postgres-only'),
  dryRun: args.includes('--dry-run'),
  confirm: args.includes('--confirm')
}

// 测试数据标识模式
const TEST_PATTERNS = [
  'test',
  'Test',
  'TEST',
  'demo',
  'Demo',
  'DEMO',
  'breakdown',
  'Breakdown',
  'sample',
  'Sample'
]

// 询问用户确认
function askConfirmation(message) {
  return new Promise((resolve) => {
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

// 检查是否为测试数据
function isTestData(name, description = '') {
  if (!name && !description) {
    return false
  }

  const text = `${name || ''} ${description || ''}`.toLowerCase()
  return TEST_PATTERNS.some((pattern) => text.includes(pattern.toLowerCase()))
}

// 清理 Redis 中的测试数据
async function cleanRedisTestData() {
  logger.info('🔍 扫描 Redis 中的测试数据...')

  const client = redis.getClientSafe()
  let deletedCount = 0

  try {
    // 1. 清理测试 API Keys
    const apiKeyIds = await client.smembers('api_keys')
    const testApiKeys = []

    for (const keyId of apiKeyIds) {
      const keyData = await redis.getApiKey(keyId)
      if (keyData && isTestData(keyData.name, keyData.description)) {
        testApiKeys.push({ id: keyId, name: keyData.name })
      }
    }

    if (testApiKeys.length > 0) {
      logger.info(`📋 发现 ${testApiKeys.length} 个测试 API Keys:`)
      testApiKeys.forEach((key) => {
        logger.info(`   - ${key.name} (${key.id})`)
      })

      if (!options.dryRun) {
        for (const key of testApiKeys) {
          // 删除 API Key 相关的所有 Redis 键
          const patterns = [
            `api_key:${key.id}`,
            `api_key_hash:*`,
            `usage:${key.id}`,
            `usage:daily:${key.id}:*`,
            `usage:monthly:${key.id}:*`,
            `usage:${key.id}:model:*`,
            `cost:${key.id}:*`,
            `rate_limit:${key.id}:*`
          ]

          for (const pattern of patterns) {
            const keys = await client.keys(pattern)
            if (keys.length > 0) {
              await client.del(...keys)
              deletedCount += keys.length
            }
          }

          // 从集合中移除
          await client.srem('api_keys', key.id)
        }
        logger.success(`✅ 已删除 ${testApiKeys.length} 个测试 API Keys`)
      }
    }

    // 2. 清理测试账户 (Claude OAuth)
    const claudeAccounts = await redis.getAllClaudeAccounts()
    const testClaudeAccounts = claudeAccounts.filter((acc) => isTestData(acc.name, acc.description))

    if (testClaudeAccounts.length > 0) {
      logger.info(`📋 发现 ${testClaudeAccounts.length} 个测试 Claude 账户:`)
      testClaudeAccounts.forEach((acc) => {
        logger.info(`   - ${acc.name} (${acc.id})`)
      })

      if (!options.dryRun) {
        for (const acc of testClaudeAccounts) {
          await client.del(`claude:account:${acc.id}`)
          await client.srem('claude:accounts', acc.id)
          deletedCount++
        }
        logger.success(`✅ 已删除 ${testClaudeAccounts.length} 个测试 Claude 账户`)
      }
    }

    // 3. 清理测试分组数据
    const allGroups = (await redis.getAllGroups) ? await redis.getAllGroups() : []
    const testGroups = allGroups.filter((group) => isTestData(group.name, group.description))

    if (testGroups.length > 0) {
      logger.info(`📋 发现 ${testGroups.length} 个测试分组:`)
      testGroups.forEach((group) => {
        logger.info(`   - ${group.name} (${group.id})`)
      })

      if (!options.dryRun) {
        for (const group of testGroups) {
          const patterns = [`account_group:${group.id}`, `group:${group.id}:*`]

          for (const pattern of patterns) {
            const keys = await client.keys(pattern)
            if (keys.length > 0) {
              await client.del(...keys)
              deletedCount += keys.length
            }
          }
        }
        logger.success(`✅ 已删除 ${testGroups.length} 个测试分组`)
      }
    }

    // 4. 清理模型统计中的测试数据
    const modelKeys = await client.keys('usage:model:*')
    const testModelKeys = []

    for (const key of modelKeys) {
      const data = await client.hgetall(key)
      if (data && Object.keys(data).length === 0) {
        testModelKeys.push(key)
      }
    }

    if (testModelKeys.length > 0 && !options.dryRun) {
      await client.del(...testModelKeys)
      deletedCount += testModelKeys.length
      logger.success(`✅ 已清理 ${testModelKeys.length} 个空的模型统计键`)
    }
  } catch (error) {
    logger.error('❌ Redis 数据清理失败:', error)
    throw error
  }

  return deletedCount
}

// 清理 PostgreSQL 中的测试数据
async function cleanPostgresTestData() {
  if (!db.isEnabled()) {
    logger.warn('⚠️ PostgreSQL 未启用，跳过清理')
    return 0
  }

  logger.info('🔍 扫描 PostgreSQL 中的测试数据...')

  let deletedCount = 0

  try {
    // 1. 查找测试 API Keys
    const testApiKeysQuery = `
      SELECT id, name, description
      FROM api_keys
      WHERE name ILIKE ANY($1)
         OR description ILIKE ANY($1)
    `
    const patterns = TEST_PATTERNS.map((p) => `%${p}%`)
    const { rows: testApiKeys } = await db.query(testApiKeysQuery, [patterns])

    if (testApiKeys.length > 0) {
      logger.info(`📋 发现 ${testApiKeys.length} 个测试 API Keys:`)
      testApiKeys.forEach((key) => {
        logger.info(`   - ${key.name} (${key.id})`)
      })

      if (!options.dryRun) {
        // 先删除相关的使用记录
        const usageDeleteQuery = `
          DELETE FROM usage_records
          WHERE api_key_id = ANY($1::uuid[])
        `
        const keyIds = testApiKeys.map((k) => k.id)
        const usageResult = await db.query(usageDeleteQuery, [keyIds])
        deletedCount += usageResult.rowCount || 0

        // 再删除 API Keys
        const keyDeleteQuery = `
          DELETE FROM api_keys
          WHERE id = ANY($1::uuid[])
        `
        const keyResult = await db.query(keyDeleteQuery, [keyIds])
        deletedCount += keyResult.rowCount || 0

        logger.success(`✅ 已删除 ${testApiKeys.length} 个测试 API Keys 及其使用记录`)
      }
    }

    // 2. 查找测试账户
    const testAccountsQuery = `
      SELECT id, name, description
      FROM accounts
      WHERE name ILIKE ANY($1)
         OR description ILIKE ANY($1)
    `
    const { rows: testAccounts } = await db.query(testAccountsQuery, [patterns])

    if (testAccounts.length > 0) {
      logger.info(`📋 发现 ${testAccounts.length} 个测试账户:`)
      testAccounts.forEach((acc) => {
        logger.info(`   - ${acc.name} (${acc.id})`)
      })

      if (!options.dryRun) {
        // 先删除相关的使用记录
        const usageDeleteQuery = `
          DELETE FROM usage_records
          WHERE account_id = ANY($1::uuid[])
        `
        const accountIds = testAccounts.map((a) => a.id)
        const usageResult = await db.query(usageDeleteQuery, [accountIds])
        deletedCount += usageResult.rowCount || 0

        // 再删除账户
        const accountDeleteQuery = `
          DELETE FROM accounts
          WHERE id = ANY($1::uuid[])
        `
        const accountResult = await db.query(accountDeleteQuery, [accountIds])
        deletedCount += accountResult.rowCount || 0

        logger.success(`✅ 已删除 ${testAccounts.length} 个测试账户及其使用记录`)
      }
    }

    // 3. 清理孤立的使用记录（账户或 API Key 已删除）
    if (!options.dryRun) {
      const orphanQuery = `
        DELETE FROM usage_records
        WHERE account_id IS NULL
           OR api_key_id IS NULL
           OR account_id NOT IN (SELECT id FROM accounts)
           OR api_key_id NOT IN (SELECT id FROM api_keys)
      `
      const orphanResult = await db.query(orphanQuery)
      if (orphanResult.rowCount > 0) {
        deletedCount += orphanResult.rowCount
        logger.success(`✅ 已清理 ${orphanResult.rowCount} 条孤立的使用记录`)
      }
    }
  } catch (error) {
    logger.error('❌ PostgreSQL 数据清理失败:', error)
    throw error
  }

  return deletedCount
}

// 显示数据库状态
async function showDatabaseStatus() {
  logger.info('\n📊 数据库状态统计:')
  logger.info('='.repeat(50))

  try {
    // Redis 统计
    const client = redis.getClientSafe()
    const apiKeyCount = (await client.scard('api_keys')) || 0
    const claudeAccountCount = (await redis.getAllClaudeAccounts()).length

    logger.info(`Redis:`)
    logger.info(`   API Keys: ${apiKeyCount}`)
    logger.info(`   Claude 账户: ${claudeAccountCount}`)

    // PostgreSQL 统计
    if (db.isEnabled()) {
      const {
        rows: [accountStat]
      } = await db.query('SELECT COUNT(*) as count FROM accounts')
      const {
        rows: [apiKeyStat]
      } = await db.query('SELECT COUNT(*) as count FROM api_keys')
      const {
        rows: [usageStat]
      } = await db.query('SELECT COUNT(*) as count FROM usage_records')

      logger.info(`PostgreSQL:`)
      logger.info(`   账户: ${accountStat.count}`)
      logger.info(`   API Keys: ${apiKeyStat.count}`)
      logger.info(`   使用记录: ${usageStat.count}`)
    } else {
      logger.info(`PostgreSQL: 未启用`)
    }
  } catch (error) {
    logger.warn('⚠️ 获取数据库状态失败:', error.message)
  }

  logger.info('='.repeat(50))
}

// 主函数
async function main() {
  try {
    logger.info('🧹 测试数据清理工具')
    logger.info('='.repeat(50))

    if (options.dryRun) {
      logger.info('🔍 预览模式 - 不会实际删除数据')
    }

    // 连接数据库
    await redis.connect()
    if (db.isEnabled()) {
      await db.initialize()
    }

    // 显示当前状态
    await showDatabaseStatus()

    // 确认操作
    if (!options.dryRun && !options.confirm) {
      const confirmed = await askConfirmation('\n⚠️ 确定要删除测试数据吗？此操作不可逆')
      if (!confirmed) {
        logger.info('❌ 用户取消操作')
        return
      }
    }

    let totalDeleted = 0

    // 执行清理
    if (!options.postgresOnly) {
      logger.info('\n🧹 开始清理 Redis 测试数据...')
      const redisDeleted = await cleanRedisTestData()
      totalDeleted += redisDeleted
    }

    if (!options.redisOnly) {
      logger.info('\n🧹 开始清理 PostgreSQL 测试数据...')
      const postgresDeleted = await cleanPostgresTestData()
      totalDeleted += postgresDeleted
    }

    // 显示结果
    logger.info(`\n${'='.repeat(50)}`)
    if (options.dryRun) {
      logger.info('🔍 预览完成 - 发现的测试数据已列出')
    } else {
      logger.success(`✅ 清理完成！共删除 ${totalDeleted} 条记录`)
    }

    // 显示清理后状态
    await showDatabaseStatus()
  } catch (error) {
    logger.error('💥 清理过程中发生错误:', error)
    process.exitCode = 1
  } finally {
    try {
      await redis.disconnect()
      if (db.isEnabled()) {
        await db.shutdown()
      }
    } catch (error) {
      logger.warn('⚠️ 关闭数据库连接时出错:', error.message)
    }
  }
}

// 运行脚本
if (require.main === module) {
  main()
}

module.exports = {
  cleanRedisTestData,
  cleanPostgresTestData,
  showDatabaseStatus
}
