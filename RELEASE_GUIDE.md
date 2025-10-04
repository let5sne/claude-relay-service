# 🚀 发布新版本指南

## 📋 当前版本信息

- **当前版本**: `1.1.174`
- **版本文件**: `VERSION`
- **自动发布**: ✅ 已配置

---

## 🎯 快速发布（推荐）

### 方式一：自动发布（最简单）

**你刚才已经完成的操作就会触发自动发布！**

```bash
# 1. 提交代码（你已完成）
git add -A
git commit -m "fix: 修复 Claude Console 输出 token 数记录错误"
git push origin main

# 2. GitHub Actions 会自动：
#    ✅ 检测到代码变更
#    ✅ 版本号自动 +1: 1.1.174 → 1.1.175
#    ✅ 更新 VERSION 文件
#    ✅ 创建 Git tag: v1.1.175
#    ✅ 创建 GitHub Release
#    ✅ 构建并推送 Docker 镜像
#    ✅ 发送 Telegram 通知（如果配置）
```

**等待时间**: 约 5-10 分钟

**查看进度**:

- GitHub Actions: `https://github.com/<your-repo>/actions`
- Releases: `https://github.com/<your-repo>/releases`

---

### 方式二：手动控制版本号

如果你想发布特定版本（如大版本更新）：

```bash
# 1. 修改 VERSION 文件
echo "1.2.0" > VERSION

# 2. 提交并推送
git add VERSION
git commit -m "chore: bump version to 1.2.0"
git push origin main

# 3. 系统会检测到 VERSION 变更并自动发布
```

---

## 📝 更新 CHANGELOG（可选但推荐）

在发布前更新 CHANGELOG.md：

```bash
# 编辑 CHANGELOG.md
cat >> CHANGELOG.md << 'EOF'

1.1.175 — 2025-10-05
--------------------
### 🐛 Bug Fixes
- **成本追踪**: 修复 Claude Console 输出 token 数记录错误
  - 问题: 输出 token 数始终记录为占位符值(1或2)
  - 修复: 严格限制只在 message_delta 事件中更新 output_tokens
  - 影响: Token 统计和费用计算现在 100% 准确

### ✨ Features
- **统计分析**: 添加 API Key 调用明细展开功能
  - 点击 API Key 可展开查看每个请求的详细信息
  - 显示缓存创建和缓存读取列
  - 支持状态标记（正常/已更新/需核对）

### 📚 Documentation
- 添加成本追踪完整总结文档
- 添加仪表盘数据流分析文档
- 添加 Output Tokens 修复详细说明

### 🔧 Technical Details
- 修复 SSE 数据格式解析（支持 `data:` 和 `data: `）
- 添加缓存 token 字段到后端 API
- 优化前端组件显示逻辑

Internal refs:
- `src/services/claudeConsoleRelayService.js`
- `src/repositories/postgresUsageRepository.js`
- `src/services/accountUsageService.js`
- `web/admin-spa/src/components/analytics/ApiKeyBreakdownAnalysis.vue`

EOF

# 提交 CHANGELOG
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v1.1.175"
git push origin main
```

---

## 🔍 验证发布

### 1. 检查 GitHub Release

访问: `https://github.com/<your-repo>/releases/latest`

应该看到:

- ✅ 版本号: v1.1.175
- ✅ Release Notes
- ✅ 发布时间

### 2. 检查 Docker 镜像

```bash
# 拉取最新镜像
docker pull let5see/claude-relay-service:latest
docker pull let5see/claude-relay-service:v1.1.175

# 查看镜像信息
docker images | grep claude-relay-service

# 应该看到:
# let5see/claude-relay-service   latest    <image-id>   几分钟前
# let5see/claude-relay-service   v1.1.175  <image-id>   几分钟前
```

### 3. 验证功能

```bash
# 启动新版本
docker-compose down
docker-compose pull
docker-compose up -d

# 查看日志
docker-compose logs -f --tail=100

# 测试功能
# 1. 发起 API 请求
# 2. 查看统计分析页面
# 3. 验证 token 数据准确性
```

---

## 📦 部署到生产环境

### Docker Compose 部署

```bash
# 1. 备份当前数据
docker-compose exec postgres pg_dump -U postgres claude_relay > backup_$(date +%Y%m%d).sql

# 2. 拉取最新镜像
docker-compose pull

# 3. 重启服务
docker-compose down
docker-compose up -d

# 4. 查看日志确认启动成功
docker-compose logs -f
```

