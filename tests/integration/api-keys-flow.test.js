/**
 * 集成测试示例 - API Keys完整流程
 *
 * 测试API Key从创建到删除的完整生命周期
 *
 * 运行方式:
 * npm run test:integration
 */

const request = require('supertest')
const app = require('../../src/app')

describe('API Keys完整流程集成测试', () => {
  let authToken
  let testApiKey
  let testAccountId

  beforeAll(async () => {
    // 获取管理员认证Token
    const loginResponse = await request(app)
      .post('/admin/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin'
      })

    authToken = loginResponse.body.token
  })

  describe('完整的API Key生命周期', () => {
    test('1. 创建Claude账户', async () => {
      const response = await request(app)
        .post('/admin/claude-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Account',
          sessionKey: 'test-session-key'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      testAccountId = response.body.account.id
    })

    test('2. 创建API Key并绑定账户', async () => {
      const response = await request(app)
        .post('/admin/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test API Key',
          claudeAccountId: testAccountId,
          dailyLimit: 1000,
          monthlyLimit: 30000
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.apiKey).toHaveProperty('key')
      testApiKey = response.body.apiKey.key
    })

    test('3. 获取API Key详情', async () => {
      const response = await request(app)
        .get(`/admin/api-keys/${testApiKey}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.apiKey.key).toBe(testApiKey)
      expect(response.body.apiKey.claudeAccountId).toBe(testAccountId)
    })

    test('4. 更新API Key配置', async () => {
      const response = await request(app)
        .put(`/admin/api-keys/${testApiKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test API Key',
          dailyLimit: 2000
        })

      expect(response.status).toBe(200)
      expect(response.body.apiKey.name).toBe('Updated Test API Key')
      expect(response.body.apiKey.dailyLimit).toBe(2000)
    })

    test('5. 模拟API Key使用并记录', async () => {
      // 这里应该调用实际的API端点使用API Key
      // 然后验证使用记录是否正确
      const response = await request(app)
        .get(`/admin/api-keys/${testApiKey}/usage-details`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('usage')
    })

    test('6. 获取使用统计', async () => {
      const response = await request(app)
        .get('/admin/usage-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ apiKey: testApiKey })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('stats')
    })

    test('7. 软删除API Key', async () => {
      const response = await request(app)
        .delete(`/admin/api-keys/${testApiKey}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('8. 验证API Key已被软删除', async () => {
      const response = await request(app)
        .get('/admin/api-keys/deleted')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      const deletedKeys = response.body.apiKeys
      expect(deletedKeys.some((k) => k.key === testApiKey)).toBe(true)
    })

    test('9. 恢复已删除的API Key', async () => {
      const response = await request(app)
        .post(`/admin/api-keys/${testApiKey}/restore`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('10. 永久删除API Key', async () => {
      // 先软删除
      await request(app)
        .delete(`/admin/api-keys/${testApiKey}`)
        .set('Authorization', `Bearer ${authToken}`)

      // 再永久删除
      const response = await request(app)
        .delete(`/admin/api-keys/${testApiKey}/permanent`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('批量操作集成测试', () => {
    let batchKeys = []

    test('批量创建API Keys', async () => {
      const response = await request(app)
        .post('/admin/api-keys/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          count: 5,
          prefix: 'batch-test',
          claudeAccountId: testAccountId
        })

      expect(response.status).toBe(200)
      expect(response.body.apiKeys).toHaveLength(5)
      batchKeys = response.body.apiKeys.map((k) => k.key)
    })

    test('批量更新API Keys', async () => {
      const response = await request(app)
        .put('/admin/api-keys/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keys: batchKeys,
          updates: { dailyLimit: 5000 }
        })

      expect(response.status).toBe(200)
      expect(response.body.updated).toBe(5)
    })

    test('批量删除API Keys', async () => {
      const response = await request(app)
        .delete('/admin/api-keys/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keys: batchKeys
        })

      expect(response.status).toBe(200)
      expect(response.body.deleted).toBe(5)
    })
  })

  afterAll(async () => {
    // 清理测试数据
    if (testAccountId) {
      await request(app)
        .delete(`/admin/claude-accounts/${testAccountId}`)
        .set('Authorization', `Bearer ${authToken}`)
    }
  })
})

describe('错误处理集成测试', () => {
  let authToken

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/admin/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin'
      })

    authToken = loginResponse.body.token
  })

  test('应该拒绝无效的API Key创建请求', async () => {
    const response = await request(app)
      .post('/admin/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        // 缺少必需字段
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  test('应该拒绝未认证的请求', async () => {
    const response = await request(app).get('/admin/api-keys')

    expect(response.status).toBe(401)
  })

  test('应该处理不存在的API Key', async () => {
    const response = await request(app)
      .get('/admin/api-keys/non-existent-key')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(404)
  })
})
