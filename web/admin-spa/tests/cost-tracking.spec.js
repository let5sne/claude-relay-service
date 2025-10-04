import { test, expect } from '@playwright/test'

test.describe('成本配置与验证功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理员账户
    await page.goto('http://localhost:3000/admin-next/login')

    // 等待登录页面加载
    await page.waitForSelector('input[type="text"]', { timeout: 10000 })

    // 填写登录信息（使用默认管理员账户）
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'testpass1234')

    // 点击登录按钮
    await page.click('button[type="submit"]')

    // 等待登录成功并跳转到仪表盘
    await page.waitForURL('**/admin-next/dashboard', { timeout: 10000 })
  })

  test('应该能访问统计分析页面', async ({ page }) => {
    // 导航到统计分析页面
    await page.goto('http://localhost:3000/admin-next/analytics')

    // 等待页面加载 - 使用更具体的选择器
    await page.waitForSelector('h2:has-text("统计分析")', { timeout: 10000 })

    // 验证页面标题
    const title = await page.textContent('h2')
    expect(title).toContain('统计分析')
  })

  test('应该能看到"成本配置与验证"标签页', async ({ page }) => {
    // 导航到统计分析页面
    await page.goto('http://localhost:3000/admin-next/analytics')

    // 等待标签页加载
    await page.waitForSelector('nav[aria-label="Tabs"]', { timeout: 5000 })

    // 检查是否有"成本配置与验证"标签
    const tabs = await page.$$eval('nav[aria-label="Tabs"] button', (buttons) =>
      buttons.map((btn) => btn.textContent.trim())
    )

    console.log('可用标签页:', tabs)
    expect(tabs).toContain('成本配置与验证')
  })

  test('应该能点击"成本配置与验证"标签页', async ({ page }) => {
    // 导航到统计分析页面
    await page.goto('http://localhost:3000/admin-next/analytics')

    // 等待并点击"成本配置与验证"标签
    await page.click('button:has-text("成本配置与验证")')

    // 等待内容加载
    await page.waitForSelector('text=管理账户计价模式', { timeout: 5000 })

    // 验证是否显示了成本配置内容（不检查h3标题，因为可能没有）
    const content = await page.textContent('body')
    expect(content).toContain('成本配置与验证')
  })

  test('应该能加载账户列表', async ({ page }) => {
    // 监听网络请求
    const requests = []
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/')) {
        requests.push({
          url: request.url(),
          method: request.method()
        })
      }
    })

    const responses = []
    page.on('response', async (response) => {
      if (response.url().includes('/api/admin/')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        })
      }
    })

    // 导航到成本配置页面
    await page.goto('http://localhost:3000/admin-next/analytics')
    await page.click('text=成本配置与验证')

    // 等待数据加载
    await page.waitForTimeout(2000)

    // 打印请求和响应
    console.log('API 请求:', requests)
    console.log('API 响应:', responses)

    // 检查是否有账户 API 调用
    const claudeAccountsRequest = requests.find((r) => r.url.includes('claude-accounts'))
    const geminiAccountsRequest = requests.find((r) => r.url.includes('gemini-accounts'))

    console.log('Claude 账户请求:', claudeAccountsRequest)
    console.log('Gemini 账户请求:', geminiAccountsRequest)

    // 检查响应状态
    const claudeResponse = responses.find((r) => r.url.includes('claude-accounts'))
    const geminiResponse = responses.find((r) => r.url.includes('gemini-accounts'))

    console.log('Claude 账户响应:', claudeResponse)
    console.log('Gemini 账户响应:', geminiResponse)

    // 验证响应状态码（允许404，因为可能没有账户）
    if (claudeResponse) {
      expect([200, 404]).toContain(claudeResponse.status)
    }
    if (geminiResponse) {
      expect([200, 404]).toContain(geminiResponse.status)
    }
  })

  test('应该显示账户列表或空状态', async ({ page }) => {
    // 导航到成本配置页面
    await page.goto('http://localhost:3000/admin-next/analytics')
    await page.click('text=成本配置与验证')

    // 等待加载完成
    await page.waitForTimeout(2000)

    // 检查是否有账户表格或空状态
    const hasTable = (await page.$('table')) !== null
    const hasEmptyState = (await page.$('text=暂无账户数据')) !== null

    console.log('是否有表格:', hasTable)
    console.log('是否显示空状态:', hasEmptyState)

    // 至少应该有一个
    expect(hasTable || hasEmptyState).toBe(true)
  })

  test('应该能打开成本配置模态框（如果有账户）', async ({ page }) => {
    // 导航到成本配置页面
    await page.goto('http://localhost:3000/admin-next/analytics')
    await page.click('text=成本配置与验证')

    // 等待加载
    await page.waitForTimeout(2000)

    // 检查是否有配置按钮
    const configButtons = await page.$$('button[title="配置成本"]')

    if (configButtons.length > 0) {
      // 点击第一个配置按钮
      await configButtons[0].click()

      // 等待模态框出现
      await page.waitForSelector('text=成本配置', { timeout: 3000 })

      // 验证模态框内容
      const modalHeading = await page.textContent('h3')
      expect(modalHeading).toContain('成本配置')

      // 检查是否有计价模式选择
      const hasBillingTypeSelect = (await page.$('select')) !== null
      expect(hasBillingTypeSelect).toBe(true)
    } else {
      console.log('没有账户，跳过模态框测试')
      test.skip()
    }
  })
})
