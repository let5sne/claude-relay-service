const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const config = require('../../config/config')
const redis = require('../models/redis')
const CostCalculator = require('../utils/costCalculator')
const logger = require('../utils/logger')
const postgresUsageRepository = require('../repositories/postgresUsageRepository')
const costTrackingService = require('./costTrackingService')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class ApiKeyService {
  constructor() {
    this.prefix = config.security.apiKeyPrefix
    this.syncedAccountCache = new Set()
  }

  // 🔑 生成新的API Key
  async generateApiKey(options = {}) {
    const {
      name = 'Unnamed Key',
      description = '',
      tokenLimit = 0, // 默认为0，不再使用token限制
      expiresAt = null,
      claudeAccountId = null,
      claudeConsoleAccountId = null,
      geminiAccountId = null,
      openaiAccountId = null,
      azureOpenaiAccountId = null,
      bedrockAccountId = null, // 添加 Bedrock 账号ID支持
      permissions = 'all', // 'claude', 'gemini', 'openai', 'all'
      isActive = true,
      concurrencyLimit = 0,
      rateLimitWindow = null,
      rateLimitRequests = null,
      rateLimitCost = null, // 新增：速率限制费用字段
      enableModelRestriction = false,
      restrictedModels = [],
      enableClientRestriction = false,
      allowedClients = [],
      dailyCostLimit = 0,
      totalCostLimit = 0, // 新增：累计总费用限制
      weeklyOpusCostLimit = 0,
      tags = [],
      activationDays = 0, // 新增：激活后有效天数（0表示不使用此功能）
      activationUnit = 'days', // 新增：激活时间单位 'hours' 或 'days'
      expirationMode = 'fixed', // 新增：过期模式 'fixed'(固定时间) 或 'activation'(首次使用后激活)
      icon = '' // 新增：图标（base64编码）
    } = options

    // 生成简单的API Key (64字符十六进制)
    const apiKey = `${this.prefix}${this._generateSecretKey()}`
    const keyId = uuidv4()
    const hashedKey = this._hashApiKey(apiKey)

    const keyData = {
      id: keyId,
      name,
      description,
      apiKey: hashedKey,
      tokenLimit: String(tokenLimit ?? 0),
      concurrencyLimit: String(concurrencyLimit ?? 0),
      rateLimitWindow: String(rateLimitWindow ?? 0),
      rateLimitRequests: String(rateLimitRequests ?? 0),
      rateLimitCost: String(rateLimitCost ?? 0), // 新增：速率限制费用字段
      isActive: String(isActive),
      claudeAccountId: claudeAccountId || '',
      claudeConsoleAccountId: claudeConsoleAccountId || '',
      geminiAccountId: geminiAccountId || '',
      openaiAccountId: openaiAccountId || '',
      azureOpenaiAccountId: azureOpenaiAccountId || '',
      bedrockAccountId: bedrockAccountId || '', // 添加 Bedrock 账号ID
      permissions: permissions || 'all',
      enableModelRestriction: String(enableModelRestriction),
      restrictedModels: JSON.stringify(restrictedModels || []),
      enableClientRestriction: String(enableClientRestriction || false),
      allowedClients: JSON.stringify(allowedClients || []),
      dailyCostLimit: String(dailyCostLimit || 0),
      totalCostLimit: String(totalCostLimit || 0),
      weeklyOpusCostLimit: String(weeklyOpusCostLimit || 0),
      tags: JSON.stringify(tags || []),
      activationDays: String(activationDays || 0), // 新增：激活后有效天数
      activationUnit: activationUnit || 'days', // 新增：激活时间单位
      expirationMode: expirationMode || 'fixed', // 新增：过期模式
      isActivated: expirationMode === 'fixed' ? 'true' : 'false', // 根据模式决定激活状态
      activatedAt: expirationMode === 'fixed' ? new Date().toISOString() : '', // 激活时间
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      expiresAt: expirationMode === 'fixed' ? expiresAt || '' : '', // 固定模式才设置过期时间
      createdBy: options.createdBy || 'admin',
      userId: options.userId || '',
      userUsername: options.userUsername || '',
      icon: icon || '' // 新增：图标（base64编码）
    }

    // 保存API Key数据并建立哈希映射
    await redis.setApiKey(keyId, keyData, hashedKey)

    // 同步至 PostgreSQL（如果启用）
    try {
      await postgresUsageRepository.upsertApiKey({
        id: keyId,
        accountId: this._resolvePrimaryAccountId(keyData),
        name,
        description,
        status: keyData.isActive === 'true' ? 'active' : 'inactive',
        hashedKey,
        dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
        totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
        lastUsedAt: keyData.lastUsedAt ? new Date(keyData.lastUsedAt) : null,
        createdBy: keyData.createdBy || options.createdBy || 'admin',
        metadata: this._buildApiKeyMetadata(keyData)
      })
    } catch (dbSyncError) {
      logger.warn(`⚠️ Failed to sync API Key ${keyId} to PostgreSQL: ${dbSyncError.message}`)
    }

    logger.success(`🔑 Generated new API key: ${name} (${keyId})`)

    return {
      id: keyId,
      apiKey, // 只在创建时返回完整的key
      name: keyData.name,
      description: keyData.description,
      tokenLimit: parseInt(keyData.tokenLimit),
      concurrencyLimit: parseInt(keyData.concurrencyLimit),
      rateLimitWindow: parseInt(keyData.rateLimitWindow || 0),
      rateLimitRequests: parseInt(keyData.rateLimitRequests || 0),
      rateLimitCost: parseFloat(keyData.rateLimitCost || 0), // 新增：速率限制费用字段
      isActive: keyData.isActive === 'true',
      claudeAccountId: keyData.claudeAccountId,
      claudeConsoleAccountId: keyData.claudeConsoleAccountId,
      geminiAccountId: keyData.geminiAccountId,
      openaiAccountId: keyData.openaiAccountId,
      azureOpenaiAccountId: keyData.azureOpenaiAccountId,
      bedrockAccountId: keyData.bedrockAccountId, // 添加 Bedrock 账号ID
      permissions: keyData.permissions,
      enableModelRestriction: keyData.enableModelRestriction === 'true',
      restrictedModels: JSON.parse(keyData.restrictedModels),
      enableClientRestriction: keyData.enableClientRestriction === 'true',
      allowedClients: JSON.parse(keyData.allowedClients || '[]'),
      dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
      totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
      weeklyOpusCostLimit: parseFloat(keyData.weeklyOpusCostLimit || 0),
      tags: JSON.parse(keyData.tags || '[]'),
      activationDays: parseInt(keyData.activationDays || 0),
      activationUnit: keyData.activationUnit || 'days',
      expirationMode: keyData.expirationMode || 'fixed',
      isActivated: keyData.isActivated === 'true',
      activatedAt: keyData.activatedAt,
      createdAt: keyData.createdAt,
      expiresAt: keyData.expiresAt,
      createdBy: keyData.createdBy
    }
  }

  // 🔍 验证API Key
  async validateApiKey(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.prefix)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      // 计算API Key的哈希值
      const hashedKey = this._hashApiKey(apiKey)

      // 通过哈希值直接查找API Key（性能优化）
      const keyData = await redis.findApiKeyByHash(hashedKey)

      if (!keyData) {
        return { valid: false, error: 'API key not found' }
      }

      // 检查是否激活
      if (keyData.isActive !== 'true') {
        return { valid: false, error: 'API key is disabled' }
      }

      // 处理激活逻辑（仅在 activation 模式下）
      if (keyData.expirationMode === 'activation' && keyData.isActivated !== 'true') {
        // 首次使用，需要激活
        const now = new Date()
        const activationPeriod = parseInt(keyData.activationDays || 30) // 默认30
        const activationUnit = keyData.activationUnit || 'days' // 默认天

        // 根据单位计算过期时间
        let milliseconds
        if (activationUnit === 'hours') {
          milliseconds = activationPeriod * 60 * 60 * 1000 // 小时转毫秒
        } else {
          milliseconds = activationPeriod * 24 * 60 * 60 * 1000 // 天转毫秒
        }

        const expiresAt = new Date(now.getTime() + milliseconds)

        // 更新激活状态和过期时间
        keyData.isActivated = 'true'
        keyData.activatedAt = now.toISOString()
        keyData.expiresAt = expiresAt.toISOString()
        keyData.lastUsedAt = now.toISOString()

        // 保存到Redis
        await redis.setApiKey(keyData.id, keyData)

        logger.success(
          `🔓 API key activated: ${keyData.id} (${
            keyData.name
          }), will expire in ${activationPeriod} ${activationUnit} at ${expiresAt.toISOString()}`
        )
      }

      // 检查是否过期
      if (keyData.expiresAt && new Date() > new Date(keyData.expiresAt)) {
        return { valid: false, error: 'API key has expired' }
      }

      // 如果API Key属于某个用户，检查用户是否被禁用
      if (keyData.userId) {
        try {
          const userService = require('./userService')
          const user = await userService.getUserById(keyData.userId, false)
          if (!user || !user.isActive) {
            return { valid: false, error: 'User account is disabled' }
          }
        } catch (error) {
          logger.error('❌ Error checking user status during API key validation:', error)
          return { valid: false, error: 'Unable to validate user status' }
        }
      }

      // 获取使用统计（供返回数据使用）
      const usage = await redis.getUsageStats(keyData.id)

      // 获取费用统计
      const [dailyCost, costStats] = await Promise.all([
        redis.getDailyCost(keyData.id),
        redis.getCostStats(keyData.id)
      ])
      const totalCost = costStats?.total || 0

      // 更新最后使用时间（优化：只在实际API调用时更新，而不是验证时）
      // 注意：lastUsedAt的更新已移至recordUsage方法中

      logger.api(`🔓 API key validated successfully: ${keyData.id}`)

      // 解析限制模型数据
      let restrictedModels = []
      try {
        restrictedModels = keyData.restrictedModels ? JSON.parse(keyData.restrictedModels) : []
      } catch (e) {
        restrictedModels = []
      }

      // 解析允许的客户端
      let allowedClients = []
      try {
        allowedClients = keyData.allowedClients ? JSON.parse(keyData.allowedClients) : []
      } catch (e) {
        allowedClients = []
      }

      // 解析标签
      let tags = []
      try {
        tags = keyData.tags ? JSON.parse(keyData.tags) : []
      } catch (e) {
        tags = []
      }

      return {
        valid: true,
        keyData: {
          id: keyData.id,
          name: keyData.name,
          description: keyData.description,
          createdAt: keyData.createdAt,
          expiresAt: keyData.expiresAt,
          claudeAccountId: keyData.claudeAccountId,
          claudeConsoleAccountId: keyData.claudeConsoleAccountId,
          geminiAccountId: keyData.geminiAccountId,
          openaiAccountId: keyData.openaiAccountId,
          azureOpenaiAccountId: keyData.azureOpenaiAccountId,
          bedrockAccountId: keyData.bedrockAccountId, // 添加 Bedrock 账号ID
          permissions: keyData.permissions || 'all',
          tokenLimit: parseInt(keyData.tokenLimit),
          concurrencyLimit: parseInt(keyData.concurrencyLimit || 0),
          rateLimitWindow: parseInt(keyData.rateLimitWindow || 0),
          rateLimitRequests: parseInt(keyData.rateLimitRequests || 0),
          rateLimitCost: parseFloat(keyData.rateLimitCost || 0), // 新增：速率限制费用字段
          enableModelRestriction: keyData.enableModelRestriction === 'true',
          restrictedModels,
          enableClientRestriction: keyData.enableClientRestriction === 'true',
          allowedClients,
          dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
          totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
          weeklyOpusCostLimit: parseFloat(keyData.weeklyOpusCostLimit || 0),
          dailyCost: dailyCost || 0,
          totalCost,
          weeklyOpusCost: (await redis.getWeeklyOpusCost(keyData.id)) || 0,
          tags,
          usage
        }
      }
    } catch (error) {
      logger.error('❌ API key validation error:', error)
      return { valid: false, error: 'Internal validation error' }
    }
  }

  // 🔍 验证API Key（仅用于统计查询，不触发激活）
  async validateApiKeyForStats(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.prefix)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      // 计算API Key的哈希值
      const hashedKey = this._hashApiKey(apiKey)

      // 通过哈希值直接查找API Key（性能优化）
      const keyData = await redis.findApiKeyByHash(hashedKey)

      if (!keyData) {
        return { valid: false, error: 'API key not found' }
      }

      // 检查是否激活
      if (keyData.isActive !== 'true') {
        return { valid: false, error: 'API key is disabled' }
      }

      // 注意：这里不处理激活逻辑，保持 API Key 的未激活状态

      // 检查是否过期（仅对已激活的 Key 检查）
      if (
        keyData.isActivated === 'true' &&
        keyData.expiresAt &&
        new Date() > new Date(keyData.expiresAt)
      ) {
        return { valid: false, error: 'API key has expired' }
      }

      // 如果API Key属于某个用户，检查用户是否被禁用
      if (keyData.userId) {
        try {
          const userService = require('./userService')
          const user = await userService.getUserById(keyData.userId, false)
          if (!user || !user.isActive) {
            return { valid: false, error: 'User account is disabled' }
          }
        } catch (userError) {
          // 如果用户服务出错，记录但不影响API Key验证
          logger.warn(`Failed to check user status for API key ${keyData.id}:`, userError)
        }
      }

      // 获取当日费用
      const [dailyCost, costStats] = await Promise.all([
        redis.getDailyCost(keyData.id),
        redis.getCostStats(keyData.id)
      ])

      // 获取使用统计
      const usage = await redis.getUsageStats(keyData.id)

      // 解析限制模型数据
      let restrictedModels = []
      try {
        restrictedModels = keyData.restrictedModels ? JSON.parse(keyData.restrictedModels) : []
      } catch (e) {
        restrictedModels = []
      }

      // 解析允许的客户端
      let allowedClients = []
      try {
        allowedClients = keyData.allowedClients ? JSON.parse(keyData.allowedClients) : []
      } catch (e) {
        allowedClients = []
      }

      // 解析标签
      let tags = []
      try {
        tags = keyData.tags ? JSON.parse(keyData.tags) : []
      } catch (e) {
        tags = []
      }

      return {
        valid: true,
        keyData: {
          id: keyData.id,
          name: keyData.name,
          description: keyData.description,
          createdAt: keyData.createdAt,
          expiresAt: keyData.expiresAt,
          // 添加激活相关字段
          expirationMode: keyData.expirationMode || 'fixed',
          isActivated: keyData.isActivated === 'true',
          activationDays: parseInt(keyData.activationDays || 0),
          activationUnit: keyData.activationUnit || 'days',
          activatedAt: keyData.activatedAt || null,
          claudeAccountId: keyData.claudeAccountId,
          claudeConsoleAccountId: keyData.claudeConsoleAccountId,
          geminiAccountId: keyData.geminiAccountId,
          openaiAccountId: keyData.openaiAccountId,
          azureOpenaiAccountId: keyData.azureOpenaiAccountId,
          bedrockAccountId: keyData.bedrockAccountId,
          permissions: keyData.permissions || 'all',
          tokenLimit: parseInt(keyData.tokenLimit),
          concurrencyLimit: parseInt(keyData.concurrencyLimit || 0),
          rateLimitWindow: parseInt(keyData.rateLimitWindow || 0),
          rateLimitRequests: parseInt(keyData.rateLimitRequests || 0),
          rateLimitCost: parseFloat(keyData.rateLimitCost || 0),
          enableModelRestriction: keyData.enableModelRestriction === 'true',
          restrictedModels,
          enableClientRestriction: keyData.enableClientRestriction === 'true',
          allowedClients,
          dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
          totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
          weeklyOpusCostLimit: parseFloat(keyData.weeklyOpusCostLimit || 0),
          dailyCost: dailyCost || 0,
          totalCost: costStats?.total || 0,
          weeklyOpusCost: (await redis.getWeeklyOpusCost(keyData.id)) || 0,
          tags,
          usage
        }
      }
    } catch (error) {
      logger.error('❌ API key validation error (stats):', error)
      return { valid: false, error: 'Internal validation error' }
    }
  }

  // 📋 获取所有API Keys
  async getAllApiKeys(includeDeleted = false) {
    try {
      let apiKeys = await redis.getAllApiKeys()
      const client = redis.getClientSafe()

      // 默认过滤掉已删除的API Keys
      if (!includeDeleted) {
        apiKeys = apiKeys.filter((key) => key.isDeleted !== 'true')
      }

      // 为每个key添加使用统计和当前并发数
      for (const key of apiKeys) {
        key.usage = await redis.getUsageStats(key.id)
        const costStats = await redis.getCostStats(key.id)
        // Add cost information to usage object for frontend compatibility
        if (key.usage && costStats) {
          key.usage.total = key.usage.total || {}
          key.usage.total.cost = costStats.total
          key.usage.totalCost = costStats.total
        }
        key.totalCost = costStats ? costStats.total : 0
        key.tokenLimit = parseInt(key.tokenLimit)
        key.concurrencyLimit = parseInt(key.concurrencyLimit || 0)
        key.rateLimitWindow = parseInt(key.rateLimitWindow || 0)
        key.rateLimitRequests = parseInt(key.rateLimitRequests || 0)
        key.rateLimitCost = parseFloat(key.rateLimitCost || 0) // 新增：速率限制费用字段
        key.currentConcurrency = await redis.getConcurrency(key.id)
        key.isActive = key.isActive === 'true'
        key.enableModelRestriction = key.enableModelRestriction === 'true'
        key.enableClientRestriction = key.enableClientRestriction === 'true'
        key.permissions = key.permissions || 'all' // 兼容旧数据
        key.dailyCostLimit = parseFloat(key.dailyCostLimit || 0)
        key.totalCostLimit = parseFloat(key.totalCostLimit || 0)
        key.weeklyOpusCostLimit = parseFloat(key.weeklyOpusCostLimit || 0)
        key.dailyCost = (await redis.getDailyCost(key.id)) || 0
        key.weeklyOpusCost = (await redis.getWeeklyOpusCost(key.id)) || 0
        key.activationDays = parseInt(key.activationDays || 0)
        key.activationUnit = key.activationUnit || 'days'
        key.expirationMode = key.expirationMode || 'fixed'
        key.isActivated = key.isActivated === 'true'
        key.activatedAt = key.activatedAt || null

        // 获取当前时间窗口的请求次数、Token使用量和费用
        if (key.rateLimitWindow > 0) {
          const requestCountKey = `rate_limit:requests:${key.id}`
          const tokenCountKey = `rate_limit:tokens:${key.id}`
          const costCountKey = `rate_limit:cost:${key.id}` // 新增：费用计数器
          const windowStartKey = `rate_limit:window_start:${key.id}`

          key.currentWindowRequests = parseInt((await client.get(requestCountKey)) || '0')
          key.currentWindowTokens = parseInt((await client.get(tokenCountKey)) || '0')
          key.currentWindowCost = parseFloat((await client.get(costCountKey)) || '0') // 新增：当前窗口费用

          // 获取窗口开始时间和计算剩余时间
          const windowStart = await client.get(windowStartKey)
          if (windowStart) {
            const now = Date.now()
            const windowStartTime = parseInt(windowStart)
            const windowDuration = key.rateLimitWindow * 60 * 1000 // 转换为毫秒
            const windowEndTime = windowStartTime + windowDuration

            // 如果窗口还有效
            if (now < windowEndTime) {
              key.windowStartTime = windowStartTime
              key.windowEndTime = windowEndTime
              key.windowRemainingSeconds = Math.max(0, Math.floor((windowEndTime - now) / 1000))
            } else {
              // 窗口已过期，下次请求会重置
              key.windowStartTime = null
              key.windowEndTime = null
              key.windowRemainingSeconds = 0
              // 重置计数为0，因为窗口已过期
              key.currentWindowRequests = 0
              key.currentWindowTokens = 0
              key.currentWindowCost = 0 // 新增：重置费用
            }
          } else {
            // 窗口还未开始（没有任何请求）
            key.windowStartTime = null
            key.windowEndTime = null
            key.windowRemainingSeconds = null
          }
        } else {
          key.currentWindowRequests = 0
          key.currentWindowTokens = 0
          key.currentWindowCost = 0 // 新增：重置费用
          key.windowStartTime = null
          key.windowEndTime = null
          key.windowRemainingSeconds = null
        }

        try {
          key.restrictedModels = key.restrictedModels ? JSON.parse(key.restrictedModels) : []
        } catch (e) {
          key.restrictedModels = []
        }
        try {
          key.allowedClients = key.allowedClients ? JSON.parse(key.allowedClients) : []
        } catch (e) {
          key.allowedClients = []
        }
        try {
          key.tags = key.tags ? JSON.parse(key.tags) : []
        } catch (e) {
          key.tags = []
        }
        // 不暴露已弃用字段
        if (Object.prototype.hasOwnProperty.call(key, 'ccrAccountId')) {
          delete key.ccrAccountId
        }
        delete key.apiKey // 不返回哈希后的key
      }

      return apiKeys
    } catch (error) {
      logger.error('❌ Failed to get API keys:', error)
      throw error
    }
  }

  // 📝 更新API Key
  async updateApiKey(keyId, updates) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 允许更新的字段
      const allowedUpdates = [
        'name',
        'description',
        'tokenLimit',
        'concurrencyLimit',
        'rateLimitWindow',
        'rateLimitRequests',
        'rateLimitCost', // 新增：速率限制费用字段
        'isActive',
        'claudeAccountId',
        'claudeConsoleAccountId',
        'geminiAccountId',
        'openaiAccountId',
        'azureOpenaiAccountId',
        'bedrockAccountId', // 添加 Bedrock 账号ID
        'permissions',
        'expiresAt',
        'activationDays', // 新增：激活后有效天数
        'activationUnit', // 新增：激活时间单位
        'expirationMode', // 新增：过期模式
        'isActivated', // 新增：是否已激活
        'activatedAt', // 新增：激活时间
        'enableModelRestriction',
        'restrictedModels',
        'enableClientRestriction',
        'allowedClients',
        'dailyCostLimit',
        'totalCostLimit',
        'weeklyOpusCostLimit',
        'tags',
        'userId', // 新增：用户ID（所有者变更）
        'userUsername', // 新增：用户名（所有者变更）
        'createdBy' // 新增：创建者（所有者变更）
      ]
      const updatedData = { ...keyData }

      for (const [field, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(field)) {
          if (field === 'restrictedModels' || field === 'allowedClients' || field === 'tags') {
            // 特殊处理数组字段
            updatedData[field] = JSON.stringify(value || [])
          } else if (
            field === 'enableModelRestriction' ||
            field === 'enableClientRestriction' ||
            field === 'isActivated'
          ) {
            // 布尔值转字符串
            updatedData[field] = String(value)
          } else if (field === 'expiresAt' || field === 'activatedAt') {
            // 日期字段保持原样，不要toString()
            updatedData[field] = value || ''
          } else {
            updatedData[field] = (value !== null && value !== undefined ? value : '').toString()
          }
        }
      }

      updatedData.updatedAt = new Date().toISOString()

      // 更新时不需要重新建立哈希映射，因为API Key本身没有变化
      await redis.setApiKey(keyId, updatedData)

      try {
        await postgresUsageRepository.upsertApiKey({
          id: keyId,
          accountId: this._resolvePrimaryAccountId(updatedData),
          name: updatedData.name,
          description: updatedData.description,
          status: updatedData.isActive === 'true' ? 'active' : 'inactive',
          hashedKey: updatedData.apiKey,
          dailyCostLimit: parseFloat(updatedData.dailyCostLimit || 0),
          totalCostLimit: parseFloat(updatedData.totalCostLimit || 0),
          lastUsedAt: updatedData.lastUsedAt ? new Date(updatedData.lastUsedAt) : null,
          createdBy: updatedData.createdBy || null,
          metadata: this._buildApiKeyMetadata(updatedData)
        })
      } catch (dbSyncError) {
        logger.warn(
          `⚠️ Failed to sync API Key ${keyId} update to PostgreSQL: ${dbSyncError.message}`
        )
      }

      logger.success(`📝 Updated API key: ${keyId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to update API key:', error)
      throw error
    }
  }

  // 🗑️ 软删除API Key (保留使用统计)
  async deleteApiKey(keyId, deletedBy = 'system', deletedByType = 'system') {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 标记为已删除，保留所有数据和统计信息
      const updatedData = {
        ...keyData,
        isDeleted: 'true',
        deletedAt: new Date().toISOString(),
        deletedBy,
        deletedByType, // 'user', 'admin', 'system'
        isActive: 'false' // 同时禁用
      }

      await redis.setApiKey(keyId, updatedData)

      try {
        await postgresUsageRepository.markApiKeyDeleted(keyId, new Date(updatedData.deletedAt))
      } catch (dbSyncError) {
        logger.warn(
          `⚠️ Failed to mark API Key ${keyId} as deleted in PostgreSQL: ${dbSyncError.message}`
        )
      }

      // 从哈希映射中移除（这样就不能再使用这个key进行API调用）
      if (keyData.apiKey) {
        await redis.deleteApiKeyHash(keyData.apiKey)
      }

      logger.success(`🗑️ Soft deleted API key: ${keyId} by ${deletedBy} (${deletedByType})`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to delete API key:', error)
      throw error
    }
  }

  // 🔄 恢复已删除的API Key
  async restoreApiKey(keyId, restoredBy = 'system', restoredByType = 'system') {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 检查是否确实是已删除的key
      if (keyData.isDeleted !== 'true') {
        throw new Error('API key is not deleted')
      }

      // 准备更新的数据
      const updatedData = { ...keyData }
      updatedData.isActive = 'true'
      updatedData.restoredAt = new Date().toISOString()
      updatedData.restoredBy = restoredBy
      updatedData.restoredByType = restoredByType

      // 从更新的数据中移除删除相关的字段
      delete updatedData.isDeleted
      delete updatedData.deletedAt
      delete updatedData.deletedBy
      delete updatedData.deletedByType

      // 保存更新后的数据
      await redis.setApiKey(keyId, updatedData)

      try {
        await postgresUsageRepository.upsertApiKey({
          id: keyId,
          accountId: this._resolvePrimaryAccountId(updatedData),
          name: updatedData.name,
          description: updatedData.description,
          status: 'active',
          hashedKey: updatedData.apiKey,
          dailyCostLimit: parseFloat(updatedData.dailyCostLimit || 0),
          totalCostLimit: parseFloat(updatedData.totalCostLimit || 0),
          lastUsedAt: updatedData.lastUsedAt ? new Date(updatedData.lastUsedAt) : null,
          createdBy: updatedData.createdBy || null,
          metadata: this._buildApiKeyMetadata(updatedData)
        })
      } catch (dbSyncError) {
        logger.warn(
          `⚠️ Failed to sync restored API Key ${keyId} to PostgreSQL: ${dbSyncError.message}`
        )
      }

      // 使用Redis的hdel命令删除不需要的字段
      const keyName = `apikey:${keyId}`
      await redis.client.hdel(keyName, 'isDeleted', 'deletedAt', 'deletedBy', 'deletedByType')

      // 重新建立哈希映射（恢复API Key的使用能力）
      if (keyData.apiKey) {
        await redis.setApiKeyHash(keyData.apiKey, {
          id: keyId,
          name: keyData.name,
          isActive: 'true'
        })
      }

      logger.success(`✅ Restored API key: ${keyId} by ${restoredBy} (${restoredByType})`)

      return { success: true, apiKey: updatedData }
    } catch (error) {
      logger.error('❌ Failed to restore API key:', error)
      throw error
    }
  }

  // 🗑️ 彻底删除API Key（物理删除）
  async permanentDeleteApiKey(keyId) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 确保只能彻底删除已经软删除的key
      if (keyData.isDeleted !== 'true') {
        throw new Error('只能彻底删除已经删除的API Key')
      }

      // 删除所有相关的使用统计数据
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      // 删除每日统计
      await redis.client.del(`usage:daily:${today}:${keyId}`)
      await redis.client.del(`usage:daily:${yesterday}:${keyId}`)

      // 删除月度统计
      const currentMonth = today.substring(0, 7)
      await redis.client.del(`usage:monthly:${currentMonth}:${keyId}`)

      // 删除所有相关的统计键（通过模式匹配）
      const usageKeys = await redis.client.keys(`usage:*:${keyId}*`)
      if (usageKeys.length > 0) {
        await redis.client.del(...usageKeys)
      }

      // 删除API Key本身
      await redis.deleteApiKey(keyId)

      try {
        await postgresUsageRepository.deleteApiKey(keyId)
      } catch (dbSyncError) {
        logger.warn(`⚠️ Failed to delete API Key ${keyId} from PostgreSQL: ${dbSyncError.message}`)
      }

      logger.success(`🗑️ Permanently deleted API key: ${keyId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to permanently delete API key:', error)
      throw error
    }
  }

  // 🧹 清空所有已删除的API Keys
  async clearAllDeletedApiKeys() {
    try {
      const allKeys = await this.getAllApiKeys(true)
      const deletedKeys = allKeys.filter((key) => key.isDeleted === 'true')

      let successCount = 0
      let failedCount = 0
      const errors = []

      for (const key of deletedKeys) {
        try {
          await this.permanentDeleteApiKey(key.id)
          successCount++
        } catch (error) {
          failedCount++
          errors.push({
            keyId: key.id,
            keyName: key.name,
            error: error.message
          })
        }
      }

      logger.success(`🧹 Cleared deleted API keys: ${successCount} success, ${failedCount} failed`)

      return {
        success: true,
        total: deletedKeys.length,
        successCount,
        failedCount,
        errors
      }
    } catch (error) {
      logger.error('❌ Failed to clear all deleted API keys:', error)
      throw error
    }
  }

  // 📊 记录使用情况（支持缓存token和账户级别统计）
  async recordUsage(
    keyId,
    inputTokens = 0,
    outputTokens = 0,
    cacheCreateTokens = 0,
    cacheReadTokens = 0,
    model = 'unknown',
    accountId = null,
    responseLatencyMs = 0
  ) {
    try {
      const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      // 计算费用
      const costInfo = CostCalculator.calculateCost(
        {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreateTokens,
          cache_read_input_tokens: cacheReadTokens
        },
        model
      )
      const usageCost = costInfo && costInfo.costs ? costInfo.costs.total || 0 : 0

      // 检查是否为 1M 上下文请求
      let isLongContextRequest = false
      if (model && model.includes('[1m]')) {
        const totalInputTokens = inputTokens + cacheCreateTokens + cacheReadTokens
        isLongContextRequest = totalInputTokens > 200000
      }

      // 记录API Key级别的使用统计
      await redis.incrementTokenUsage(
        keyId,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        0, // ephemeral5mTokens - 暂时为0，后续处理
        0, // ephemeral1hTokens - 暂时为0，后续处理
        isLongContextRequest
      )

      // 记录费用统计
      if (costInfo.costs.total > 0) {
        await redis.incrementDailyCost(keyId, costInfo.costs.total)
        logger.database(
          `💰 Recorded cost for ${keyId}: $${costInfo.costs.total.toFixed(6)}, model: ${model}`
        )
      } else {
        logger.debug(`💰 No cost recorded for ${keyId} - zero cost for model: ${model}`)
      }

      // 获取API Key数据以确定关联的账户
      const keyData = await redis.getApiKey(keyId)
      let keyMetadata = {}
      if (keyData && keyData.metadata) {
        if (typeof keyData.metadata === 'string') {
          try {
            keyMetadata = JSON.parse(keyData.metadata)
          } catch (parseError) {
            keyMetadata = {}
          }
        } else if (typeof keyData.metadata === 'object') {
          keyMetadata = keyData.metadata
        }
      }
      if (keyData && Object.keys(keyData).length > 0) {
        // 更新最后使用时间
        keyData.lastUsedAt = new Date().toISOString()
        await redis.setApiKey(keyId, keyData)

        // 记录账户级别的使用统计（只统计实际处理请求的账户）
        if (accountId) {
          await redis.incrementAccountUsage(
            accountId,
            totalTokens,
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            model,
            isLongContextRequest
          )
          await redis.incrementAccountKeyUsage(accountId, keyId, {
            totalTokens,
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            cost: usageCost,
            model
          })
          logger.database(
            `📊 Recorded account usage: ${accountId} - ${totalTokens} tokens (API Key: ${keyId})`
          )

          await this._ensureAccountSynced(accountId, null, keyData)
        } else {
          logger.debug(
            '⚠️ No accountId provided for usage recording, skipping account-level statistics'
          )
        }
      }

      // 记录单次请求的使用详情
      await redis.addUsageRecord(keyId, {
        timestamp: new Date().toISOString(),
        model,
        accountId: accountId || null,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        totalTokens,
        cost: Number(usageCost.toFixed(6)),
        costBreakdown: costInfo && costInfo.costs ? costInfo.costs : undefined
      })

      let costProfile = null
      if (accountId) {
        costProfile = await costTrackingService.getAccountCostProfile(accountId)
      }

      const actualCostResult = CostCalculator.calculateActualCost({
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreateTokens,
          cache_read_input_tokens: cacheReadTokens,
          requests: 1
        },
        model,
        fallback: costInfo,
        profile: costProfile
      })

      const normalizedActualCost = Number(
        ((actualCostResult.actualCost ?? usageCost) || 0).toFixed(6)
      )

      try {
        await postgresUsageRepository.recordUsage({
          occurredAt: new Date(),
          accountId,
          apiKeyId: keyId,
          model,
          requests: 1,
          inputTokens,
          outputTokens,
          cacheCreateTokens,
          cacheReadTokens,
          totalTokens,
          totalCost: Number(usageCost.toFixed(6)),
          actualCost: normalizedActualCost,
          costSource: actualCostResult.costSource,
          billingPeriod: actualCostResult.billingPeriod,
          confidenceLevel: actualCostResult.confidenceLevel,
          costBreakdown: costInfo?.costs || {},
          metadata: {
            source: 'redis-sync',
            isLongContext: isLongContextRequest
          },
          requestStatus: 'success',
          responseLatencyMs,
          httpStatus: null,
          errorCode: null,
          retries: 0,
          clientType: keyData?.clientType || keyMetadata.clientType || null,
          region: keyData?.region || keyMetadata.region || null
        })
      } catch (dbError) {
        logger.warn(`⚠️ Failed to persist usage to PostgreSQL for key ${keyId}: ${dbError.message}`)
      }

      const logParts = [`Model: ${model}`, `Input: ${inputTokens}`, `Output: ${outputTokens}`]
      if (cacheCreateTokens > 0) {
        logParts.push(`Cache Create: ${cacheCreateTokens}`)
      }
      if (cacheReadTokens > 0) {
        logParts.push(`Cache Read: ${cacheReadTokens}`)
      }
      logParts.push(`Total: ${totalTokens} tokens`)

      logger.database(`📊 Recorded usage: ${keyId} - ${logParts.join(', ')}`)
    } catch (error) {
      logger.error('❌ Failed to record usage:', error)
    }
  }

  // 📊 记录 Opus 模型费用（仅限 claude 和 claude-console 账户）
  async recordOpusCost(keyId, cost, model, accountType) {
    try {
      // 判断是否为 Opus 模型
      if (!model || !model.toLowerCase().includes('claude-opus')) {
        return // 不是 Opus 模型，直接返回
      }

      // 判断是否为 claude、claude-console 或 ccr 账户
      if (
        !accountType ||
        (accountType !== 'claude' && accountType !== 'claude-console' && accountType !== 'ccr')
      ) {
        logger.debug(`⚠️ Skipping Opus cost recording for non-Claude account type: ${accountType}`)
        return // 不是 claude 账户，直接返回
      }

      // 记录 Opus 周费用
      await redis.incrementWeeklyOpusCost(keyId, cost)
      logger.database(
        `💰 Recorded Opus weekly cost for ${keyId}: $${cost.toFixed(
          6
        )}, model: ${model}, account type: ${accountType}`
      )
    } catch (error) {
      logger.error('❌ Failed to record Opus cost:', error)
    }
  }

  // 📊 记录使用情况（新版本，支持详细的缓存类型）
  async recordUsageWithDetails(
    keyId,
    usageObject,
    model = 'unknown',
    accountId = null,
    accountType = null
  ) {
    try {
      // 提取 token 数量
      const inputTokens = usageObject.input_tokens || 0
      const outputTokens = usageObject.output_tokens || 0
      const cacheCreateTokens = usageObject.cache_creation_input_tokens || 0
      const cacheReadTokens = usageObject.cache_read_input_tokens || 0

      const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      // 计算费用（支持详细的缓存类型）- 添加错误处理
      let costInfo = { totalCost: 0, ephemeral5mCost: 0, ephemeral1hCost: 0 }
      try {
        const pricingService = require('./pricingService')
        // 确保 pricingService 已初始化
        if (!pricingService.pricingData) {
          logger.warn('⚠️ PricingService not initialized, initializing now...')
          await pricingService.initialize()
        }
        costInfo = pricingService.calculateCost(usageObject, model)

        // 验证计算结果
        if (!costInfo || typeof costInfo.totalCost !== 'number') {
          logger.error(`❌ Invalid cost calculation result for model ${model}:`, costInfo)
          // 使用 CostCalculator 作为后备
          const CostCalculator = require('../utils/costCalculator')
          const fallbackCost = CostCalculator.calculateCost(usageObject, model)
          if (fallbackCost && fallbackCost.costs && fallbackCost.costs.total > 0) {
            logger.warn(
              `⚠️ Using fallback cost calculation for ${model}: $${fallbackCost.costs.total}`
            )
            costInfo = {
              totalCost: fallbackCost.costs.total,
              ephemeral5mCost: 0,
              ephemeral1hCost: 0
            }
          } else {
            costInfo = { totalCost: 0, ephemeral5mCost: 0, ephemeral1hCost: 0 }
          }
        }
      } catch (pricingError) {
        logger.error(`❌ Failed to calculate cost for model ${model}:`, pricingError)
        logger.error(`   Usage object:`, JSON.stringify(usageObject))
        // 使用 CostCalculator 作为后备
        try {
          const CostCalculator = require('../utils/costCalculator')
          const fallbackCost = CostCalculator.calculateCost(usageObject, model)
          if (fallbackCost && fallbackCost.costs && fallbackCost.costs.total > 0) {
            logger.warn(
              `⚠️ Using fallback cost calculation for ${model}: $${fallbackCost.costs.total}`
            )
            costInfo = {
              totalCost: fallbackCost.costs.total,
              ephemeral5mCost: 0,
              ephemeral1hCost: 0
            }
          }
        } catch (fallbackError) {
          logger.error(`❌ Fallback cost calculation also failed:`, fallbackError)
        }
      }

      // 如果无法根据模型定价算出费用（可能因为缺少模型名），退回到静态定价做一次兜底估算
      if ((!costInfo || costInfo.totalCost === 0) && totalTokens > 0) {
        try {
          const fallbackModel = 'claude-3-5-haiku-20241022'
          const fallback = CostCalculator.calculateCost(
            {
              input_tokens: usageObject.input_tokens || 0,
              output_tokens: usageObject.output_tokens || 0,
              cache_creation_input_tokens: usageObject.cache_creation_input_tokens || 0,
              cache_read_input_tokens: usageObject.cache_read_input_tokens || 0
            },
            fallbackModel
          )
          costInfo = {
            totalCost: fallback.costs.total,
            ephemeral5mCost: 0,
            ephemeral1hCost: 0,
            isLongContextRequest: false
          }
          logger.debug(
            `💰 Fallback cost used for ${keyId} with model=${model || 'unknown'} => ${fallbackModel}: $${fallback.costs.total}`
          )
        } catch (e) {
          logger.warn('⚠️ Fallback cost calculation failed:', e)
        }
      }

      // 提取详细的缓存创建数据
      let ephemeral5mTokens = 0
      let ephemeral1hTokens = 0

      if (usageObject.cache_creation && typeof usageObject.cache_creation === 'object') {
        ephemeral5mTokens = usageObject.cache_creation.ephemeral_5m_input_tokens || 0
        ephemeral1hTokens = usageObject.cache_creation.ephemeral_1h_input_tokens || 0
      }

      // 记录API Key级别的使用统计 - 这个必须执行
      await redis.incrementTokenUsage(
        keyId,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        ephemeral5mTokens, // 传递5分钟缓存 tokens
        ephemeral1hTokens, // 传递1小时缓存 tokens
        costInfo.isLongContextRequest || false // 传递 1M 上下文请求标记
      )

      // 记录费用统计
      if (costInfo.totalCost > 0) {
        await redis.incrementDailyCost(keyId, costInfo.totalCost)
        logger.database(
          `💰 Recorded cost for ${keyId}: $${costInfo.totalCost.toFixed(6)}, model: ${model}`
        )

        // 记录 Opus 周费用（如果适用）
        await this.recordOpusCost(keyId, costInfo.totalCost, model, accountType)

        // 记录详细的缓存费用（如果有）
        if (costInfo.ephemeral5mCost > 0 || costInfo.ephemeral1hCost > 0) {
          logger.database(
            `💰 Cache costs - 5m: $${costInfo.ephemeral5mCost.toFixed(
              6
            )}, 1h: $${costInfo.ephemeral1hCost.toFixed(6)}`
          )
        }
      } else {
        // 如果有 token 使用但费用为 0，记录警告
        if (totalTokens > 0) {
          logger.warn(
            `⚠️ No cost recorded for ${keyId} - zero cost for model: ${model} (tokens: ${totalTokens})`
          )
          logger.warn(`   This may indicate a pricing issue or model not found in pricing data`)
        } else {
          logger.debug(`💰 No cost recorded for ${keyId} - zero tokens for model: ${model}`)
        }
      }

      // 获取API Key数据以确定关联的账户
      const keyData = await redis.getApiKey(keyId)
      let keyMetadata = {}
      if (keyData && keyData.metadata) {
        if (typeof keyData.metadata === 'string') {
          try {
            keyMetadata = JSON.parse(keyData.metadata)
          } catch (parseError) {
            keyMetadata = {}
          }
        } else if (typeof keyData.metadata === 'object') {
          keyMetadata = keyData.metadata
        }
      }
      if (keyData && Object.keys(keyData).length > 0) {
        // 更新最后使用时间
        keyData.lastUsedAt = new Date().toISOString()
        await redis.setApiKey(keyId, keyData)

        // 记录账户级别的使用统计（只统计实际处理请求的账户）
        if (accountId) {
          await redis.incrementAccountUsage(
            accountId,
            totalTokens,
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            model,
            costInfo.isLongContextRequest || false
          )
          logger.database(
            `📊 Recorded account usage: ${accountId} - ${totalTokens} tokens (API Key: ${keyId})`
          )

          await this._ensureAccountSynced(accountId, accountType, keyData)
        } else {
          logger.debug(
            '⚠️ No accountId provided for usage recording, skipping account-level statistics'
          )
        }
      }

      const usageRecord = {
        timestamp: new Date().toISOString(),
        model,
        accountId: accountId || null,
        accountType: accountType || null,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        ephemeral5mTokens,
        ephemeral1hTokens,
        totalTokens,
        cost: Number((costInfo.totalCost || 0).toFixed(6)),
        costBreakdown: {
          input: costInfo.inputCost || 0,
          output: costInfo.outputCost || 0,
          cacheCreate: costInfo.cacheCreateCost || 0,
          cacheRead: costInfo.cacheReadCost || 0,
          ephemeral5m: costInfo.ephemeral5mCost || 0,
          ephemeral1h: costInfo.ephemeral1hCost || 0
        },
        isLongContext: costInfo.isLongContextRequest || false
      }

      await redis.addUsageRecord(keyId, usageRecord)

      let requestStatus = usageObject.request_status || usageObject.status || null
      if (typeof requestStatus === 'string') {
        requestStatus = requestStatus.toLowerCase()
        if (requestStatus === 'ok') {
          requestStatus = 'success'
        }
      }
      if (!requestStatus) {
        requestStatus = usageObject.error || usageObject.error_code ? 'error' : 'success'
      }

      let responseLatencyMs =
        usageObject.response_latency_ms ||
        usageObject.responseLatencyMs ||
        usageObject.latency_ms ||
        usageObject.latencyMs ||
        usageObject.response_time_ms ||
        usageObject.duration_ms ||
        (usageObject.metrics &&
          (usageObject.metrics.response_latency_ms || usageObject.metrics.latency_ms)) ||
        0

      responseLatencyMs = Number(responseLatencyMs) || 0

      const httpStatus =
        usageObject.http_status || usageObject.status_code || usageObject.response_status || null

      const errorCode =
        usageObject.error_code ||
        (usageObject.error && usageObject.error.code) ||
        usageObject.error_type ||
        null

      const retries =
        usageObject.retry_count ||
        usageObject.retries ||
        usageObject.attempt ||
        usageObject.attempts ||
        0

      const clientType =
        usageObject.client_type || (keyData && keyData.clientType) || keyMetadata.clientType || null

      const region =
        usageObject.region ||
        usageObject.zone ||
        (keyData && keyData.region) ||
        keyMetadata.region ||
        null

      let costProfile = null
      if (accountId) {
        costProfile = await costTrackingService.getAccountCostProfile(accountId)
      }

      const actualCostResult = CostCalculator.calculateActualCost({
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreateTokens,
          cache_read_input_tokens: cacheReadTokens,
          requests: 1
        },
        model,
        fallback:
          costInfo && costInfo.totalCost !== undefined
            ? {
                costs: {
                  total: costInfo.totalCost,
                  input: costInfo.inputCost,
                  output: costInfo.outputCost,
                  cacheWrite: costInfo.cacheCreateCost,
                  cacheRead: costInfo.cacheReadCost
                }
              }
            : {
                costs: {
                  total: usageRecord.cost || 0
                }
              },
        profile: costProfile
      })

      const normalizedActualCost = Number(
        ((actualCostResult.actualCost ?? usageRecord.cost) || 0).toFixed(6)
      )

      try {
        await postgresUsageRepository.recordUsage({
          occurredAt: usageRecord.timestamp,
          accountId,
          apiKeyId: keyId,
          model,
          requests: 1,
          inputTokens,
          outputTokens,
          cacheCreateTokens,
          cacheReadTokens,
          ephemeral5mTokens: usageRecord.ephemeral5mTokens,
          ephemeral1hTokens: usageRecord.ephemeral1hTokens,
          totalTokens,
          totalCost: usageRecord.cost,
          actualCost: normalizedActualCost,
          costSource: actualCostResult.costSource,
          billingPeriod: actualCostResult.billingPeriod,
          confidenceLevel: actualCostResult.confidenceLevel,
          costBreakdown: usageRecord.costBreakdown,
          metadata: {
            accountType: accountType || 'unknown',
            isLongContext: usageRecord.isLongContext,
            source: 'redis-sync',
            // 保留上游传递的标记（如 _no_usage_data）
            ...(usageObject._no_usage_data && {
              _no_usage_data: true,
              _requires_manual_review: true
            })
          },
          requestStatus,
          responseLatencyMs,
          httpStatus,
          errorCode,
          retries,
          clientType,
          region
        })
      } catch (dbError) {
        logger.warn(`⚠️ Failed to persist usage to PostgreSQL for key ${keyId}: ${dbError.message}`)
      }

      const logParts = [`Model: ${model}`, `Input: ${inputTokens}`, `Output: ${outputTokens}`]
      if (cacheCreateTokens > 0) {
        logParts.push(`Cache Create: ${cacheCreateTokens}`)

        // 如果有详细的缓存创建数据，也记录它们
        if (usageObject.cache_creation) {
          const { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens } =
            usageObject.cache_creation
          if (ephemeral_5m_input_tokens > 0) {
            logParts.push(`5m: ${ephemeral_5m_input_tokens}`)
          }
          if (ephemeral_1h_input_tokens > 0) {
            logParts.push(`1h: ${ephemeral_1h_input_tokens}`)
          }
        }
      }
      if (cacheReadTokens > 0) {
        logParts.push(`Cache Read: ${cacheReadTokens}`)
      }
      logParts.push(`Total: ${totalTokens} tokens`)

      logger.database(`📊 Recorded usage: ${keyId} - ${logParts.join(', ')}`)
    } catch (error) {
      logger.error('❌ Failed to record usage:', error)
    }
  }

  _inferAccountPlatform(accountId, accountType = null, keyData = {}) {
    if (accountType) {
      return accountType
    }

    if (keyData && typeof keyData === 'object') {
      const {
        claudeConsoleAccountId,
        claudeAccountId,
        geminiAccountId,
        bedrockAccountId,
        openaiAccountId,
        azureOpenaiAccountId
      } = keyData

      if (claudeConsoleAccountId && claudeConsoleAccountId === accountId) {
        return 'claude-console'
      }
      if (claudeAccountId && claudeAccountId === accountId) {
        return 'claude'
      }
      if (geminiAccountId && geminiAccountId === accountId) {
        return 'gemini'
      }
      if (bedrockAccountId && bedrockAccountId === accountId) {
        return 'bedrock'
      }
      if (openaiAccountId && openaiAccountId === accountId) {
        return 'openai'
      }
      if (azureOpenaiAccountId && azureOpenaiAccountId === accountId) {
        return 'azure-openai'
      }
    }

    return null
  }

  async _buildAccountRecordFromRedis(accountId, _platformHint = null) {
    try {
      const client = redis.getClientSafe()
      if (!client) {
        return null
      }

      const providerConfigs = [
        {
          platform: 'claude-console',
          type: 'claude-console',
          format: 'hash',
          keys: [`claude_console_account:${accountId}`]
        },
        {
          platform: 'claude',
          type: 'claude',
          format: 'hash',
          keys: [`claude:account:${accountId}`, `claude_account:${accountId}`]
        },
        {
          platform: 'gemini',
          type: 'gemini',
          format: 'hash',
          keys: [`gemini_account:${accountId}`]
        },
        {
          platform: 'bedrock',
          type: 'bedrock',
          format: 'json',
          keys: [`bedrock_account:${accountId}`]
        },
        {
          platform: 'openai',
          type: 'openai',
          format: 'hash',
          keys: [`openai:account:${accountId}`, `openai_account:${accountId}`]
        },
        {
          platform: 'azure-openai',
          type: 'azure-openai',
          format: 'hash',
          keys: [`azure_openai:account:${accountId}`, `azure-openai:account:${accountId}`]
        },
        {
          platform: 'openai-responses',
          type: 'openai-responses',
          format: 'hash',
          keys: [`openai_responses_account:${accountId}`]
        },
        {
          platform: 'ccr',
          type: 'ccr',
          format: 'hash',
          keys: [`ccr_account:${accountId}`]
        }
      ]

      for (const provider of providerConfigs) {
        let raw = null

        for (const key of provider.keys) {
          if (!key) {
            continue
          }

          if (provider.format === 'json') {
            const payload = await client.get(key)
            if (!payload) {
              continue
            }
            try {
              raw = JSON.parse(payload)
            } catch (parseError) {
              logger.debug(`⚠️ Failed to parse JSON payload for ${key}: ${parseError.message}`)
              continue
            }
          } else {
            const hash = await client.hgetall(key)
            if (hash && Object.keys(hash).length > 0) {
              raw = hash
            }
          }

          if (raw && Object.keys(raw).length > 0) {
            break
          }
        }

        if (!raw || Object.keys(raw).length === 0) {
          continue
        }

        const metadata = this._sanitizeAccountMetadata(raw)
        const statusFlag =
          metadata.status ||
          (metadata.isActive === 'true' || metadata.isActive === true ? 'active' : 'inactive')

        return {
          id: accountId,
          name: metadata.name || metadata.email || accountId,
          type: metadata.accountType || metadata.type || provider.type,
          platform: provider.platform,
          description: metadata.description || '',
          status: statusFlag,
          priority: parseInt(metadata.priority, 10) || 50,
          metadata
        }
      }

      return null
    } catch (error) {
      logger.debug(
        `⚠️ Failed to build account record from Redis for ${accountId}: ${error.message}`
      )
      return null
    }
  }

  _buildFallbackAccountRecord(accountId, platformHint = null) {
    return {
      id: accountId,
      name: `Recovered Account ${accountId}`,
      type: platformHint === 'claude-console' ? 'claude-console' : 'generic',
      platform: platformHint || 'unknown',
      description: '',
      status: 'unknown',
      priority: 50,
      metadata: {
        source: 'usage-auto-sync',
        platformHint: platformHint || 'unknown',
        syncedAt: new Date().toISOString()
      }
    }
  }

  _sanitizeAccountMetadata(raw = {}) {
    const metadata = {}
    const sensitivePattern = /api[-_]?key|secret|token|password|credential|bearer|refresh/i

    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined || value === null) {
        continue
      }

      if (sensitivePattern.test(key)) {
        metadata[key] = '[redacted]'
      } else {
        metadata[key] = value
      }
    }

    metadata.platform = metadata.platform || raw.platform
    metadata.source = metadata.source || 'redis-sync'
    metadata.syncedAt = new Date().toISOString()

    return metadata
  }

  async _ensureAccountSynced(accountId, accountType = null, keyData = null) {
    if (!accountId || this.syncedAccountCache.has(accountId)) {
      return
    }

    try {
      const existing = await postgresUsageRepository.getAccountById(accountId)
      if (existing) {
        this.syncedAccountCache.add(accountId)
        return
      }
    } catch (error) {
      logger.debug(`⚠️ Failed to verify account ${accountId} in PostgreSQL: ${error.message}`)
      return
    }

    const platformHint = this._inferAccountPlatform(accountId, accountType, keyData || {})
    let accountRecord = await this._buildAccountRecordFromRedis(accountId, platformHint)

    if (!accountRecord) {
      accountRecord = this._buildFallbackAccountRecord(accountId, platformHint)
    }

    if (!accountRecord) {
      this.syncedAccountCache.add(accountId)
      return
    }

    try {
      await postgresUsageRepository.upsertAccount(accountRecord)
      this.syncedAccountCache.add(accountId)
      logger.database?.(`🐘 Auto-synced account ${accountId} into PostgreSQL`)
    } catch (error) {
      logger.warn(`⚠️ Failed to auto-sync account ${accountId} into PostgreSQL: ${error.message}`)
    }
  }

  // 🔐 生成密钥
  _generateSecretKey() {
    return crypto.randomBytes(32).toString('hex')
  }

  _normalizeAccountId(value) {
    if (!value) {
      return null
    }

    const stringValue = String(value).trim()
    if (!stringValue || stringValue.toLowerCase().startsWith('group:')) {
      return null
    }

    if (!UUID_REGEX.test(stringValue)) {
      return null
    }

    return stringValue
  }

  _resolvePrimaryAccountId(keyData = {}) {
    const candidates = [
      keyData.claudeAccountId,
      keyData.claudeConsoleAccountId,
      keyData.openaiAccountId,
      keyData.azureOpenaiAccountId,
      keyData.geminiAccountId,
      keyData.bedrockAccountId,
      keyData.accountId
    ]

    for (const candidate of candidates) {
      const normalized = this._normalizeAccountId(candidate)
      if (normalized) {
        return normalized
      }
    }

    return null
  }

  _buildApiKeyMetadata(keyData = {}) {
    const safeParse = (value, fallback) => {
      if (typeof value !== 'string' || value.length === 0) {
        return fallback
      }
      try {
        return JSON.parse(value)
      } catch (error) {
        logger.debug('Failed to parse API key metadata field, falling back to raw string', {
          field: value,
          error: error.message
        })
        return fallback
      }
    }

    return {
      claudeAccountId: keyData.claudeAccountId || null,
      claudeConsoleAccountId: keyData.claudeConsoleAccountId || null,
      geminiAccountId: keyData.geminiAccountId || null,
      openaiAccountId: keyData.openaiAccountId || null,
      azureOpenaiAccountId: keyData.azureOpenaiAccountId || null,
      bedrockAccountId: keyData.bedrockAccountId || null,
      permissions: keyData.permissions || 'all',
      restrictedModels: safeParse(keyData.restrictedModels, []),
      allowedClients: safeParse(keyData.allowedClients, []),
      tags: safeParse(keyData.tags, []),
      userId: keyData.userId || null,
      userUsername: keyData.userUsername || null
    }
  }

  // 🔒 哈希API Key
  _hashApiKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey + config.security.encryptionKey)
      .digest('hex')
  }

  // 📈 获取使用统计
  async getUsageStats(keyId, options = {}) {
    const usageStats = await redis.getUsageStats(keyId)

    // options 可能是字符串（兼容旧接口），仅当为对象时才解析
    const optionObject =
      options && typeof options === 'object' && !Array.isArray(options) ? options : {}

    if (optionObject.includeRecords === false) {
      return usageStats
    }

    const recordLimit = optionObject.recordLimit || 20
    const recentRecords = await redis.getUsageRecords(keyId, recordLimit)

    return {
      ...usageStats,
      recentRecords
    }
  }

  // 📊 获取账户使用统计
  async getAccountUsageStats(accountId) {
    return await redis.getAccountUsageStats(accountId)
  }

  // 📈 获取所有账户使用统计
  async getAllAccountsUsageStats() {
    return await redis.getAllAccountsUsageStats()
  }

  // === 用户相关方法 ===

  // 🔑 创建API Key（支持用户）
  async createApiKey(options = {}) {
    return await this.generateApiKey(options)
  }

  // 👤 获取用户的API Keys
  async getUserApiKeys(userId, includeDeleted = false) {
    try {
      const allKeys = await redis.getAllApiKeys()
      let userKeys = allKeys.filter((key) => key.userId === userId)

      // 默认过滤掉已删除的API Keys
      if (!includeDeleted) {
        userKeys = userKeys.filter((key) => key.isDeleted !== 'true')
      }

      // Populate usage stats for each user's API key (same as getAllApiKeys does)
      const userKeysWithUsage = []
      for (const key of userKeys) {
        const usage = await redis.getUsageStats(key.id)
        const dailyCost = (await redis.getDailyCost(key.id)) || 0
        const costStats = await redis.getCostStats(key.id)

        userKeysWithUsage.push({
          id: key.id,
          name: key.name,
          description: key.description,
          key: key.apiKey ? `${this.prefix}****${key.apiKey.slice(-4)}` : null, // 只显示前缀和后4位
          tokenLimit: parseInt(key.tokenLimit || 0),
          isActive: key.isActive === 'true',
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          usage,
          dailyCost,
          totalCost: costStats.total,
          dailyCostLimit: parseFloat(key.dailyCostLimit || 0),
          totalCostLimit: parseFloat(key.totalCostLimit || 0),
          userId: key.userId,
          userUsername: key.userUsername,
          createdBy: key.createdBy,
          // Include deletion fields for deleted keys
          isDeleted: key.isDeleted,
          deletedAt: key.deletedAt,
          deletedBy: key.deletedBy,
          deletedByType: key.deletedByType
        })
      }

      return userKeysWithUsage
    } catch (error) {
      logger.error('❌ Failed to get user API keys:', error)
      return []
    }
  }

  // 🔍 通过ID获取API Key（检查权限）
  async getApiKeyById(keyId, userId = null) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData) {
        return null
      }

      // 如果指定了用户ID，检查权限
      if (userId && keyData.userId !== userId) {
        return null
      }

      return {
        id: keyData.id,
        name: keyData.name,
        description: keyData.description,
        key: keyData.apiKey,
        tokenLimit: parseInt(keyData.tokenLimit || 0),
        isActive: keyData.isActive === 'true',
        createdAt: keyData.createdAt,
        lastUsedAt: keyData.lastUsedAt,
        expiresAt: keyData.expiresAt,
        userId: keyData.userId,
        userUsername: keyData.userUsername,
        createdBy: keyData.createdBy,
        permissions: keyData.permissions,
        dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
        totalCostLimit: parseFloat(keyData.totalCostLimit || 0)
      }
    } catch (error) {
      logger.error('❌ Failed to get API key by ID:', error)
      return null
    }
  }

  // 🔄 重新生成API Key
  async regenerateApiKey(keyId) {
    try {
      const existingKey = await redis.getApiKey(keyId)
      if (!existingKey) {
        throw new Error('API key not found')
      }

      // 生成新的key
      const newApiKey = `${this.prefix}${this._generateSecretKey()}`
      const newHashedKey = this._hashApiKey(newApiKey)

      // 删除旧的哈希映射
      const oldHashedKey = existingKey.apiKey
      await redis.deleteApiKeyHash(oldHashedKey)

      // 更新key数据
      const updatedKeyData = {
        ...existingKey,
        apiKey: newHashedKey,
        updatedAt: new Date().toISOString()
      }

      // 保存新数据并建立新的哈希映射
      await redis.setApiKey(keyId, updatedKeyData, newHashedKey)

      logger.info(`🔄 Regenerated API key: ${existingKey.name} (${keyId})`)

      return {
        id: keyId,
        name: existingKey.name,
        key: newApiKey, // 返回完整的新key
        updatedAt: updatedKeyData.updatedAt
      }
    } catch (error) {
      logger.error('❌ Failed to regenerate API key:', error)
      throw error
    }
  }

  // 🗑️ 硬删除API Key (完全移除)
  async hardDeleteApiKey(keyId) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData) {
        throw new Error('API key not found')
      }

      // 删除key数据和哈希映射
      await redis.deleteApiKey(keyId)
      await redis.deleteApiKeyHash(keyData.apiKey)

      logger.info(`🗑️ Deleted API key: ${keyData.name} (${keyId})`)
      return true
    } catch (error) {
      logger.error('❌ Failed to delete API key:', error)
      throw error
    }
  }

  // 🚫 禁用用户的所有API Keys
  async disableUserApiKeys(userId) {
    try {
      const userKeys = await this.getUserApiKeys(userId)
      let disabledCount = 0

      for (const key of userKeys) {
        if (key.isActive) {
          await this.updateApiKey(key.id, { isActive: false })
          disabledCount++
        }
      }

      logger.info(`🚫 Disabled ${disabledCount} API keys for user: ${userId}`)
      return { count: disabledCount }
    } catch (error) {
      logger.error('❌ Failed to disable user API keys:', error)
      throw error
    }
  }

  // 📊 获取聚合使用统计（支持多个API Key）
  async getAggregatedUsageStats(keyIds, options = {}) {
    try {
      if (!Array.isArray(keyIds)) {
        keyIds = [keyIds]
      }

      const { period: _period = 'week', model: _model } = options
      const stats = {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        dailyStats: [],
        modelStats: []
      }

      // 汇总总体（累计）统计数据
      for (const keyId of keyIds) {
        const keyStats = await redis.getUsageStats(keyId)
        const costStats = await redis.getCostStats(keyId)
        if (keyStats && keyStats.total) {
          stats.totalRequests += keyStats.total.requests || 0
          stats.totalInputTokens += keyStats.total.inputTokens || 0
          stats.totalOutputTokens += keyStats.total.outputTokens || 0
          stats.totalCost += costStats?.total || 0
        }
      }

      // 处理周期参数
      const period = String(_period || 'week').toLowerCase()
      const client = redis.getClientSafe()

      // 计算需要聚合的日期范围
      const tzNow = redis.getDateInTimezone(new Date())
      const todayStr = redis.getDateStringInTimezone(tzNow)
      const currentMonth = `${tzNow.getUTCFullYear()}-${String(tzNow.getUTCMonth() + 1).padStart(2, '0')}`

      const dateStrings = []
      if (period.startsWith('day') || period === 'today' || period === 'daily') {
        dateStrings.push(todayStr)
      } else if (period.startsWith('week')) {
        // 最近7天（含今日）
        const base = new Date(tzNow)
        for (let i = 6; i >= 0; i--) {
          const d = new Date(base)
          d.setUTCDate(base.getUTCDate() - i)
          dateStrings.push(redis.getDateStringInTimezone(d))
        }
      } else if (period.startsWith('month')) {
        // 本月从1号到今天
        const daysInMonth = new Date(
          tzNow.getUTCFullYear(),
          tzNow.getUTCMonth() + 1,
          0
        ).getUTCDate()
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(Date.UTC(tzNow.getUTCFullYear(), tzNow.getUTCMonth(), day))
          const ds = redis.getDateStringInTimezone(d)
          // 仅统计到今天
          if (ds <= todayStr) {
            dateStrings.push(ds)
          }
        }
      } else {
        // 默认按最近7天
        const base = new Date(tzNow)
        for (let i = 6; i >= 0; i--) {
          const d = new Date(base)
          d.setUTCDate(base.getUTCDate() - i)
          dateStrings.push(redis.getDateStringInTimezone(d))
        }
      }

      // 按天聚合每日统计（requests/tokens/cost）
      const dailyStats = []
      for (const ds of dateStrings) {
        let dayRequests = 0
        let dayInputTokens = 0
        let dayOutputTokens = 0
        let dayCacheCreateTokens = 0
        let dayCacheReadTokens = 0
        let dayAllTokens = 0
        let dayCost = 0

        // 批量获取所有 key 在该日的 usage 和 cost
        const pipeline = client.pipeline()
        const costPipeline = client.pipeline()
        for (const keyId of keyIds) {
          pipeline.hgetall(`usage:daily:${keyId}:${ds}`)
          costPipeline.get(`usage:cost:daily:${keyId}:${ds}`)
        }
        const [usageResults, costResults] = await Promise.all([
          pipeline.exec(),
          costPipeline.exec()
        ])

        // 聚合 usage
        for (const [err, data] of usageResults) {
          if (err || !data) {
            continue
          }
          dayRequests += parseInt(data.requests || 0)
          dayInputTokens += parseInt(data.inputTokens || 0)
          dayOutputTokens += parseInt(data.outputTokens || 0)
          dayCacheCreateTokens += parseInt(data.cacheCreateTokens || 0)
          dayCacheReadTokens += parseInt(data.cacheReadTokens || 0)
          // allTokens 字段更准确地包含缓存token
          const allT = parseInt(data.allTokens || 0)
          if (allT > 0) {
            dayAllTokens += allT
          } else {
            // 兼容旧数据
            const core = parseInt(data.tokens || 0) || 0
            dayAllTokens += core
          }
        }
        // 聚合 cost
        for (const [err, val] of costResults) {
          if (err) {
            continue
          }
          const v = parseFloat(val || 0)
          if (!Number.isNaN(v)) {
            dayCost += v
          }
        }

        dailyStats.push({
          date: ds,
          requests: dayRequests,
          inputTokens: dayInputTokens,
          outputTokens: dayOutputTokens,
          cacheCreateTokens: dayCacheCreateTokens,
          cacheReadTokens: dayCacheReadTokens,
          allTokens: dayAllTokens,
          cost: dayCost
        })
      }

      stats.dailyStats = dailyStats

      // 按模型聚合
      const modelMap = new Map()

      const addModelUsage = (model, usage) => {
        if (!modelMap.has(model)) {
          modelMap.set(model, {
            name: model,
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreateTokens: 0,
            cacheReadTokens: 0,
            allTokens: 0
          })
        }
        const m = modelMap.get(model)
        m.requests += usage.requests || 0
        m.inputTokens += usage.inputTokens || 0
        m.outputTokens += usage.outputTokens || 0
        m.cacheCreateTokens += usage.cacheCreateTokens || 0
        m.cacheReadTokens += usage.cacheReadTokens || 0
        m.allTokens += usage.allTokens || 0
      }

      if (period.startsWith('month')) {
        // 使用月度模型统计键：usage:{keyId}:model:monthly:{model}:{YYYY-MM}
        for (const keyId of keyIds) {
          const keys = await client.keys(`usage:${keyId}:model:monthly:*:${currentMonth}`)
          if (keys.length === 0) {
            continue
          }
          const pipeline = client.pipeline()
          keys.forEach((k) => pipeline.hgetall(k))
          const results = await pipeline.exec()
          for (let i = 0; i < results.length; i++) {
            const [err, data] = results[i]
            if (err || !data) {
              continue
            }
            const match = keys[i].match(/usage:.+:model:monthly:(.+):\d{4}-\d{2}$/)
            if (!match) {
              continue
            }
            const model = match[1]
            addModelUsage(model, {
              requests: parseInt(data.requests || 0),
              inputTokens: parseInt(data.inputTokens || 0),
              outputTokens: parseInt(data.outputTokens || 0),
              cacheCreateTokens: parseInt(data.cacheCreateTokens || 0),
              cacheReadTokens: parseInt(data.cacheReadTokens || 0),
              allTokens: parseInt(data.allTokens || 0)
            })
          }
        }
      } else {
        // 按天汇总模型（今日或最近7天）
        for (const keyId of keyIds) {
          for (const ds of dateStrings) {
            const keys = await client.keys(`usage:${keyId}:model:daily:*:${ds}`)
            if (keys.length === 0) {
              continue
            }
            const pipeline = client.pipeline()
            keys.forEach((k) => pipeline.hgetall(k))
            const results = await pipeline.exec()
            for (let i = 0; i < results.length; i++) {
              const [err, data] = results[i]
              if (err || !data) {
                continue
              }
              const match = keys[i].match(/usage:.+:model:daily:(.+):\d{4}-\d{2}-\d{2}$/)
              if (!match) {
                continue
              }
              const model = match[1]
              addModelUsage(model, {
                requests: parseInt(data.requests || 0),
                inputTokens: parseInt(data.inputTokens || 0),
                outputTokens: parseInt(data.outputTokens || 0),
                cacheCreateTokens: parseInt(data.cacheCreateTokens || 0),
                cacheReadTokens: parseInt(data.cacheReadTokens || 0),
                allTokens: parseInt(data.allTokens || 0)
              })
            }
          }
        }
      }

      // 计算各模型费用并格式化
      const modelStats = []
      for (const [modelName, m] of modelMap.entries()) {
        // 可选：仅返回指定模型
        if (_model && _model !== modelName) {
          continue
        }

        const usage = {
          input_tokens: m.inputTokens,
          output_tokens: m.outputTokens,
          cache_creation_input_tokens: m.cacheCreateTokens,
          cache_read_input_tokens: m.cacheReadTokens
        }
        const cost = CostCalculator.calculateCost(usage, modelName)
        modelStats.push({
          name: modelName,
          requests: m.requests,
          inputTokens: m.inputTokens,
          outputTokens: m.outputTokens,
          cacheCreateTokens: m.cacheCreateTokens,
          cacheReadTokens: m.cacheReadTokens,
          allTokens: m.allTokens,
          cost: cost.costs.total,
          formatted: cost.formatted,
          pricing: cost.pricing
        })
      }

      // 按总token数降序
      modelStats.sort((a, b) => b.allTokens - a.allTokens)
      stats.modelStats = modelStats

      return stats
    } catch (error) {
      logger.error('❌ Failed to get usage stats:', error)
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        dailyStats: [],
        modelStats: []
      }
    }
  }

  // 🔓 解绑账号从所有API Keys
  async unbindAccountFromAllKeys(accountId, accountType) {
    try {
      // 账号类型与字段的映射关系
      const fieldMap = {
        claude: 'claudeAccountId',
        'claude-console': 'claudeConsoleAccountId',
        gemini: 'geminiAccountId',
        openai: 'openaiAccountId',
        'openai-responses': 'openaiAccountId', // 特殊处理，带 responses: 前缀
        azure_openai: 'azureOpenaiAccountId',
        bedrock: 'bedrockAccountId',
        ccr: null // CCR 账号没有对应的 API Key 字段
      }

      const field = fieldMap[accountType]
      if (!field) {
        logger.info(`账号类型 ${accountType} 不需要解绑 API Key`)
        return 0
      }

      // 获取所有API Keys
      const allKeys = await this.getAllApiKeys()

      // 筛选绑定到此账号的 API Keys
      let boundKeys = []
      if (accountType === 'openai-responses') {
        // OpenAI-Responses 特殊处理：查找 openaiAccountId 字段中带 responses: 前缀的
        boundKeys = allKeys.filter((key) => key.openaiAccountId === `responses:${accountId}`)
      } else {
        // 其他账号类型正常匹配
        boundKeys = allKeys.filter((key) => key[field] === accountId)
      }

      // 批量解绑
      for (const key of boundKeys) {
        const updates = {}
        if (accountType === 'openai-responses') {
          updates.openaiAccountId = null
        } else if (accountType === 'claude-console') {
          updates.claudeConsoleAccountId = null
        } else {
          updates[field] = null
        }

        await this.updateApiKey(key.id, updates)
        logger.info(
          `✅ 自动解绑 API Key ${key.id} (${key.name}) 从 ${accountType} 账号 ${accountId}`
        )
      }

      if (boundKeys.length > 0) {
        logger.success(
          `🔓 成功解绑 ${boundKeys.length} 个 API Key 从 ${accountType} 账号 ${accountId}`
        )
      }

      return boundKeys.length
    } catch (error) {
      logger.error(`❌ 解绑 API Keys 失败 (${accountType} 账号 ${accountId}):`, error)
      return 0
    }
  }

  // 🧹 清理过期的API Keys
  async cleanupExpiredKeys() {
    try {
      const apiKeys = await redis.getAllApiKeys()
      const now = new Date()
      let cleanedCount = 0

      for (const key of apiKeys) {
        // 检查是否已过期且仍处于激活状态
        if (key.expiresAt && new Date(key.expiresAt) < now && key.isActive === 'true') {
          // 将过期的 API Key 标记为禁用状态，而不是直接删除
          await this.updateApiKey(key.id, { isActive: false })
          logger.info(`🔒 API Key ${key.id} (${key.name}) has expired and been disabled`)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        logger.success(`🧹 Disabled ${cleanedCount} expired API keys`)
      }

      return cleanedCount
    } catch (error) {
      logger.error('❌ Failed to cleanup expired keys:', error)
      return 0
    }
  }
}

// 导出实例和单独的方法
const apiKeyService = new ApiKeyService()

// 为了方便其他服务调用，导出 recordUsage 方法
apiKeyService.recordUsageMetrics = apiKeyService.recordUsage.bind(apiKeyService)

module.exports = apiKeyService
