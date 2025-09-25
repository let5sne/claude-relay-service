import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { execSync } from 'child_process'

async function ensureLoggedIn(page: Page) {
  await page.goto('login')
  if (/\/login$/.test(page.url())) {
    const usernameField = page.getByRole('textbox', { name: '请输入用户名' })
    if (await usernameField.isVisible().catch(() => false)) {
      await usernameField.fill('admin')
      await page.getByRole('textbox', { name: '请输入密码' }).fill('testpass1234')
      await page.getByRole('button', { name: '登录' }).click()
      await page.waitForURL(/\/dashboard$/)
    }
  }
}

test.describe.serial('Account usage breakdown', () => {
  test.beforeAll(() => {
    execSync('node scripts/generate-breakdown-demo.js', { stdio: 'inherit' })
  })

  test.afterAll(() => {
    execSync('node scripts/generate-breakdown-demo.js --clean', { stdio: 'inherit' })
  })

  test('view account -> API key breakdown', async ({ page }) => {
    await ensureLoggedIn(page)

    await page.goto('accounts')
    await page.waitForURL(/\/accounts$/)

    await expect(page.locator('th', { hasText: '总用量' }).first()).toBeVisible()

    const accountName = 'Test Breakdown Account 1'

    const searchInput = page.locator('input[placeholder*="搜索"]').first()
    if (await searchInput.count()) {
      await searchInput.fill(accountName)
    }

    const accountRow = page.locator('tr', { hasText: accountName }).first()
    await expect(accountRow).toBeVisible()

    await accountRow.getByRole('button', { name: '详情' }).click()

    const detailSection = page.locator('div').filter({ hasText: 'API Key 明细' }).first()

    await expect(detailSection).toBeVisible()

    const loadingText = detailSection.getByText('正在加载明细...', { exact: true })
    if (await loadingText.isVisible().catch(() => false)) {
      await loadingText.waitFor({ state: 'hidden' })
    }

    const tableRows = detailSection.locator('tbody tr')
    const rowCount = await tableRows.count()
    expect(rowCount).toBeGreaterThan(0)

    await detailSection.getByRole('button', { name: '本月' }).click()
    if (await loadingText.isVisible().catch(() => false)) {
      await loadingText.waitFor({ state: 'hidden' })
    }
    await detailSection.getByRole('button', { name: '今日' }).click()
    if (await loadingText.isVisible().catch(() => false)) {
      await loadingText.waitFor({ state: 'hidden' })
    }
    const loadMoreBtn = detailSection.getByRole('button', { name: '加载更多' })
    if (await loadMoreBtn.isVisible().catch(() => false)) {
      await loadMoreBtn.click()
      if (await loadingText.isVisible().catch(() => false)) {
        await loadingText.waitFor({ state: 'hidden' })
      }
    }
  })
})
