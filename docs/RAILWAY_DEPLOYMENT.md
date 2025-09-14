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

#### 📊 Redis配置 (自动设置)

Railway会自动设置以下Redis环境变量：

- `REDIS_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

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

Railway提供的Redis服务会自动配置连接参数，应用会自动使用这些配置。

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
   - 确保Redis服务已正确添加
   - 检查Redis环境变量
   - 验证网络连接

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
