-- 0005_fix_account_id_type.sql
-- 修复账户 ID 类型：从 UUID 改为 TEXT，支持非 UUID 格式的账户 ID
-- 例如: claude_console_account:88code-gac, gemini_account:xxx 等

-- 0. 删除依赖的视图
DROP VIEW IF EXISTS v_account_cost_accuracy CASCADE;
DROP VIEW IF EXISTS v_daily_usage_summary CASCADE;
DROP VIEW IF EXISTS v_api_key_usage_summary CASCADE;
DROP VIEW IF EXISTS account_efficiency_daily CASCADE;
DROP VIEW IF EXISTS account_efficiency_summary CASCADE;
DROP VIEW IF EXISTS account_efficiency_totals CASCADE;

-- 1. 删除外键约束
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_account_id_fkey;
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS usage_records_api_key_id_fkey;
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_account_id_fkey;
ALTER TABLE account_cost_profiles DROP CONSTRAINT IF EXISTS account_cost_profiles_account_id_fkey;
ALTER TABLE account_cost_profiles DROP CONSTRAINT IF EXISTS account_cost_profiles_baseline_account_id_fkey;
ALTER TABLE account_bills DROP CONSTRAINT IF EXISTS account_bills_account_id_fkey;
ALTER TABLE account_balance_snapshots DROP CONSTRAINT IF EXISTS account_balance_snapshots_account_id_fkey;
ALTER TABLE cost_validation_history DROP CONSTRAINT IF EXISTS cost_validation_history_account_id_fkey;
ALTER TABLE pricing_inference_history DROP CONSTRAINT IF EXISTS pricing_inference_history_account_id_fkey;

-- 2. 修改 accounts 表的 id 字段类型
ALTER TABLE accounts ALTER COLUMN id TYPE TEXT;

-- 3. 修改关联表的 account_id 字段类型
ALTER TABLE usage_records ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE api_keys ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE account_cost_profiles ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE account_cost_profiles ALTER COLUMN baseline_account_id TYPE TEXT;
ALTER TABLE account_bills ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE account_balance_snapshots ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE cost_validation_history ALTER COLUMN account_id TYPE TEXT;
ALTER TABLE pricing_inference_history ALTER COLUMN account_id TYPE TEXT;

-- 4. 修改 api_keys 表的 id 字段类型（API Key ID 也可能不是 UUID）
ALTER TABLE api_keys ALTER COLUMN id TYPE TEXT;
ALTER TABLE usage_records ALTER COLUMN api_key_id TYPE TEXT;

-- 5. 重新创建外键约束
ALTER TABLE usage_records 
  ADD CONSTRAINT usage_records_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE usage_records
  ADD CONSTRAINT usage_records_api_key_id_fkey
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;

ALTER TABLE api_keys 
  ADD CONSTRAINT api_keys_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE account_cost_profiles 
  ADD CONSTRAINT account_cost_profiles_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE account_bills 
  ADD CONSTRAINT account_bills_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE account_balance_snapshots 
  ADD CONSTRAINT account_balance_snapshots_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE account_cost_profiles
  ADD CONSTRAINT account_cost_profiles_baseline_account_id_fkey
  FOREIGN KEY (baseline_account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE cost_validation_history
  ADD CONSTRAINT cost_validation_history_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE pricing_inference_history
  ADD CONSTRAINT pricing_inference_history_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- 6. 重新创建视图（如果需要）
CREATE OR REPLACE VIEW v_account_cost_accuracy AS
SELECT 
  acp.account_id,
  a.name as account_name,
  acp.billing_type,
  acp.confidence_level,
  acp.verification_status,
  acp.last_verified_at
FROM account_cost_profiles acp
LEFT JOIN accounts a ON a.id = acp.account_id;

-- 7. 记录迁移
INSERT INTO schema_migrations (name, applied_at)
VALUES ('0005_fix_account_id_type', NOW())
ON CONFLICT (name) DO NOTHING;

-- 完成
COMMENT ON TABLE accounts IS '账户表 - 支持各种格式的账户 ID（UUID 或字符串）';
