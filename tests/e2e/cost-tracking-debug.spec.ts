import { test, expect } from '@playwright/test'

test.describe('Cost Tracking Data Loading Debug', () => {
  test('debug account loading', async ({ page }) => {
    // 捕获所有控制台消息
    const consoleMessages = []
    page.on('console', (msg) => {
      const text = msg.text()
      consoleMessages.push({
        type: msg.type(),
        text: text
      })
      console.log(`[${msg.type()}]`, text)
    })

    // 捕获网络请求
    const apiRequests = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/admin/') || url.includes('/webapi/')) {
        apiRequests.push({
          method: request.method(),
          url: url,
          headers: request.headers()
        })
        console.log('→ Request:', request.method(), url)
      }
    })

    // 捕获网络响应
    const apiResponses = []
    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/admin/') || url.includes('/webapi/')) {
        let body = null
        try {
          body = await response.json()
        } catch (e) {
          body = await response.text()
        }

        apiResponses.push({
          status: response.status(),
          url: url,
          body: body
        })
        console.log('← Response:', response.status(), url)
        if (body && typeof body === 'object') {
          console.log('   Body:', JSON.stringify(body, null, 2).substring(0, 500))
        }
      }
    })

    // 登录
    console.log('\n=== 开始登录 ===')
    await page.goto('http://localhost:3000/admin-next/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')

    // 等待跳转到仪表板
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    console.log('✅ 登录成功\n')

    // 导航到统计分析
    console.log('=== 导航到统计分析 ===')
    await page.click('text=统计分析')
    await page.waitForURL('**/analytics')

    // 点击成本配置与验证标签
    console.log('\n=== 点击成本配置与验证标签 ===')
    await page.click('text=成本配置与验证')

    // 等待加载
    await page.waitForTimeout(3000)

    // 查找 "All accounts" 日志
    console.log('\n=== 控制台日志分析 ===')
    const allAccountsLog = consoleMessages.find((m) => m.text.includes('All accounts:'))
    if (allAccountsLog) {
      console.log('找到 All accounts 日志:')
      console.log(allAccountsLog.text)
    } else {
      console.log('⚠️  未找到 All accounts 日志')
    }

    const profilesLog = consoleMessages.find((m) => m.text.includes('Accounts with profiles:'))
    if (profilesLog) {
      console.log('\n找到 Accounts with profiles 日志:')
      console.log(profilesLog.text)
    }

    // 分析 API 请求
    console.log('\n=== API 请求分析 ===')
    const claudeRequest = apiRequests.find((r) => r.url.includes('claude-accounts'))
    const geminiRequest = apiRequests.find((r) => r.url.includes('gemini-accounts'))

    if (claudeRequest) {
      console.log('✅ 发送了 Claude 账户请求:', claudeRequest.url)
    } else {
      console.log('❌ 未发送 Claude 账户请求')
    }

    if (geminiRequest) {
      console.log('✅ 发送了 Gemini 账户请求:', geminiRequest.url)
    } else {
      console.log('❌ 未发送 Gemini 账户请求')
    }

    // 分析 API 响应
    console.log('\n=== API 响应分析 ===')
    const claudeResponse = apiResponses.find((r) => r.url.includes('claude-accounts'))
    const geminiResponse = apiResponses.find((r) => r.url.includes('gemini-accounts'))

    if (claudeResponse) {
      console.log('Claude 账户响应:')
      console.log('  Status:', claudeResponse.status)
      if (claudeResponse.body?.data) {
        console.log('  Data length:', claudeResponse.body.data.length)
        console.log('  First account:', JSON.stringify(claudeResponse.body.data[0], null, 2))
      } else {
        console.log('  Body:', claudeResponse.body)
      }
    }

    if (geminiResponse) {
      console.log('\nGemini 账户响应:')
      console.log('  Status:', geminiResponse.status)
      if (geminiResponse.body?.data) {
        console.log('  Data length:', geminiResponse.body.data.length)
        console.log('  First account:', JSON.stringify(geminiResponse.body.data[0], null, 2))
      } else {
        console.log('  Body:', geminiResponse.body)
      }
    }

    // 检查页面实际显示
    console.log('\n=== 页面显示检查 ===')
    const hasTable = (await page.locator('tbody tr').count()) > 0
    const hasEmptyState = (await page.locator('text=暂无账户数据').count()) > 0

    console.log('Has table rows:', hasTable)
    console.log('Has empty state:', hasEmptyState)

    if (hasTable) {
      const rowCount = await page.locator('tbody tr').count()
      console.log('Table rows count:', rowCount)

      // 获取每一行的账户信息
      for (let i = 0; i < rowCount; i++) {
        const row = page.locator('tbody tr').nth(i)
        const accountName = await row.locator('td').first().textContent()
        const platform = await row.locator('td').nth(1).textContent()
        console.log(`Row ${i + 1}: ${accountName?.trim()} - Platform: ${platform?.trim()}`)
      }
    }

    // 截图
    await page.screenshot({ path: 'cost-tracking-debug.png', fullPage: true })
    console.log('\n📸 已保存截图: cost-tracking-debug.png')

    // 保持页面打开以便检查
    await page.waitForTimeout(2000)
  })
})
