import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [ ['list'], ['html', { open: 'never' }] ],
  use: {
    // Ensure trailing slash so relative paths resolve under /admin-next/
    baseURL: 'http://127.0.0.1:3000/admin-next/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'bash tests/e2e/run-server.sh',
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: false,
    timeout: 180_000
  }
})
