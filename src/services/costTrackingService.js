const db = require('../models/db')
const logger = require('../utils/logger')
const postgresCostTrackingRepository = require('../repositories/postgresCostTrackingRepository')

const profileCache = new Map()

function getCacheKey(accountId) {
  return accountId
}

function setCache(accountId, profile) {
  if (!accountId) {
    return
  }

  const key = getCacheKey(accountId)
  if (profile) {
    profileCache.set(key, profile)
  } else {
    profileCache.delete(key)
  }
}

async function getAccountCostProfile(accountId, options = {}) {
  if (!db.isEnabled() || !accountId) {
    return null
  }

  const { refresh = false } = options
  const cacheKey = getCacheKey(accountId)

  if (!refresh && profileCache.has(cacheKey)) {
    return profileCache.get(cacheKey)
  }

  try {
    const profile = await postgresCostTrackingRepository.getAccountCostProfile(accountId)
    setCache(accountId, profile)
    return profile
  } catch (error) {
    logger.debug(`⚠️ Failed to fetch cost profile for ${accountId}: ${error.message}`)
    return null
  }
}

function invalidateProfile(accountId) {
  if (!accountId) {
    profileCache.clear()
    return
  }
  profileCache.delete(getCacheKey(accountId))
}

async function upsertAccountCostProfile(profile) {
  if (!db.isEnabled()) {
    return null
  }

  const result = await postgresCostTrackingRepository.upsertAccountCostProfile(profile)
  invalidateProfile(profile?.accountId)
  return result
}

async function listAccountBills(accountId, options = {}) {
  if (!db.isEnabled()) {
    return []
  }

  return postgresCostTrackingRepository.listAccountBills(accountId, options)
}

async function createAccountBill(bill) {
  if (!db.isEnabled()) {
    return null
  }

  const result = await postgresCostTrackingRepository.createAccountBill(bill)
  return result
}

async function listBalanceSnapshots(accountId, options = {}) {
  if (!db.isEnabled()) {
    return []
  }

  return postgresCostTrackingRepository.listBalanceSnapshots(accountId, options)
}

async function createBalanceSnapshot(snapshot) {
  if (!db.isEnabled()) {
    return null
  }

  const result = await postgresCostTrackingRepository.createBalanceSnapshot(snapshot)
  return result
}

module.exports = {
  getAccountCostProfile,
  invalidateProfile,
  upsertAccountCostProfile,
  listAccountBills,
  createAccountBill,
  listBalanceSnapshots,
  createBalanceSnapshot,
  _setCache: setCache, // exposed for tests
  _cache: profileCache
}
