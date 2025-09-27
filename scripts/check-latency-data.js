#!/usr/bin/env node

/**
 * 检查 PostgreSQL 中的延迟数据
 */

const db = require('../src/models/db')
const logger = require('../src/utils/logger')

async function checkLatencyData() {
  try {
    await db.initialize()

    // 1. 检查 usage_records 表结构
    logger.info('🔍 检查 usage_records 表结构...')
    const tableInfo = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'usage_records'
      AND column_name LIKE '%latency%'
      ORDER BY ordinal_position
    `)

    if (tableInfo.rows.length > 0) {
      logger.info('📋 延迟相关字段:')
      tableInfo.rows.forEach((col) => {
        logger.info(
          `   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`
        )
      })
    } else {
      logger.error('❌ 未找到延迟相关字段！')
    }

    // 2. 检查实际数据
    logger.info('\n🔍 检查使用记录数据...')
    const dataCheck = await db.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(response_latency_ms) as non_null_latency,
        AVG(response_latency_ms) as avg_latency,
        MIN(response_latency_ms) as min_latency,
        MAX(response_latency_ms) as max_latency,
        COUNT(CASE WHEN response_latency_ms = 0 THEN 1 END) as zero_latency,
        COUNT(CASE WHEN response_latency_ms > 0 THEN 1 END) as positive_latency
      FROM usage_records
    `)

    const stats = dataCheck.rows[0]
    logger.info('📊 延迟数据统计:')
    logger.info(`   总记录数: ${stats.total_records}`)
    logger.info(`   非空延迟: ${stats.non_null_latency}`)
    logger.info(
      `   平均延迟: ${stats.avg_latency ? `${parseFloat(stats.avg_latency).toFixed(2)}ms` : 'N/A'}`
    )
    logger.info(`   最小延迟: ${stats.min_latency || 'N/A'}ms`)
    logger.info(`   最大延迟: ${stats.max_latency || 'N/A'}ms`)
    logger.info(`   零延迟记录: ${stats.zero_latency}`)
    logger.info(`   正延迟记录: ${stats.positive_latency}`)

    // 3. 查看最近的几条记录
    logger.info('\n🔍 最近的使用记录样本:')
    const sampleData = await db.query(`
      SELECT
        id,
        occurred_at,
        model,
        response_latency_ms,
        request_status,
        total_cost,
        total_tokens
      FROM usage_records
      ORDER BY occurred_at DESC
      LIMIT 5
    `)

    if (sampleData.rows.length > 0) {
      sampleData.rows.forEach((row, index) => {
        logger.info(
          `   ${index + 1}. ${row.occurred_at} | ${row.model || 'unknown'} | ${row.response_latency_ms}ms | ${row.request_status} | $${row.total_cost} | ${row.total_tokens} tokens`
        )
      })
    } else {
      logger.warn('⚠️ 没有找到使用记录')
    }

    // 4. 检查成本效率分析查询
    logger.info('\n🔍 测试成本效率分析查询...')
    const efficiencyQuery = `
      SELECT
        COUNT(*) as total_accounts,
        AVG(NULLIF(ur.response_latency_ms, 0)) AS avg_latency_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(ur.response_latency_ms, 0)) AS p95_latency_ms
      FROM usage_records ur
      LEFT JOIN accounts a ON a.id = ur.account_id
      WHERE ur.account_id IS NOT NULL
    `

    const efficiencyResult = await db.query(efficiencyQuery)
    const effStats = efficiencyResult.rows[0]
    logger.info('📊 成本效率分析结果:')
    logger.info(`   关联账户记录: ${effStats.total_accounts}`)
    logger.info(
      `   平均延迟 (NULLIF过滤): ${effStats.avg_latency_ms ? `${parseFloat(effStats.avg_latency_ms).toFixed(2)}ms` : 'NULL'}`
    )
    logger.info(
      `   P95延迟 (NULLIF过滤): ${effStats.p95_latency_ms ? `${parseFloat(effStats.p95_latency_ms).toFixed(2)}ms` : 'NULL'}`
    )

    // 5. 不使用 NULLIF 的查询
    logger.info('\n🔍 不过滤零值的延迟统计...')
    const rawLatencyQuery = `
      SELECT
        AVG(ur.response_latency_ms) AS avg_latency_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY ur.response_latency_ms) AS p95_latency_ms
      FROM usage_records ur
      LEFT JOIN accounts a ON a.id = ur.account_id
      WHERE ur.account_id IS NOT NULL
    `

    const rawResult = await db.query(rawLatencyQuery)
    const rawStats = rawResult.rows[0]
    logger.info('📊 原始延迟统计 (包含零值):')
    logger.info(
      `   平均延迟: ${rawStats.avg_latency_ms ? `${parseFloat(rawStats.avg_latency_ms).toFixed(2)}ms` : 'NULL'}`
    )
    logger.info(
      `   P95延迟: ${rawStats.p95_latency_ms ? `${parseFloat(rawStats.p95_latency_ms).toFixed(2)}ms` : 'NULL'}`
    )
  } catch (error) {
    logger.error('❌ 检查延迟数据失败:', error)
  } finally {
    await db.shutdown()
  }
}

// 运行检查
checkLatencyData()
