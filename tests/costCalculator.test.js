const CostCalculator = require('../src/utils/costCalculator')

describe('CostCalculator - Enhanced Pricing Methods', () => {
  describe('calculateTieredCost', () => {
    it('应该正确计算阶梯定价 - 单档位', () => {
      const tieredPricing = [{ minTokens: 0, maxTokens: 1000000, costPerMillion: 3.0 }]

      const cost = CostCalculator.calculateTieredCost({
        totalTokens: 500000,
        tieredPricing
      })

      expect(cost).toBeCloseTo(1.5, 2) // 500k tokens * $3/M = $1.5
    })

    it('应该正确计算阶梯定价 - 多档位', () => {
      const tieredPricing = [
        { minTokens: 0, maxTokens: 1000000, costPerMillion: 3.0 },
        { minTokens: 1000001, maxTokens: 10000000, costPerMillion: 2.5 },
        { minTokens: 10000001, maxTokens: null, costPerMillion: 2.0 }
      ]

      // 测试跨越多个档位
      const cost = CostCalculator.calculateTieredCost({
        totalTokens: 5000000, // 5M tokens
        tieredPricing
      })

      // 第一档: 1M * $3 = $3
      // 第二档: 4M * $2.5 = $10
      // 总计: $13
      expect(cost).toBeCloseTo(13.0, 2)
    })

    it('应该正确计算阶梯定价 - 超过所有档位', () => {
      const tieredPricing = [
        { minTokens: 0, maxTokens: 1000000, costPerMillion: 3.0 },
        { minTokens: 1000001, maxTokens: 10000000, costPerMillion: 2.5 },
        { minTokens: 10000001, maxTokens: null, costPerMillion: 2.0 }
      ]

      const cost = CostCalculator.calculateTieredCost({
        totalTokens: 15000000, // 15M tokens
        tieredPricing
      })

      // 第一档: 1M * $3 = $3
      // 第二档: 9M * $2.5 = $22.5
      // 第三档: 5M * $2 = $10
      // 总计: $35.5
      expect(cost).toBeCloseTo(35.5, 2)
    })
  })

  describe('calculatePointBasedCost', () => {
    it('应该正确计算积分制成本 - 仅按请求', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        requests: 1
      }

      const pointConversion = {
        pointsPerRequest: 1,
        pointsPerToken: 0,
        costPerPoint: 0.01
      }

      const cost = CostCalculator.calculatePointBasedCost({
        usage,
        pointConversion
      })

      expect(cost).toBeCloseTo(0.01, 4) // 1 request * 1 point * $0.01 = $0.01
    })

    it('应该正确计算积分制成本 - 仅按token', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        requests: 1
      }

      const pointConversion = {
        pointsPerRequest: 0,
        pointsPerToken: 0.001,
        costPerPoint: 0.01
      }

      const cost = CostCalculator.calculatePointBasedCost({
        usage,
        pointConversion
      })

      // 1500 tokens * 0.001 points/token * $0.01/point = $0.015
      expect(cost).toBeCloseTo(0.015, 4)
    })

    it('应该正确计算积分制成本 - 混合计费', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        requests: 1
      }

      const pointConversion = {
        pointsPerRequest: 1,
        pointsPerToken: 0.001,
        costPerPoint: 0.01
      }

      const cost = CostCalculator.calculatePointBasedCost({
        usage,
        pointConversion
      })

      // (1 request * 1 point + 1500 tokens * 0.001 points) * $0.01 = $0.025
      expect(cost).toBeCloseTo(0.025, 4)
    })
  })

  describe('calculateHybridCost', () => {
    it('应该正确计算混合计费 - 按请求', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        requests: 1
      }

      const pricingFormula = {
        components: [{ type: 'per_request', rate: 0.002, weight: 1.0 }]
      }

      const cost = CostCalculator.calculateHybridCost({
        usage,
        pricingFormula
      })

      expect(cost).toBeCloseTo(0.002, 4)
    })

    it('应该正确计算混合计费 - 按token', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        requests: 1
      }

      const pricingFormula = {
        components: [{ type: 'per_token', rate: 0.000003, weight: 1.0 }]
      }

      const cost = CostCalculator.calculateHybridCost({
        usage,
        pricingFormula
      })

      // 1500 tokens * $0.000003 = $0.0045
      expect(cost).toBeCloseTo(0.0045, 6)
    })

    it('应该正确计算混合计费 - 多组件加权', () => {
      const usage = {
        input_tokens: 5000,
        output_tokens: 2000,
        requests: 1
      }

      const pricingFormula = {
        components: [
          { type: 'per_request', rate: 0.002, weight: 0.3 },
          { type: 'per_token', rate: 0.000003, weight: 0.7 }
        ]
      }

      const cost = CostCalculator.calculateHybridCost({
        usage,
        pricingFormula
      })

      // (1 * $0.002 * 0.3) + (7000 * $0.000003 * 0.7) = $0.0006 + $0.0147 = $0.0153
      expect(cost).toBeCloseTo(0.0153, 4)
    })
  })

  describe('calculateActualCost - 集成测试', () => {
    it('应该使用阶梯定价配置', () => {
      const usage = {
        input_tokens: 5000000,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        requests: 1
      }

      const profile = {
        costTrackingMode: 'manual_billing',
        billingType: 'tiered',
        tieredPricing: [
          { minTokens: 0, maxTokens: 1000000, costPerMillion: 3.0 },
          { minTokens: 1000001, maxTokens: null, costPerMillion: 2.5 }
        ],
        confidenceLevel: 'high'
      }

      const fallback = {
        costs: { total: 10.0 }
      }

      const result = CostCalculator.calculateActualCost({
        usage,
        model: 'test-model',
        fallback,
        profile
      })

      // 1M * $3 + 4M * $2.5 = $3 + $10 = $13
      expect(result.actualCost).toBeCloseTo(13.0, 2)
      expect(result.costSource).toBe('manual')
      expect(result.calculationMethod).toBe('tiered_pricing')
      expect(result.confidenceLevel).toBe('high')
    })

    it('应该使用积分制配置', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        requests: 1
      }

      const profile = {
        costTrackingMode: 'manual_billing',
        billingType: 'point_based',
        pointConversion: {
          pointsPerRequest: 1,
          pointsPerToken: 0.001,
          costPerPoint: 0.01
        },
        confidenceLevel: 'high'
      }

      const fallback = {
        costs: { total: 0.05 }
      }

      const result = CostCalculator.calculateActualCost({
        usage,
        model: 'test-model',
        fallback,
        profile
      })

      // (1 + 1500 * 0.001) * $0.01 = $0.025
      expect(result.actualCost).toBeCloseTo(0.025, 4)
      expect(result.costSource).toBe('manual')
      expect(result.calculationMethod).toBe('point_based')
    })

    it('应该使用混合计费配置', () => {
      const usage = {
        input_tokens: 5000,
        output_tokens: 2000,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        requests: 1
      }

      const profile = {
        costTrackingMode: 'manual_billing',
        billingType: 'hybrid',
        pricingFormula: {
          components: [
            { type: 'per_request', rate: 0.002, weight: 0.3 },
            { type: 'per_token', rate: 0.000003, weight: 0.7 }
          ]
        },
        confidenceLevel: 'medium-high'
      }

      const fallback = {
        costs: { total: 0.02 }
      }

      const result = CostCalculator.calculateActualCost({
        usage,
        model: 'test-model',
        fallback,
        profile
      })

      expect(result.actualCost).toBeCloseTo(0.0153, 4)
      expect(result.costSource).toBe('manual')
      expect(result.calculationMethod).toBe('hybrid')
    })

    it('应该在没有profile时使用fallback', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        requests: 1
      }

      const fallback = {
        costs: { total: 0.05 }
      }

      const result = CostCalculator.calculateActualCost({
        usage,
        model: 'test-model',
        fallback,
        profile: null
      })

      expect(result.actualCost).toBe(0.05)
      expect(result.costSource).toBe('calculated')
      expect(result.calculationMethod).toBe('standard')
    })
  })
})
