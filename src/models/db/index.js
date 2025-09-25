const { Pool } = require('pg')
const config = require('../../../config/config')
const logger = require('../../utils/logger')

let pool = null
let isInitialized = false

const MAX_INIT_RETRIES = parseInt(process.env.POSTGRES_INIT_RETRIES || '5', 10)
const RETRY_DELAY_MS = parseInt(process.env.POSTGRES_INIT_RETRY_DELAY || '2000', 10)

function isEnabled() {
  return Boolean(config.postgres?.enabled)
}

function buildPoolConfig() {
  const baseConfig = {
    max: config.postgres.max,
    idleTimeoutMillis: config.postgres.idleTimeoutMillis,
    connectionTimeoutMillis: config.postgres.connectionTimeoutMillis,
    keepAlive: true
  }

  if (config.postgres.applicationName) {
    baseConfig.application_name = config.postgres.applicationName
  }

  if (config.postgres.connectionString) {
    return {
      ...baseConfig,
      connectionString: config.postgres.connectionString,
      ssl: config.postgres.ssl || false
    }
  }

  return {
    ...baseConfig,
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user || undefined,
    password: config.postgres.password || undefined,
    database: config.postgres.database,
    ssl: config.postgres.ssl || false
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function initialize() {
  if (!isEnabled()) {
    logger.info('🐘 PostgreSQL support disabled via configuration')
    return null
  }

  if (isInitialized && pool) {
    return pool
  }

  const poolConfig = buildPoolConfig()
  pool = new Pool(poolConfig)

  pool.on('error', (err) => {
    logger.error('❌ Unexpected PostgreSQL client error', err)
  })

  let attempt = 0
  while (attempt < MAX_INIT_RETRIES) {
    attempt += 1
    try {
      const client = await pool.connect()
      try {
        await client.query('SELECT 1')
        logger.success(`✅ PostgreSQL connected (attempt ${attempt})`)
        isInitialized = true
        client.release()
        break
      } catch (err) {
        client.release()
        throw err
      }
    } catch (error) {
      logger.error(
        `💥 Failed to connect to PostgreSQL (attempt ${attempt}/${MAX_INIT_RETRIES})`,
        error
      )
      if (attempt >= MAX_INIT_RETRIES) {
        await shutdown()
        throw error
      }
      const delay = RETRY_DELAY_MS * attempt
      logger.warn(`⏳ Retrying PostgreSQL connection in ${delay}ms...`)
      await sleep(delay)
    }
  }

  return pool
}

function getPool() {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initialize() first.')
  }
  return pool
}

async function query(text, params = [], options = {}) {
  if (!isEnabled()) {
    throw new Error('PostgreSQL support is disabled')
  }

  const targetClient = options.client || pool
  if (!targetClient) {
    throw new Error('PostgreSQL pool not initialized. Call initialize() first.')
  }

  return targetClient.query(text, params)
}

async function withTransaction(handler, options = {}) {
  if (!isEnabled()) {
    throw new Error('PostgreSQL support is disabled')
  }

  const client = await getPool().connect()
  const isolationLevel = options.isolationLevel

  try {
    if (isolationLevel) {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`)
    } else {
      await client.query('BEGIN')
    }

    const result = await handler(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      logger.error('💥 Failed to rollback PostgreSQL transaction', rollbackError)
    }
    throw error
  } finally {
    client.release()
  }
}

async function shutdown() {
  if (pool) {
    try {
      await pool.end()
      logger.info('👋 PostgreSQL pool closed')
    } catch (error) {
      logger.error('⚠️ Failed to close PostgreSQL pool gracefully', error)
    } finally {
      pool = null
      isInitialized = false
    }
  }
}

module.exports = {
  initialize,
  shutdown,
  query,
  withTransaction,
  getPool,
  isEnabled
}
