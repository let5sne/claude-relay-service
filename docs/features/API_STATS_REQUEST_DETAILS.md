# API Stats 请求明细功能

## 📋 功能概述

在 API Stats 页面（`/admin-next/api-stats`）添加了请求明细查看功能，用户可以展开查看每个 API Key 的详细请求记录。

---

## ✨ 功能特性

### 1. 详细信息显示

每条请求记录包含：

- ⏰ **时间**: 精确到秒的请求时间
- 🤖 **模型**: 使用的 AI 模型
- 📊 **Token 统计**:
  - 输入 Token
  - 输出 Token
  - 缓存创建 Token
  - 缓存读取 Token
  - 总计 Token
- 💰 **费用**: 估算费用（精确到 6 位小数）
- 🏷️ **状态标记**:
  - 🟢 正常 - 有完整的 usage 数据
  - 🟡 需核对 - 缺少 usage 数据
  - 🟠 已更新 - 手动更新的数据

### 2. 交互体验

- **展开/收起**: 点击按钮切换显示
- **加载动画**: 数据加载时显示动画
- **响应式设计**: 适配移动端和桌面端
- **数据限制**: 显示最近 100 条记录

### 3. 时间范围

- **今日**: 显示当天的请求记录
- **本月**: 显示本月的请求记录
- 自动跟随页面的时间范围切换

---

## 🎯 使用方法

### 1. 访问页面

```
URL: http://your-domain/admin-next/api-stats
```

### 2. 查询统计

1. 输入 API Key
2. 点击"查询统计"按钮
3. 查看统计概览和模型使用情况

### 3. 查看请求明细

1. 滚动到页面底部
2. 点击"查看详情"按钮
3. 展开显示详细请求列表
4. 点击"收起"按钮隐藏列表

---

## 📊 数据结构

### API 端点

```
GET /admin/api-keys/:apiKeyId/usage-details
```

### 请求参数

```javascript
{
  range: 'today' | 'month',  // 时间范围
  limit: 100                  // 返回记录数
}
```

### 响应数据

```javascript
{
  success: true,
  data: [
    {
      id: 'record-id',
      occurred_at: '2025-10-05T01:23:21.000Z',
      model: 'claude-3-5-haiku-20241022',
      input_tokens: 86,
      output_tokens: 26,
      cache_create_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 112,
      estimated_cost: 0.000073,
      metadata: {
        _no_usage_data: false,
        _requires_manual_review: false
      }
    }
    // ... 更多记录
  ]
}
```

---

## 🎨 UI 设计

### 组件结构

```
RequestDetailsTable.vue
├── 标题栏
│   ├── 图标 + 标题
│   └── 展开/收起按钮
├── 加载状态
│   └── 加载动画
├── 数据表格
│   ├── 表头（9 列）
│   └── 数据行
│       ├── 时间
│       ├── 模型（标签样式）
│       ├── Token 数据（右对齐）
│       ├── 费用（右对齐）
│       └── 状态（标签样式）
└── 空状态提示
```

### 样式特点

- **玻璃态效果**: `glass-strong` 类
- **深色模式**: 自动适配
- **悬停效果**: 行悬停高亮
- **状态标签**: 彩色圆角标签
  - 🟢 绿色 - 正常
  - 🟡 黄色 - 需核对
  - 🟠 橙色 - 已更新

---

## 🔧 技术实现

### 组件位置

```
web/admin-spa/src/components/apistats/RequestDetailsTable.vue
```

### 集成位置

```vue
<!-- ApiStatsView.vue -->
<RequestDetailsTable
  v-if="apiId && !multiKeyMode"
  :api-id="apiId"
  :range="statsPeriod === 'daily' ? 'today' : 'month'"
/>
```

### 关键代码

```javascript
// 加载详情
async function loadDetails() {
  loading.value = true
  expanded.value = true

  try {
    const response = await apiClient.get(`/admin/api-keys/${props.apiId}/usage-details`, {
      params: {
        range: props.range,
        limit: 100
      }
    })

    if (response.success && response.data) {
      details.value = response.data
    }
  } catch (error) {
    console.error('Failed to load request details:', error)
    details.value = []
  } finally {
    loading.value = false
  }
}
```

---

## 📱 显示条件

### 显示时机

- ✅ 已输入 API Key 并查询成功
- ✅ 单 Key 模式（非多 Key 聚合模式）
- ✅ 有 `apiId` 数据

### 不显示时机

- ❌ 未查询统计数据
- ❌ 多 Key 聚合模式
- ❌ 查询失败

---

## 🎯 与统计分析页面的对比

| 特性         | API Stats 页面     | 统计分析页面  |
| ------------ | ------------------ | ------------- |
| **访问权限** | 公开（需 API Key） | 管理员        |
| **数据范围** | 单个 API Key       | 所有 API Keys |
| **展开方式** | 点击按钮           | 点击行        |
| **显示位置** | 页面底部           | 表格内嵌      |
| **时间范围** | 今日/本月          | 自定义        |
| **记录数量** | 最近 100 条        | 可配置        |

---

## 🔍 数据准确性

### Token 统计

- ✅ **输入 Token**: 准确
- ✅ **输出 Token**: 准确（已修复占位符问题）
- ✅ **缓存创建**: 准确
- ✅ **缓存读取**: 准确
- ✅ **总计**: 准确（= 输入 + 输出 + 缓存创建 + 缓存读取）

### 费用计算

- ✅ 使用 `pricingService` 计算
- ✅ 基于官方标准价格
- ✅ 与仪表盘、统计分析一致

---

## 📝 使用场景

### 1. 用户自查

用户可以查看自己 API Key 的详细使用情况：

- 每次请求的 token 消耗
- 费用明细
- 使用的模型

### 2. 问题排查

当发现统计数据异常时：

- 查看具体哪些请求有问题
- 识别"需核对"的记录
- 验证 token 统计准确性

### 3. 成本分析

分析 token 消耗和费用：

- 哪些请求消耗最多
- 缓存使用情况
- 成本优化方向

---

## 🚀 未来增强

### 可能的改进

1. **筛选功能**
   - 按模型筛选
   - 按状态筛选
   - 按 token 范围筛选

2. **排序功能**
   - 按时间排序
   - 按 token 数排序
   - 按费用排序

3. **导出功能**
   - 导出 CSV
   - 导出 JSON
   - 生成报表

4. **分页功能**
   - 加载更多记录
   - 分页导航
   - 虚拟滚动

5. **详情弹窗**
   - 点击查看完整请求信息
   - 显示请求/响应内容
   - 错误信息详情

---

## 📚 相关文档

- [API Stats 页面](../../web/admin-spa/src/views/ApiStatsView.vue)
- [请求明细组件](../../web/admin-spa/src/components/apistats/RequestDetailsTable.vue)
- [API Key 调用明细](../../web/admin-spa/src/components/analytics/ApiKeyBreakdownAnalysis.vue)
- [成本追踪功能](./cost-tracking/README.md)

---

## 🎉 总结

API Stats 页面的请求明细功能为用户提供了：

- ✅ **透明度**: 清楚看到每次请求的详细信息
- ✅ **准确性**: 基于修复后的 token 统计
- ✅ **易用性**: 简单的展开/收起操作
- ✅ **一致性**: 与管理后台数据完全一致

这个功能增强了用户对 API 使用情况的掌控，提升了系统的透明度和可信度。

---

**更新时间**: 2025-10-05  
**版本**: v1.1.175+  
**状态**: ✅ 已实现
