-- 0002_cost_efficiency.sql
-- 扩展 usage_records 结构并建立账户性价比视图

ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS response_latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (response_latency_ms >= 0),
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS retries SMALLINT NOT NULL DEFAULT 0 CHECK (retries >= 0),
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_usage_records_account_status_date
  ON usage_records(account_id, request_status, usage_date);

CREATE INDEX IF NOT EXISTS idx_usage_records_account_latency
  ON usage_records(account_id, response_latency_ms);

CREATE OR REPLACE VIEW account_efficiency_daily AS
SELECT
  account_id,
  usage_date,
  SUM(requests) AS total_requests,
  SUM(total_tokens) AS total_tokens,
  SUM(total_cost) AS total_cost,
  SUM(CASE WHEN request_status = 'success' THEN requests ELSE 0 END) AS success_requests,
  SUM(CASE WHEN request_status <> 'success' THEN requests ELSE 0 END) AS error_requests,
  AVG(NULLIF(response_latency_ms, 0)) AS avg_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(response_latency_ms, 0)) AS p95_latency_ms
FROM usage_records
GROUP BY account_id, usage_date;

CREATE OR REPLACE VIEW account_efficiency_totals AS
SELECT
  account_id,
  SUM(requests) AS total_requests,
  SUM(total_tokens) AS total_tokens,
  SUM(total_cost) AS total_cost,
  SUM(CASE WHEN request_status = 'success' THEN requests ELSE 0 END) AS success_requests,
  SUM(CASE WHEN request_status <> 'success' THEN requests ELSE 0 END) AS error_requests,
  AVG(NULLIF(response_latency_ms, 0)) AS avg_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(response_latency_ms, 0)) AS p95_latency_ms
FROM usage_records
GROUP BY account_id;
