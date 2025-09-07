const costInit = require('../src/services/costInitService')
const Redis = require('ioredis')
const config = require('../config/config')
;(async () => {
  const keyId = process.argv[2]
  if (!keyId) {
    console.error('Usage: node scripts/init_cost_for_key.js <keyId>')
    process.exit(1)
  }
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    tls: config.redis.enableTLS ? {} : false
  })
  try {
    await costInit.initializeApiKeyCosts(keyId, client)
    console.log('Done.')
  } finally {
    await client.quit()
  }
})()
