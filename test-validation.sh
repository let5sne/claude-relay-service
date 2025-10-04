#!/bin/bash

# 测试成本验证 API

# 从浏览器 localStorage 获取 token，或使用固定的测试 token
# 你需要在浏览器控制台运行: localStorage.getItem('authToken')
# 然后把 token 复制到下面
TOKEN="YOUR_TOKEN_HERE"

if [ "$TOKEN" = "YOUR_TOKEN_HERE" ]; then
  echo "请先从浏览器获取 authToken:"
  echo "1. 打开浏览器控制台 (F12)"
  echo "2. 运行: localStorage.getItem('authToken')"
  echo "3. 复制输出的 token"
  echo "4. 编辑此脚本，替换 YOUR_TOKEN_HERE"
  exit 1
fi

echo "测试成本验证 API..."
curl -v -X POST http://localhost:3000/admin/accounts/25b75f3f-ec8a-4300-8b73-4c4269293bb1/validate-costs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"billingPeriod":"2025-10"}'

echo ""
echo "请查看响应内容"
