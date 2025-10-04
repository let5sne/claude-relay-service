#!/usr/bin/env node

/**
 * 补充缺失的 token 使用数据
 * 用于修复那些记录了请求但 token 数为 0 的记录
 *
 * 用法: node scripts/backfill-usage-tokens.js
 */

const db = require('../src/models/db')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function findZeroTokenRecords() {
  const result = await db.query(`
    SELECT 
      id,
      occurred_at,
      account_id,
      api_key_id,
      model,
      total_tokens,
      total_cost,
      metadata
    FROM usage_records
    WHERE total_tokens = 0
      AND metadata->>'_no_usage_data' = 'true'
    ORDER BY occurred_at DESC
    LIMIT 50
  `)

  return result.rows
}

async function updateUsageRecord(id, inputTokens, outputTokens, cacheCreate, cacheRead) {
  const totalTokens = inputTokens + outputTokens + cacheCreate + cacheRead

  // 这里需要计算费用，暂时设为 0，后续可以集成 costCalculator
  const totalCost = 0 // TODO: 调用 costCalculator

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
    [id, inputTokens, outputTokens, cacheCreate, cacheRead, totalTokens, totalCost]
  )
}

async function main() {
  try {
    await db.initialize()
    console.log('✅ 数据库连接成功\n')

    console.log('🔍 查找需要补充 token 数据的记录...\n')
    const records = await findZeroTokenRecords()

    if (records.length === 0) {
      console.log('✅ 没有需要补充的记录')
      return
    }

    console.log(`找到 ${records.length} 条需要补充的记录:\n`)

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      console.log(`\n[${i + 1}/${records.length}]`)
      console.log(`  ID: ${record.id}`)
      console.log(`  时间: ${record.occurred_at}`)
      console.log(`  账户: ${record.account_id}`)
      console.log(`  模型: ${record.model}`)
      console.log(`  当前 tokens: ${record.total_tokens}`)
      console.log(`  当前费用: $${record.total_cost}`)
    }

    console.log('\n\n📋 补充方式:')
    console.log('1. 手动逐条补充（交互式）')
    console.log('2. 从 CSV 文件批量导入')
    console.log('3. 退出')

    const choice = await question('\n请选择 (1/2/3): ')

    if (choice === '1') {
      console.log('\n开始交互式补充...\n')

      for (const record of records) {
        console.log(`\n记录 ID: ${record.id}`)
        console.log(`时间: ${record.occurred_at}`)
        console.log(`模型: ${record.model}`)

        const skip = await question('是否跳过此记录? (y/N): ')
        if (skip.toLowerCase() === 'y') {
          continue
        }

        const inputTokens = parseInt(await question('输入 tokens: ')) || 0
        const outputTokens = parseInt(await question('输出 tokens: ')) || 0
        const cacheCreate = parseInt(await question('缓存创建 tokens (可选): ')) || 0
        const cacheRead = parseInt(await question('缓存读取 tokens (可选): ')) || 0

        await updateUsageRecord(record.id, inputTokens, outputTokens, cacheCreate, cacheRead)
        console.log('✅ 已更新')
      }

      console.log('\n✅ 补充完成！')
    } else if (choice === '2') {
      console.log('\n📄 CSV 格式示例:')
      console.log('record_id,input_tokens,output_tokens,cache_create_tokens,cache_read_tokens')
      console.log('123,100,200,0,0')
      console.log('\n请先准备 CSV 文件，然后使用以下命令导入:')
      console.log('node scripts/import-usage-from-csv.js <csv_file>')
    } else {
      console.log('已取消')
    }
  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    rl.close()
    await db.shutdown()
  }
}

main()
