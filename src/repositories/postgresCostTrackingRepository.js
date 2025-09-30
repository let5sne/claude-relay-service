const db = require('../models/db')
const logger = require('../utils/logger')

async function getAccountCostProfile(accountId) {
  if (!db.isEnabled()) {
    return null
  }

  if (!accountId) {
    return null
  }

  const result = await db.query(
    `
      SELECT
        account_id,
        billing_type,
        cost_tracking_mode,
        currency,
        derived_rates,
        relative_efficiency,
        baseline_account_id,
        confidence_level,
        notes,
        metadata,
        pricing_formula,
        tiered_pricing,
        fixed_costs,
        point_conversion,
        inferred_rates,
        inference_quality,
        last_verified_at,
        verification_status,
        created_at,
        updated_at
      FROM account_cost_profiles
      WHERE account_id = $1
    `,
    [accountId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    accountId: row.account_id,
    billingType: row.billing_type,
    costTrackingMode: row.cost_tracking_mode,
    currency: row.currency,
    derivedRates: row.derived_rates || {},
    relativeEfficiency: row.relative_efficiency,
    baselineAccountId: row.baseline_account_id,
    confidenceLevel: row.confidence_level,
    notes: row.notes,
    metadata: row.metadata || {},
    pricingFormula: row.pricing_formula || {},
    tieredPricing: row.tiered_pricing || [],
    fixedCosts: row.fixed_costs || {},
    pointConversion: row.point_conversion || {},
    inferredRates: row.inferred_rates || {},
    inferenceQuality: row.inference_quality || {},
    lastVerifiedAt: row.last_verified_at,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function upsertAccountCostProfile(profile) {
  if (!db.isEnabled()) {
    logger.debug('PostgreSQL disabled, skip upsertAccountCostProfile')
    return null
  }

  const {
    accountId,
    billingType = 'standard',
    costTrackingMode = 'standard',
    currency = 'USD',
    derivedRates = {},
    relativeEfficiency = null,
    baselineAccountId = null,
    confidenceLevel = null,
    notes = null,
    metadata = {},
    pricingFormula = {},
    tieredPricing = [],
    fixedCosts = {},
    pointConversion = {},
    inferredRates = {},
    inferenceQuality = {},
    lastVerifiedAt = null,
    verificationStatus = null
  } = profile

  if (!accountId) {
    throw new Error('accountId is required when upserting cost profile')
  }

  const result = await db.query(
    `
      INSERT INTO account_cost_profiles (
        account_id,
        billing_type,
        cost_tracking_mode,
        currency,
        derived_rates,
        relative_efficiency,
        baseline_account_id,
        confidence_level,
        notes,
        metadata,
        pricing_formula,
        tiered_pricing,
        fixed_costs,
        point_conversion,
        inferred_rates,
        inference_quality,
        last_verified_at,
        verification_status
      ) VALUES (
        $1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb), $6, $7, $8, $9, COALESCE($10::jsonb, '{}'::jsonb),
        COALESCE($11::jsonb, '{}'::jsonb), COALESCE($12::jsonb, '[]'::jsonb), COALESCE($13::jsonb, '{}'::jsonb),
        COALESCE($14::jsonb, '{}'::jsonb), COALESCE($15::jsonb, '{}'::jsonb), COALESCE($16::jsonb, '{}'::jsonb),
        $17, $18
      )
      ON CONFLICT (account_id) DO UPDATE SET
        billing_type = COALESCE(EXCLUDED.billing_type, account_cost_profiles.billing_type),
        cost_tracking_mode = COALESCE(EXCLUDED.cost_tracking_mode, account_cost_profiles.cost_tracking_mode),
        currency = COALESCE(EXCLUDED.currency, account_cost_profiles.currency),
        derived_rates = COALESCE(EXCLUDED.derived_rates, account_cost_profiles.derived_rates),
        relative_efficiency = COALESCE(EXCLUDED.relative_efficiency, account_cost_profiles.relative_efficiency),
        baseline_account_id = COALESCE(EXCLUDED.baseline_account_id, account_cost_profiles.baseline_account_id),
        confidence_level = COALESCE(EXCLUDED.confidence_level, account_cost_profiles.confidence_level),
        notes = COALESCE(EXCLUDED.notes, account_cost_profiles.notes),
        metadata = account_cost_profiles.metadata || EXCLUDED.metadata,
        pricing_formula = COALESCE(EXCLUDED.pricing_formula, account_cost_profiles.pricing_formula),
        tiered_pricing = COALESCE(EXCLUDED.tiered_pricing, account_cost_profiles.tiered_pricing),
        fixed_costs = COALESCE(EXCLUDED.fixed_costs, account_cost_profiles.fixed_costs),
        point_conversion = COALESCE(EXCLUDED.point_conversion, account_cost_profiles.point_conversion),
        inferred_rates = COALESCE(EXCLUDED.inferred_rates, account_cost_profiles.inferred_rates),
        inference_quality = COALESCE(EXCLUDED.inference_quality, account_cost_profiles.inference_quality),
        last_verified_at = COALESCE(EXCLUDED.last_verified_at, account_cost_profiles.last_verified_at),
        verification_status = COALESCE(EXCLUDED.verification_status, account_cost_profiles.verification_status),
        updated_at = NOW()
      RETURNING *
    `,
    [
      accountId,
      billingType,
      costTrackingMode,
      currency,
      JSON.stringify(derivedRates),
      relativeEfficiency,
      baselineAccountId,
      confidenceLevel,
      notes,
      JSON.stringify(metadata),
      JSON.stringify(pricingFormula),
      JSON.stringify(tieredPricing),
      JSON.stringify(fixedCosts),
      JSON.stringify(pointConversion),
      JSON.stringify(inferredRates),
      JSON.stringify(inferenceQuality),
      lastVerifiedAt,
      verificationStatus
    ]
  )

  const row = result.rows[0]
  return {
    accountId: row.account_id,
    billingType: row.billing_type,
    costTrackingMode: row.cost_tracking_mode,
    currency: row.currency,
    derivedRates: row.derived_rates || {},
    relativeEfficiency: row.relative_efficiency,
    baselineAccountId: row.baseline_account_id,
    confidenceLevel: row.confidence_level,
    notes: row.notes,
    metadata: row.metadata || {},
    pricingFormula: row.pricing_formula || {},
    tieredPricing: row.tiered_pricing || [],
    fixedCosts: row.fixed_costs || {},
    pointConversion: row.point_conversion || {},
    inferredRates: row.inferred_rates || {},
    inferenceQuality: row.inference_quality || {},
    lastVerifiedAt: row.last_verified_at,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function listAccountBills(accountId, options = {}) {
  if (!db.isEnabled()) {
    return []
  }

  const { limit = 20, offset = 0 } = options
  const result = await db.query(
    `
      SELECT
        id,
        account_id,
        billing_period_start,
        billing_period_end,
        total_amount,
        currency,
        total_units,
        unit_name,
        exchange_rate,
        confidence_level,
        data_source,
        document_url,
        notes,
        created_by,
        metadata,
        created_at,
        updated_at
      FROM account_bills
      WHERE account_id = $1
      ORDER BY billing_period_start DESC
      LIMIT $2 OFFSET $3
    `,
    [accountId, Math.max(1, Math.min(100, limit)), Math.max(0, offset)]
  )

  return result.rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    billingPeriodStart: row.billing_period_start,
    billingPeriodEnd: row.billing_period_end,
    totalAmount: row.total_amount,
    currency: row.currency,
    totalUnits: row.total_units,
    unitName: row.unit_name,
    exchangeRate: row.exchange_rate,
    confidenceLevel: row.confidence_level,
    dataSource: row.data_source,
    documentUrl: row.document_url,
    notes: row.notes,
    createdBy: row.created_by,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

async function createAccountBill(bill) {
  if (!db.isEnabled()) {
    return null
  }

  const {
    id,
    accountId,
    billingPeriodStart,
    billingPeriodEnd,
    totalAmount,
    currency = 'USD',
    totalUnits = null,
    unitName = null,
    exchangeRate = null,
    confidenceLevel = null,
    dataSource = 'manual',
    documentUrl = null,
    notes = null,
    createdBy = null,
    metadata = {}
  } = bill

  const result = await db.query(
    `
      INSERT INTO account_bills (
        id,
        account_id,
        billing_period_start,
        billing_period_end,
        total_amount,
        currency,
        total_units,
        unit_name,
        exchange_rate,
        confidence_level,
        data_source,
        document_url,
        notes,
        created_by,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        COALESCE($15::jsonb, '{}'::jsonb)
      )
      RETURNING *
    `,
    [
      id,
      accountId,
      billingPeriodStart,
      billingPeriodEnd,
      totalAmount,
      currency,
      totalUnits,
      unitName,
      exchangeRate,
      confidenceLevel,
      dataSource,
      documentUrl,
      notes,
      createdBy,
      JSON.stringify(metadata)
    ]
  )

  const row = result.rows[0]
  return {
    id: row.id,
    accountId: row.account_id,
    billingPeriodStart: row.billing_period_start,
    billingPeriodEnd: row.billing_period_end,
    totalAmount: row.total_amount,
    currency: row.currency,
    totalUnits: row.total_units,
    unitName: row.unit_name,
    exchangeRate: row.exchange_rate,
    confidenceLevel: row.confidence_level,
    dataSource: row.data_source,
    documentUrl: row.document_url,
    notes: row.notes,
    createdBy: row.created_by,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function listBalanceSnapshots(accountId, options = {}) {
  if (!db.isEnabled()) {
    return []
  }

  const { limit = 50, offset = 0 } = options
  const result = await db.query(
    `
      SELECT
        id,
        account_id,
        captured_at,
        balance_units,
        unit_name,
        currency,
        confidence_level,
        data_source,
        notes,
        metadata,
        created_at
      FROM account_balance_snapshots
      WHERE account_id = $1
      ORDER BY captured_at DESC
      LIMIT $2 OFFSET $3
    `,
    [accountId, Math.max(1, Math.min(200, limit)), Math.max(0, offset)]
  )

  return result.rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    capturedAt: row.captured_at,
    balanceUnits: row.balance_units,
    unitName: row.unit_name,
    currency: row.currency,
    confidenceLevel: row.confidence_level,
    dataSource: row.data_source,
    notes: row.notes,
    metadata: row.metadata || {},
    createdAt: row.created_at
  }))
}

async function createBalanceSnapshot(snapshot) {
  if (!db.isEnabled()) {
    return null
  }

  const {
    id,
    accountId,
    capturedAt,
    balanceUnits,
    unitName = null,
    currency = null,
    confidenceLevel = null,
    dataSource = 'manual',
    notes = null,
    metadata = {}
  } = snapshot

  const result = await db.query(
    `
      INSERT INTO account_balance_snapshots (
        id,
        account_id,
        captured_at,
        balance_units,
        unit_name,
        currency,
        confidence_level,
        data_source,
        notes,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::jsonb, '{}'::jsonb)
      )
      RETURNING *
    `,
    [
      id,
      accountId,
      capturedAt,
      balanceUnits,
      unitName,
      currency,
      confidenceLevel,
      dataSource,
      notes,
      JSON.stringify(metadata)
    ]
  )

  const row = result.rows[0]
  return {
    id: row.id,
    accountId: row.account_id,
    capturedAt: row.captured_at,
    balanceUnits: row.balance_units,
    unitName: row.unit_name,
    currency: row.currency,
    confidenceLevel: row.confidence_level,
    dataSource: row.data_source,
    notes: row.notes,
    metadata: row.metadata || {},
    createdAt: row.created_at
  }
}

module.exports = {
  getAccountCostProfile,
  upsertAccountCostProfile,
  listAccountBills,
  createAccountBill,
  listBalanceSnapshots,
  createBalanceSnapshot
}
