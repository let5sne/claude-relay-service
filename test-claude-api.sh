#!/bin/bash

# 从浏览器 localStorage 获取 token
# 在浏览器控制台运行: localStorage.getItem('authToken')
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <auth-token>"
  echo "Get token from browser console: localStorage.getItem('authToken')"
  exit 1
fi

echo "Testing Claude accounts API..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/claude-accounts | jq '.'

echo -e "\n\nTesting Gemini accounts API..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/gemini-accounts | jq '.'
