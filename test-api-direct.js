#!/usr/bin/env node

/**
 * 直接测试 API，跳过登录
 * 使用方式：从浏览器开发者工具复制 sessionStorage 中的 token
 * node test-api-direct.js <token>
 */

const axios = require('axios')

const BASE_URL = 'http://localhost:3000'
const token = process.argv[2]

if (!token) {
  console.log('Usage: node test-api-direct.js <token>')
  console.log('Get token from browser sessionStorage.getItem("authToken")')
  process.exit(1)
}

async function test() {
  console.log('🔍 Testing Cost Tracking API with provided token...\n')

  const headers = {
    Authorization: `Bearer ${token}`
  }

  try {
    // 1. 测试获取 Claude 账户
    console.log('1️⃣ Testing GET /api/admin/claude-accounts...')
    const claudeResponse = await axios.get(`${BASE_URL}/api/admin/claude-accounts`, { headers })

    console.log('✅ Response received')
    console.log('Response structure:', {
      success: claudeResponse.data.success,
      hasData: !!claudeResponse.data.data,
      hasAccounts: !!claudeResponse.data.accounts,
      dataType: Array.isArray(claudeResponse.data.data) ? 'array' : typeof claudeResponse.data.data,
      accountsType: Array.isArray(claudeResponse.data.accounts)
        ? 'array'
        : typeof claudeResponse.data.accounts
    })

    // 使用与前端相同的逻辑解析
    const claudeAccounts = claudeResponse.data.data || claudeResponse.data.accounts || []
    console.log(`📊 Parsed ${claudeAccounts.length} Claude accounts`)

    if (claudeAccounts.length > 0) {
      console.log('\nFirst account details:')
      const acc = claudeAccounts[0]
      console.log(
        JSON.stringify(
          {
            id: acc.id,
            name: acc.name,
            platform: acc.platform,
            email: acc.email,
            hasUsage: !!acc.usage,
            hasGroupInfos: !!acc.groupInfos
          },
          null,
          2
        )
      )
    } else {
      console.log('⚠️  No Claude accounts found!')
    }
    console.log()

    // 2. 测试获取 Gemini 账户
    console.log('2️⃣ Testing GET /api/admin/gemini-accounts...')
    const geminiResponse = await axios.get(`${BASE_URL}/api/admin/gemini-accounts`, { headers })

    console.log('✅ Response received')
    const geminiAccounts = geminiResponse.data.data || geminiResponse.data.accounts || []
    console.log(`📊 Parsed ${geminiAccounts.length} Gemini accounts`)

    if (geminiAccounts.length > 0) {
      console.log('\nFirst account details:')
      const acc = geminiAccounts[0]
      console.log(
        JSON.stringify(
          {
            id: acc.id,
            name: acc.name,
            platform: acc.platform,
            email: acc.email
          },
          null,
          2
        )
      )
    } else {
      console.log('⚠️  No Gemini accounts found!')
    }
    console.log()

    // 3. 模拟前端的账户处理逻辑
    console.log('3️⃣ Simulating frontend account processing...')
    const allAccounts = [
      ...claudeAccounts.map((acc) => ({
        ...acc,
        platform: acc.platform || 'claude'
      })),
      ...geminiAccounts.map((acc) => ({
        ...acc,
        platform: acc.platform || 'gemini'
      }))
    ]

    console.log(`✅ Total accounts after processing: ${allAccounts.length}`)
    if (allAccounts.length > 0) {
      console.log('Platforms:', [...new Set(allAccounts.map((a) => a.platform))])
    }
    console.log()

    // 4. 测试成本配置 API
    if (allAccounts.length > 0) {
      const testAccount = allAccounts[0]
      console.log(`4️⃣ Testing cost profile for account: ${testAccount.name} (${testAccount.id})`)

      try {
        const profileResponse = await axios.get(
          `${BASE_URL}/api/admin/accounts/${testAccount.id}/cost-profile`,
          { headers }
        )
        console.log('✅ Cost profile response:', {
          success: profileResponse.data.success,
          hasProfile: !!profileResponse.data.profile,
          billingType: profileResponse.data.profile?.billingType || 'none'
        })
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(
            'ℹ️  404 - Cost profile endpoint not found (backend feature may not be implemented)'
          )
        } else if (error.response?.status === 500) {
          console.log('⚠️  500 - Server error:', error.response.data?.error)
        } else {
          console.log('❌ Error:', error.message)
        }
      }
    }

    console.log('\n✅ All API tests completed!')
    console.log(
      `\n📊 Summary: ${claudeAccounts.length} Claude + ${geminiAccounts.length} Gemini = ${allAccounts.length} total accounts`
    )
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Data:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

test()
