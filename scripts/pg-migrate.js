#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const logger = require('../src/utils/logger')
const postgres = require('../src/models/db')

const migrationsDir = path.resolve(__dirname, '..', 'sql', 'migrations')
const seedFile = path.resolve(__dirname, '..', 'sql', 'seed.sql')

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    seed: args.includes('--seed') || args.includes('--with-seed'),
    dryRun: args.includes('--dry-run'),
    list: args.includes('--list')
  }
}

function loadMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return []
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT name FROM schema_migrations')
  return new Set(result.rows.map((row) => row.name))
}

async function applyMigration(client, fileName, dryRun = false) {
  const filePath = path.join(migrationsDir, fileName)
  const sql = fs.readFileSync(filePath, 'utf8')

  logger.info(`📦 Applying migration: ${fileName}${dryRun ? ' (dry-run)' : ''}`)

  if (dryRun) {
    logger.info(sql)
    return
  }

  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [fileName])
    await client.query('COMMIT')
    logger.success(`✅ Migration applied: ${fileName}`)
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error(`❌ Migration failed: ${fileName}`)
    throw error
  }
}

async function runSeed(client) {
  if (!fs.existsSync(seedFile)) {
    logger.warn('⚠️ Seed file not found, skipping SQL seed step')
    return
  }

  const sql = fs.readFileSync(seedFile, 'utf8')
  logger.info('🌱 Running seed script...')
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('COMMIT')
    logger.success('✅ Seed data applied successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('❌ Failed to apply seed data')
    throw error
  }
}

async function main() {
  const options = parseArgs()

  if (!postgres.isEnabled()) {
    logger.warn('⚠️ PostgreSQL support is disabled via configuration. Exiting.')
    return
  }

  const files = loadMigrationFiles()
  if (options.list) {
    logger.info('📋 Migrations available:')
    files.forEach((file) => logger.info(` - ${file}`))
    return
  }

  if (files.length === 0) {
    logger.info('ℹ️ No migrations found in sql/migrations')
    return
  }

  await postgres.initialize()
  const client = await postgres.getPool().connect()

  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)

    for (const file of files) {
      if (applied.has(file)) {
        logger.info(`⏭️ Skipping already applied migration: ${file}`)
        continue
      }

      await applyMigration(client, file, options.dryRun)
    }

    if (options.seed && !options.dryRun) {
      await runSeed(client)
    }
  } finally {
    client.release()
    await postgres.shutdown()
  }
}

main().catch((error) => {
  logger.error('💥 Migration runner failed:', error)
  process.exit(1)
})
