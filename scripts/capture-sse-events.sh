#!/bin/bash

# 捕获 SSE 事件的脚本
# 用法: ./scripts/capture-sse-events.sh

echo "🔍 开始监控 SSE 事件..."
echo "请在另一个终端发起请求"
echo "按 Ctrl+C 停止监控"
echo ""

# 实时监控日志中的 SSE 事件
tail -f logs/claude-relay-$(date +%Y-%m-%d).log | grep --line-buffered -E "SSE event|Event data|Stream completed|Usage callback"
