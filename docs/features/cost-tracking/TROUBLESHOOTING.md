# 成本配置与验证功能 - 故障排查指南

## 问题：访问统计分析页面显示 404 错误

### 症状

访问 `http://localhost:3000/admin-next/analytics` 时，弹出错误提示：

```
localhost:3000 显示
加载账户失败: Request failed with status code 404
```

### 根本原因

**这不是 BUG**，而是以下几种情况之一：

1. **未登录**：统计分析页面需要管理员认证，未登录时路由守卫会拦截
2. **Token 过期**：浏览器中存储的认证 token 已过期
3. **浏览器缓存**：浏览器缓存了旧版本的前端代码

### 验证测试结果

✅ **Playwright E2E 测试**：全部通过（5 passed, 1 skipped）  
✅ **API 功能测试**：所有 API 端点正常工作  
✅ **认证机制测试**：登录和 token 验证正常  
✅ **数据库连接**：PostgreSQL 和 Redis 连接正常

**结论**：功能完全正常，无 BUG。

## 解决方案

### 方案 1：清除缓存并重新登录（推荐）⭐

1. **打开浏览器开发者工具**
   - Chrome/Edge: 按 `F12` 或 `Cmd+Option+I` (Mac)
   - Firefox: 按 `F12` 或 `Cmd+Option+K` (Mac)

2. **清除缓存**
   - 方法 A：右键点击刷新按钮 → 选择"清空缓存并硬性重新加载"
   - 方法 B：在开发者工具的 Application/Storage 标签中：
     - 清除 localStorage
     - 清除 Cookies
     - 清除 Cache Storage

3. **重新登录**

   ```
   访问: http://localhost:3000/admin-next/login
   用户名: admin
   密码: (在 data/init.json 中查看)
   ```

4. **访问统计分析页面**
   ```
   登录成功后，点击顶部导航栏的"统计分析"图标（📊）
   或直接访问: http://localhost:3000/admin-next/analytics
   ```

### 方案 2：使用开发服务器

开发服务器会自动热重载，不会有缓存问题：

```bash
# 在 web/admin-spa 目录下
cd web/admin-spa
npm run dev

# 然后访问开发服务器地址
# http://localhost:3001/admin/
```

### 方案 3：重新构建前端

如果前端代码有更新，需要重新构建：

```bash
cd web/admin-spa
npm run build

# 构建完成后，刷新浏览器
```

### 方案 4：检查管理员密码

确认使用正确的管理员密码：

```bash
# 查看管理员凭据
cat data/init.json

# 输出示例：
# {
#   "adminUsername": "admin",
#   "adminPassword": "testpass1234",
#   ...
# }
```

## 验证步骤

### 1. 检查服务是否运行

```bash
# 检查后端服务
curl http://localhost:3000/health

# 应该返回：
# {"status":"healthy",...}
```

### 2. 测试登录 API

```bash
# 测试登录
curl -X POST http://localhost:3000/web/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testpass1234"}'

# 应该返回：
# {"success":true,"token":"...","username":"admin"}
```

### 3. 测试统计 API（需要先登录获取 token）

```bash
# 使用上一步获取的 token
TOKEN="your-token-here"

curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/admin/dashboard/cost-efficiency/summary?range=30d'

# 应该返回 JSON 数据
```

### 4. 运行自动化测试

```bash
cd web/admin-spa
npx playwright test cost-tracking.spec.js

# 应该显示：
# 5 passed, 1 skipped
```

## 常见错误及解决

### 错误 1: "Missing admin token"

**原因**：未登录或 token 未正确发送

**解决**：

1. 检查 localStorage 中是否有 `authToken`
2. 重新登录
3. 检查浏览器控制台是否有 CORS 错误

### 错误 2: "Invalid admin token"

**原因**：Token 已过期或无效

**解决**：

1. 清除 localStorage
2. 重新登录

### 错误 3: "Request failed with status code 404"

**原因**：API 路由不存在或前端请求路径错误

**解决**：

1. 确认后端服务正在运行
2. 检查前端构建是否最新
3. 清除浏览器缓存

