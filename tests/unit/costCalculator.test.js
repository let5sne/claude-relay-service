/**
 * 单元测试示例 - 成本计算器
 *
 * 运行方式:
 * npm test tests/unit/costCalculator.test.js
 */

const { calculateCost, calculateTokenCost } = require('../../src/utils/costCalculator')

describe('成本计算器单元测试', () => {
  describe('calculateCost', () => {
    test('应该正确计算GPT-4的成本', () => {
      const result = calculateCost({
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toHaveProperty('totalCost')
      expect(result).toHaveProperty('inputCost')
      expect(result).toHaveProperty('outputCost')
      expect(result.totalCost).toBeGreaterThan(0)
    })

    test('应该正确处理Claude模型的成本', () => {
      const result = calculateCost({
        model: 'claude-3-opus-20240229',
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result.totalCost).toBeGreaterThan(0)
    })

    test('应该处理无效的模型名称', () => {
      const result = calculateCost({
        model: 'invalid-model',
        inputTokens: 1000,
        outputTokens: 500
      })

      // 应该返回默认成本或0
      expect(result.totalCost).toBeGreaterThanOrEqual(0)
    })

    test('应该处理零Token的情况', () => {
      const result = calculateCost({
        model: 'gpt-4',
        inputTokens: 0,
        outputTokens: 0
      })

      expect(result.totalCost).toBe(0)
    })

    test('应该处理负数Token(边界条件)', () => {
      const result = calculateCost({
        model: 'gpt-4',
        inputTokens: -100,
        outputTokens: -50
      })

      // 应该返回0或抛出错误
      expect(result.totalCost).toBe(0)
    })
  })

  describe('calculateTokenCost', () => {
    test('应该正确计算单个Token的成本', () => {
      const cost = calculateTokenCost('gpt-4', 1000, 'input')
      expect(cost).toBeGreaterThan(0)
    })

    test('应该区分输入和输出Token的成本', () => {
      const inputCost = calculateTokenCost('gpt-4', 1000, 'input')
      const outputCost = calculateTokenCost('gpt-4', 1000, 'output')

      // 输出Token通常更贵
      expect(outputCost).toBeGreaterThanOrEqual(inputCost)
    })
  })
})

describe('成本计算性能测试', () => {
  test('应该在合理时间内完成大量计算', () => {
    const startTime = Date.now()

    for (let i = 0; i < 10000; i++) {
      calculateCost({
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500
      })
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    // 10000次计算应该在1秒内完成
    expect(duration).toBeLessThan(1000)
  })
})
