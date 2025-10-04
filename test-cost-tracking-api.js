#!/usr/bin/env node

/**
 * 测试成本追踪 API 是否正常工作
 */

const axios = require('axios')

const BASE_URL = 'http://localhost:3000'

async function test() {
  console.log('🔍 Testing Cost Tracking API...\n')

  try {
    // 1. 测试登录获取 token
    console.log('1️⃣ Testing admin login...')
    const loginResponse = await axios.post(`${BASE_URL}/web/auth/login`, {
      username: 'admin',
      password: 'admin123' // 使用默认密码，实际环境中应该从配置读取
    })

    if (!loginResponse.data.success) {
      throw new Error('Login failed')
    }

    const token = loginResponse.data.token
    console.log('✅ Login successful, got token\n')

    const headers = {
      Authorization: `Bearer ${token}`
    }

    // 2. 测试获取 Claude 账户
    console.log('2️⃣ Testing GET /api/admin/claude-accounts...')
    const claudeResponse = await axios.get(`${BASE_URL}/api/admin/claude-accounts`, { headers })
    console.log('Response structure:', {
      success: claudeResponse.data.success,
      hasData: !!claudeResponse.data.data,
      hasAccounts: !!claudeResponse.data.accounts,
      dataType: Array.isArray(claudeResponse.data.data) ? 'array' : typeof claudeResponse.data.data,
      accountsType: Array.isArray(claudeResponse.data.accounts)
        ? 'array'
        : typeof claudeResponse.data.accounts,
      dataLength: claudeResponse.data.data?.length || 0,
      accountsLength: claudeResponse.data.accounts?.length || 0
    })

    const claudeAccounts = claudeResponse.data.data || claudeResponse.data.accounts || []
    console.log(`✅ Got ${claudeAccounts.length} Claude accounts`)
    if (claudeAccounts.length > 0) {
      console.log('First account sample:', {
        id: claudeAccounts[0].id,
        name: claudeAccounts[0].name,
        platform: claudeAccounts[0].platform,
        hasUsage: !!claudeAccounts[0].usage
      })
    }
    console.log()

    // 3. 测试获取 Gemini 账户
    console.log('3️⃣ Testing GET /api/admin/gemini-accounts...')
    const geminiResponse = await axios.get(`${BASE_URL}/api/admin/gemini-accounts`, { headers })
    console.log('Response structure:', {
      success: geminiResponse.data.success,
      hasData: !!geminiResponse.data.data,
      hasAccounts: !!geminiResponse.data.accounts,
      dataLength: geminiResponse.data.data?.length || 0,
      accountsLength: geminiResponse.data.accounts?.length || 0
    })

    const geminiAccounts = geminiResponse.data.data || geminiResponse.data.accounts || []
    console.log(`✅ Got ${geminiAccounts.length} Gemini accounts`)
    if (geminiAccounts.length > 0) {
      console.log('First account sample:', {
        id: geminiAccounts[0].id,
        name: geminiAccounts[0].name,
        platform: geminiAccounts[0].platform,
        hasUsage: !!geminiAccounts[0].usage
      })
    }
    console.log()

    // 4. 测试获取成本配置
    const allAccounts = [...claudeAccounts, ...geminiAccounts]
    if (allAccounts.length > 0) {
      const testAccount = allAccounts[0]
      console.log(`4️⃣ Testing GET /api/admin/accounts/${testAccount.id}/cost-profile...`)
      try {
        const profileResponse = await axios.get(
          `${BASE_URL}/api/admin/accounts/${testAccount.id}/cost-profile`,
          { headers }
        )
        console.log('Profile response:', {
          success: profileResponse.data.success,
          hasProfile: !!profileResponse.data.profile,
          profile: profileResponse.data.profile
        })
        console.log('✅ Cost profile API is accessible\n')
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('⚠️  Cost profile not found (this is expected if not configured)\n')
        } else {
          console.log('❌ Cost profile API error:', error.message, '\n')
        }
      }
    }

    console.log('✅ All tests completed successfully!')
    console.log(
      '\n📊 Summary: Found',
      claudeAccounts.length,
      'Claude accounts and',
      geminiAccounts.length,
      'Gemini accounts'
    )
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    process.exit(1)
  }
}

test()
