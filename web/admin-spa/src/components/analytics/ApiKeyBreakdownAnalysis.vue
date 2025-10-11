<template>
  <div class="api-key-breakdown-analysis">
    <div class="card p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">API Key 调用明细</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            查看每个 API Key 的详细调用统计
          </p>
        </div>
        <div class="flex gap-3">
          <select
            v-model="selectedAccount"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            @change="loadBreakdown"
          >
            <option value="">选择账户</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }} ({{ account.platform }})
            </option>
          </select>
          <select
            v-model="filters.range"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            @change="loadBreakdown"
          >
            <option value="today">今日</option>
            <option value="7days">7天</option>
            <option value="30d">30天</option>
            <option value="total">全部</option>
          </select>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex h-64 items-center justify-center">
        <div class="loading-spinner h-12 w-12 border-4 border-indigo-500" />
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="!selectedAccount"
        class="flex h-64 flex-col items-center justify-center text-gray-500"
      >
        <i class="fas fa-key mb-4 text-4xl" />
        <p>请选择一个账户查看 API Key 调用明细</p>
      </div>

      <!-- 数据展示 -->
      <div v-else-if="breakdown.length > 0">
        <!-- 汇总信息 -->
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            class="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">API Key 总数</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ breakdown.length }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">总请求数</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ formatNumber(totalRequests) }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:from-purple-900/20 dark:to-pink-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">总成本</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${{ totalCost.toFixed(6) }}
            </div>
          </div>
        </div>

        <!-- API Key 列表 -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  API Key
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  请求数
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  输入Token
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  输出Token
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  缓存创建
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  缓存读取
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  总Token
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  总成本
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  最后使用
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              <template v-for="item in breakdown" :key="item.apiKeyId">
                <!-- 主行 -->
                <tr
                  class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  @click="toggleDetails(item.apiKeyId)"
                >
                  <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <i
                      class="mr-2 text-xs text-gray-400"
                      :class="
                        expandedKeys.has(item.apiKeyId)
                          ? 'fas fa-chevron-down'
                          : 'fas fa-chevron-right'
                      "
                    />
                    {{ item.apiKeyName }}
                  </td>
                  <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    {{ formatNumber(item.requests) }}
                  </td>
                  <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                    {{ formatNumber(item.inputTokens) }}
                  </td>
                  <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                    {{ formatNumber(item.outputTokens) }}
                  </td>
                  <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                    {{ formatNumber(item.cacheCreateTokens || 0) }}
                  </td>
                  <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                    {{ formatNumber(item.cacheReadTokens || 0) }}
                  </td>
                  <td
                    class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    {{ formatNumber(item.totalTokens) }}
                  </td>
                  <td
                    class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    ${{ (item.totalCost || 0).toFixed(6) }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {{ formatDateTime(item.lastUsedAt) }}
                  </td>
                </tr>

                <!-- 详细请求列表（展开时显示） -->
                <tr v-if="expandedKeys.has(item.apiKeyId)" :key="`${item.apiKeyId}-details`">
                  <td class="bg-gray-50 px-4 py-4 dark:bg-gray-800/50" colspan="9">
                    <div v-if="loadingDetails[item.apiKeyId]" class="flex justify-center py-4">
                      <div class="loading-spinner h-8 w-8 border-4 border-indigo-500" />
                    </div>
                    <div v-else-if="detailsData[item.apiKeyId]?.length > 0" class="space-y-2">
                      <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        详细请求记录 (最近 {{ detailsData[item.apiKeyId].length }} 条)
                      </div>
                      <div class="max-h-96 overflow-y-auto">
                        <table class="min-w-full text-xs">
                          <thead class="bg-gray-100 dark:bg-gray-700">
                            <tr>
                              <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">
                                时间
                              </th>
                              <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">
                                模型
                              </th>
                              <th class="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                                输入
                              </th>
                              <th class="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                                输出
                              </th>
                              <th class="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                                缓存创建
                              </th>
                              <th class="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                                缓存读取
                              </th>
                              <th class="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                                总计
                              </th>
                              <th class="px-3 py-2 text-right text-gray-600 dark:text-gray-300">
                                费用
                              </th>
                              <th class="px-3 py-2 text-center text-gray-600 dark:text-gray-300">
                                状态
                              </th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                            <tr
                              v-for="detail in detailsData[item.apiKeyId]"
                              :key="detail.id"
                              class="hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <td class="px-3 py-2 text-gray-700 dark:text-gray-300">
                                {{ formatDetailTime(detail.occurred_at) }}
                              </td>
                              <td class="px-3 py-2 text-gray-700 dark:text-gray-300">
                                {{ detail.model }}
                              </td>
                              <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                {{ detail.input_tokens }}
                              </td>
                              <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                {{ detail.output_tokens }}
                              </td>
                              <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                {{ detail.cache_create_tokens }}
                              </td>
                              <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                {{ detail.cache_read_tokens }}
                              </td>
                              <td
                                class="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100"
                              >
                                {{ detail.total_tokens }}
                              </td>
                              <td
                                class="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100"
                              >
                                ${{ parseFloat(detail.total_cost || 0).toFixed(6) }}
                              </td>
                              <td class="px-3 py-2 text-center">
                                <span
                                  v-if="detail.metadata?._no_usage_data"
                                  class="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  title="此请求的 token 数据需要人工核对"
                                >
                                  需核对
                                </span>
                                <span
                                  v-else-if="detail.metadata?._manually_updated"
                                  class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  title="此记录已手动更新"
                                >
                                  已更新
                                </span>
                                <span
                                  v-else
                                  class="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                >
                                  正常
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div v-else class="py-4 text-center text-sm text-gray-500">暂无详细记录</div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 无数据 -->
      <div v-else class="flex h-64 flex-col items-center justify-center text-gray-500">
        <i class="fas fa-inbox mb-4 text-4xl" />
        <p>该账户暂无 API Key 调用数据</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const loading = ref(false)
const accounts = ref([])
const selectedAccount = ref('')
const filters = ref({
  range: '30d'
})
const breakdown = ref([])
const expandedKeys = ref(new Set())
const loadingDetails = ref({})
const detailsData = ref({})

const totalRequests = computed(() =>
  breakdown.value.reduce((sum, item) => sum + (item.requests || 0), 0)
)
const totalCost = computed(() =>
  breakdown.value.reduce((sum, item) => sum + (item.totalCost || 0), 0)
)

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num?.toString() || '0'
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatDetailTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}:${seconds}`
}

const loadAccounts = async () => {
  try {
    console.log('🔍 Loading accounts for API key breakdown')
    const response = await apiClient.get('/admin/accounts/usage-stats', {
      params: { range: 'total' }
    })
    console.log('📋 Accounts response:', response)

    if (response?.success) {
      accounts.value = response.data || []
      console.log('✅ Accounts loaded:', accounts.value.length, 'accounts')
    } else {
      console.warn('⚠️ Accounts response missing success flag:', response)
      accounts.value = []
    }
  } catch (error) {
    console.error('❌ Failed to load accounts:', error)
    showToast('加载账户列表失败: ' + (error.message || '未知错误'), 'error')
    accounts.value = []
  }
}

const loadBreakdown = async () => {
  if (!selectedAccount.value) {
    breakdown.value = []
    return
  }

  loading.value = true
  try {
    console.log('🔍 Loading API key breakdown for account:', selectedAccount.value)
    const response = await apiClient.get(
      `/admin/accounts/${selectedAccount.value}/usage-breakdown`,
      {
        params: { ...filters.value, limit: 100 }
      }
    )
    console.log('🔑 Breakdown response:', response)

    if (response?.success) {
      breakdown.value = response.items || []
      console.log('✅ Breakdown loaded:', breakdown.value.length, 'API keys')
      // 清空展开状态和详情数据
      expandedKeys.value.clear()
      detailsData.value = {}
    } else {
      console.warn('⚠️ Breakdown response missing success flag:', response)
      breakdown.value = []
    }
  } catch (error) {
    console.error('❌ Failed to load API key breakdown:', error)
    showToast('加载 API Key 明细失败: ' + (error.message || '未知错误'), 'error')
    breakdown.value = []
  } finally {
    loading.value = false
  }
}

const toggleDetails = async (apiKeyId) => {
  if (expandedKeys.value.has(apiKeyId)) {
    // 收起
    expandedKeys.value.delete(apiKeyId)
    expandedKeys.value = new Set(expandedKeys.value) // 触发响应式更新
  } else {
    // 展开并加载详情
    expandedKeys.value.add(apiKeyId)
    expandedKeys.value = new Set(expandedKeys.value) // 触发响应式更新
    await loadApiKeyDetails(apiKeyId)
  }
}

const loadApiKeyDetails = async (apiKeyId) => {
  loadingDetails.value[apiKeyId] = true

  try {
    const response = await apiClient.get(`/admin/api-keys/${apiKeyId}/usage-details`, {
      params: { range: filters.value.range, limit: 50 }
    })

    if (response.success) {
      detailsData.value[apiKeyId] = response.items || []
    }
  } catch (error) {
    showToast('加载请求详情失败', 'error')
    detailsData.value[apiKeyId] = []
  } finally {
    loadingDetails.value[apiKeyId] = false
  }
}

onMounted(() => {
  loadAccounts()
})
</script>
