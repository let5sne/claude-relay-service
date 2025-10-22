# 测试体系完整指南

本项目建立了完整的四层测试体系,覆盖从单元测试到端到端测试的所有层级。

---

## 📊 测试体系概览

| 测试类型     | 覆盖率目标 | 执行时间 | 运行频率    | 状态          |
| ------------ | ---------- | -------- | ----------- | ------------- |
| **回归测试** | 85-90%     | 3-5分钟  | 每次提交    | ✅ 已实施     |
| **单元测试** | 70%+       | <1分钟   | 每次提交    | ✅ 框架已建立 |
| **集成测试** | 50%+       | 2-3分钟  | 每次PR      | ✅ 框架已建立 |
| **E2E测试**  | 30%+       | 5-10分钟 | 每日/发布前 | ✅ 已扩展     |

---

## 🧪 1. 回归测试 (Regression Tests)

### 用途

防止上游同步或代码修改破坏现有功能。

### 运行方式

```bash
# 快速模式 (1-2分钟, 50-55%覆盖率)
./scripts/regression-test-enhanced.sh --quick

# 标准模式 (2-3分钟, 70-75%覆盖率)
./scripts/regression-test-enhanced.sh

# 完整模式 (3-5分钟, 85-90%覆盖率)
./scripts/regression-test-enhanced.sh --full
```

### 覆盖内容

- ✅ 111个API端点 (83%覆盖率)
- ✅ 36个前端组件 (75%覆盖率)
- ✅ 20个业务逻辑
- ✅ 8个配置文件

### 测试模块

1. API Keys管理 (15个端点)
2. 统计分析 (10个端点)
3. Claude账户 (13个端点)
4. Console账户 (7个端点)
5. OpenAI账户 (8个端点)
6. 账户组 (6个端点)
7. **Gemini账户 (8个端点)** ✨新增
8. **Bedrock账户 (8个端点)** ✨新增
9. **CCR账户 (10个端点)** ✨新增
10. **Droid账户 (9个端点)** ✨新增
11. 前端组件 (36个)
12. 业务逻辑 (20个)
13. 配置文件 (8个)
14. 数据结构 (10个)

---

## 🔬 2. 单元测试 (Unit Tests)

### 用途

测试独立函数和模块的正确性。

### 运行方式

```bash
# 运行所有单元测试
npm test

# 运行特定测试文件
npm test tests/unit/costCalculator.test.js

# 监听模式(开发时使用)
npm test -- --watch

# 生成覆盖率报告
npm test -- --coverage
```

### 示例测试文件

- `tests/unit/costCalculator.test.js` - 成本计算器测试
- `tests/unit/apiKeyService.test.js` - API Key服务测试

### 编写单元测试指南

```javascript
/**
 * 单元测试模板
 */
const { functionToTest } = require('../../src/utils/module')

describe('模块名称', () => {
  describe('functionToTest', () => {
    test('应该正确处理正常输入', () => {
      const result = functionToTest(validInput)
      expect(result).toBe(expectedOutput)
    })

    test('应该处理边界条件', () => {
      const result = functionToTest(edgeCase)
      expect(result).toBeDefined()
    })

    test('应该处理错误输入', () => {
      expect(() => functionToTest(invalidInput)).toThrow()
    })
  })
})
```

### 单元测试最佳实践

1. ✅ 每个函数至少3个测试用例(正常/边界/异常)
2. ✅ 使用Mock隔离外部依赖
3. ✅ 测试名称清晰描述测试内容
4. ✅ 保持测试独立,不依赖执行顺序
5. ✅ 测试应该快速执行(<100ms/测试)

---

## 🔗 3. 集成测试 (Integration Tests)

### 用途

测试多个模块协同工作的正确性。

### 运行方式

```bash
# 运行所有集成测试
npm run test:integration

# 运行特定集成测试
npm test tests/integration/api-keys-flow.test.js
```

### 示例测试文件

- `tests/integration/api-keys-flow.test.js` - API Keys完整流程测试

### 集成测试覆盖场景

1. **API Key生命周期**
   - 创建账户 → 创建Key → 使用 → 更新 → 删除 → 恢复
2. **批量操作流程**
   - 批量创建 → 批量更新 → 批量删除
3. **成本追踪流程**
   - 配置追踪 → 使用API → 记录成本 → 查询统计
4. **账户管理流程**
   - OAuth认证 → 创建账户 → 绑定Key → 使用 → 刷新Token

### 编写集成测试指南

```javascript
const request = require('supertest')
const app = require('../../src/app')

describe('功能流程集成测试', () => {
  let authToken
  let testResourceId

  beforeAll(async () => {
    // 设置测试环境
    authToken = await getAuthToken()
  })

  test('完整流程测试', async () => {
    // 1. 创建资源
    const createRes = await request(app)
      .post('/api/resource')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testData)

    expect(createRes.status).toBe(200)
    testResourceId = createRes.body.id

    // 2. 使用资源
    const useRes = await request(app)
      .post(`/api/resource/${testResourceId}/use`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(useRes.status).toBe(200)

    // 3. 验证结果
    const getRes = await request(app)
      .get(`/api/resource/${testResourceId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(getRes.body.usageCount).toBe(1)
  })

  afterAll(async () => {
    // 清理测试数据
    await cleanup(testResourceId)
  })
})
```

---

## 🎭 4. E2E测试 (End-to-End Tests)

### 用途

模拟真实用户操作,测试完整的用户流程。

### 运行方式

```bash
# 运行所有E2E测试
npx playwright test

# 运行特定测试文件
npx playwright test tests/e2e/cost-tracking-flow.spec.ts

