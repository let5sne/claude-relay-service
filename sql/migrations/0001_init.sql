-- 0001_init.sql
-- 初始 PostgreSQL 架构：账户、API Key、使用记录

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic',
  platform TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 50,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_type_status ON accounts(type, status);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  hashed_key TEXT,
  daily_cost_limit NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_cost_limit NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_cost_accumulated NUMERIC(20,8) NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_deleted_at ON api_keys(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_records (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_hour SMALLINT NOT NULL DEFAULT EXTRACT(HOUR FROM NOW()),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  model TEXT NOT NULL DEFAULT 'unknown',
  requests INTEGER NOT NULL DEFAULT 1 CHECK (requests >= 0),
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cache_create_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_create_tokens >= 0),
  cache_read_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
  ephemeral_5m_tokens BIGINT NOT NULL DEFAULT 0 CHECK (ephemeral_5m_tokens >= 0),
  ephemeral_1h_tokens BIGINT NOT NULL DEFAULT 0 CHECK (ephemeral_1h_tokens >= 0),
  total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  total_cost NUMERIC(20,8) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  cost_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_records_usage_date ON usage_records(usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_records_account_date ON usage_records(account_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_records_api_key_date ON usage_records(api_key_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_records_model_date ON usage_records(model, usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_records_occurred_at ON usage_records(occurred_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON api_keys;
CREATE TRIGGER trg_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
