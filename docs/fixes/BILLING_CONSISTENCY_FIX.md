# 计费一致性修复

## 问题描述

**日期**: 2025-10-04  
**严重性**: 高 - 影响对账准确性

### 症状

- 上游 Claude Console API 产生了计费
- 本地统计系统没有记录
- 导致对账时出现差异

### 根本原因

Claude Console 的某些流式响应不返回 `usage` 数据（token 统计信息）。原有代码逻辑：

- 如果流式响应没有 usage 数据 → 不记录任何统计
- 只记录警告日志：`⚠️ No usage data captured from SSE stream`

这导致：

1. ❌ 请求成功执行但未记录
2. ❌ 上游产生费用但本地无记录
3. ❌ 对账时出现不一致

## 修复方案

### 修改文件

1. `src/services/claudeConsoleRelayService.js` (第 652-669 行)
2. `src/routes/api.js` (第 512-520 行)

### 修复逻辑

在流式响应结束时（`response.data.on('end')`），检查是否捕获到 usage 数据：

**修复前**：

```javascript
// 流结束，没有 usage 数据 → 什么都不做
response.data.on('end', () => {
  responseStream.end()
  resolve()
})
```

**修复后**：

```javascript
response.data.on('end', () => {
  // 如果没有 usage 数据，也要记录基本请求
  if (!finalUsageReported && usageCallback) {
    logger.warn(
      '⚠️ Stream completed without usage data - recording basic request for billing consistency'
    )
    usageCallback({
      accountId,
      model: collectedUsageData.model || body?.model || 'unknown',
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      _no_usage_data: true,
      _requires_manual_review: true
    })
  }
  responseStream.end()
  resolve()
})
```

### 记录内容

即使没有 usage 数据，也会记录：

- ✅ 请求次数：1
- ✅ 账户 ID
- ✅ 模型名称
- ✅ Token 数：0（标记为需要人工核对）
- ✅ 元数据标记：`_no_usage_data: true`, `_requires_manual_review: true`

## 影响范围

### 受影响的场景

- Claude Console 流式请求
- 某些不返回 usage 数据的响应

### 不受影响的场景

- 非流式请求（总是有 usage 数据）
- 其他平台（Gemini、OpenAI 等）

## 验证方法

### 1. 发起测试请求

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### 2. 检查日志

应该看到以下之一：

- 正常情况：`📊 CCR stream usage recorded (real)`
- 无 usage 数据：`⚠️ Stream completed without usage data - recording basic request`

### 3. 检查数据库

```sql
SELECT
  occurred_at,
  account_id,
  model,
  total_tokens,
  metadata
FROM usage_records
WHERE occurred_at > NOW() - INTERVAL '1 hour'
ORDER BY occurred_at DESC
LIMIT 10;
```

应该能看到记录，即使 `total_tokens = 0`，`metadata` 中会有 `_no_usage_data: true`

### 4. 检查统计页面

访问 `http://localhost:3000/admin-next/analytics`，在"API Key 调用明细"中应该能看到请求记录。

## 后续建议

### 短期

1. ✅ 监控带有 `_no_usage_data` 标记的请求数量
2. ✅ 定期与上游账单核对
3. ✅ 对于 token 数为 0 的记录，需要从上游账单补充实际用量

### 中期

1. 🔄 开发自动对账工具
2. 🔄 添加告警：当无 usage 数据的请求超过阈值时通知
3. 🔄 尝试从上游 API 获取历史用量数据

### 长期

1. 🔄 与 Claude Console 团队沟通，要求所有响应都包含 usage 数据
2. 🔄 开发 usage 数据补录工具

## 相关问题

### Q: 为什么不估算 token 数？

**A**: 估算不准确，可能导致更大的对账差异。记录为 0 并标记需要人工核对，更加透明和可追溯。

### Q: 如何补充实际的 token 数？

**A**:

1. 从上游账单系统导出详细用量
2. 使用 SQL 更新对应记录：

```sql
UPDATE usage_records
SET
  input_tokens = 实际值,
  output_tokens = 实际值,
  total_tokens = 实际值,
  total_cost = 实际值,
  metadata = metadata || '{"_manually_updated": true}'::jsonb
WHERE id = 记录ID;
```

### Q: 这会影响费用统计吗？

**A**:

- 请求次数：✅ 准确
- Token 统计：⚠️ 不准确（显示为 0）
- 费用统计：⚠️ 不准确（显示为 0）
- 需要定期与上游账单核对并手动补充

## 测试结果

- ✅ 修复已应用
- ⏳ 等待下次请求验证
- ⏳ 需要观察一段时间确认稳定性

---

**修复人员**: AI Assistant  
**审核状态**: 待测试  
**部署状态**: 已部署到开发环境