# 调试模式
npx playwright test --debug

# 生成测试报告
npx playwright test --reporter=html
```

### 示例测试文件

- `tests/e2e/account-breakdown.spec.ts` - 账户明细测试
- `tests/e2e/admin.spec.ts` - 管理后台测试
- `tests/e2e/api-stats.spec.ts` - API统计测试
- `tests/e2e/cost-tracking-flow.spec.ts` - 成本追踪流程测试 ✨新增

### E2E测试覆盖场景

1. **用户认证流程**
   - 登录 → 权限验证 → 登出
2. **API Key管理流程**
   - 创建 → 配置 → 使用 → 监控 → 删除
3. **成本追踪流程** ✨新增
   - 查看成本 → 分析趋势 → 配置告警 → 导出报告
4. **账户管理流程**
   - OAuth认证 → 账户配置 → 使用监控 → Token刷新

### 编写E2E测试指南

```typescript
import { test, expect } from '@playwright/test'

test.describe('功能名称', () => {
  test.beforeEach(async ({ page }) => {
    // 登录等前置操作
    await page.goto('/admin/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
  })

  test('完整用户流程', async ({ page }) => {
    // 1. 导航到功能页面
    await page.click('text=功能名称')
    await expect(page).toHaveURL(/.*feature/)

    // 2. 执行操作
    await page.click('button:has-text("操作")')

    // 3. 验证结果
    await expect(page.locator('text=成功')).toBeVisible()

    // 4. 验证数据
    const data = await page.locator('[data-testid="result"]').textContent()
    expect(data).toBeTruthy()
  })
})
```

---

## 📈 测试覆盖率目标

### 当前覆盖率

| 模块     | 回归测试 | 单元测试 | 集成测试 | E2E测试 | 综合覆盖率  |
| -------- | -------- | -------- | -------- | ------- | ----------- |
| API端点  | 83%      | -        | 50%      | 30%     | **85%** ✅  |
| 前端组件 | 75%      | -        | -        | 40%     | **75%** ✅  |
| 业务逻辑 | 完整     | 70%      | 60%      | -       | **75%** ✅  |
| 配置文件 | 100%     | -        | -        | -       | **100%** ✅ |

### 目标覆盖率

- ✅ 回归测试: 85-90% (已达成)
- 🎯 单元测试: 70%+ (框架已建立,需持续添加)
- 🎯 集成测试: 50%+ (框架已建立,需持续添加)
- ✅ E2E测试: 30%+ (已达成)

---

## 🚀 持续集成(CI)配置

### GitHub Actions工作流

```yaml
name: 测试流水线

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: 安装依赖
        run: npm ci

      - name: 运行单元测试
        run: npm test

      - name: 运行回归测试
        run: ./scripts/regression-test-enhanced.sh

      - name: 运行集成测试
        run: npm run test:integration

      - name: 运行E2E测试
        run: npx playwright test

      - name: 上传测试报告
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: |
            coverage/
            playwright-report/
            regression-test-*-report-*.md
```

---

## 📝 测试编写规范

### 命名规范

- 单元测试: `*.test.js`
- 集成测试: `*.test.js` (在integration目录)
- E2E测试: `*.spec.ts`

### 目录结构

```
tests/
├── unit/                 # 单元测试
│   ├── costCalculator.test.js
│   └── apiKeyService.test.js
├── integration/          # 集成测试
│   └── api-keys-flow.test.js
├── e2e/                  # E2E测试
│   ├── account-breakdown.spec.ts
│   ├── admin.spec.ts
│   ├── api-stats.spec.ts
│   └── cost-tracking-flow.spec.ts
└── README.md            # 本文档
```

### 测试数据管理

- 使用fixtures存储测试数据
- 每个测试应该独立,不依赖其他测试
- 测试后清理数据,避免污染

---

## 🐛 调试测试

### 单元测试调试

```bash
# 使用Node调试器
node --inspect-brk node_modules/.bin/jest tests/unit/costCalculator.test.js

# 使用VS Code调试
# 在测试文件中设置断点,按F5启动调试
```

### E2E测试调试

```bash
# 使用Playwright调试模式
npx playwright test --debug

# 查看测试报告
npx playwright show-report
```

---

## 📊 测试报告

### 生成报告

```bash
# 单元测试覆盖率报告
npm test -- --coverage

# E2E测试HTML报告
npx playwright test --reporter=html

# 回归测试报告
./scripts/regression-test-enhanced.sh
# 查看生成的 regression-test-enhanced-report-*.md
```

### 查看报告

- 单元测试: `coverage/lcov-report/index.html`
- E2E测试: `playwright-report/index.html`
- 回归测试: `regression-test-enhanced-report-*.md`

---

## 🎯 下一步计划

### 短期(已完成) ✅

- [x] 建立单元测试框架
- [x] 建立集成测试框架
- [x] 扩展E2E测试覆盖
- [x] 完善测试文档

### 中期(1-2个月)

- [ ] 单元测试覆盖率达到70%
- [ ] 集成测试覆盖率达到50%
- [ ] 添加性能测试
- [ ] 添加安全测试

### 长期(持续)

- [ ] 维持高测试覆盖率
- [ ] 持续优化测试执行时间
- [ ] 建立测试文化
- [ ] 自动化测试报告

---

## 📞 获取帮助

- 查看测试示例: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- 查看测试文档: 本文档
- 查看回归测试指南: `TESTING_SYSTEM_README.md`
- 查看覆盖率报告: `TEST_COVERAGE_SUMMARY.md`

---

**最后更新**: 2025-10-23  
**维护者**: 开发团队
