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
  const ts = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
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
  const dailyCostLabel = page.getByText('每日费用限制 (美元)', { exact: true })
  const dailyCostInput = dailyCostLabel.locator('xpath=following::input[1]')
  await dailyCostInput.fill('0.25')

  const costLabel = page.getByText('总费用限制 (美元)', { exact: true })
  const costInput = costLabel.locator('xpath=following::input[1]')
  await costInput.fill('0.5')

  await page.getByRole('button', { name: '+ 创建', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'API Key 创建成功' })).toBeVisible()
  await page.getByText('我已保存').click()
  await page.getByText('确定关闭').click()

  // Ensure the key appears in the list
  const row = page.locator('table').locator('tr', { hasText: keyName }).first()
  await expect(row).toBeVisible()

  // Fetch persisted data via admin API to verify limits
  const listResp = await request.get(`${ROOT}/admin/api-keys`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const listJson = await listResp.json()
  expect(listJson.success).toBeTruthy()
  const createdKey = listJson.data.find((entry) => entry.name === keyName)
  expect(createdKey).toBeTruthy()
  expect(createdKey.totalCostLimit).toBeCloseTo(0.5, 5)
  expect(createdKey.dailyCostLimit).toBeCloseTo(0.25, 5)
})
