import { test, expect } from '@playwright/test'

test('public API stats page loads and shows query UI', async ({ page }) => {
  await page.goto('api-stats')
  await expect(page).toHaveURL(/\/api-stats$/)
  await expect(page.getByRole('heading', { name: '使用统计查询' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查询统计' })).toBeVisible()
})

test('invalid API key shows error on stats page', async ({ page }) => {
  await page.goto('api-stats')
  await page.getByPlaceholder('请输入您的 API Key (cr_...)').fill('cr_invalid_key')
  await page.getByRole('button', { name: '查询统计' }).click()

  // Expect an error box to appear with message, typically 'API key not found'
  await expect(page.getByText(/API key not found|请求失败|查询失败|401/i)).toBeVisible()
})

