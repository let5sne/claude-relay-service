#!/bin/bash

echo "=== 测试管理员 API 认证 ==="
echo ""

# 1. 登录获取 token
echo "1. 登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/web/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testpass1234"}')

echo "登录响应: $LOGIN_RESPONSE"
echo ""

# 提取 token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取 token"
  exit 1
fi

echo "✅ Token: ${TOKEN:0:20}..."
echo ""

# 2. 测试 dashboard API
echo "2. 测试 /admin/dashboard..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/dashboard | head -5
echo ""
echo ""

# 3. 测试 cost-efficiency API
echo "3. 测试 /admin/dashboard/cost-efficiency/summary..."
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/admin/dashboard/cost-efficiency/summary?range=30d'
echo ""
echo ""

# 4. 测试 cost-efficiency accounts API
echo "4. 测试 /admin/dashboard/cost-efficiency/accounts..."
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/admin/dashboard/cost-efficiency/accounts?range=30d&limit=10'
echo ""
