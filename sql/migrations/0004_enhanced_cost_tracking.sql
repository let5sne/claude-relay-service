-- 0004_enhanced_cost_tracking.sql
-- 增强成本追踪功能,支持不透明计价方式

BEGIN;

-- ============================================================================
-- 1. 扩展 account_cost_profiles 表
-- ============================================================================

-- 计价公式配置 (支持复杂的混合计费)
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS pricing_formula JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN account_cost_profiles.pricing_formula IS 
  '计价公式配置,支持混合计费模式。示例: {"type":"composite","components":[{"type":"per_request","rate":0.002,"weight":0.3}]}';

-- 阶梯定价配置
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS tiered_pricing JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN account_cost_profiles.tiered_pricing IS 
  '阶梯定价配置数组。示例: [{"minTokens":0,"maxTokens":1000000,"costPerMillion":3.0}]';

-- 固定费用配置
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS fixed_costs JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN account_cost_profiles.fixed_costs IS 
  '固定费用配置。示例: {"monthly_base":50.0,"api_access_fee":10.0}';

-- 积分换算配置
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS point_conversion JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN account_cost_profiles.point_conversion IS 
  '积分换算配置。示例: {"pointsPerRequest":1,"pointsPerToken":0.001,"costPerPoint":0.01}';

-- 历史推导的计价参数
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS inferred_rates JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN account_cost_profiles.inferred_rates IS 
  '基于历史账单自动推导的计价参数';

-- 推导质量指标
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS inference_quality JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN account_cost_profiles.inference_quality IS 
  '推导质量指标。示例: {"score":0.92,"r_squared":0.89,"mean_absolute_error":0.05}';

-- 最后验证时间
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN account_cost_profiles.last_verified_at IS 
  '最后一次验证成本准确性的时间';

-- 验证状态
ALTER TABLE account_cost_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT;

COMMENT ON COLUMN account_cost_profiles.verification_status IS 
  '验证状态: excellent(<5%偏差), good(5-10%), acceptable(10-20%), poor(>20%), unverified';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_account_cost_profiles_verification_status
  ON account_cost_profiles(verification_status);

CREATE INDEX IF NOT EXISTS idx_account_cost_profiles_last_verified
  ON account_cost_profiles(last_verified_at DESC);

-- ============================================================================
-- 2. 扩展 usage_records 表
-- ============================================================================

-- 计算方法标识
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS calculation_method TEXT;

COMMENT ON COLUMN usage_records.calculation_method IS 
  '成本计算方法: standard, tiered_pricing, point_based, hybrid, estimated';

-- 计算详情 (记录完整的计算过程)
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS calculation_details JSONB;

COMMENT ON COLUMN usage_records.calculation_details IS 
  '详细的成本计算信息,包括定价数据、token分解、成本分解等';

-- 验证状态
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN usage_records.verified IS 
  '该记录的成本是否已通过账单验证';

-- 验证时间
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN usage_records.verified_at IS 
  '成本验证的时间';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_usage_records_calculation_method
  ON usage_records(calculation_method);

CREATE INDEX IF NOT EXISTS idx_usage_records_verified
  ON usage_records(verified) WHERE verified = TRUE;

CREATE INDEX IF NOT EXISTS idx_usage_records_account_billing_period
  ON usage_records(account_id, billing_period) WHERE billing_period IS NOT NULL;

-- ============================================================================
-- 3. 扩展 account_bills 表
-- ============================================================================

-- 验证结果
ALTER TABLE account_bills
  ADD COLUMN IF NOT EXISTS validation_result JSONB;

COMMENT ON COLUMN account_bills.validation_result IS 
  '账单验证结果。示例: {"calculatedCost":1234.56,"deviation":2.3,"status":"excellent"}';

-- 是否已应用于成本验证
ALTER TABLE account_bills
  ADD COLUMN IF NOT EXISTS applied_to_validation BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN account_bills.applied_to_validation IS 
  '该账单是否已用于验证和调整成本计算';

-- 应用时间
ALTER TABLE account_bills
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_account_bills_applied
  ON account_bills(applied_to_validation, account_id);

-- ============================================================================
-- 4. 创建成本验证历史表
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_validation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  billing_period VARCHAR(10) NOT NULL,
  
  -- 账单数据
  bill_amount NUMERIC(20,8) NOT NULL,
  bill_currency TEXT NOT NULL DEFAULT 'USD',
  
  -- 计算数据
  calculated_cost NUMERIC(20,8) NOT NULL,
  total_requests INTEGER NOT NULL,
  total_tokens BIGINT NOT NULL,
  
  -- 偏差分析
  deviation_amount NUMERIC(20,8) NOT NULL,
  deviation_percent NUMERIC(10,4) NOT NULL,
  validation_status TEXT NOT NULL,
  
  -- 调整建议
  adjustment_needed BOOLEAN DEFAULT FALSE,
  suggested_adjustments JSONB,
  
  -- 元数据
  validated_by TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cost_validation_history IS 
  '成本验证历史记录,用于追踪成本计算准确性';

CREATE INDEX IF NOT EXISTS idx_cost_validation_history_account_period
  ON cost_validation_history(account_id, billing_period DESC);

CREATE INDEX IF NOT EXISTS idx_cost_validation_history_status
  ON cost_validation_history(validation_status);

CREATE INDEX IF NOT EXISTS idx_cost_validation_history_created
  ON cost_validation_history(created_at DESC);

