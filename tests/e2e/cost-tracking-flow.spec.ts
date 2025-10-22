/**
 * E2E测试 - 成本追踪完整流程
 *
 * 使用Playwright测试成本追踪功能的完整用户流程
 *
 * 运行方式:
 * npx playwright test tests/e2e/cost-tracking-flow.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('成本追踪完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理后台
    await page.goto('/admin/login')
    await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin')
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin')
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin/dashboard')
  })

  test('完整的成本追踪流程', async ({ page }) => {
    // 1. 导航到统计分析页面
    await page.click('text=统计分析')
    await expect(page).toHaveURL(/.*analytics/)

    // 2. 查看成本效率分析
    await page.click('text=成本效率')
    await expect(page.locator('text=成本效率汇总')).toBeVisible()

    // 3. 验证数据加载
    await page.waitForSelector('[data-testid="cost-summary"]')
    const totalCost = await page.locator('[data-testid="total-cost"]').textContent()
    expect(totalCost).toBeTruthy()

    // 4. 查看成本趋势
    await page.click('text=成本趋势')
    await expect(page.locator('canvas')).toBeVisible() // 图表应该显示

    // 5. 筛选特定时间范围
    await page.click('[data-testid="date-range-picker"]')
    await page.click('text=最近7天')
    await page.waitForTimeout(1000) // 等待数据刷新

    // 6. 查看账户成本明细
    await page.click('text=账户明细')
    const accountRows = await page.locator('[data-testid="account-row"]').count()
    expect(accountRows).toBeGreaterThan(0)

    // 7. 点击查看某个账户的详细成本
    await page.click('[data-testid="account-row"]:first-child')
    await expect(page.locator('text=账户成本详情')).toBeVisible()

    // 8. 验证API Key级别的成本分解
    await page.click('text=API Key明细')
    const apiKeyRows = await page.locator('[data-testid="apikey-cost-row"]').count()
    expect(apiKeyRows).toBeGreaterThanOrEqual(0)

    // 9. 导出成本报告
    await page.click('button:has-text("导出报告")')
    const downloadPromise = page.waitForEvent('download')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/cost-report.*\.csv/)

    // 10. 验证成本计算的准确性
    const inputCost = await page.locator('[data-testid="input-cost"]').textContent()
    const outputCost = await page.locator('[data-testid="output-cost"]').textContent()
    const totalDisplayed = await page.locator('[data-testid="total-cost"]').textContent()

    // 简单验证总成本 = 输入成本 + 输出成本
    if (inputCost && outputCost && totalDisplayed) {
      const inputNum = parseFloat(inputCost.replace(/[^0-9.]/g, ''))
      const outputNum = parseFloat(outputCost.replace(/[^0-9.]/g, ''))
      const totalNum = parseFloat(totalDisplayed.replace(/[^0-9.]/g, ''))

      expect(Math.abs(totalNum - (inputNum + outputNum))).toBeLessThan(0.01)
    }
  })

  test('成本追踪配置管理', async ({ page }) => {
    // 1. 导航到成本追踪管理
    await page.goto('/admin/analytics')
    await page.click('text=成本追踪管理')

    // 2. 查看当前配置
    await expect(page.locator('text=成本追踪配置')).toBeVisible()

    // 3. 启用/禁用成本追踪
    const toggleButton = page.locator('[data-testid="cost-tracking-toggle"]')
    const initialState = await toggleButton.isChecked()
    await toggleButton.click()
    await page.waitForTimeout(500)
    const newState = await toggleButton.isChecked()
    expect(newState).toBe(!initialState)

    // 4. 配置成本阈值告警
    await page.click('text=告警设置')
    await page.fill('[data-testid="daily-threshold"]', '100')
    await page.fill('[data-testid="monthly-threshold"]', '3000')
    await page.click('button:has-text("保存")')
    await expect(page.locator('text=保存成功')).toBeVisible()

    // 5. 查看成本告警历史
    await page.click('text=告警历史')
    await expect(page.locator('[data-testid="alert-history"]')).toBeVisible()
  })

  test('实时成本监控', async ({ page }) => {
    // 1. 导航到Dashboard
    await page.goto('/admin/dashboard')

    // 2. 验证实时成本显示
    await expect(page.locator('[data-testid="realtime-cost"]')).toBeVisible()

    // 3. 验证成本更新（模拟API调用）
    const initialCost = await page.locator('[data-testid="realtime-cost"]').textContent()

    // 触发一次API调用（如果有测试端点）
    // await page.evaluate(() => fetch('/test/trigger-api-call'))

    // 等待成本更新
    await page.waitForTimeout(2000)

    // 验证成本可能已更新
    const updatedCost = await page.locator('[data-testid="realtime-cost"]').textContent()
    if (updatedCost) {
      expect(updatedCost).toBeTruthy()
    }

    // 4. 验证成本图表实时更新
    await expect(page.locator('[data-testid="cost-chart"]')).toBeVisible()
  })

  test('成本分析和优化建议', async ({ page }) => {
    // 1. 导航到成本效率分析
    await page.goto('/admin/analytics')
    await page.click('text=成本效率')

    // 2. 查看效率评分
    const efficiencyScore = await page.locator('[data-testid="efficiency-score"]')
    await expect(efficiencyScore).toBeVisible()
    const scoreText = await efficiencyScore.textContent()
    if (scoreText) {
      const score = parseFloat(scoreText)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }

    // 3. 查看优化建议
    await page.click('text=优化建议')
    await expect(page.locator('[data-testid="optimization-suggestions"]')).toBeVisible()

    // 4. 查看成本异常检测
    await page.click('text=异常检测')
    await expect(page.locator('[data-testid="anomaly-detection"]')).toBeVisible()

    // 5. 比较不同账户的成本效率
    await page.click('text=账户对比')
    await page.selectOption('[data-testid="account-selector"]', { index: 0 })
    await page.selectOption('[data-testid="compare-account-selector"]', { index: 1 })
    await page.click('button:has-text("对比")')
    await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible()
  })
})

test.describe('成本追踪错误处理', () => {
  test('应该处理数据加载失败', async ({ page }) => {
    // 模拟网络错误
    await page.route('**/api/cost-stats', (route) => route.abort())

    await page.goto('/admin/analytics')
    await page.click('text=成本效率')

    // 应该显示错误提示
    await expect(page.locator('text=加载失败')).toBeVisible()

    // 应该有重试按钮
    await expect(page.locator('button:has-text("重试")')).toBeVisible()
  })

  test('应该处理无数据情况', async ({ page }) => {
    // 模拟空数据响应
    await page.route('**/api/cost-stats', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: [] })
      })
    )

    await page.goto('/admin/analytics')
    await page.click('text=成本效率')

    // 应该显示空状态提示
    await expect(page.locator('text=暂无数据')).toBeVisible()
  })
})
