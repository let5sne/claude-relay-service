const Redis = require('ioredis')
const config = require('../config/config')
;(async () => {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: node scripts/check_redis_cost.js <keyId>')
    process.exit(1)
  }
  const r = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    tls: config.redis.enableTLS ? {} : false
  })
  try {
    const total = await r.get(`usage:cost:total:${id}`)
    const dailyKeys = await r.keys(`usage:cost:daily:${id}:*`)
    const daily = []
    for (const k of dailyKeys) {
      daily.push([k, await r.get(k)])
    }
    const keyhash = await r.hgetall(`apikey:${id}`)
    console.log(
      JSON.stringify(
        {
          total,
          dailyCount: daily.length,
          daily,
          totalCostLimit: keyhash.totalCostLimit,
          apikey: keyhash
        },
        null,
        2
      )
    )
  } finally {
    r.quit()
  }
})()
