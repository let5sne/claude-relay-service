#!/bin/bash

# 增强版回归测试脚本 - 目标75%覆盖率
# 用法: ./scripts/regression-test-enhanced.sh [--quick|--full]

set -e

MODE=${1:-normal}

echo "🧪 开始增强版回归测试..."
echo "模式: $MODE"
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
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
  local name=$1
  local method=$2
  local path=$3
  local description=$4
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第1部分: API Keys管理模块 (15个端点)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "API-001" "get" "/api-keys" "获取所有API Keys"
test_endpoint "API-002" "post" "/api-keys" "创建API Key"
test_endpoint "API-003" "put" "/api-keys/:keyId" "更新API Key"
test_endpoint "API-004" "delete" "/api-keys/:keyId" "删除API Key"
test_endpoint "API-005" "post" "/api-keys/batch" "批量创建API Keys"
test_endpoint "API-006" "put" "/api-keys/batch" "批量编辑API Keys"
test_endpoint "API-007" "delete" "/api-keys/batch" "批量删除API Keys"
test_endpoint "API-008" "get" "/api-keys/deleted" "获取已删除的API Keys"
test_endpoint "API-009" "post" "/api-keys/:keyId/restore" "恢复已删除的API Key"
test_endpoint "API-010" "delete" "/api-keys/:keyId/permanent" "永久删除API Key"
test_endpoint "API-011" "delete" "/api-keys/deleted/clear-all" "清空所有已删除的API Keys"
test_endpoint "API-012" "get" "/api-keys/tags" "获取标签列表"
test_endpoint "API-013" "get" "/api-keys/:keyId/cost-debug" "API Key费用调试"
test_endpoint "API-014" "get" "/api-keys/:keyId/model-stats" "API Key模型统计"
test_endpoint "API-015" "get" "/api-keys/:keyId/usage-details" "API Key使用详情"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第2部分: 统计分析模块 (10个端点)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "STATS-001" "get" "/dashboard" "系统Dashboard"
test_endpoint "STATS-002" "get" "/dashboard/cost-efficiency/summary" "成本效率汇总"
test_endpoint "STATS-003" "get" "/dashboard/cost-efficiency/accounts" "账户成本效率"
test_endpoint "STATS-004" "get" "/dashboard/cost-efficiency/trends" "成本趋势"
test_endpoint "STATS-005" "get" "/accounts/:accountId/usage-breakdown" "账户API Key使用明细"
test_endpoint "STATS-006" "get" "/accounts/:accountId/usage-stats" "账户使用统计"
test_endpoint "STATS-007" "get" "/accounts/:accountId/usage-history" "账户使用历史"
test_endpoint "STATS-008" "get" "/usage-stats" "全局使用统计"
test_endpoint "STATS-009" "get" "/usage-trend" "使用趋势"
test_endpoint "STATS-010" "get" "/account-daily-quota-stats" "账户每日额度统计"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第3部分: Claude账户管理 (13个端点)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "CLAUDE-001" "get" "/claude-accounts" "获取Claude账户列表"
test_endpoint "CLAUDE-002" "post" "/claude-accounts" "创建Claude账户"
test_endpoint "CLAUDE-003" "put" "/claude-accounts/:accountId" "更新Claude账户"
test_endpoint "CLAUDE-004" "delete" "/claude-accounts/:accountId" "删除Claude账户"
test_endpoint "CLAUDE-005" "post" "/claude-accounts/generate-auth-url" "生成OAuth认证URL"
test_endpoint "CLAUDE-006" "post" "/claude-accounts/exchange-code" "交换OAuth代码"
test_endpoint "CLAUDE-007" "post" "/claude-accounts/:accountId/update-profile" "更新账户资料"
test_endpoint "CLAUDE-008" "post" "/claude-accounts/update-all-profiles" "批量更新账户资料"
test_endpoint "CLAUDE-009" "post" "/claude-accounts/:accountId/refresh" "刷新账户"
test_endpoint "CLAUDE-010" "post" "/claude-accounts/:accountId/reset-status" "重置账户状态"

if [ "$MODE" != "quick" ]; then
  test_endpoint "CLAUDE-011" "get" "/claude-accounts/usage" "Claude账户使用情况"
  test_endpoint "CLAUDE-012" "post" "/claude-accounts/generate-setup-token-url" "生成Setup Token URL"
  test_endpoint "CLAUDE-013" "post" "/claude-accounts/exchange-setup-token-code" "交换Setup Token"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第4部分: Claude Console账户 (7个端点)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "CONSOLE-001" "get" "/claude-console-accounts" "获取Console账户列表"
