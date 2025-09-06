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

test.describe.serial('Claude Console recovery actions', () => {
  let token: string
  let accountId: string
  const name = uniqueName('e2e-console')

  test.beforeAll(async ({ request }) => {
    token = await adminLogin(request)

    // Create a dummy console account
    const createResp = await request.post(`${ROOT}/admin/claude-console-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name,
        apiUrl: 'https://console.fake.local/api',
        apiKey: 'test_key',
        priority: 50
      }
    })
    const created = await createResp.json()
    expect(created.success).toBeTruthy()
    accountId = created.data.id
  })

  test('clear rate limit API works and account row renders', async ({ request, page }) => {
    const resp = await request.post(
      `${ROOT}/admin/claude-console-accounts/${accountId}/clear-rate-limit`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await resp.json()
    expect(data.success).toBeTruthy()

    await page.addInitScript((authToken) => {
      window.localStorage.setItem('authToken', authToken as string)
    }, token)
    await page.goto('accounts')
    await page.waitForURL(/\/accounts$/)
    const row = page.locator('table').locator('tr', { hasText: name }).first()
    await expect(row).toBeVisible()
  })

  test('clear overload API works', async ({ request }) => {
    const resp = await request.post(
      `${ROOT}/admin/claude-console-accounts/${accountId}/clear-overload`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await resp.json()
    expect(data.success).toBeTruthy()
  })

  test('reset daily usage API works', async ({ request }) => {
    const resp = await request.post(
      `${ROOT}/admin/claude-console-accounts/${accountId}/reset-usage`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await resp.json()
    expect(data.success).toBeTruthy()
  })
})