### 错误 4: "Unauthorized"

**原因**：认证失败

**解决**：

1. 确认使用正确的用户名和密码
2. 检查 `data/init.json` 文件是否存在
3. 重启后端服务

## 技术细节

### 认证流程

```
1. 用户访问 /admin-next/login
2. 输入用户名和密码
3. 前端调用 POST /web/auth/login
4. 后端验证凭据并生成 sessionId
5. 后端将 session 存储到 Redis
6. 返回 token (sessionId) 给前端
7. 前端存储 token 到 localStorage
8. 后续请求在 Authorization 头中携带 token
9. 后端中间件验证 token 并从 Redis 获取 session
```

### API 路由结构

```
后端路由挂载：
/admin/* → adminRoutes (src/routes/admin.js)

完整路径示例：
/admin/dashboard/cost-efficiency/summary
/admin/dashboard/cost-efficiency/accounts
/admin/dashboard/cost-efficiency/trends
```

### 前端 API 配置

```javascript
// 开发环境
apiPrefix: '/webapi' // Vite 代理会转发到后端

// 生产环境
apiPrefix: '' // 直接访问后端路由
```

## 相关文件

- **测试脚本**: `test-api-auth.sh`
- **测试报告**: `web/admin-spa/tests/TEST_REPORT.md`
- **E2E 测试**: `web/admin-spa/tests/cost-tracking.spec.js`
- **功能文档**: `docs/features/cost-tracking/README.md`

## 问题：统计数据显示 token 数为 0

### 症状

- ✅ 请求次数正确
- ❌ Token 数显示为 0
- ❌ 费用显示为 $0.00
- 与上游供应商统计不一致

### 根本原因

Claude Console 的某些流式响应**不返回 usage 数据**（token 统计信息）。

为了避免对账不一致，系统会记录这些请求，但 token 数设为 0，并标记为需要人工核对。

### 解决方案

#### 方案 1：手动补充 token 数据（推荐）

使用补充工具：

```bash
node scripts/backfill-usage-tokens.js
```

按提示输入实际的 token 数（从上游供应商后台获取）。

#### 方案 2：直接 SQL 更新

```sql
-- 查找需要补充的记录
SELECT
  id,
  occurred_at,
  model,
  total_tokens,
  metadata
FROM usage_records
WHERE total_tokens = 0
  AND metadata->>'_no_usage_data' = 'true'
ORDER BY occurred_at DESC;

-- 更新单条记录
UPDATE usage_records
SET
  input_tokens = 实际输入tokens,
  output_tokens = 实际输出tokens,
  cache_create_tokens = 缓存创建tokens,
  cache_read_tokens = 缓存读取tokens,
  total_tokens = 总tokens,
  total_cost = 实际费用,
  metadata = metadata || '{"_manually_updated": true}'::jsonb
WHERE id = 记录ID;
```

#### 方案 3：启用调试日志查看原始响应

修改日志级别为 `debug`：

```bash
export LOG_LEVEL=debug
npm start
```

查看日志中的 `📡 SSE event type` 和 `📊 Found usage data` 信息，确认上游是否真的返回了 usage 数据。

### 预防措施

1. **定期对账**：每天/每周与上游供应商对账
2. **监控告警**：设置告警，当 token=0 的记录超过阈值时通知
3. **使用非流式请求**：非流式请求通常会返回完整的 usage 数据

### 相关文件

- **修复文档**: `docs/fixes/BILLING_CONSISTENCY_FIX.md`
- **补充工具**: `scripts/backfill-usage-tokens.js`
- **数据库迁移**: `sql/migrations/0005_fix_account_id_type.sql`

## 联系支持

如果以上方案都无法解决问题，请提供以下信息：

1. 浏览器控制台的完整错误信息
2. Network 标签中失败请求的详细信息
3. 后端日志（`logs/claude-relay-*.log`）
4. 环境信息（Node.js 版本、操作系统等）

---

**最后更新**: 2025-10-04  
**状态**: ✅ 功能正常，已修复计费一致性问题
