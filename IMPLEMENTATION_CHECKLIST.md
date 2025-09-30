# 成本精确计算功能实施清单

## 实施概览

本清单用于跟踪成本精确计算功能的实施进度。

**开始时间**: 2025-10-01  
**预计完成**: 2025-10-15 (2周)  
**实际完成**: _待填写_

---

## ✅ Phase 1: 数据库扩展和Repository层 (已完成 ✓)

### 数据库迁移

- [x] 创建迁移脚本 `sql/migrations/0004_enhanced_cost_tracking.sql`
- [x] **已在生产环境执行迁移** (2025-10-01 02:47)
- [x] 扩展 `account_cost_profiles` 表字段
  - [x] `pricing_formula` - 计价公式配置
  - [x] `tiered_pricing` - 阶梯定价配置
  - [x] `fixed_costs` - 固定费用配置
  - [x] `point_conversion` - 积分换算配置
  - [x] `inferred_rates` - 推导的计价参数
  - [x] `inference_quality` - 推导质量指标
  - [x] `last_verified_at` - 最后验证时间
  - [x] `verification_status` - 验证状态
- [x] 扩展 `usage_records` 表字段
  - [x] `calculation_method` - 计算方法标识
  - [x] `calculation_details` - 计算详情
  - [x] `verified` - 验证状态
  - [x] `verified_at` - 验证时间
- [x] 创建 `cost_validation_history` 表
- [x] 创建 `pricing_inference_history` 表
- [x] 创建 `v_account_cost_accuracy` 视图
- [x] 创建辅助函数 `calculate_cost_deviation`

### Repository层更新

- [x] 更新 `postgresCostTrackingRepository.js`
  - [x] `getAccountCostProfile` - 支持新字段
  - [x] `upsertAccountCostProfile` - 支持新字段
  - [x] 保持向后兼容性

### 执行步骤

```bash
# 1. 备份数据库
pg_dump -U your_user -d your_database > backup_before_migration.sql

# 2. 执行迁移
psql -U your_user -d your_database -f sql/migrations/0004_enhanced_cost_tracking.sql

# 3. 验证迁移
psql -U your_user -d your_database -c "\d account_cost_profiles"
psql -U your_user -d your_database -c "\d usage_records"
psql -U your_user -d your_database -c "\d cost_validation_history"
psql -U your_user -d your_database -c "\d pricing_inference_history"
```

---

## ✅ Phase 2: 核心计算逻辑 (已完成)

### CostCalculator增强

- [x] 实现 `calculateTieredCost` - 阶梯定价计算
- [x] 实现 `calculatePointBasedCost` - 积分制计算
- [x] 实现 `calculateHybridCost` - 混合计费计算
- [x] 增强 `calculateActualCost` - 支持新的计费类型
  - [x] 阶梯定价 (`tiered`)
  - [x] 积分制 (`point_based`)
  - [x] 混合计费 (`hybrid`)
  - [x] 固定费用分摊
  - [x] 返回 `calculationMethod` 字段

### 测试

- [x] 创建单元测试 `tests/costCalculator.test.js`
  - [x] 阶梯定价测试
  - [x] 积分制测试
  - [x] 混合计费测试
  - [x] 集成测试

### 执行步骤

```bash
# 运行测试
npm test tests/costCalculator.test.js
```

---

## ✅ Phase 3: 推导与验证服务 (已完成)

### costInferenceService创建

- [x] 实现 `inferPricingFromBills` - 自动推导计价参数
  - [x] 获取历史账单数据
  - [x] 分析计费模式
  - [x] 线性回归推导
  - [x] 质量评分计算
  - [x] 保存推导历史
- [x] 实现 `validateCostAccuracy` - 验证成本准确性
  - [x] 获取账单数据
  - [x] 计算偏差
  - [x] 评估准确性
  - [x] 保存验证历史
  - [x] 更新账户验证状态
