# 🚀 Railway部署指南

本指南将帮助您将Claude Relay Service部署到Railway平台。

## 📋 前置要求

- [Railway账户](https://railway.app/)
- GitHub仓库访问权限
- 基本的Docker知识

## 🚀 部署步骤

### 1. 准备仓库

确保您的代码已推送到GitHub仓库，并且包含以下文件：

- `Dockerfile`
- `railway.json`
- `railway.env.example`

### 2. 创建Railway项目

1. 访问 [Railway控制台](https://railway.app/dashboard)
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择您的 `claude-relay-service` 仓库
5. 点击 "Deploy Now"

### 3. 添加Redis服务

1. 在项目页面点击 "New Service"
2. 选择 "Database" → "Add Redis"
3. Railway会自动创建Redis实例并设置环境变量

### 4. 配置环境变量

在项目设置中添加以下环境变量：

#### 🔐 必需的环境变量

```bash
# 安全配置 (必须设置)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key-here

# 服务器配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
TRUST_PROXY=true

# 管理员账户 (首次部署时设置)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
```

#### 📊 Redis配置（私网 VS 公网）

本项目同时支持 Railway 私有网络（推荐）与公网访问两种连接方式，请二选一并保持“单一真相”。

- 私网（推荐）：延迟低、无需 TLS。
  - 两个服务都需开启 Private Networking（Web 与 Redis）且位于同一 Environment/Region。
  - 变量模板（其一即可）：
    - 仅主机：`REDIS_HOST=redis.railway.internal`（不需要端口与密码时，保留一个变量最稳）
    - 或完整 URL：`REDIS_URL=redis://default:<密码>@redis.railway.internal:6379`
  - 不要设置 `REDIS_ENABLE_TLS`。

- 公网（仅当私网不可用）：需要 TLS。
  - 打开 Redis 的 Public Internet。
  - 使用公开连接串：`REDIS_URL=rediss://default:<密码>@containers-xxxx.railway.app:<端口>`
  - 或者分散变量：`REDIS_HOST=containers-xxxx.railway.app`、`REDIS_PORT=<端口>`、`REDIS_PASSWORD=<密码>`，并设置 `REDIS_ENABLE_TLS=true`。

兼容性与调试开关：

- 变量兼容：支持 `REDIS_URL`，或 `REDIS_HOST/REDIS_PORT/REDIS_PASSWORD`；兼容老变量名 `REDISHOST/REDISPORT/REDISPASSWORD/REDISUSER`。
- IPv4/IPv6：内部已对 ioredis 自动添加 `family=0`，以适配 Railway 私网 IPv6-only 解析。
- 日志：`LOG_REDIS_DETAILS=true` 可打印去敏的连接目标（协议/主机/端口/TLS）。

#### 🔧 可选配置

```bash
# API密钥前缀
API_KEY_PREFIX=cr_

# 会话超时 (毫秒)
ADMIN_SESSION_TIMEOUT=86400000

# 邮件配置 (可选)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# 功能开关
ENABLE_WEBHOOK=true
ENABLE_LDAP=false
ENABLE_EMAIL=false
ENABLE_RATE_LIMITING=true
```

### 5. 部署配置

Railway会自动检测到 `railway.json` 配置文件，使用以下设置：

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node src/app.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 6. 监控部署

1. 在Railway控制台中查看部署日志
2. 等待构建完成（通常需要5-10分钟）
3. 检查健康检查状态

## 🔧 配置说明

### 端口配置

Railway会自动设置 `PORT` 环境变量，应用会监听该端口。

### Redis连接

- 选择“私网”或“公网”其一配置，避免混用。
- 若看到日志 `ENOTFOUND redis.railway.internal`，多为 DNS 仅 IPv6 导致。项目已启用 `family=0`，但仍需确保两边都开启 Private Networking 并处在同一 Environment/Region。
- 若为 `ETIMEDOUT`：通常是私网未双向开启或公网入口未开放（未启用 Public Internet）。

### 健康检查

应用提供 `/health` 端点用于健康检查，Railway会自动监控。

### 日志管理

- 应用日志会显示在Railway控制台中
- 支持实时日志查看
- 日志会自动轮转

## 🚨 故障排除

### 常见问题

1. **构建失败**
   - 检查Dockerfile语法
   - 确保所有依赖都正确安装
   - 查看构建日志中的错误信息

2. **应用启动失败**
   - 检查环境变量是否正确设置
   - 确保JWT_SECRET和ENCRYPTION_KEY已设置
   - 查看应用启动日志

3. **Redis连接失败**
   - ENOTFOUND：启用双侧 Private Networking + 同一 Environment/Region；或改用公网 rediss://
   - ETIMEDOUT：未真正开通的访问路径（私网未双开 / 公网未开放端口）
   - 变量冲突：请只保留一套（URL 或 HOST/PORT/PASSWORD）
   - 调试：设置 `LOG_REDIS_DETAILS=true`，查看目标协议/主机/端口/TLS

4. **健康检查失败**
   - 确保应用监听正确的端口
   - 检查 `/health` 端点是否可访问
   - 查看应用日志

### 调试步骤

1. 查看Railway控制台中的日志
2. 检查环境变量设置
3. 验证服务状态
4. 测试API端点

## 📊 监控和维护

### 性能监控

- Railway提供基本的性能指标
- 可以查看CPU、内存使用情况
- 监控请求响应时间

### 日志管理

- 实时日志查看
- 日志搜索和过滤
- 错误日志告警

### 自动重启

- 应用崩溃时自动重启
- 最多重试10次
- 健康检查失败时重启

## 🔄 更新部署

### 自动部署

- 推送到main分支会自动触发部署
- 支持预览部署（PR部署）
- 可以回滚到之前的版本

### 手动部署

1. 在Railway控制台中点击 "Deploy"
2. 选择要部署的分支或提交
3. 等待部署完成

## 💰 成本估算

### 免费额度

- 每月$5免费额度
- 包含512MB RAM和1GB存储
- 适合小规模使用

### 付费计划

- 按使用量计费
- 支持更大的资源分配
- 提供更多功能

## 🔒 安全建议

1. **环境变量安全**
   - 使用强密码和密钥
   - 定期轮换密钥
   - 不要在代码中硬编码敏感信息

2. **网络安全**
   - 启用HTTPS
   - 配置适当的CORS策略
   - 使用防火墙规则

3. **数据安全**
   - 定期备份数据
   - 加密敏感数据
   - 监控访问日志

## 📞 支持

- [Railway文档](https://docs.railway.app/)
- [Railway社区](https://discord.gg/railway)
- [GitHub Issues](https://github.com/let5sne/claude-relay-service/issues)

5. **管理员登录 401 Unauthorized**
   - Railway 的 `startCommand` 可能绕过 entrypoint，首次启动未生成 `data/init.json`
   - 解决方案（二选一）：
     - 在变量中设置 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD`，项目会在启动时自动创建 `data/init.json` 并加载到 Redis
     - 在容器 Shell 中运行 `node cli/index.js admin` 交互创建管理员
   - 日志出现 `Admin username: xxx` 即表示凭据已生效

6. **允许降级启动（仅排障临时使用）**
   - `ALLOW_START_WITHOUT_REDIS=true` 可让应用在 Redis 不可达时先启动（部分功能不可用）。排障结束后建议移除。

7. **定价文件与回退**
   - 启动时如未检测到 `data/model_pricing.json`，会从 `resources/model-pricing` 回退并自动下载最新定价至 `data/model_pricing.json`。文件变更会被监听并热加载。
