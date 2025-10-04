# Claude Console 流式响应缺失 Usage 数据分析

## 问题现象

**日志显示**：

```
⚠️ Stream completed without usage data - recording basic request for billing consistency
📊 Stream usage recorded (real) - Model: claude-3-5-haiku-20241022, Input: 0, Output: 0, Total: 0 tokens
```

**结果**：

- ✅ 请求成功（200 状态码）
- ✅ 响应正常返回
- ❌ Token 统计为 0
- ❌ 费用统计为 0

## 根本原因分析

### 1. Claude Console API 的 SSE 事件流格式

标准的 Anthropic Messages API 流式响应应该包含以下事件：

```
event: message_start
data: {"type":"message_start","message":{"id":"...","usage":{"input_tokens":10,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}

event: message_stop
data: {"type":"message_stop"}
```

**关键 usage 数据位置**：

- `message_start` 事件：包含 `input_tokens`（输入 token 数）
- `message_delta` 事件：包含 `output_tokens`（输出 token 数）

### 2. 可能的原因

#### 原因 A：Claude Console 代理服务器不返回 usage 数据

某些 Claude Console 的代理实现**不转发 usage 字段**，只转发内容：

```javascript
// 正常响应（有 usage）
{
  "type": "message_start",
  "message": {
    "id": "msg_xxx",
    "usage": { "input_tokens": 10 }  // ✅ 有 usage
  }
}

// 代理响应（无 usage）
{
  "type": "message_start",
  "message": {
    "id": "msg_xxx"
    // ❌ 缺少 usage 字段
  }
}
```

#### 原因 B：API 版本或配置问题

- Claude Console 可能使用了不同的 API 版本
- 某些配置下不返回 usage 统计
- 可能需要特定的请求头才能获取 usage

#### 原因 C：流式响应被中间件修改

- 代理服务器过滤了 usage 字段
- 防火墙或负载均衡器修改了响应
- CDN 缓存导致数据不完整

### 3. 代码解析逻辑

当前代码尝试从多个位置提取 usage：

```javascript
// 1. message_start 事件
if (data.type === 'message_start' && data.message && data.message.usage) {
  collectedUsageData.input_tokens = data.message.usage.input_tokens || 0
}

// 2. message_delta 事件
if (data.type === 'message_delta' && data.usage && data.usage.output_tokens !== undefined) {
  collectedUsageData.output_tokens = data.usage.output_tokens || 0
}

// 3. message_stop 事件（兼容性）
if (data.type === 'message_stop' && data.usage) {
  // 某些实现把 usage 放在这里
}
```

**如果所有这些位置都没有 usage 数据** → 流结束时触发回退逻辑 → 记录 token=0 的请求

## 验证方法

### 方法 1：查看原始 SSE 响应

启用详细日志：

```bash
# 修改日志级别
export LOG_LEVEL=debug

# 或在代码中临时添加
logger.info(`📊 Event data: ${JSON.stringify(data)}`)
```

查看日志中的 SSE 事件，确认是否有 `usage` 字段。

### 方法 2：直接调用上游 API

绕过代理，直接调用 Claude Console 的 API：

```bash
curl -X POST "https://api.claude.ai/api/organizations/{org_id}/chat_conversations/{conv_id}/completion" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello",
    "model": "claude-3-5-haiku-20241022",
    "stream": true
  }'
```

观察响应中是否包含 usage 数据。

### 方法 3：对比非流式请求

发起非流式请求（`stream: false`），查看响应：

```javascript
{
  "id": "msg_xxx",
  "content": [...],
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

如果非流式有 usage，但流式没有 → 确认是流式响应的问题。

## 解决方案

### 短期方案（已实施）

✅ **记录基本请求，避免对账丢失**

```javascript
// 流结束时，如果没有 usage 数据
if (!finalUsageReported && usageCallback) {
  usageCallback({
    accountId,
    model: body?.model || 'unknown',
    input_tokens: 0,
    output_tokens: 0,
    _no_usage_data: true, // 标记
    _requires_manual_review: true
  })
}
```

✅ **手动补充工具**

```bash
node scripts/backfill-usage-tokens.js
```

### 中期方案

#### 方案 1：切换到非流式请求

如果 usage 数据很重要，可以使用非流式请求：

```javascript
const requestBody = {
  ...body,
  stream: false // 关闭流式
}
```

**优点**：

- ✅ 总是有完整的 usage 数据
- ✅ 更容易解析

**缺点**：

- ❌ 用户体验差（等待时间长）
- ❌ 无法实时显示响应

#### 方案 2：从上游账单 API 获取数据

定期调用 Claude Console 的账单 API：

```javascript
// 每小时同步一次
async function syncUsageFromBilling() {
  const billingData = await claudeConsoleAPI.getBillingHistory()
  // 匹配请求 ID，补充 token 数据
  await updateUsageRecords(billingData)
}
```

#### 方案 3：请求头优化

尝试添加特定请求头：

```javascript
headers: {
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'usage-2024-01',  // 可能的 beta 功能
  ...
}
```

### 长期方案

#### 方案 1：与 Claude Console 团队沟通

- 报告 usage 数据缺失问题
- 请求在流式响应中包含 usage
- 或提供专门的 usage 查询 API

#### 方案 2：开发 Token 估算引擎

基于请求内容估算 token 数：

```javascript
function estimateTokens(text) {
  // 简单估算：1 token ≈ 4 字符
  return Math.ceil(text.length / 4)
}
```

**优点**：

- ✅ 立即可用
- ✅ 比 0 更准确

**缺点**：

- ❌ 不够精确
- ❌ 无法处理缓存 token

## 当前状态总结

| 项目           | 状态        | 说明                              |
| -------------- | ----------- | --------------------------------- |
| **请求记录**   | ✅ 完整     | 所有请求都被记录                  |
| **请求次数**   | ✅ 准确     | 与上游一致                        |
| **Token 统计** | ⚠️ 部分准确 | 有 usage 数据的准确，无数据的为 0 |
| **费用统计**   | ⚠️ 部分准确 | 同上                              |
| **对账一致性** | ✅ 可追溯   | 通过标记可识别需要核对的记录      |

## 建议

1. **立即**：启用详细日志，查看一次完整的 SSE 响应
2. **短期**：继续使用手动补充工具
3. **中期**：评估是否切换到非流式请求或开发账单同步
4. **长期**：与 Claude Console 团队沟通解决

---

**创建时间**: 2025-10-05  
**最后更新**: 2025-10-05  
**状态**: 调查中
