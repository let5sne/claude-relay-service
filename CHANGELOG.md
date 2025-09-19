Changelog
=========

1.1.157 — 2025-09-19
--------------------
- Add “Group” column to Accounts view (desktop) next to “Name”, and show group badges on mobile cards.
- Fix missing data (platform, today’s usage, session window) when combining Group filter with Platform filter.
- Preload and cache account–group membership to ensure consistent `groupInfos` for all platforms; show “Ungrouped” as a safe fallback.
- Unify platform request configuration to avoid gaps when a platform is selected.
- Minor layout and copy tweaks in Accounts view.

Internal refs: `web/admin-spa/src/views/AccountsView.vue`
