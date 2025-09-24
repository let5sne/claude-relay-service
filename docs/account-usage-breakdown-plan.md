# Account Usage Breakdown Feature Plan

## Objective
Provide per-account visibility into which API Keys contribute to usage (requests, tokens, cost) while balancing write-time performance and query latency.

## Milestones

1. **Data Model & Persistence**
   - Extend existing Redis accounting pipeline to record per-account, per-key totals (overall + daily + monthly).
   - Define key naming conventions and TTL/retention strategy.
   - Add optional sorted sets for top-N queries.

2. **Backend Services**
   - Implement Redis accessors for breakdown data with pagination & sorting.
   - Add admin routes (REST) to fetch breakdown by range (`daily|monthly|total`) and limit.
   - Provide script/cron hooks for historical backfill and cleanup.

3. **Frontend Integration**
   - Enhance `AccountsView` detail panel with "API Key 明细" tab showing Top-N keys and pagination.
   - Support sorting by requests/tokens/cost and display percentage contributions.
   - Handle empty states and loading indicators.

4. **Quality & Ops**
   - Update tests (unit/service + e2e smoke) covering aggregation and API responses.
   - Document Redis schema, config toggles, and data retention guidance.
   - Monitor performance (metrics/logging) to ensure negligible overhead.

## Risks & Mitigations
- **Redis growth**: limit record count per account, periodic cleanup, optional retention TTL.
- **Write latency**: batch pipelines and fall back to async worker if needed.
- **Legacy data**: provide backfill script and guard routes when data missing.

## Deliverables
- Code changes (backend + frontend) with tests.
- Update to docs/README for new feature usage.
- Migration/backfill script.

## Implementation Notes
- Redis tracking: hashes `account_usage:key:(total|daily|monthly)` and sorted sets for quick Top-N queries.
- Admin API: `GET /admin/accounts/:accountId/usage-breakdown` with range & pagination parameters.
- Frontend: Accounts view now lazy-loads API Key breakdown per account with range toggle and load-more pagination.
