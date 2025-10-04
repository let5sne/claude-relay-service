import { test, expect } from '@playwright/test'

test.describe('Cost Tracking Debug - Skip Login', () => {
  test('debug with manual session', async ({ page, context }) => {
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

    // 捕获网络请求和响应
    const apiCalls = []
    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('claude-accounts') || url.includes('gemini-accounts')) {
        let body = null
        try {
          body = await response.json()
        } catch (e) {
          try {
            body = await response.text()
          } catch (e2) {
            body = 'Unable to parse'
          }
        }

        const call = {
          status: response.status(),
          url: url,
          body: body
        }
        apiCalls.push(call)

        console.log('\n📡 API Response:', response.status(), url)
        if (body && typeof body === 'object') {
          console.log('Success:', body.success)
          console.log('Has data:', !!body.data)
          console.log('Data is array:', Array.isArray(body.data))
          if (Array.isArray(body.data)) {
            console.log('Data length:', body.data.length)
            if (body.data.length > 0) {
              console.log(
                'First account:',
                JSON.stringify(
                  {
                    id: body.data[0].id,
                    name: body.data[0].name,
                    platform: body.data[0].platform,
                    email: body.data[0].email
                  },
                  null,
                  2
                )
              )
            }
          }
        }
      }
    })

    console.log('\n========================================')
    console.log('请在浏览器中手动执行以下步骤：')
    console.log('1. 登录到管理后台')
    console.log('2. 导航到"统计分析" → "成本配置与验证"')
    console.log('3. 点击"刷新"按钮')
    console.log('========================================\n')

    // 直接打开统计分析页面
    await page.goto('http://localhost:3000/admin-next/analytics')

    // 等待可能的跳转
    await page.waitForTimeout(2000)

    // 检查是否在登录页面
    const isLoginPage = page.url().includes('/login')
    if (isLoginPage) {
      console.log('\n⚠️  检测到登录页面，需要手动登录')
      console.log('请在浏览器中登录，然后导航到统计分析页面')
      await page.waitForURL('**/analytics', { timeout: 120000 })
    }

    console.log('\n=== 当前页面:', page.url(), '===\n')

    // 等待页面加载
    await page.waitForTimeout(2000)

    // 尝试点击成本配置标签
    try {
      const costTab = page.locator('text=成本配置与验证')
      await costTab.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ 找到成本配置标签，准备点击...')
      await costTab.click()
      console.log('✅ 已点击成本配置标签\n')
    } catch (e) {
      console.log('⚠️  未找到成本配置标签，可能需要手动点击')
    }

    // 等待数据加载
    console.log('等待数据加载...')
    await page.waitForTimeout(5000)

    // 分析控制台日志
    console.log('\n=== 控制台日志分析 ===')
    const allAccountsLog = consoleMessages.find((m) => m.text.includes('All accounts:'))
    if (allAccountsLog) {
      console.log('✅ 找到 All accounts 日志:')
      console.log(allAccountsLog.text)
    } else {
      console.log('❌ 未找到 All accounts 日志')
    }

    const profilesLog = consoleMessages.find((m) => m.text.includes('Accounts with profiles:'))
    if (profilesLog) {
      console.log('\n✅ 找到 Accounts with profiles 日志:')
      console.log(profilesLog.text)
    } else {
      console.log('❌ 未找到 Accounts with profiles 日志')
    }

    // 输出所有警告信息
    const warnings = consoleMessages.filter((m) => m.text.includes('Failed to load'))
    if (warnings.length > 0) {
      console.log('\n⚠️  警告信息:')
      warnings.forEach((w) => console.log('  -', w.text))
    }

    // 分析 API 调用
    console.log('\n=== API 调用汇总 ===')
    console.log('总共捕获', apiCalls.length, '个账户 API 调用')

    const claudeCall = apiCalls.find((c) => c.url.includes('claude-accounts'))
    const geminiCall = apiCalls.find((c) => c.url.includes('gemini-accounts'))

    if (claudeCall) {
      console.log('\n✅ Claude 账户 API:')
      console.log('  Status:', claudeCall.status)
      console.log('  Data length:', claudeCall.body?.data?.length || 0)
    } else {
      console.log('\n❌ 未调用 Claude 账户 API')
    }

    if (geminiCall) {
      console.log('\n✅ Gemini 账户 API:')
      console.log('  Status:', geminiCall.status)
      console.log('  Data length:', geminiCall.body?.data?.length || 0)
    } else {
      console.log('\n❌ 未调用 Gemini 账户 API')
    }

    // 检查页面显示
    console.log('\n=== 页面显示检查 ===')
    try {
      const tableRows = await page.locator('tbody tr').count()
      console.log('表格行数:', tableRows)

      if (tableRows > 0) {
        console.log('\n账户列表:')
        for (let i = 0; i < tableRows; i++) {
          const row = page.locator('tbody tr').nth(i)
          const cells = await row.locator('td').allTextContents()
          console.log(`  行 ${i + 1}:`, cells[0]?.trim(), '-', cells[1]?.trim())
        }
      }
    } catch (e) {
      console.log('无法读取表格数据')
    }

    const emptyState = await page.locator('text=暂无账户数据').count()
    if (emptyState > 0) {
      console.log('\n⚠️  显示"暂无账户数据"')
    }

    // 截图
    await page.screenshot({ path: 'cost-tracking-debug.png', fullPage: true })
    console.log('\n📸 已保存截图: cost-tracking-debug.png')

    // 保持浏览器打开
    console.log('\n测试完成，浏览器将保持打开 30 秒以便检查...')
    await page.waitForTimeout(30000)
  })
})