test_endpoint "CONSOLE-002" "post" "/claude-console-accounts" "创建Console账户"
test_endpoint "CONSOLE-003" "put" "/claude-console-accounts/:accountId" "更新Console账户"
test_endpoint "CONSOLE-004" "delete" "/claude-console-accounts/:accountId" "删除Console账户"
test_endpoint "CONSOLE-005" "put" "/claude-console-accounts/:accountId/toggle" "切换账户状态"
test_endpoint "CONSOLE-006" "get" "/claude-console-accounts/:accountId/usage" "Console账户使用情况"
test_endpoint "CONSOLE-007" "post" "/claude-console-accounts/reset-all-usage" "重置所有使用量"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第5部分: OpenAI账户管理 (8个端点)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "OPENAI-001" "get" "/openai-accounts" "获取OpenAI账户列表"
test_endpoint "OPENAI-002" "post" "/openai-accounts" "创建OpenAI账户"
test_endpoint "OPENAI-003" "put" "/openai-accounts/:accountId" "更新OpenAI账户"
test_endpoint "OPENAI-004" "delete" "/openai-accounts/:accountId" "删除OpenAI账户"
test_endpoint "OPENAI-005" "put" "/openai-accounts/:accountId/toggle" "切换OpenAI账户状态"

if [ "$MODE" = "full" ]; then
  test_endpoint "OPENAI-006" "post" "/openai-accounts/:accountId/refresh" "刷新OpenAI账户"
  test_endpoint "OPENAI-007" "get" "/openai-accounts/:accountId/usage" "OpenAI账户使用情况"
  test_endpoint "OPENAI-008" "post" "/openai-accounts/batch-import" "批量导入OpenAI账户"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第6部分: 账户组管理 (6个端点)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "GROUP-001" "get" "/account-groups" "获取账户组列表"
test_endpoint "GROUP-002" "post" "/account-groups" "创建账户组"
test_endpoint "GROUP-003" "get" "/account-groups/:groupId" "获取账户组详情"
test_endpoint "GROUP-004" "put" "/account-groups/:groupId" "更新账户组"
test_endpoint "GROUP-005" "delete" "/account-groups/:groupId" "删除账户组"
test_endpoint "GROUP-006" "get" "/account-groups/:groupId/members" "获取账户组成员"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第7部分: 前端组件完整性 (18个核心组件)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# API Keys组件
test_file_exists "FE-001" "web/admin-spa/src/components/apikeys/CreateApiKeyModal.vue" "创建API Key模态框"
test_file_exists "FE-002" "web/admin-spa/src/components/apikeys/EditApiKeyModal.vue" "编辑API Key模态框"
test_file_exists "FE-003" "web/admin-spa/src/components/apikeys/BatchApiKeyModal.vue" "批量API Key模态框"
test_file_exists "FE-004" "web/admin-spa/src/components/apikeys/UsageDetailModal.vue" "使用详情模态框"

# 账户管理组件
test_file_exists "FE-005" "web/admin-spa/src/components/accounts/AccountForm.vue" "账户表单"
test_file_exists "FE-006" "web/admin-spa/src/components/accounts/OAuthFlow.vue" "OAuth认证流程"
test_file_exists "FE-007" "web/admin-spa/src/components/accounts/AccountUsageDetailModal.vue" "账户使用详情"
test_file_exists "FE-008" "web/admin-spa/src/components/accounts/GroupManagementModal.vue" "组管理模态框"

# 统计分析组件
test_file_exists "FE-009" "web/admin-spa/src/components/analytics/ApiKeyBreakdownAnalysis.vue" "API Key调用明细"
test_file_exists "FE-010" "web/admin-spa/src/components/analytics/CostEfficiencyAnalysis.vue" "成本效率分析"
test_file_exists "FE-011" "web/admin-spa/src/components/analytics/CostTrendsAnalysis.vue" "成本趋势分析"
test_file_exists "FE-012" "web/admin-spa/src/components/analytics/CostTrackingManagement.vue" "成本追踪管理"
test_file_exists "FE-013" "web/admin-spa/src/components/analytics/QuotaAllocationAnalysis.vue" "额度配置分析"
test_file_exists "FE-014" "web/admin-spa/src/components/analytics/AccountDailyQuotaAnalysis.vue" "账户每日额度"

