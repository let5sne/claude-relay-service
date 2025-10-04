import { test } from '@playwright/test'

test('debug cost tracking directly', async ({ page, context }) => {
  // 捕获控制台和API
  const logs = { console: [], api: [] }

  page.on('console', (msg) => {
    const text = msg.text()
    logs.console.push({ type: msg.type(), text })
    console.log(`[${msg.type()}]`, text)
  })

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('claude-accounts') || url.includes('gemini-accounts')) {
      let body = null
      try {
        body = await response.json()
      } catch (e) {}

      logs.api.push({ url, status: response.status(), body })
      console.log('\n📡', response.status(), url)
      if (body?.data) {
        console.log('   账户数量:', body.data.length)
      }
    }
  })

  // 直接访问
  console.log('\n=== 访问登录页面 ===')
  await page.goto('http://localhost:3000/admin-next/login')
  await page.waitForTimeout(1000)

  // 简单查找并填写表单
  const usernameInput = page.locator('input').first()
  const passwordInput = page.locator('input[type="password"]').or(page.locator('input').nth(1))
  const submitButton = page.locator('button').first()

  await usernameInput.fill('admin')
  await passwordInput.fill('testpass1234')
  await submitButton.click()

  console.log('=== 等待登录完成 ===')
  await page.waitForTimeout(3000)

  console.log('当前 URL:', page.url())

  // 直接访问 analytics
  console.log('\n=== 直接访问 analytics 页面 ===')
  await page.goto('http://localhost:3000/admin-next/analytics')
  await page.waitForTimeout(2000)

  console.log('=== 查找并点击成本配置标签 ===')
  try {
    // 使用正确的选择器
    const costTab = page.locator('text=成本配置与验证')
    await costTab.waitFor({ state: 'visible', timeout: 5000 })
    console.log('找到成本配置标签')
    await costTab.click()
    console.log('✅ 点击成功')
  } catch (e) {
    console.log('⚠️ ', e.message)
  }

  console.log('\n=== 等待 5 秒观察数据加载 ===')
  await page.waitForTimeout(5000)

  // 分析结果
  console.log('\n=== 结果分析 ===')
  console.log('\nAPI 调用:', logs.api.length)
  logs.api.forEach((call) => {
    console.log(`  ${call.url}: ${call.status} - ${call.body?.data?.length || 0} 账户`)
  })

  console.log('\n控制台中包含 "All accounts" 的日志:')
  logs.console
    .filter((l) => l.text.includes('All accounts'))
    .forEach((l) => console.log('  ', l.text.substring(0, 200)))

  console.log('\n控制台中包含 "Failed" 的日志:')
  logs.console.filter((l) => l.text.includes('Failed')).forEach((l) => console.log('  ', l.text))

  // 截图
  await page.screenshot({ path: 'cost-tracking-final.png', fullPage: true })
  console.log('\n📸 截图已保存')

  await page.waitForTimeout(5000)
})
