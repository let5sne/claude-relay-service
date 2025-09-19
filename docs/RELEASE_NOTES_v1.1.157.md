# v1.1.157 Release Notes (双语)

English
- Group column: Adds a new “Group” column next to “Name” on desktop; mobile cards also show group badges.
- Correct usage stats with filters: Platform type, today’s usage, and session-window data remain visible when applying both Group and Platform filters.
- Consistent group info: Preloads and caches account–group membership so `groupInfos` is available for all platforms; displays “Ungrouped” as a safe fallback.
- Unified requests: Centralizes platform request configuration to avoid missing calls under specific filters.
- Minor layout and copy improvements.

Upgrade
- Backend: No change required.
- Frontend: If you bundle the Admin SPA, rebuild and deploy `web/admin-spa/dist`.

Files
- `web/admin-spa/src/views/AccountsView.vue`

Chinese (中文)
- 分组列: 桌面表格在“名称”右侧新增“分组”；移动端卡片显示分组徽标。
- 筛选修复: 同时应用“分组 + 平台”筛选时，平台类型、今日使用、会话窗口等数据保持可见。
- 数据一致性: 预加载并缓存账户-分组关系，保证所有平台都有 `groupInfos`；未分组时显示“未分组”。
- 请求统一: 统一平台请求配置，避免在特定筛选下遗漏请求导致的数据缺失。
- 细节优化：布局与部分提示文案优化。

升级
- 后端：无需变更。
- 前端：如需构建 Admin SPA，请在 `web/admin-spa` 执行 `npm ci && npm run build` 并部署 `dist/`。

版本
- VERSION: 1.1.157
- Tag: v1.1.157