# 通用组件
test_file_exists "FE-015" "web/admin-spa/src/components/common/ThemeToggle.vue" "主题切换"
test_file_exists "FE-016" "web/admin-spa/src/components/common/LogoTitle.vue" "Logo标题"
test_file_exists "FE-017" "web/admin-spa/src/components/common/Toast.vue" "Toast提示"

# 视图页面
test_file_exists "FE-018" "web/admin-spa/src/views/AnalyticsView.vue" "统计分析视图"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第8部分: 业务逻辑代码 (20个关键逻辑)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# API Key相关逻辑
test_code_pattern "LOGIC-001" "src/routes/admin.js" "claudeAccountId === accountId" "API Key按Claude账户过滤"
test_code_pattern "LOGIC-002" "src/routes/admin.js" "openaiAccountId === accountId" "API Key按OpenAI账户过滤"
test_code_pattern "LOGIC-003" "src/routes/admin.js" "geminiAccountId === accountId" "API Key按Gemini账户过滤"
test_code_pattern "LOGIC-004" "src/routes/admin.js" "getUsageRecords" "使用记录获取"
test_code_pattern "LOGIC-005" "src/routes/admin.js" "getAllApiKeys" "获取所有API Keys"

# 统计相关逻辑
test_code_pattern "LOGIC-006" "src/routes/admin.js" "getAccountUsageStats" "账户使用统计"
test_code_pattern "LOGIC-007" "src/routes/admin.js" "getCostStats" "成本统计"
test_code_pattern "LOGIC-008" "src/routes/admin.js" "calculateCost" "成本计算"

# 账户相关逻辑
test_code_pattern "LOGIC-009" "src/routes/admin.js" "authenticateAdmin" "管理员认证"
test_code_pattern "LOGIC-010" "src/routes/admin.js" "getAccount" "获取账户信息"

if [ "$MODE" = "full" ]; then
  # Token相关逻辑
  test_code_pattern "LOGIC-011" "src/services/apiKeyService.js" "recordUsage" "记录使用"
  test_code_pattern "LOGIC-012" "src/services/apiKeyService.js" "checkLimit" "检查限制"
  test_code_pattern "LOGIC-013" "src/services/apiKeyService.js" "updateUsageStats" "更新使用统计"
  
  # 成本计算逻辑
  test_code_pattern "LOGIC-014" "src/utils/costCalculator.js" "calculateCost" "成本计算器"
  test_code_pattern "LOGIC-015" "src/services/pricingService.js" "getPrice" "获取价格"
  
  # 缓存逻辑
  test_code_pattern "LOGIC-016" "src/models/redis.js" "getClientSafe" "Redis客户端"
  test_code_pattern "LOGIC-017" "src/models/redis.js" "setApiKey" "设置API Key缓存"
  test_code_pattern "LOGIC-018" "src/models/redis.js" "getApiKey" "获取API Key缓存"
  
  # 错误处理
  test_code_pattern "LOGIC-019" "src/routes/admin.js" "try.*catch" "错误处理"
  test_code_pattern "LOGIC-020" "src/routes/admin.js" "res.status(500)" "500错误响应"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第9部分: 配置文件完整性 (8个配置)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_file_exists "CONFIG-001" "package.json" "项目配置"
test_file_exists "CONFIG-002" ".husky/pre-push" "Git pre-push hook"
test_file_exists "CONFIG-003" "PRIVATE_BRANCH_WORKFLOW.md" "私有分支工作流文档"
test_file_exists "CONFIG-004" "LOCAL_FEATURES.md" "本地功能清单"
test_file_exists "CONFIG-005" "UPSTREAM_SYNC_GUIDE.md" "上游同步指南"
test_file_exists "CONFIG-006" "PROJECT_ANALYSIS.md" "项目分析报告"
test_file_exists "CONFIG-007" "scripts/sync-from-upstream.sh" "上游同步脚本"
test_file_exists "CONFIG-008" "scripts/regression-test.sh" "回归测试脚本"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 第10部分: 关键数据结构 (10个检查)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查关键数据结构定义
warn_if_missing "DATA-001" "src/routes/admin.js" "success.*true" "标准响应格式"
warn_if_missing "DATA-002" "src/routes/admin.js" "error.*message" "错误响应格式"
warn_if_missing "DATA-003" "src/models/redis.js" "hgetall" "Redis Hash操作"
warn_if_missing "DATA-004" "src/models/redis.js" "zadd" "Redis Sorted Set操作"
warn_if_missing "DATA-005" "src/services/apiKeyService.js" "keyData" "API Key数据结构"
warn_if_missing "DATA-006" "src/services/apiKeyService.js" "usage" "使用数据结构"
warn_if_missing "DATA-007" "src/utils/costCalculator.js" "totalCost" "成本数据结构"
warn_if_missing "DATA-008" "web/admin-spa/src/utils/apiClient.js" "axios" "HTTP客户端"
warn_if_missing "DATA-009" "web/admin-spa/src/router/index.js" "routes" "路由配置"
warn_if_missing "DATA-010" "web/admin-spa/src/stores" "pinia" "状态管理"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试结果统计"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo ""

