import { test } from '@playwright/test'

test('login and debug accounts', async ({ page }) => {
  const logs = { console: [], api: [] }

  page.on('console', (msg) => {
    const text = msg.text()
    logs.console.push({ type: msg.type(), text })
    if (!text.includes('Download the Vue Devtools')) {
      console.log(`[${msg.type()}]`, text)
    }
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
      if (body?.success && body?.data) {
        console.log('   ✅ Success, 账户数:', body.data.length)
        body.data.forEach((acc, i) => {
          console.log(`   账户 ${i + 1}: ${acc.name} (${acc.platform || 'unknown'})`)
        })
      } else if (body) {
        console.log('   ❌ Response:', body)
      }
    }
  })

  console.log('=== 访问登录页面 ===')
  await page.goto('http://localhost:3000/admin-next/login')
  await page.waitForLoadState('networkidle')

  console.log('=== 尝试登录 ===')
  // 等待表单加载
  await page.waitForTimeout(1000)

  // 使用更具体的选择器
  try {
    // 方法1: 通过 placeholder 或 label
    await page.fill('input[placeholder*="用户名"], input[placeholder*="username"]', 'admin')
    await page.fill('input[type="password"]', 'testpass1234')
  } catch (e) {
    console.log('方法1失败，尝试方法2...')
    // 方法2: 直接使用 input 索引
    const inputs = await page.locator('input[type="text"], input:not([type])').all()
    if (inputs.length > 0) {
      await inputs[0].fill('admin')
    }
    await page.fill('input[type="password"]', 'testpass1234')
  }

  // 点击登录按钮
  await page.click('button:has-text("登录"), button:has-text("Login"), button[type="submit"]')

  console.log('=== 等待登录跳转 ===')
  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    console.log('✅ 登录成功，当前页面:', page.url())
  } catch (e) {
    console.log('❌ 登录可能失败，当前页面:', page.url())
    await page.screenshot({ path: 'login-failed.png' })
  }

  console.log('\n=== 导航到统计分析 ===')
  await page.goto('http://localhost:3000/admin-next/analytics')
  await page.waitForLoadState('networkidle')

  console.log('=== 点击成本配置标签 ===')
  await page.waitForTimeout(1000)

  const costTab = page.locator('button:has-text("成本配置"), div:has-text("成本配置与验证")')
  try {
    await costTab.first().click({ timeout: 5000 })
    console.log('✅ 点击成功')
  } catch (e) {
    console.log('⚠️  找不到标签，尝试直接查找...')
    // 列出所有可能的标签
    const allTabs = await page.locator('[role="tab"], button').allTextContents()
    console.log('所有标签/按钮:', allTabs.slice(0, 20))
  }

  console.log('\n=== 等待数据加载 ===')
  await page.waitForTimeout(8000)

  console.log('\n=== 分析结果 ===')
  console.log('API 调用次数:', logs.api.length)

  if (logs.api.length > 0) {
    console.log('\nAPI 详情:')
    logs.api.forEach((call) => {
      console.log(`\n${call.url}`)
      console.log(`  Status: ${call.status}`)
      if (call.body?.data) {
        console.log(`  账户数: ${call.body.data.length}`)
      }
    })
  } else {
    console.log('\n⚠️  没有捕获到任何 API 调用')
  }

  const allAccountsLogs = logs.console.filter((l) => l.text.includes('All accounts'))
  if (allAccountsLogs.length > 0) {
    console.log('\n✅ 找到 "All accounts" 日志:')
    allAccountsLogs.forEach((log) => console.log('  ', log.text.substring(0, 300)))
  } else {
    console.log('\n❌ 未找到 "All accounts" 日志')
  }

  const failedLogs = logs.console.filter((l) => l.text.toLowerCase().includes('failed'))
  if (failedLogs.length > 0) {
    console.log('\n⚠️  发现失败日志:')
    failedLogs.forEach((log) => console.log('  ', log.text))
  }

  await page.screenshot({ path: 'final-debug.png', fullPage: true })
  console.log('\n📸 截图: final-debug.png')

  await page.waitForTimeout(3000)
})
