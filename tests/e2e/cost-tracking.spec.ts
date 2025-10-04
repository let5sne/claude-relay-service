import { test, expect } from '@playwright/test'

test.describe('Cost Tracking Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理后台
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('should display cost tracking tab and load accounts', async ({ page }) => {
    // 导航到统计分析页面
    await page.click('text=统计分析')
    await page.waitForURL('**/analytics')

    // 点击"成本配置与验证"标签页
    await page.click('text=成本配置与验证')

    // 等待加载完成
    await page.waitForSelector('.cost-tracking-management', { timeout: 10000 })

    // 检查是否显示了表格或空状态
    const hasTable = await page.locator('table').count()
    const hasEmptyState = await page.locator('text=暂无账户数据').count()

    console.log('Has table:', hasTable > 0)
    console.log('Has empty state:', hasEmptyState > 0)

    // 应该至少有一个显示
    expect(hasTable + hasEmptyState).toBeGreaterThan(0)

    // 如果有表格，检查表头
    if (hasTable > 0) {
      await expect(page.locator('th:has-text("账户")')).toBeVisible()
      await expect(page.locator('th:has-text("平台")')).toBeVisible()
      await expect(page.locator('th:has-text("计价模式")')).toBeVisible()
      await expect(page.locator('th:has-text("操作")')).toBeVisible()

      // 获取账户行数
      const rows = await page.locator('tbody tr').count()
      console.log('Number of account rows:', rows)
      expect(rows).toBeGreaterThan(0)
    }
  })

  test('should not show error popup on tab click', async ({ page }) => {
    // 监听所有 dialog 事件
    const dialogs: string[] = []
    page.on('dialog', (dialog) => {
      console.log('Dialog detected:', dialog.type(), dialog.message())
      dialogs.push(dialog.message())
      dialog.dismiss()
    })

    // 导航到统计分析
    await page.click('text=统计分析')
    await page.waitForURL('**/analytics')

    // 点击成本配置标签
    await page.click('text=成本配置与验证')

    // 等待2秒看是否有弹窗
    await page.waitForTimeout(2000)

    // 不应该有任何错误弹窗
    expect(dialogs).toHaveLength(0)
  })

  test('should display correct platform filter options', async ({ page }) => {
    await page.click('text=统计分析')
    await page.waitForURL('**/analytics')
    await page.click('text=成本配置与验证')

    // 检查平台筛选下拉框
    const select = page.locator('select').first()
    await expect(select).toBeVisible()

    // 检查选项
    const options = await select.locator('option').allTextContents()
    expect(options).toContain('全部平台')
    expect(options).toContain('Claude')
    expect(options).toContain('Gemini')
  })

  test('should open console and check for API errors', async ({ page }) => {
    const consoleMessages: any[] = []
    const apiErrors: any[] = []

    // 捕获控制台消息
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      })
    })

    // 捕获网络错误
    page.on('requestfailed', (request) => {
      apiErrors.push({
        url: request.url(),
        failure: request.failure()
      })
    })

    // 导航并点击标签
    await page.click('text=统计分析')
    await page.waitForURL('**/analytics')
    await page.click('text=成本配置与验证')

    // 等待加载
    await page.waitForTimeout(3000)

    // 打印控制台日志（用于调试）
    console.log('\n=== Console Messages ===')
    consoleMessages.forEach((msg) => {
      console.log(`[${msg.type}]`, msg.text)
    })

    console.log('\n=== API Errors ===')
    apiErrors.forEach((err) => {
      console.log('Failed:', err.url, err.failure)
    })

    // 检查是否有关键的 console.log
    const allAccountsLog = consoleMessages.find((m) => m.text.includes('All accounts:'))
    console.log('\n=== All Accounts Log ===')
    console.log(allAccountsLog?.text || 'Not found')

    // 不应该有 404 错误
    const has404 = apiErrors.some(
      (err) =>
        err.url.includes('/api/admin/claude-accounts') ||
        err.url.includes('/api/admin/gemini-accounts')
    )
    expect(has404).toBe(false)
  })
})
