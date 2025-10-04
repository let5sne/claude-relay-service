#!/usr/bin/env node

/**
 * 快速测试账户 API - 无需 token
 */

const http = require('http')

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          })
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          })
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function test() {
  console.log('Testing account APIs without auth...\n')

  // Test Claude accounts
  console.log('1️⃣ Testing /api/admin/claude-accounts')
  try {
    const result = await makeRequest('/api/admin/claude-accounts')
    console.log('Status:', result.status)
    if (result.status === 401) {
      console.log('❌ Unauthorized (expected - need login)')
    } else if (result.data.success) {
      console.log('✅ Success')
      console.log('Data structure:', {
        hasData: !!result.data.data,
        dataLength: result.data.data?.length || 0,
        firstAccount: result.data.data?.[0]
          ? {
              id: result.data.data[0].id,
              name: result.data.data[0].name,
              platform: result.data.data[0].platform
            }
          : null
      })
    } else {
      console.log('Response:', result.data)
    }
  } catch (err) {
    console.log('Error:', err.message)
  }

  console.log('\n2️⃣ Testing /api/admin/gemini-accounts')
  try {
    const result = await makeRequest('/api/admin/gemini-accounts')
    console.log('Status:', result.status)
    if (result.status === 401) {
      console.log('❌ Unauthorized (expected - need login)')
    } else if (result.data.success) {
      console.log('✅ Success')
      console.log('Data structure:', {
        hasData: !!result.data.data,
        dataLength: result.data.data?.length || 0,
        firstAccount: result.data.data?.[0]
          ? {
              id: result.data.data[0].id,
              name: result.data.data[0].name,
              platform: result.data.data[0].platform
            }
          : null
      })
    } else {
      console.log('Response:', result.data)
    }
  } catch (err) {
    console.log('Error:', err.message)
  }
}

test()
