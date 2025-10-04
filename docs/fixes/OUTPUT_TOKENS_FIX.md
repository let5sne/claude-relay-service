# Output Tokens 记录错误修复

## 问题描述

**发现时间**: 2025-10-05 01:14

**症状**：

- ✅ 输入 token 数正确
- ❌ 输出 token 数始终为 1 或 2（占位符值）
- ❌ 与上游供应商统计不一致

**实际案例**：

```
本地记录: Input: 86, Output: 1  ← 错误
上游统计: Input: 86, Output: 26 ← 正确

本地记录: Input: 3, Output: 2   ← 错误
上游统计: Input: 3, Output: 14  ← 正确
```

## 根本原因

### Claude Console SSE 事件流

```javascript
// 1. message_start 事件
{
  "type": "message_start",
  "message": {
    "usage": {
      "input_tokens": 86,
      "output_tokens": 1  // ← 这只是占位符！
    }
  }
}

// 2. content_block_delta 事件（多次）
// 输出内容...

// 3. message_delta 事件
{
  "type": "message_delta",
  "usage": {
    "input_tokens": 86,
    "output_tokens": 26  // ← 这才是真实值！
  }
}
```

### 代码问题

**原代码逻辑**：

```javascript
// message_start 事件处理
if (data.type === 'message_start' && data.message.usage) {
  collectedUsageData.input_tokens = data.message.usage.input_tokens
  // ❌ 没有明确排除 output_tokens
}

// 检查是否有 output_tokens
if (u2 && u2.output_tokens !== undefined) {  // ← 在 message_start 时就满足！
  collectedUsageData.output_tokens = u2.output_tokens  // ← 记录了占位符值 1

  if (collectedUsageData.input_tokens !== undefined) {
    usageCallback(...)  // ← 立即触发回调！
    finalUsageReported = true
  }
}

// message_delta 事件（稍后到达）
if (data.type === 'message_delta' && data.usage.output_tokens !== undefined) {
  collectedUsageData.output_tokens = data.usage.output_tokens  // ← 更新为真实值 26

  if (!finalUsageReported) {  // ← 但回调已经触发了！
    usageCallback(...)
  }
}
```

**问题**：

1. `message_start` 中的 `output_tokens:1` 是占位符，不是真实值
2. 代码没有区分事件类型，在 `message_start` 时就触发了回调
3. 后续 `message_delta` 中的真实值无法更新（回调已触发）

## 解决方案

### 修复代码

**文件**: `src/services/claudeConsoleRelayService.js`

```javascript
// 1. 在 message_start 中只收集 input_tokens 和缓存数据
if (data.type === 'message_start' && data.message && data.message.usage) {
  const u = data.message.usage

  if (u.input_tokens !== undefined) {
    collectedUsageData.input_tokens = u.input_tokens || 0
  }
  if (u.cache_creation_input_tokens !== undefined) {
    collectedUsageData.cache_creation_input_tokens = u.cache_creation_input_tokens || 0
  }
  if (u.cache_read_input_tokens !== undefined) {
    collectedUsageData.cache_read_input_tokens = u.cache_read_input_tokens || 0
  }
  // ✅ 不要在 message_start 中收集 output_tokens，因为它只是占位符
  // 真实的 output_tokens 会在 message_delta 中更新
}

// 2. 只在 message_delta 中更新 output_tokens 并触发回调
if (
  data.type === 'message_delta' && // ← 严格检查事件类型
  data.usage &&
  data.usage.output_tokens !== undefined
) {
  collectedUsageData.output_tokens = data.usage.output_tokens || 0

  // 只有在 message_delta 中才触发回调（此时 output_tokens 是真实值）
  if (collectedUsageData.input_tokens !== undefined && !finalUsageReported) {
    logger.info(`✅ Complete usage data collected - reporting to callback`)
    usageCallback({ ...collectedUsageData, accountId })
    finalUsageReported = true
  }
}
```

### 修复后的事件流

```
1. message_start 事件
   ✅ 收集: input_tokens=86, cache_create=0, cache_read=0
   ⏸️  不触发回调

2. content_block_delta 事件（多次）
   ⏸️  继续等待

3. message_delta 事件
   ✅ 收集: output_tokens=26（真实值）
   ✅ 触发回调: {input:86, output:26, ...}

4. 记录到数据库
   ✅ 正确的 token 数据
```

## 验证结果

### 修复前

```
时间: 10-05 01:14:33
模型: claude-3-5-haiku-20241022
输入: 86 ✅
输出: 1  ❌ (应该是 26)

时间: 10-05 01:14:35
模型: claude-sonnet-4-5-20250929
输入: 3  ✅
输出: 2  ❌ (应该是 14)
```

### 修复后

```
时间: 10-05 01:23:21
模型: claude-3-5-haiku-20241022
输入: 86 ✅
输出: 26 ✅

时间: 10-05 01:23:23
模型: claude-sonnet-4-5-20250929
输入: 3  ✅
输出: 14 ✅
```

## 相关修复

此次修复是在以下修复的基础上完成的：

1. **SSE 格式修复** (2025-10-05 00:35)
   - 修复了 `data:` 后无空格的解析问题
   - 文件: `src/services/claudeConsoleRelayService.js`

2. **缓存字段添加** (2025-10-05 01:10)
   - 添加了 `cache_create_tokens` 和 `cache_read_tokens` 字段
   - 文件: `src/repositories/postgresUsageRepository.js`, `src/services/accountUsageService.js`

3. **Output Tokens 修复** (2025-10-05 01:25) ← 本次修复
   - 修复了输出 token 数记录错误的问题
   - 文件: `src/services/claudeConsoleRelayService.js`

## 影响范围

- ✅ 所有使用 Claude Console 账户的流式请求
- ✅ Token 统计准确性
- ✅ 费用计算准确性
- ✅ 与上游供应商账单一致性

## 测试建议

1. **发起测试请求**：

   ```bash
   # 使用 claude-cli 或其他客户端
   claude "Hello"
   ```

2. **查看日志**：

   ```bash
   ./scripts/capture-sse-events.sh
   ```

   应该看到：

   ```
   📡 SSE event: message_start
   📊 Event data: {...,"output_tokens":1,...}  ← 占位符
   📡 SSE event: message_delta
   📊 Event data: {...,"output_tokens":26,...} ← 真实值
   ✅ Complete usage data collected - reporting to callback
   ```

3. **验证数据库**：

   ```sql
   SELECT occurred_at, model, input_tokens, output_tokens, total_tokens
   FROM usage_records
   WHERE usage_date = CURRENT_DATE
   ORDER BY occurred_at DESC
   LIMIT 5;
   ```

4. **对比上游统计**：
   - 登录 Claude Console 后台
   - 查看最近的请求统计
   - 确认 token 数一致

## 总结

**问题**：Claude Console 在 `message_start` 事件中返回的 `output_tokens` 只是占位符（通常为 1 或 2），真实值在 `message_delta` 事件中才会更新。

**修复**：严格限制只在 `message_delta` 事件中更新 `output_tokens` 并触发回调，避免记录占位符值。

**结果**：✅ Token 统计完全准确，与上游供应商一致。

---

**修复时间**: 2025-10-05 01:25  
**修复人员**: AI Assistant  
**验证状态**: ✅ 已验证通过