### 手动部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm install
cd web/admin-spa && npm install && npm run build && cd ../..

# 3. 重启服务
pm2 restart claude-relay-service
# 或
systemctl restart claude-relay-service
```

---

## 🎨 版本号规范

### 语义化版本

格式: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.x.x): 重大变更，不兼容的 API 修改
- **MINOR** (x.1.x): 新功能，向后兼容
- **PATCH** (x.x.1): Bug 修复，向后兼容

### 示例

```
1.1.174 → 1.1.175  (Bug 修复)
1.1.175 → 1.2.0    (新功能)
1.2.0   → 2.0.0    (重大变更)
```

---

## 🚫 跳过自动发布

如果只是更新文档，不想触发发布：

```bash
# 方式 1: 在 commit 消息中添加 [skip ci]
git commit -m "docs: 更新文档 [skip ci]"

# 方式 2: 只修改这些文件会自动跳过
# - *.md 文件
# - docs/ 目录
# - .github/ 目录
# - .gitignore, LICENSE 等
```

---

## 📊 发布检查清单

在推送代码前，确认：

- [ ] ✅ 所有测试通过
- [ ] ✅ 代码已经过审查
- [ ] ✅ CHANGELOG.md 已更新
- [ ] ✅ 重要功能已验证
- [ ] ✅ 数据库迁移已准备（如果有）
- [ ] ✅ 环境变量文档已更新（如果有新增）
- [ ] ✅ README 已更新（如果有重大变更）

---

## 🔧 故障排除

### 问题 1: 版本没有自动更新

**原因**: 可能只修改了文档文件

**解决**:

```bash
# 检查 GitHub Actions 日志
# 如果需要强制发布，手动修改 VERSION 文件
echo "1.1.175" > VERSION
git add VERSION
git commit -m "chore: bump version to 1.1.175"
git push origin main
```

### 问题 2: Docker 镜像构建失败

**原因**: 可能是 Dockerfile 或依赖问题

**解决**:

```bash
# 本地测试构建
docker build -t test-image .

# 查看构建日志
# 修复问题后重新推送
```

### 问题 3: 需要回滚版本

**解决**:

```bash
# 方式 1: 使用旧版本的 Docker 镜像
docker-compose down
docker pull let5see/claude-relay-service:v1.1.174
# 修改 docker-compose.yml 指定版本
# image: let5see/claude-relay-service:v1.1.174
docker-compose up -d

# 方式 2: 代码回滚
git revert <commit-hash>
git push origin main
```

---

## 📱 Telegram 通知配置（可选）

如果想接收发布通知：

1. 创建 Telegram Bot (@BotFather)
2. 获取 Bot Token
3. 创建频道并添加 Bot 为管理员
4. 获取 Chat ID
5. 在 GitHub 仓库设置 Secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

---

## 🎯 本次发布总结

### 修复内容

1. ✅ **输出 Token 记录错误** - 核心修复
   - 修复前: 输出 token 始终为 1 或 2
   - 修复后: 准确记录真实的输出 token 数

2. ✅ **SSE 格式解析** - 兼容性修复
   - 支持 `data:` 和 `data: ` 两种格式

3. ✅ **缓存字段显示** - 功能增强
   - 添加缓存创建和缓存读取列
   - 后端 API 返回缓存数据

4. ✅ **详细请求列表** - 新功能
   - 可展开查看每个请求的详细信息
   - 状态标记（正常/已更新/需核对）

### 影响范围

- ✅ 所有使用 Claude Console 账户的流式请求
- ✅ Token 统计准确性: 100%
- ✅ 费用计算准确性: 100%
- ✅ 与上游供应商账单一致性: 100%

### 建议版本号

- **推荐**: `1.1.175` (Bug 修复)
- **或**: `1.2.0` (如果认为是重要功能更新)

---

## 📚 相关文档

- [发布流程说明](.github/RELEASE_PROCESS.md)
- [自动发布指南](.github/AUTO_RELEASE_GUIDE.md)
- [成本追踪完整总结](COST_TRACKING_COMPLETE_SUMMARY.md)
- [数据流分析](docs/analysis/DASHBOARD_DATA_FLOW_ANALYSIS.md)
- [Output Tokens 修复](docs/fixes/OUTPUT_TOKENS_FIX.md)

---

**准备好了吗？**

你的代码已经推送到 main 分支，GitHub Actions 应该正在自动处理发布流程！

查看进度: `https://github.com/<your-repo>/actions` 🚀
