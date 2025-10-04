#!/usr/bin/env node

/**
 * 诊断账户统计数据问题
 * 用法: node scripts/diagnose-account-stats.js <accountId>
 */

const db = require('../src/models/db')
const redis = require('../src/models/redis')

async function diagnose(accountId) {
  console.log(`\n🔍 诊断账户: ${accountId}\n`)

  // 1. 检查 PostgreSQL 连接
  console.log('📊 检查 PostgreSQL...')
  if (!db.isEnabled()) {
    console.log('❌ PostgreSQL 未启用 (POSTGRES_ENABLED != true)')
    return
  }

  try {
    await db.query('SELECT 1')
    console.log('✅ PostgreSQL 连接正常')
  } catch (error) {
    console.log(`❌ PostgreSQL 连接失败: ${error.message}`)
    return
  }

  // 2. 检查账户是否存在于 accounts 表
  console.log('\n📋 检查 accounts 表...')
  try {
    const accountResult = await db.query('SELECT * FROM accounts WHERE id = $1', [accountId])
    if (accountResult.rows.length === 0) {
      console.log(`❌ 账户不存在于 accounts 表中`)
      console.log(`   提示: 需要先同步账户到 PostgreSQL`)
    } else {
      const account = accountResult.rows[0]
      console.log(`✅ 账户存在:`)
      console.log(`   - ID: ${account.id}`)
      console.log(`   - Name: ${account.name}`)
      console.log(`   - Type: ${account.type}`)
      console.log(`   - Platform: ${account.platform}`)
      console.log(`   - Status: ${account.status}`)
      console.log(`   - Created: ${account.created_at}`)
    }
  } catch (error) {
    console.log(`❌ 查询失败: ${error.message}`)
  }

  // 3. 检查 usage_records 表
  console.log('\n📈 检查 usage_records 表...')
  try {
    const usageResult = await db.query(
      `SELECT 
        COUNT(*) as total_records,
        MIN(occurred_at) as first_record,
        MAX(occurred_at) as last_record,
        SUM(requests) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost
      FROM usage_records 
      WHERE account_id = $1`,
      [accountId]
    )

    const stats = usageResult.rows[0]
    if (parseInt(stats.total_records) === 0) {
      console.log(`❌ 没有使用记录`)
      console.log(`   提示: 请确认该账户已发起请求，并且 recordUsage() 被正确调用`)
    } else {
      console.log(`✅ 找到 ${stats.total_records} 条使用记录:`)
      console.log(`   - 首次记录: ${stats.first_record}`)
      console.log(`   - 最新记录: ${stats.last_record}`)
      console.log(`   - 总请求数: ${stats.total_requests}`)
      console.log(`   - 总 Token: ${stats.total_tokens}`)
      console.log(`   - 总费用: $${parseFloat(stats.total_cost).toFixed(6)}`)
    }

    // 显示最近 5 条记录
    const recentResult = await db.query(
      `SELECT occurred_at, model, requests, total_tokens, total_cost, request_status
       FROM usage_records 
       WHERE account_id = $1 
       ORDER BY occurred_at DESC 
       LIMIT 5`,
      [accountId]
    )

    if (recentResult.rows.length > 0) {
      console.log(`\n   最近 5 条记录:`)
      recentResult.rows.forEach((row, idx) => {
        console.log(
          `   ${idx + 1}. ${row.occurred_at} | ${row.model} | ${row.total_tokens} tokens | $${parseFloat(row.total_cost).toFixed(6)} | ${row.request_status}`
        )
      })
    }
  } catch (error) {
    console.log(`❌ 查询失败: ${error.message}`)
  }

  // 4. 检查今日数据
  console.log('\n📅 检查今日数据 (UTC)...')
  try {
    const todayResult = await db.query(
      `SELECT 
        COUNT(*) as today_records,
        SUM(requests) as today_requests,
        SUM(total_tokens) as today_tokens,
        SUM(total_cost) as today_cost
      FROM usage_records 
      WHERE account_id = $1 
        AND usage_date = CURRENT_DATE`,
      [accountId]
    )

    const today = todayResult.rows[0]
    console.log(`   今日记录数: ${today.today_records}`)
    console.log(`   今日请求数: ${today.today_requests || 0}`)
    console.log(`   今日 Token: ${today.today_tokens || 0}`)
    console.log(`   今日费用: $${parseFloat(today.today_cost || 0).toFixed(6)}`)
  } catch (error) {
    console.log(`❌ 查询失败: ${error.message}`)
  }

  // 5. 检查 30 天数据
  console.log('\n📊 检查 30 天数据...')
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const rangeResult = await db.query(
      `SELECT 
        COUNT(*) as records,
        SUM(requests) as requests,
        SUM(total_tokens) as tokens,
        SUM(total_cost) as cost
      FROM usage_records 
      WHERE account_id = $1 
        AND occurred_at >= $2`,
      [accountId, thirtyDaysAgo]
    )

    const range = rangeResult.rows[0]
    console.log(`   30天记录数: ${range.records}`)
    console.log(`   30天请求数: ${range.requests || 0}`)
    console.log(`   30天 Token: ${range.tokens || 0}`)
    console.log(`   30天费用: $${parseFloat(range.cost || 0).toFixed(6)}`)
  } catch (error) {
    console.log(`❌ 查询失败: ${error.message}`)
  }

  // 6. 检查 Redis 数据
  console.log('\n🔴 检查 Redis 数据...')
  try {
    await redis.connect()
    const accountUsage = await redis.getAccountUsage(accountId)
    if (accountUsage) {
      console.log(`✅ Redis 中有账户使用数据:`)
      console.log(`   - Total Tokens: ${accountUsage.totalTokens || 0}`)
      console.log(`   - Input Tokens: ${accountUsage.inputTokens || 0}`)
      console.log(`   - Output Tokens: ${accountUsage.outputTokens || 0}`)
    } else {
      console.log(`⚠️  Redis 中没有账户使用数据`)
    }
  } catch (error) {
    console.log(`❌ Redis 查询失败: ${error.message}`)
  }

  console.log('\n✅ 诊断完成\n')
}

// 主函数
async function main() {
  const accountId = process.argv[2]

  if (!accountId) {
    console.error('用法: node scripts/diagnose-account-stats.js <accountId>')
    console.error('示例: node scripts/diagnose-account-stats.js claude_console_account:88code-gac')
    process.exit(1)
  }

  try {
    await db.initialize()
    await diagnose(accountId)
  } catch (error) {
    console.error('❌ 诊断失败:', error)
  } finally {
    await db.shutdown()
    await redis.disconnect()
    process.exit(0)
  }
}

main()
