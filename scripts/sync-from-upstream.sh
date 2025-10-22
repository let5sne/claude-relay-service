#!/bin/bash

# 从上游同步更新到private分支的脚本
# 用法: ./scripts/sync-from-upstream.sh

set -e

echo "🔄 开始从上游同步更新..."
echo ""

# 1. 获取上游最新代码
echo "📥 步骤1: 获取上游最新代码..."
git fetch upstream
echo "✅ 上游代码已获取"
echo ""

# 2. 切换到main分支并合并上游
echo "🔀 步骤2: 更新main分支..."
CURRENT_BRANCH=$(git branch --show-current)
git checkout main
git merge upstream/main --no-edit

if [ $? -eq 0 ]; then
  echo "✅ main分支已更新"
else
  echo "❌ 合并失败，请手动解决冲突"
  exit 1
fi
echo ""

# 3. 推送main到origin（可选）
read -p "是否推送更新后的main分支到你的fork? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main
  echo "✅ main分支已推送到origin"
else
  echo "⏭️  跳过推送main分支"
fi
echo ""

# 4. 切换到private分支并合并main
echo "🔀 步骤3: 将更新合并到private分支..."
git checkout private
git merge main --no-edit

if [ $? -eq 0 ]; then
  echo "✅ private分支已更新"
else
  echo "❌ 合并失败，请手动解决冲突"
  exit 1
fi
echo ""

# 5. 提示用户
echo "🎉 同步完成！"
echo ""
echo "📊 查看更新内容："
echo "  git log --oneline main@{1}..main"
echo ""
echo "⚠️  注意：private分支已在本地更新，但未推送到远程"
echo "   如需推送，请使用: git push --no-verify origin private"
echo ""

# 返回原分支
if [ "$CURRENT_BRANCH" != "private" ] && [ "$CURRENT_BRANCH" != "main" ]; then
  git checkout "$CURRENT_BRANCH"
  echo "已返回到原分支: $CURRENT_BRANCH"
fi
