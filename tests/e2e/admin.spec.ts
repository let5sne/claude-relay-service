import { test, expect } from '@playwright/test'

function uniqueName(prefix: string) {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `${prefix}-${ts}`
}

test('admin login, create/disable/activate API key, protected redirects, logout', async ({ page }) => {
  // Login (robust to already-logged-in state)
  // Use baseURL-aware relative paths (no leading slash)
  await page.goto('login')
  if (/\/login$/.test(page.url())) {
    const hasUserField = await page
      .getByRole('textbox', { name: '请输入用户名' })
      .isVisible()
      .catch(() => false)
    if (hasUserField) {
      await page.getByRole('textbox', { name: '请输入用户名' }).fill('admin')
      await page.getByRole('textbox', { name: '请输入密码' }).fill('testpass1234')
      await page.getByRole('button', { name: '登录' }).click()
      await page.waitForURL(/\/dashboard$/)
    }
  }

  // Go to API Keys page directly
  await page.goto('api-keys')
  await page.waitForURL(/\/api-keys$/)
  // Button has an icon plus sign, but text content is '创建新 Key'
  await expect(page.getByRole('button', { name: '创建新 Key' })).toBeVisible()

  // Create a new API key
  const keyName = uniqueName('e2e-key')
  await page.getByRole('button', { name: '创建新 Key' }).click()
  await page.getByPlaceholder('为您的 API Key 取一个名称').fill(keyName)
  // Click modal submit button (label includes a leading plus)
  await page.getByRole('button', { name: '+ 创建', exact: true }).click()

  // Creation modal appears (prefer heading to avoid toast ambiguity)
  await expect(page.getByRole('heading', { name: 'API Key 创建成功' })).toBeVisible()

  // Acknowledge saved
  await page.getByText('我已保存').click()
  await page.getByText('确定关闭').click()

  // Verify key row exists (target the table row explicitly)
  // Narrow list using search to ensure visibility even with pagination
  const search = page.getByPlaceholder(/搜索名称/)
  await search.fill(keyName)
  const row = page.locator('table').locator('tr', { hasText: keyName }).first()
  await expect(row).toBeVisible()
  await row.getByText('禁用').click()
  await page.getByText('确定禁用').click()
  await expect(page.getByText('API Key 已禁用')).toBeVisible()

  // Activate the key back
  const disabledRow = page.getByText(keyName).locator('xpath=ancestor::tr')
  await expect(disabledRow.getByText('禁用')).toBeVisible()
  await disabledRow.getByText('激活').click()
  await expect(page.getByText(keyName).locator('xpath=ancestor::tr').getByText('活跃')).toBeVisible()

  // Logout
  await page.getByText('admin').click()
  page.once('dialog', (d) => d.accept())
  await page.getByText('退出登录').click()
  await expect(page).toHaveURL(/\/login$/)

  // Protected redirect check
  await page.goto('dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
