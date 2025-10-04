#!/usr/bin/env node

/**
 * 快速更新今天的 usage 记录
 * 用法: node scripts/quick-update-usage.js
 */

const db = require('../src/models/db')

async function main() {
  try {
    await db.initialize()
    console.log('✅ 数据库连接成功\n')

    const accountId = '25b75f3f-ec8a-4300-8b73-4c4269293bb1' // 88code-gac

    // 查找今天 token=0 的记录
    const result = await db.query(
      `
      SELECT id, occurred_at, model
      FROM usage_records
      WHERE account_id = $1
        AND usage_date = CURRENT_DATE
        AND total_tokens = 0
      ORDER BY occurred_at ASC
    `,
      [accountId]
    )

    console.log(`找到 ${result.rows.length} 条需要更新的记录:\n`)

    if (result.rows.length === 0) {
      console.log('没有需要更新的记录')
      return
    }

    // 根据上游数据更新
    // 第1条: claude-3-5-haiku-20241022 - 输入2, 输出53
    // 第2条: claude-sonnet-4-5-20250929 - 输入66, 输出76

    const updates = [
      { input: 2, output: 53, cacheCreate: 0, cacheRead: 0 },
      { input: 66, output: 76, cacheCreate: 0, cacheRead: 0 }
    ]

    for (let i = 0; i < Math.min(result.rows.length, updates.length); i++) {
      const record = result.rows[i]
      const update = updates[i]

      const totalTokens = update.input + update.output + update.cacheCreate + update.cacheRead

      // 简单估算费用（实际应该调用 costCalculator）
      let estimatedCost = 0
      if (record.model.includes('haiku')) {
        estimatedCost = (update.input * 0.8 + update.output * 4) / 1000000
      } else if (record.model.includes('sonnet')) {
        estimatedCost = (update.input * 3 + update.output * 15) / 1000000
      }

      await db.query(
        `
        UPDATE usage_records
        SET
          input_tokens = $2,
          output_tokens = $3,
          cache_create_tokens = $4,
          cache_read_tokens = $5,
          total_tokens = $6,
          total_cost = $7,
          metadata = metadata || '{"_manually_updated": true, "_updated_at": "${new Date().toISOString()}"}'::jsonb
        WHERE id = $1
      `,
        [
          record.id,
          update.input,
          update.output,
          update.cacheCreate,
          update.cacheRead,
          totalTokens,
          estimatedCost
        ]
      )

      console.log(`✅ 已更新记录 ${i + 1}:`)
      console.log(`   模型: ${record.model}`)
      console.log(`   输入: ${update.input} tokens`)
      console.log(`   输出: ${update.output} tokens`)
      console.log(`   总计: ${totalTokens} tokens`)
      console.log(`   费用: $${estimatedCost.toFixed(6)}`)
    }

    console.log('\n✅ 更新完成！')
    console.log('\n请刷新统计页面查看更新后的数据。')
  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await db.shutdown()
  }
}

main()
