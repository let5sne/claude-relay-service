# 成本追踪功能测试说明

## 问题修复

修复了成本追踪页面无法加载账户数据的问题。

### 根本原因

**CostTrackingManagement 组件使用了错误的 API 客户端**：

- ❌ 使用了 `axios` + `createApiUrl()` 手动拼接路径
- ✅ 应该使用项目统一的 `apiClient`（已内置���径处理和认证）

### 修复内容

**文件**: `web/admin-spa/src/components/analytics/CostTrackingManagement.vue`

**变更**:

1. 移除 `axios` 和 `createApiUrl` 的导入
2. 改用 `apiClient` 进行 API 请求
3. 正确处理返回的数据格式 `{ success: true, data: [...] }`

**修改前**:

```javascript
import axios from 'axios'
import { createApiUrl } from '@/config/api'

const accountsResponse = await axios.get(createApiUrl('/api/admin/claude-accounts'))
const claudeAccounts = accountsResponse.data.data || accountsResponse.data.accounts || []
```

**修改后**:

```javascript
import { apiClient } from '@/config/api'

const claudeData = await apiClient.get('/admin/claude-accounts')
if (claudeData.success && claudeData.data) {
  allAccounts.push(
    ...claudeData.data.map((acc) => ({
      ...acc,
      platform: acc.platform || 'claude'
    }))
  )
}
```

## 如何测试

### 方式 1: 浏览器测试（推荐）

1. **启动服务**:

```bash
npm run dev
```

2. **访问管理后台**:

```
http://localhost:3000/admin-next/
```

3. **登录** (默认账户):
   - 用户名: `admin`
   - 密码: `admin123` (如果不对，检查 `npm run setup` 生成的密码)

4. **导航到成本追踪**:
   - 点击顶部菜单 "统计分析"
   - 点击 "成本配置与验证" 标签页

5. **检查数据加载**:
   - ✅ 应该看到账户列表（如果有 Claude 或 Gemini 账户）
   - ✅ 不应该有任何错误弹窗
   - ✅ 打开浏览器控制台，应该看到 `console.log('All accounts:', ...)` 输出

### 方式 2: 使用测试脚本

如果你已经登录过浏览器，可以使用以下脚本直接测试 API：

```bash
# 1. 从浏览器控制台获取 token
# 在浏览器控制台执行: sessionStorage.getItem('authToken')
# 或 localStorage.getItem('authToken')

# 2. 运行测试脚本
node test-api-direct.js <你的token>
```

### 预期结果

#### 如果有账户数据

- 显示账户列表表格
- 每行显示: 账户名、平台、计价模式、置信度、最后验证时间、操作按钮
- 平台筛选器工作正常
- 可以点击操作按钮（配置成本、录入账单、推导参数、验证成本）

#### 如果没有账户数据

- 显示空状态图标和文字 "暂无账户数据"
- 不显示表格
- 不报错

### 浏览器控制台输出示例

成功加载时应该看到类似的输出：

```
All accounts: [{
  id: "claude_xxx",
  name: "My Claude Account",
  platform: "claude",
  email: "user@example.com",
  usage: {...},
  costProfile: null  // 如果还没配置成本信息
}, ...]

Accounts with profiles: [{...}]
```

## 常见问题

### Q: 依然显示 "暂无账户数据"

**A**: 检查以下几点:

1. 确认 Redis 中确实有账户数据（使用 `npm run cli accounts list`）
2. 打开浏览器控制台，查看 `All accounts:` 日志，确认 API 返回了数据
3. 检查网络标签页，确认 API 请求返回 200 状态码

### Q: 看到 401 未授权错误

**A**: 需要重新登录

1. 清除浏览器 localStorage: `localStorage.clear()`
2. 刷新页面并重新登录

### Q: 看到 500 服务器错误

**A**: 检查后端日志:

```bash
tail -f logs/claude-relay-*.log
```

### Q: 成本配置 API 返回 404

**A**: 这是正常的 - 成本追踪后端功能可能还未完全实现。此时账户依然会显示，只是 `costProfile` 为 `null`

## 调试技巧

### 1. 启用详细日志

打开浏览器控制台，所有 API 请求都会有日志输出

### 2. 检查网络请求

浏览器开发者工具 → Network 标签页:

- 查找 `/admin/claude-accounts` 和 `/admin/gemini-accounts` 请求
- 检查响应数据格式
- 确认状态码为 200

### 3. 使用 Vue DevTools

安装 Vue DevTools 浏览器扩展:

- 查看组件状态 `accounts` 数组
- 查看 `loading` 状态
- 查看 `filteredAccounts` 计算属性

## 下一步

如果数据加载正常，可以继续测试以下功能:

1. 点击 "配置成本" 按钮 → 应该打开成本配置模态框
2. 点击 "录入账单" 按钮 → 应该打开账单录入模态框
3. 点击 "推导参数" 按钮 → 应该显示确认对话框
4. 点击 "验证成本" 按钮 → 应该打开验证面板
5. 使用平台筛选器 → ��户列表应该根据选择的平台过滤

如果这些功能有问题，可能需要进一步调试后端 API 端点。
