## 贡献指南

### 分支策略
- 常规开发：从 `dev` 切 `feature/*`，完成后 PR → `dev`。
- 紧急修复：从 `main` 或发布标签切 `hotfix/*`，合并回 `main` 并回灌 `dev`。

### 提交信息（Conventional Commits）
- 模板：`.github/commit-message-template.txt`
- 本地启用模板：
  ```bash
  git config commit.template .github/commit-message-template.txt
  ```
- 格式：`<type>(<scope>): <subject>`（subject 使用祈使句，非首字母大写，结尾不加句号）
- type：feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert
- scope：api / web / cli / scripts / services / routes / utils / config

### PR 规范
- 使用 PR 模板，标题遵循 Conventional Commits（工作流会自动校验）。
- 勾选验证项，附上冒烟验证说明与影响面。

### 本地质量检查
```bash
npm run lint:check
npm test        # 如有测试
```

