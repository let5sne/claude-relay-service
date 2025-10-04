import { test, expect } from '@playwright/test'

test('调试登录流程', async ({ page }) => {
  // 启用详细日志
  page.on('console', (msg) => console.log('浏览器日志:', msg.text()))
  page.on('pageerror', (err) => console.log('页面错误:', err.message))

  console.log('1. 访问登录页面...')
  await page.goto('http://localhost:3000/admin-next/login')

  console.log('2. 等待页面加载...')
  await page.waitForLoadState('networkidle')

  console.log('3. 当前 URL:', page.url())

  // 截图
  await page.screenshot({ path: 'test-results/login-page.png' })

  console.log('4. 查找输入框...')
  const usernameInput = await page.$('input[type="text"]')
  const passwordInput = await page.$('input[type="password"]')

  console.log('用户名输入框存在:', !!usernameInput)
  console.log('密码输入框存在:', !!passwordInput)

  if (usernameInput && passwordInput) {
    console.log('5. 填写登录信息...')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin')

    console.log('6. 点击登录按钮...')
    await page.click('button[type="submit"]')

    console.log('7. 等待导航...')
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    console.log('8. 登录后 URL:', page.url())

    // 截图
    await page.screenshot({ path: 'test-results/after-login.png' })

    // 检查是否有错误提示
    const errorMsg = await page.$('.error, .alert-error, [role="alert"]')
    if (errorMsg) {
      console.log('错误信息:', await errorMsg.textContent())
    }
  } else {
    console.log('未找到登录表单元素')
  }
})