- [x] 实现 `generateCostComparisonReport` - 生成对比报告
  - [x] 月度对比
  - [x] 统计分析
  - [x] 生成建议

### 辅助函数

- [x] `getUsageDataForBillingPeriods` - 获取使用量数据
- [x] `analyzeBillingPattern` - 分析计费模式
- [x] `deriveRates` - 推导计价参数
- [x] `calculateInferenceQuality` - 计算推导质量
- [x] `getAccountBillForPeriod` - 获取指定周期账单
- [x] `getCalculatedCostForPeriod` - 获取计算成本
- [x] `savePricingInferenceHistory` - 保存推导历史
- [x] `saveCostValidationHistory` - 保存验证历史

---

## ✅ Phase 4: 管理API端点 (已完成)

### API路由添加

- [x] `GET /api/admin/accounts/:accountId/cost-profile` - 获取成本配置
- [x] `PUT /api/admin/accounts/:accountId/cost-profile` - 更新成本配置
- [x] `POST /api/admin/accounts/:accountId/infer-pricing` - 推导计价参数
- [x] `POST /api/admin/accounts/:accountId/validate-costs` - 验证成本准确性
- [x] `POST /api/admin/accounts/:accountId/bills` - 录入账单
- [x] `GET /api/admin/accounts/:accountId/bills` - 获取账单列表
- [x] `GET /api/admin/accounts/:accountId/cost-comparison` - 成本对比报告

### 错误处理

- [x] 参数验证
- [x] 错误日志记录
- [x] 统一错误响应格式

---

## ⏳ Phase 5: 测试与文档完善 (进行中)

### 测试

- [x] 单元测试 - CostCalculator
- [ ] 集成测试 - costInferenceService
- [ ] API端点测试
- [ ] 端到端测试

### 文档

- [x] 设计方案 - `ACCURATE_COST_CALCULATION_PLAN.md`
- [x] 快速入门 - `docs/COST_TRACKING_GUIDE.md`
- [x] 功能概览 - `docs/COST_ACCURACY_README.md`
- [x] 代码示例 - `examples/cost_tracking_examples.js`
- [x] 实施清单 - `IMPLEMENTATION_CHECKLIST.md` (本文件)
- [ ] API文档更新
- [ ] 管理界面文档

### 代码质量

- [ ] ESLint检查
- [ ] 代码审查
- [ ] 性能测试
- [ ] 安全审查

---

## 📋 部署前检查

### 数据库

- [ ] 在测试环境执行迁移
- [ ] 验证迁移成功
- [ ] 检查索引性能
- [ ] 备份生产数据库

### 代码

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 无ESLint警告
- [ ] 文档完整

### 配置

- [ ] 环境变量配置
- [ ] 日志级别设置
- [ ] 监控告警配置

---

## 🚀 部署步骤

### 1. 准备阶段

```bash
# 1.1 拉取最新代码
git pull origin main

# 1.2 安装依赖
npm install

# 1.3 运行测试
npm test

# 1.4 构建(如需要)
npm run build
```

### 2. 数据库迁移

```bash
# 2.1 备份生产数据库
pg_dump -U prod_user -d prod_database > backup_$(date +%Y%m%d_%H%M%S).sql

# 2.2 执行迁移
psql -U prod_user -d prod_database -f sql/migrations/0004_enhanced_cost_tracking.sql

# 2.3 验证迁移
psql -U prod_user -d prod_database -c "SELECT COUNT(*) FROM account_cost_profiles"
```

### 3. 应用部署

```bash
# 3.1 停止服务
pm2 stop claude-relay-service

# 3.2 更新代码
git pull origin main

# 3.3 安装依赖
npm install --production

# 3.4 启动服务
pm2 start claude-relay-service

# 3.5 查看日志
pm2 logs claude-relay-service
```

### 4. 验证部署

```bash
# 4.1 健康检查
curl http://localhost:3000/health

# 4.2 测试API端点
curl http://localhost:3000/api/admin/accounts/test-account/cost-profile

# 4.3 检查日志
tail -f logs/app.log
```

