import { test, expect } from '@playwright/test'

const ROOT = 'http://127.0.0.1:3000'

test('health endpoint is healthy', async ({ request }) => {
  const res = await request.get(`${ROOT}/health`)
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(data.status).toBe('healthy')
  expect(data.components?.redis?.status).toBeDefined()
})

test('metrics endpoint returns json with uptime and memory', async ({ request }) => {
  const res = await request.get(`${ROOT}/metrics`)
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(typeof data.uptime).toBe('number')
  expect(data.memory).toBeDefined()
})