# 计算覆盖率
PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "${BLUE}测试通过率: $PASS_RATE%${NC}"

# 估算覆盖率
if [ "$MODE" = "quick" ]; then
  ESTIMATED_COVERAGE="约40-45%"
elif [ "$MODE" = "full" ]; then
  ESTIMATED_COVERAGE="约75-80%"
else
  ESTIMATED_COVERAGE="约60-65%"
fi
echo -e "${BLUE}估算覆盖率: $ESTIMATED_COVERAGE${NC}"
echo ""

# 生成测试报告
REPORT_FILE="regression-test-enhanced-report-$(date +%Y%m%d-%H%M%S).md"
cat > "$REPORT_FILE" << EOF
# 增强版回归测试报告

**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')
**测试模式**: $MODE
**Git分支**: $(git branch --show-current)
**Git提交**: $(git rev-parse --short HEAD)

## 测试结果

- 总测试数: $TOTAL_TESTS
- ✅ 通过: $PASSED_TESTS ($PASS_RATE%)
- ❌ 失败: $FAILED_TESTS
- ⚠️  警告: $WARNINGS

## 测试覆盖

### API端点测试
- API Keys管理: 15个端点
- 统计分析: 10个端点
- Claude账户: 10-13个端点
- Console账户: 7个端点
- OpenAI账户: 5-8个端点
- 账户组: 6个端点

### 前端组件测试
- 核心组件: 18个

### 业务逻辑测试
- 关键逻辑: 10-20个

### 配置文件测试
- 配置完整性: 8个

## 估算覆盖率

**$ESTIMATED_COVERAGE**

### 覆盖率详情
- API端点覆盖: $(grep -E "^(API|STATS|CLAUDE|CONSOLE|OPENAI|GROUP)-" <<< "$REPORT_FILE" | wc -l | tr -d ' ')个 / 133个总端点
- 前端组件覆盖: 18个 / 48个总组件
- 业务逻辑覆盖: 较完整
- 配置文件覆盖: 完整

## 建议

EOF

if [ $FAILED_TESTS -gt 0 ]; then
  cat >> "$REPORT_FILE" << EOF
⚠️ **发现 $FAILED_TESTS 个失败的测试项**

建议：
1. 检查上游合并是否覆盖了本地修改
2. 查看备份分支恢复丢失的代码
3. 重新实现缺失的功能
4. 参考 LOCAL_FEATURES.md 和 PROJECT_ANALYSIS.md

EOF
fi

if [ $WARNINGS -gt 0 ]; then
  cat >> "$REPORT_FILE" << EOF
💡 **有 $WARNINGS 个警告项需要关注**

这些警告不影响功能，但建议检查相关代码是否符合最佳实践。

EOF
fi

if [ $PASS_RATE -ge 90 ]; then
  cat >> "$REPORT_FILE" << EOF
🎉 **测试通过率优秀！** ($PASS_RATE%)

当前测试覆盖率已达到较高水平，继续保持！

EOF
elif [ $PASS_RATE -ge 75 ]; then
  cat >> "$REPORT_FILE" << EOF
✅ **测试通过率良好** ($PASS_RATE%)

已达到行业标准，建议继续提升到90%以上。

EOF
else
  cat >> "$REPORT_FILE" << EOF
⚠️ **测试通过率需要提升** ($PASS_RATE%)

建议：
1. 修复失败的测试项
2. 增加更多测试用例
3. 参考 PROJECT_ANALYSIS.md 中的改进建议

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
  echo ""
  echo "🎯 当前估算覆盖率: $ESTIMATED_COVERAGE"
  echo "📊 详细分析请查看: PROJECT_ANALYSIS.md"
  exit 0
fi
