const redis = require('../src/models/redis')
const CostCalculator = require('../src/utils/costCalculator')
;(async () => {
  const keyId = process.argv[2]
  if (!keyId) {
    console.error('Usage: node scripts/compare_costs.js <keyId>')
    process.exit(1)
  }
  const client = redis.getClientSafe()
  const today = redis.getDateStringInTimezone()
  const modelKeys = await client.keys(`usage:${keyId}:model:daily:*:${today}`)
  let sumCost = 0
  const details = []
  for (const k of modelKeys) {
    const data = await client.hgetall(k)
    const match = k.match(/usage:.+:model:daily:(.+):\d{4}-\d{2}-\d{2}$/)
    const model = match ? match[1] : 'unknown'
    const usage = {
      input_tokens: parseInt(data.totalInputTokens || data.inputTokens || 0),
      output_tokens: parseInt(data.totalOutputTokens || data.outputTokens || 0),
      cache_creation_input_tokens: parseInt(
        data.totalCacheCreateTokens || data.cacheCreateTokens || 0
      ),
      cache_read_input_tokens: parseInt(data.totalCacheReadTokens || data.cacheReadTokens || 0)
    }
    const cost = CostCalculator.calculateCost(usage, model).costs.total
    sumCost += cost
    details.push({ model, usage, cost })
  }
  const costStats = await redis.getCostStats(keyId)
  console.log(JSON.stringify({ todayModelRecalc: sumCost, costStats }, null, 2))
})()
