/**
 * 单元测试示例 - API Key服务
 *
 * 运行方式:
 * npm test tests/unit/apiKeyService.test.js
 */

const apiKeyService = require('../../src/services/apiKeyService')

// Mock Redis
jest.mock('../../src/models/redis', () => ({
  getAllApiKeys: jest.fn(),
  getApiKey: jest.fn(),
  setApiKey: jest.fn(),
  deleteApiKey: jest.fn()
}))

const redis = require('../../src/models/redis')

describe('API Key服务单元测试', () => {
  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks()
  })

  describe('getAllApiKeys', () => {
    test('应该返回所有API Keys', async () => {
      const mockKeys = [
        { key: 'sk-test1', name: 'Test Key 1' },
        { key: 'sk-test2', name: 'Test Key 2' }
      ]

      redis.getAllApiKeys.mockResolvedValue(mockKeys)

      const result = await apiKeyService.getAllApiKeys()

      expect(result).toEqual(mockKeys)
      expect(redis.getAllApiKeys).toHaveBeenCalledTimes(1)
    })

    test('应该处理空结果', async () => {
      redis.getAllApiKeys.mockResolvedValue([])

      const result = await apiKeyService.getAllApiKeys()

      expect(result).toEqual([])
    })

    test('应该处理Redis错误', async () => {
      redis.getAllApiKeys.mockRejectedValue(new Error('Redis连接失败'))

      await expect(apiKeyService.getAllApiKeys()).rejects.toThrow('Redis连接失败')
    })
  })

  describe('getApiKey', () => {
    test('应该返回指定的API Key', async () => {
      const mockKey = { key: 'sk-test1', name: 'Test Key 1' }

      redis.getApiKey.mockResolvedValue(mockKey)

      const result = await apiKeyService.getApiKey('sk-test1')

      expect(result).toEqual(mockKey)
      expect(redis.getApiKey).toHaveBeenCalledWith('sk-test1')
    })

    test('应该处理不存在的Key', async () => {
      redis.getApiKey.mockResolvedValue(null)

      const result = await apiKeyService.getApiKey('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createApiKey', () => {
    test('应该创建新的API Key', async () => {
      const keyData = {
        name: 'New Key',
        claudeAccountId: 'account-123'
      }

      redis.setApiKey.mockResolvedValue(true)

      const result = await apiKeyService.createApiKey(keyData)

      expect(result).toHaveProperty('key')
      expect(result.key).toMatch(/^sk-/)
      expect(redis.setApiKey).toHaveBeenCalled()
    })

    test('应该验证必需字段', async () => {
      await expect(apiKeyService.createApiKey({})).rejects.toThrow()
    })
  })

  describe('updateApiKey', () => {
    test('应该更新现有的API Key', async () => {
      const existingKey = { key: 'sk-test1', name: 'Old Name' }
      const updates = { name: 'New Name' }

      redis.getApiKey.mockResolvedValue(existingKey)
      redis.setApiKey.mockResolvedValue(true)

      const result = await apiKeyService.updateApiKey('sk-test1', updates)

      expect(result.name).toBe('New Name')
      expect(redis.setApiKey).toHaveBeenCalled()
    })

    test('应该处理不存在的Key更新', async () => {
      redis.getApiKey.mockResolvedValue(null)

      await expect(apiKeyService.updateApiKey('non-existent', {})).rejects.toThrow('API Key不存在')
    })
  })

  describe('deleteApiKey', () => {
    test('应该删除指定的API Key', async () => {
      redis.deleteApiKey.mockResolvedValue(true)

      const result = await apiKeyService.deleteApiKey('sk-test1')

      expect(result).toBe(true)
      expect(redis.deleteApiKey).toHaveBeenCalledWith('sk-test1')
    })
  })
})

describe('API Key过滤功能测试', () => {
  test('应该按Claude账户过滤', async () => {
    const mockKeys = [
      { key: 'sk-1', claudeAccountId: 'acc-1' },
      { key: 'sk-2', claudeAccountId: 'acc-2' },
      { key: 'sk-3', claudeAccountId: 'acc-1' }
    ]

    redis.getAllApiKeys.mockResolvedValue(mockKeys)

    const result = await apiKeyService.filterByClaudeAccount('acc-1')

    expect(result).toHaveLength(2)
    expect(result.every((k) => k.claudeAccountId === 'acc-1')).toBe(true)
  })

  test('应该按OpenAI账户过滤', async () => {
    const mockKeys = [
      { key: 'sk-1', openaiAccountId: 'oai-1' },
      { key: 'sk-2', openaiAccountId: 'oai-2' }
    ]

    redis.getAllApiKeys.mockResolvedValue(mockKeys)

    const result = await apiKeyService.filterByOpenAIAccount('oai-1')

    expect(result).toHaveLength(1)
    expect(result[0].openaiAccountId).toBe('oai-1')
  })
})
