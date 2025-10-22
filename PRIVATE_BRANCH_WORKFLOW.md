# Private分支工作流指南

## 📋 概述

本项目采用**私有分支策略**来保护商业功能，同时持续接收上游的核心更新。

## 🌳 分支结构

```
upstream/main (上游原始仓库)
    ↓ 定期同步
origin/main (你的公开fork)
    ↓ 合并
origin/private (你的私有商业功能分支) 🔒
```

## 🔐 保护机制

### Git Hook保护

- `.husky/pre-push` 已配置自动拦截
- 执行 `git push origin private` 会被自动阻止
- 需要明确使用 `--no-verify` 才能推送

### 强制确认推送

如果确实需要推送private分支：

```bash
git push --no-verify origin private
```

## 🔄 日常工作流

### 1. 开发新功能（在private分支）

```bash
# 确保在private分支
git checkout private

# 开发你的商业功能
# ... 编码 ...

# 提交到本地
git add .
git commit -m "feat: 添加新的商业功能"

# ⚠️ 不要推送到远程（除非明确需要）
```

### 2. 从上游同步更新（推荐使用脚本）

#### 方式A：使用自动化脚本（推荐）

```bash
./scripts/sync-from-upstream.sh
```

#### 方式B：手动同步

```bash
# 1. 获取上游更新
git fetch upstream

# 2. 更新main分支
git checkout main
git merge upstream/main

# 3. （可选）推送main到你的fork
git push origin main

# 4. 将上游更新合并到private
git checkout private
git merge main

# 5. 解决可能的冲突
# 如果有冲突，手动解决后：
git add .
git commit -m "merge: 同步上游更新"
```

### 3. 向上游贡献代码

如果你想贡献非商业功能到上游：

```bash
# 1. 从private创建功能分支
git checkout private
git checkout -b feature/my-contribution

# 2. 只提交想要贡献的代码
git add <specific-files>
git commit -m "feat: 添加某个功能"

# 3. 推送到你的fork
git push origin feature/my-contribution

# 4. 在GitHub上创建PR到上游
```

## 📊 查看分支状态

### 检查本地与上游的差异

```bash
# 查看上游有哪些新提交
git log main..upstream/main

# 查看你领先上游的提交
git log upstream/main..main

# 查看private分支与main的差异
git log main..private
```

### 查看远程分支

```bash
git remote -v
git branch -a
```

## ⚠️ 注意事项

### ✅ 可以做的

- ✅ 在private分支自由开发和提交
- ✅ 定期从上游同步更新到private
- ✅ 推送main分支到origin
- ✅ 创建功能分支贡献代码

### ❌ 避免做的

- ❌ 直接推送private分支（除非明确需要）
- ❌ 在main分支开发商业功能
- ❌ 将private分支的商业代码合并到main
- ❌ 在公开PR中暴露商业逻辑

## 🔧 故障排除

### 合并冲突

如果同步时遇到冲突：

```bash
# 1. 查看冲突文件
git status

# 2. 手动编辑解决冲突

# 3. 标记为已解决
git add <resolved-files>

# 4. 完成合并
git commit
```

### 误推送private分支

如果不小心推送了private分支：

```bash
# 从远程删除（谨慎操作！）
git push origin --delete private

# 重新创建干净的private分支
git checkout main
git branch -D private
git checkout -b private
```

### 重置到上游状态

如果想完全重置main到上游：

```bash
git checkout main
git reset --hard upstream/main
git push origin main --force
```

## 📝 最佳实践

1. **定期同步**：每周至少同步一次上游更新
2. **小步提交**：在private分支频繁提交，便于回滚
3. **清晰命名**：提交信息清晰，便于区分商业功能和上游功能
4. **备份重要**：定期备份private分支（可以推送到私有仓库）
5. **环境变量**：敏感配置使用环境变量，不要硬编码

## 🚀 快速参考

```bash
# 同步上游（使用脚本）
./scripts/sync-from-upstream.sh

# 查看当前分支
git branch --show-current

# 切换到private分支
git checkout private

# 查看上游更新
git fetch upstream && git log main..upstream/main --oneline

# 强制推送private（需要明确确认）
git push --no-verify origin private
```

## 📞 获取帮助

如果遇到问题：

1. 查看Git状态：`git status`
2. 查看提交历史：`git log --oneline --graph --all -20`
3. 查看远程配置：`git remote -v`
4. 备份当前工作：`git stash` 或创建临时分支

---

**记住：private分支是你的商业秘密，谨慎推送！** 🔒
