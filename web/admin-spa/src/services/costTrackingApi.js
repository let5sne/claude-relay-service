import { apiClient } from '@/config/api'

const API_BASE = '/admin'

/**
 * 成本追踪 API 服务
 * 用于账户成本配置、账单管理、计价推导和验证
 */
export default {
  /**
   * 获取账户成本配置
   * @param {string} accountId - 账户ID
   * @returns {Promise} 成本配置对象
   */
  async getAccountCostProfile(accountId) {
    const response = await apiClient.get(`${API_BASE}/accounts/${accountId}/cost-profile`)
    return response.data
  },

  /**
   * 更新账户成本配置
   * @param {string} accountId - 账户ID
   * @param {object} profile - 成本配置数据
   * @returns {Promise} 更新后的配置
   */
  async updateCostProfile(accountId, profile) {
    const response = await apiClient.put(`${API_BASE}/accounts/${accountId}/cost-profile`, profile)
    return response.data
  },

  /**
   * 录入账单数据
   * @param {string} accountId - 账户ID
   * @param {object} billData - 账单数据 { billingPeriod, totalCost, notes }
   * @returns {Promise} 创建的账单对象
   */
  async createBill(accountId, billData) {
    const response = await apiClient.post(`${API_BASE}/accounts/${accountId}/bills`, billData)
    return response.data
  },

  /**
   * 获取账单列表
   * @param {string} accountId - 账户ID
   * @param {object} options - 分页选项 { limit, offset }
   * @returns {Promise} 账单列表
   */
  async listBills(accountId, options = {}) {
    const response = await apiClient.get(`${API_BASE}/accounts/${accountId}/bills`, {
      params: {
        limit: options.limit || 20,
        offset: options.offset || 0
      }
    })
    return response.data
  },

  /**
   * 推导计价参数（基于历史账单）
   * @param {string} accountId - 账户ID
   * @returns {Promise} 推导结果，包含推导的计价参数和质量指标
   */
  async inferPricing(accountId) {
    const response = await apiClient.post(`${API_BASE}/accounts/${accountId}/infer-pricing`)
    return response.data
  },

  /**
   * 验证成本准确性
   * @param {string} accountId - 账户ID
   * @param {string} billingPeriod - 计费周期 (YYYY-MM)
   * @returns {Promise} 验证结果，包含计算成本、实际账单、偏差率
   */
  async validateCosts(accountId, billingPeriod) {
    const response = await apiClient.post(`${API_BASE}/accounts/${accountId}/validate-costs`, {
      billingPeriod
    })
    return response.data
  },

  /**
   * 获取成本对比报告
   * @param {string} accountId - 账户ID
   * @param {string} startDate - 开始日期 (YYYY-MM-DD)
   * @param {string} endDate - 结束日期 (YYYY-MM-DD)
   * @returns {Promise} 成本对比报告数据
   */
  async getCostComparison(accountId, startDate, endDate) {
    const response = await apiClient.get(`${API_BASE}/accounts/${accountId}/cost-comparison`, {
      params: { startDate, endDate }
    })
    return response.data
  },

  /**
   * 批量导入账单（CSV）
   * @param {string} accountId - 账户ID
   * @param {FormData} formData - 包含 CSV 文件的 FormData
   * @returns {Promise} 导入结果
   */
  async importBillsCSV(accountId, formData) {
    const response = await apiClient.post(
      `${API_BASE}/accounts/${accountId}/bills/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )
    return response.data
  }
}
