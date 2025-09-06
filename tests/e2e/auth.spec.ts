import { test, expect } from '@playwright/test'

test('protected routes redirect to login when not authenticated', async ({ page }) => {
  await page.goto('dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('admin can login then logout successfully', async ({ page }) => {
  // Login
  await page.goto('login')
  await page.getByRole('textbox', { name: '请输入用户名' }).fill('admin')
  await page.getByRole('textbox', { name: '请输入密码' }).fill('testpass1234')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  // Logout
  await page.getByText('admin').click()
  page.once('dialog', (d) => d.accept())
  await page.getByText('退出登录').click()
  await expect(page).toHaveURL(/\/login$/)

  // Accessing protected after logout redirects to login
  await page.goto('dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

