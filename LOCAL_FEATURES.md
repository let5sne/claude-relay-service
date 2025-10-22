# 本地特有功能清单

> **重要**: 此文件记录了本地开发的、不在上游仓库中的功能。在同步上游更新时需要特别注意这些功能是否被覆盖。

**最后更新**: 2025-10-23

---

## 📊 统计分析模块

### 1. API Key 调用明细分析

**文件位置**:

- 后端: `src/routes/admin.js` (行 4581-4697)
- 前端: `web/admin-spa/src/components/analytics/ApiKeyBreakdownAnalysis.vue`

**API端点**:

- `GET /admin/accounts/:accountId/usage-breakdown` - 获取账户下所有API Key的使用明细
- `GET /admin/api-keys/:keyId/usage-details` - 获取单个API Key的详细使用记录

**功能描述**:

- 按服务账户查看所有绑定的API Keys使用情况
- 支持时间范围过滤（今日/7天/30天/全部）
- 展示聚合统计：请求数、Token数、成本等
- 可展开查看每个API Key的详细请求记录

**关键代码特征**:

```javascript
// API Key查找逻辑 - 按服务账户ID过滤
const accountApiKeys = allApiKeys.filter(
  (key) =>
    key.claudeAccountId === accountId ||
    key.claudeConsoleAccountId === accountId ||
    key.openaiAccountId === accountId ||
    // ... 其他账户类型
)
```

**测试方法**:

1. 登录管理后台
2. 进入"统计分析" > "API Key 调用明细"
3. 选择一个有绑定API Key的账户（如"端"）
4. 验证是否显示API Key列表和统计数据
5. 点击展开按钮，验证详细记录是否加载

---

## 🔐 Private分支保护机制

**文件位置**:

- `.husky/pre-push`
- `scripts/sync-from-upstream.sh`
- `PRIVATE_BRANCH_WORKFLOW.md`

**功能描述**:

- Git pre-push hook自动阻止推送private分支
- 安全的上游同步脚本
- 完整的工作流文档

**关键特性**:

- 防止意外推送私有商业功能
- 需要 `--no-verify` 标志才能推送private分支

---

## 🧪 回归测试系统

**文件位置**:

- `scripts/regression-test-enhanced.sh` (增强版,推荐使用)
- `scripts/regression-test.sh` (基础版)

**功能描述**:

- 自动检测关键API端点是否存在 (76个端点)
- 验证前端组件完整性 (18个组件)
- 检查业务逻辑代码 (20个逻辑)
- 生成详细测试报告
- 支持三种测试模式 (Quick/Normal/Full)

**测试覆盖**:

- ✅ API端点完整性 (57.1%覆盖率)
- ✅ 前端组件文件 (37.5%覆盖率)
- ✅ 关键代码模式 (业务逻辑)
- ✅ 配置文件检查 (100%覆盖率)
- ✅ 数据结构警告 (潜在问题检测)

**测试模式**:

| 模式   | 测试数量 | 覆盖率 | 执行时间 | 使用场景           |
| ------ | -------- | ------ | -------- | ------------------ |
| Quick  | 94个     | ~40%   | 1-2分钟  | 日常提交前快速验证 |
| Normal | 114个    | ~60%   | 2-3分钟  | 上游同步后标准检查 |
| Full   | 132个    | ~75%   | 3-5分钟  | 发布前完整验证     |

**使用方法**:

```bash
# 快速测试 (推荐日常使用)
./scripts/regression-test-enhanced.sh --quick

# 标准测试 (推荐上游同步后)
./scripts/regression-test-enhanced.sh

# 完整测试 (推荐发布前)
./scripts/regression-test-enhanced.sh --full
```

---

## 📝 维护指南

### 添加新功能时

1. **在此文件中记录**:
   - 功能名称和描述
   - 相关文件位置
   - API端点（如有）
   - 关键代码特征
   - 测试方法

2. **更新回归测试**:
   - 在 `scripts/regression-test-enhanced.sh` 中添加测试用例
   - 确保新功能可以被自动检测
   - 根据功能重要性选择合适的测试模式

3. **提交到private分支**:
   ```bash
   git add .
   git commit -m "feat: 添加新功能 - [功能名称]"
   ```

### 同步上游更新时

1. **使用安全同步脚本**:

   ```bash
   ./scripts/sync-from-upstream.sh
   ```

2. **脚本会自动**:
   - ✅ 检查工作区状态
   - ✅ 显示即将合并的更新
   - ✅ 创建备份分支
   - ✅ 运行回归测试
   - ✅ 生成变更报告

3. **如果回归测试失败**:
   - 查看测试报告了解缺失的功能
   - 使用备份分支恢复代码
   - 重新实现缺失的功能

4. **回滚命令**（如需要）:

   ```bash
   # 查看备份分支
   git branch | grep backup

   # 回滚到备份
   git checkout main && git reset --hard backup-main-YYYYMMDD-HHMMSS
   git checkout private && git reset --hard backup-private-YYYYMMDD-HHMMSS
   ```

---

## 🔍 快速检查清单

在每次上游同步后，手动验证以下功能：

- [ ] 管理后台可以正常登录
- [ ] 统计分析 > API Key 调用明细 可以正常显示
- [ ] 选择账户后可以看到API Key列表
- [ ] 展开API Key可以看到详细记录
- [ ] 其他自定义功能正常工作

---

## 📞 故障排查

### 问题：同步后功能丢失

**原因**: 上游更新覆盖了本地修改

**解决方案**:

1. 查看同步报告中的变更文件列表
2. 使用备份分支恢复代码：
   ```bash
   git show backup-private-YYYYMMDD-HHMMSS:src/routes/admin.js > admin.js.backup
   # 对比差异并恢复需要的代码
   ```
3. 重新运行回归测试确认修复

### 问题：回归测试失败

**原因**: 关键代码或文件缺失

**解决方案**:

1. 查看测试报告了解具体失败项
2. 根据本文档重新实现缺失功能
3. 参考备份分支中的代码

---

## 📚 相关文档

- [Private分支工作流](./PRIVATE_BRANCH_WORKFLOW.md)
- [测试体系使用指南](./TESTING_SYSTEM_README.md)
- [测试覆盖率总结](./TEST_COVERAGE_SUMMARY.md)
- [上游同步完整指南](./UPSTREAM_SYNC_GUIDE.md)
- [增强版回归测试脚本](./scripts/regression-test-enhanced.sh)
- [基础版回归测试脚本](./scripts/regression-test.sh)
- [上游同步脚本](./scripts/sync-from-upstream.sh)

---

**维护者**: 请在添加新功能时及时更新此文档！
