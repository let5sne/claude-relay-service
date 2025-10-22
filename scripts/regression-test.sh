#!/bin/bash

# 回归测试脚本 - 检测关键功能是否完整
# 用法: ./scripts/regression-test.sh

set -e

echo "🧪 开始回归测试..."
echo ""

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
  local name=$1
  local method=$2
  local path=$3
  local description=$4
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  # 在代码中搜索路由定义
  if grep -q "router\.$method('$path'" src/routes/admin.js 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $name: $description"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $name: $description - 端点不存在！"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

test_file_exists() {
  local name=$1
  local file=$2
  local description=$3
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $name: $description"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $name: $description - 文件不存在！"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

test_code_pattern() {
  local name=$1
  local file=$2
  local pattern=$3
  local description=$4
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $name: $description"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗${NC} $name: $description - 代码模式未找到！"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

warn_if_missing() {
  local name=$1
  local file=$2
  local pattern=$3
  local description=$4
  
  if ! grep -q "$pattern" "$file" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC}  $name: $description - 建议检查"
    WARNINGS=$((WARNINGS + 1))
  fi
}

echo "📋 测试1: 检查关键API端点"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 测试统计分析模块的API端点
test_endpoint "API-001" "get" "/accounts/:accountId/usage-breakdown" "账户API Key使用明细端点"
test_endpoint "API-002" "get" "/api-keys/:keyId/usage-details" "API Key详细使用记录端点"
test_endpoint "API-003" "get" "/dashboard/cost-efficiency/summary" "成本效率汇总端点"
test_endpoint "API-004" "get" "/dashboard/cost-efficiency/accounts" "账户成本效率端点"
test_endpoint "API-005" "get" "/dashboard/cost-efficiency/trends" "成本趋势端点"

echo ""
echo "📋 测试2: 检查前端组件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_file_exists "FE-001" "web/admin-spa/src/components/analytics/ApiKeyBreakdownAnalysis.vue" "API Key调用明细组件"
test_file_exists "FE-002" "web/admin-spa/src/components/analytics/CostEfficiencyAnalysis.vue" "成本效率分析组件"
test_file_exists "FE-003" "web/admin-spa/src/components/analytics/CostTrendsAnalysis.vue" "成本趋势分析组件"
test_file_exists "FE-004" "web/admin-spa/src/views/AnalyticsView.vue" "统计分析视图"

echo ""
echo "📋 测试3: 检查关键功能代码"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查API Key查找逻辑是否正确
test_code_pattern "LOGIC-001" "src/routes/admin.js" "claudeAccountId === accountId" "API Key按服务账户过滤逻辑"
test_code_pattern "LOGIC-002" "src/routes/admin.js" "openaiAccountId === accountId" "OpenAI账户过滤逻辑"

# 检查使用记录获取
test_code_pattern "LOGIC-003" "src/routes/admin.js" "getUsageRecords" "使用记录获取功能"

echo ""
echo "📋 测试4: 检查配置文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_file_exists "CONFIG-001" "package.json" "项目配置文件"
test_file_exists "CONFIG-002" ".husky/pre-push" "Git pre-push hook"
test_file_exists "CONFIG-003" "PRIVATE_BRANCH_WORKFLOW.md" "私有分支工作流文档"

echo ""
echo "📋 测试5: 警告检查（可选）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否有潜在问题
warn_if_missing "WARN-001" "src/routes/admin.js" "authenticateAdmin" "管理员认证中间件"
warn_if_missing "WARN-002" "src/routes/admin.js" "try.*catch" "错误处理机制"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试结果统计"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo ""

# 生成测试报告
REPORT_FILE="regression-test-report-$(date +%Y%m%d-%H%M%S).md"
cat > "$REPORT_FILE" << EOF
# 回归测试报告

**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')
**Git分支**: $(git branch --show-current)
**Git提交**: $(git rev-parse --short HEAD)

## 测试结果

- 总测试数: $TOTAL_TESTS
- ✅ 通过: $PASSED_TESTS
- ❌ 失败: $FAILED_TESTS
- ⚠️  警告: $WARNINGS

## 测试覆盖

- [x] 关键API端点检查
- [x] 前端组件完整性
- [x] 业务逻辑代码
- [x] 配置文件检查
- [x] 潜在问题警告

## 建议

EOF

if [ $FAILED_TESTS -gt 0 ]; then
  cat >> "$REPORT_FILE" << EOF
⚠️ **发现 $FAILED_TESTS 个失败的测试项**

建议：
1. 检查上游合并是否覆盖了本地修改
2. 查看备份分支恢复丢失的代码
3. 重新实现缺失的功能

EOF
fi

if [ $WARNINGS -gt 0 ]; then
  cat >> "$REPORT_FILE" << EOF
💡 **有 $WARNINGS 个警告项需要关注**

建议检查相关代码是否符合预期。

EOF
fi

echo "📄 测试报告已生成: $REPORT_FILE"
echo ""

# 返回测试结果
if [ $FAILED_TESTS -gt 0 ]; then
  echo -e "${RED}❌ 回归测试失败！${NC}"
  echo "请检查失败的测试项并修复问题"
  exit 1
else
  echo -e "${GREEN}✅ 回归测试通过！${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  但有 $WARNINGS 个警告需要关注${NC}"
  fi
  exit 0
fi