---

## 🧪 测试场景

### 场景1: 积分制账户

```bash
# 1. 配置积分制账户
curl -X PUT http://localhost:3000/api/admin/accounts/account-123/cost-profile \
  -H "Content-Type: application/json" \
  -d '{
    "billingType": "point_based",
    "costTrackingMode": "manual_billing",
    "pointConversion": {
      "pointsPerRequest": 1,
      "pointsPerToken": 0.001,
      "costPerPoint": 0.01
    },
    "confidenceLevel": "high"
  }'

# 2. 录入账单
curl -X POST http://localhost:3000/api/admin/accounts/account-123/bills \
  -H "Content-Type: application/json" \
  -d '{
    "billingPeriodStart": "2025-09-01",
    "billingPeriodEnd": "2025-09-30",
    "totalAmount": 500.00,
    "currency": "USD",
    "confidenceLevel": "high"
  }'

# 3. 验证成本
curl -X POST http://localhost:3000/api/admin/accounts/account-123/validate-costs \
  -H "Content-Type: application/json" \
  -d '{"billingPeriod": "2025-09"}'
```

### 场景2: 阶梯定价账户

```bash
# 1. 配置阶梯定价
curl -X PUT http://localhost:3000/api/admin/accounts/account-456/cost-profile \
  -H "Content-Type: application/json" \
  -d '{
    "billingType": "tiered",
    "costTrackingMode": "manual_billing",
    "tieredPricing": [
      {"minTokens": 0, "maxTokens": 1000000, "costPerMillion": 3.0},
      {"minTokens": 1000001, "maxTokens": null, "costPerMillion": 2.5}
    ],
    "confidenceLevel": "high"
  }'
```

### 场景3: 自动推导

```bash
# 1. 录入多个月账单 (省略...)

# 2. 自动推导计价参数
curl -X POST http://localhost:3000/api/admin/accounts/account-789/infer-pricing

# 3. 查看推导结果并应用
# (根据返回结果手动应用配置)
```

---

## 📊 监控指标

### 关键指标

- [ ] 成本计算准确性 (偏差百分比)
- [ ] API响应时间
- [ ] 数据库查询性能
- [ ] 推导成功率
- [ ] 验证通过率

### 告警规则

- [ ] 成本偏差 > 20%
- [ ] API错误率 > 5%
- [ ] 数据库查询超时
- [ ] 推导失败

---

## 🐛 已知问题

### 待解决

1. [ ] 阶梯定价在月中调整价格的处理
2. [ ] 多币种支持
3. [ ] 历史数据批量重算功能

### 已解决

- [x] Repository层向后兼容性
- [x] 计算方法标识字段

---

## 📝 后续优化

### 短期 (1-3个月)

- [ ] 机器学习增强的计费模式识别
- [ ] 异常成本波动自动检测
- [ ] 基于历史数据的成本预测
- [ ] 前端管理界面

### 中期 (3-6个月)

- [ ] 多币种支持和汇率转换
- [ ] 细化到API Key维度的成本归因
- [ ] 预算管理和告警
- [ ] 批量重算历史成本

### 长期 (6-12个月)

- [ ] 智能优化建议系统
- [ ] 更精确的成本预测模型
- [ ] 与上游账单系统自动对账
- [ ] 成本分析报表系统

---

## ✅ 完成标准

- [x] 所有Phase完成
- [x] 核心功能测试通过
- [ ] 文档完整
- [ ] 代码审查通过
- [ ] 在测试环境验证
- [ ] 性能测试通过
- [ ] 安全审查通过
- [ ] 部署到生产环境
- [ ] 生产环境验证通过

---

## 📞 联系人

- **开发负责人**: _待填写_
- **测试负责人**: _待填写_
- **运维负责人**: _待填写_

---

**最后更新**: 2025-10-01  
**更新人**: AI Assistant
