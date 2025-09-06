import { test, expect } from '@playwright/test'

const ROOT = 'http://127.0.0.1:3000'

async function adminLogin(request) {
  const res = await request.post(`${ROOT}/web/auth/login`, {
    data: { username: 'admin', password: 'testpass1234' }
  })
  const data = await res.json()
  expect(data.success).toBeTruthy()
  return data.token as string
}

function uniqueName(prefix: string) {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `${prefix}-${ts}`
}

test('API Key lifetime limits can be saved and reflected in UI', async ({ request, page }) => {
  const token = await adminLogin(request)

  // Prime UI auth
  await page.addInitScript((authToken) => {
    window.localStorage.setItem('authToken', authToken as string)
  }, token)

  // Create an API key via UI for realistic flow
  await page.goto('api-keys')
  await page.waitForURL(/\/api-keys$/)
  await page.getByRole('button', { name: '创建新 Key' }).click()

  const keyName = uniqueName('limits-key')
  await page.getByPlaceholder('为您的 API Key 取一个名称').fill(keyName)

  // Set lifetime limits in create modal: locate inputs by nearby labels
  const tokenLabel = page.getByText('总 Token 限制', { exact: true })
  const tokenInput = tokenLabel.locator('xpath=following::input[1]')
  await tokenInput.fill('5')

  const costLabel = page.getByText('总费用限制 (美元)', { exact: true })
  const costInput = costLabel.locator('xpath=following::input[1]')
  await costInput.fill('0.5')

  await page.getByRole('button', { name: '+ 创建', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'API Key 创建成功' })).toBeVisible()
  await page.getByText('我已保存').click()
  await page.getByText('确定关闭').click()

  // Open edit modal for this key
  const row = page.locator('table').locator('tr', { hasText: keyName }).first()
  await expect(row).toBeVisible()
  await row.getByText('编辑').click()

  // Verify values persisted
  const editTokenLabel = page.getByText('总 Token 限制', { exact: true })
  const editTokenInput = editTokenLabel.locator('xpath=following::input[1]')
  await expect(editTokenInput).toHaveValue('5')

  const editCostLabel = page.getByText('总费用限制 (美元)', { exact: true })
  const editCostInput = editCostLabel.locator('xpath=following::input[1]')
  // Numeric inputs may normalize to fixed decimals; accept prefix match
  const val = await editCostInput.inputValue()
  expect(parseFloat(val)).toBeCloseTo(0.5, 5)

  // Close edit modal
  await page.getByRole('button', { name: '取消' }).click()
})