-- ============================================================================
-- 5. 创建计价推导历史表
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_inference_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- 推导结果
  inferred_billing_type TEXT NOT NULL,
  inferred_rates JSONB NOT NULL,
  
  -- 质量指标
  quality_score NUMERIC(5,4),
  confidence_level TEXT,
  r_squared NUMERIC(5,4),
  mean_absolute_error NUMERIC(10,6),
  
  -- 数据来源
  bills_analyzed INTEGER NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- 是否已应用
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  applied_by TEXT,
  
  -- 元数据
  inference_method TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pricing_inference_history IS 
  '计价参数推导历史,记录自动推导的计价配置';

CREATE INDEX IF NOT EXISTS idx_pricing_inference_history_account
  ON pricing_inference_history(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_inference_history_applied
  ON pricing_inference_history(applied) WHERE applied = TRUE;

-- ============================================================================
-- 6. 创建视图: 账户成本准确性概览
-- ============================================================================

CREATE OR REPLACE VIEW v_account_cost_accuracy AS
SELECT 
  a.id AS account_id,
  a.name AS account_name,
  acp.billing_type,
  acp.cost_tracking_mode,
  acp.confidence_level,
  acp.verification_status,
  acp.last_verified_at,
  
  -- 最近验证结果
  (
    SELECT jsonb_build_object(
      'billing_period', cvh.billing_period,
      'deviation_percent', cvh.deviation_percent,
      'validation_status', cvh.validation_status,
      'validated_at', cvh.created_at
    )
    FROM cost_validation_history cvh
    WHERE cvh.account_id = a.id
    ORDER BY cvh.created_at DESC
    LIMIT 1
  ) AS latest_validation,
  
  -- 平均偏差 (最近6个月)
  (
    SELECT AVG(cvh.deviation_percent)
    FROM cost_validation_history cvh
    WHERE cvh.account_id = a.id
      AND cvh.created_at >= NOW() - INTERVAL '6 months'
  ) AS avg_deviation_6m,
  
  -- 验证次数
  (
    SELECT COUNT(*)
    FROM cost_validation_history cvh
    WHERE cvh.account_id = a.id
  ) AS validation_count,
  
  -- 最近推导
  (
    SELECT jsonb_build_object(
      'billing_type', pih.inferred_billing_type,
      'quality_score', pih.quality_score,
      'confidence_level', pih.confidence_level,
      'created_at', pih.created_at,
      'applied', pih.applied
    )
    FROM pricing_inference_history pih
    WHERE pih.account_id = a.id
    ORDER BY pih.created_at DESC
    LIMIT 1
  ) AS latest_inference

FROM accounts a
LEFT JOIN account_cost_profiles acp ON a.id = acp.account_id
WHERE a.status = 'active';

COMMENT ON VIEW v_account_cost_accuracy IS 
  '账户成本准确性概览,汇总验证和推导信息';

-- ============================================================================
-- 7. 创建辅助函数
-- ============================================================================

-- 计算账单周期的成本偏差
CREATE OR REPLACE FUNCTION calculate_cost_deviation(
  p_account_id UUID,
  p_billing_period VARCHAR(10)
)
RETURNS TABLE(
  bill_amount NUMERIC,
  calculated_cost NUMERIC,
  deviation_amount NUMERIC,
  deviation_percent NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_bill_amount NUMERIC;
  v_calculated_cost NUMERIC;
  v_deviation_amount NUMERIC;
  v_deviation_percent NUMERIC;
  v_status TEXT;
BEGIN
  -- 获取账单金额
  SELECT ab.total_amount INTO v_bill_amount
  FROM account_bills ab
  WHERE ab.account_id = p_account_id
    AND TO_CHAR(ab.billing_period_start, 'YYYY-MM') = p_billing_period
  LIMIT 1;
  
  IF v_bill_amount IS NULL THEN
    RAISE EXCEPTION 'No bill found for account % in period %', p_account_id, p_billing_period;
  END IF;
  
  -- 计算该周期的总成本
  SELECT COALESCE(SUM(COALESCE(ur.actual_cost, ur.total_cost)), 0) INTO v_calculated_cost
  FROM usage_records ur
  WHERE ur.account_id = p_account_id
    AND ur.billing_period = p_billing_period;
  
  -- 计算偏差
  v_deviation_amount := ABS(v_bill_amount - v_calculated_cost);
  v_deviation_percent := CASE 
    WHEN v_bill_amount > 0 THEN (v_deviation_amount / v_bill_amount) * 100
    ELSE 0
  END;
  
  -- 确定状态
  v_status := CASE
    WHEN v_deviation_percent < 5 THEN 'excellent'
    WHEN v_deviation_percent < 10 THEN 'good'
    WHEN v_deviation_percent < 20 THEN 'acceptable'
    ELSE 'poor'
  END;
  
  RETURN QUERY SELECT 
    v_bill_amount,
    v_calculated_cost,
    v_deviation_amount,
    v_deviation_percent,
    v_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_cost_deviation IS 
  '计算指定账户和账单周期的成本偏差';

-- ============================================================================
-- 8. 数据迁移
-- ============================================================================

-- 为现有的 usage_records 设置默认 calculation_method
UPDATE usage_records
SET calculation_method = CASE
  WHEN cost_source = 'manual' THEN 'manual_billing'
  WHEN cost_source = 'estimated' THEN 'estimated'
  ELSE 'standard'
END
WHERE calculation_method IS NULL;

-- 为现有的 account_cost_profiles 设置默认 verification_status
UPDATE account_cost_profiles
SET verification_status = 'unverified'
WHERE verification_status IS NULL;

COMMIT;
