-- 0003_cost_tracking.sql
-- 成本追踪相关表结构与字段扩展

BEGIN;

-- 账户成本配置
CREATE TABLE IF NOT EXISTS account_cost_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  billing_type TEXT NOT NULL DEFAULT 'standard',
  cost_tracking_mode TEXT NOT NULL DEFAULT 'standard',
  currency TEXT NOT NULL DEFAULT 'USD',
  derived_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  relative_efficiency NUMERIC(10,4),
  baseline_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  confidence_level TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_cost_profiles_mode
  ON account_cost_profiles(cost_tracking_mode);

DROP TRIGGER IF EXISTS trg_account_cost_profiles_updated_at ON account_cost_profiles;
CREATE TRIGGER trg_account_cost_profiles_updated_at
BEFORE UPDATE ON account_cost_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 账单信息
CREATE TABLE IF NOT EXISTS account_bills (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_amount NUMERIC(20,8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  total_units NUMERIC(20,8),
  unit_name TEXT,
  exchange_rate NUMERIC(20,8),
  confidence_level TEXT,
  data_source TEXT,
  document_url TEXT,
  notes TEXT,
  created_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_bills_account_period
  ON account_bills(account_id, billing_period_start, billing_period_end);

DROP TRIGGER IF EXISTS trg_account_bills_updated_at ON account_bills;
CREATE TRIGGER trg_account_bills_updated_at
BEFORE UPDATE ON account_bills
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 积分/额度余额快照
CREATE TABLE IF NOT EXISTS account_balance_snapshots (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL,
  balance_units NUMERIC(20,8) NOT NULL,
  unit_name TEXT,
  currency TEXT,
  confidence_level TEXT,
  data_source TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_balance_snapshots_account_time
  ON account_balance_snapshots(account_id, captured_at DESC);

-- usage_records 字段扩展
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS cost_source TEXT,
  ADD COLUMN IF NOT EXISTS billing_period VARCHAR(10),
  ADD COLUMN IF NOT EXISTS confidence_level TEXT;

CREATE INDEX IF NOT EXISTS idx_usage_records_billing_period
  ON usage_records(billing_period);

CREATE INDEX IF NOT EXISTS idx_usage_records_cost_source
  ON usage_records(cost_source);

COMMIT;
