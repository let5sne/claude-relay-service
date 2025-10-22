#!/bin/bash

# 从上游同步更新到private分支的脚本（安全版本）
# 用法: ./scripts/sync-from-upstream.sh [--force]

set -e

# 检查是否强制模式
FORCE_MODE=false
if [ "$1" = "--force" ]; then
  FORCE_MODE=true
  echo "⚠️  强制模式已启用"
fi

echo "🔄 开始从上游同步更新..."
echo ""

# 0. 检查工作区是否干净
if [ "$FORCE_MODE" = false ]; then
  if ! git diff-index --quiet HEAD --; then
    echo "❌ 错误：工作区有未提交的修改"
    echo "请先提交或暂存你的修改："
    echo "  git add ."
    echo "  git commit -m 'your message'"
    echo "或者使用 git stash 暂存修改"
    exit 1
  fi
fi

# 1. 获取上游最新代码
echo "📥 步骤1: 获取上游最新代码..."
git fetch upstream
echo "✅ 上游代码已获取"
echo ""

# 1.5 显示即将合并的更新
echo "📋 上游新增的提交："
git log --oneline --graph main..upstream/main | head -20
echo ""
read -p "是否继续合并这些更新? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "⏭️  已取消同步"
  exit 0
fi

# 2. 切换到main分支并合并上游
echo "🔀 步骤2: 更新main分支..."
CURRENT_BRANCH=$(git branch --show-current)

# 创建备份分支
BACKUP_BRANCH="backup-main-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
echo "💾 已创建备份分支: $BACKUP_BRANCH"

git checkout main

# 使用策略合并，优先保留本地修改
git merge upstream/main --no-edit --strategy-option=ours || {
  echo "❌ 自动合并失败，尝试手动解决冲突..."
  echo "📝 冲突文件列表："
  git diff --name-only --diff-filter=U
  echo ""
  echo "请手动解决冲突后运行："
  echo "  git add <resolved-files>"
  echo "  git commit"
  echo "  ./scripts/sync-from-upstream.sh --continue"
  exit 1
}

echo "✅ main分支已更新"
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

# 创建private分支备份
BACKUP_PRIVATE="backup-private-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_PRIVATE" private
echo "💾 已创建private分支备份: $BACKUP_PRIVATE"

git checkout private
git merge main --no-edit || {
  echo "❌ 合并到private分支失败"
  echo "📝 冲突文件列表："
  git diff --name-only --diff-filter=U
  echo ""
  echo "请手动解决冲突后运行："
  echo "  git add <resolved-files>"
  echo "  git commit"
  exit 1
}

echo "✅ private分支已更新"
echo ""

# 5. 运行回归测试
echo "🧪 步骤4: 运行回归测试..."
if [ -f "./scripts/regression-test.sh" ]; then
  ./scripts/regression-test.sh || {
    echo "⚠️  回归测试失败！"
    echo "建议回滚到备份分支："
    echo "  git checkout main && git reset --hard $BACKUP_BRANCH"
    echo "  git checkout private && git reset --hard $BACKUP_PRIVATE"
    exit 1
  }
  echo "✅ 回归测试通过"
else
  echo "⚠️  未找到回归测试脚本，跳过测试"
  echo "建议创建 ./scripts/regression-test.sh 进行自动化测试"
fi
echo ""

# 6. 生成变更报告
echo "📊 步骤5: 生成变更报告..."
REPORT_FILE="sync-report-$(date +%Y%m%d-%H%M%S).md"
cat > "$REPORT_FILE" << EOF
# 上游同步报告

**同步时间**: $(date '+%Y-%m-%d %H:%M:%S')
**备份分支**: 
- main: $BACKUP_BRANCH
- private: $BACKUP_PRIVATE

## 上游更新内容

\`\`\`
$(git log --oneline --graph main@{1}..main)
\`\`\`

## 文件变更统计

\`\`\`
$(git diff --stat main@{1}..main)
\`\`\`

## 需要关注的文件

\`\`\`
$(git diff --name-only main@{1}..main | grep -E '\.(js|vue|json)$' || echo "无")
\`\`\`

## 回滚命令（如需要）

\`\`\`bash
# 回滚main分支
git checkout main && git reset --hard $BACKUP_BRANCH

# 回滚private分支  
git checkout private && git reset --hard $BACKUP_PRIVATE
\`\`\`
EOF

echo "✅ 变更报告已生成: $REPORT_FILE"
echo ""

# 7. 提示用户
echo "🎉 同步完成！"
echo ""
echo "📋 后续步骤："
echo "  1. 查看变更报告: cat $REPORT_FILE"
echo "  2. 测试关键功能是否正常"
echo "  3. 如有问题，使用备份分支回滚"
echo ""
echo "⚠️  注意：private分支已在本地更新，但未推送到远程"
echo "   如需推送，请使用: git push --no-verify origin private"
echo ""

# 返回原分支
if [ "$CURRENT_BRANCH" != "private" ] && [ "$CURRENT_BRANCH" != "main" ]; then
  git checkout "$CURRENT_BRANCH"
  echo "已返回到原分支: $CURRENT_BRANCH"
fi
