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
      <div v-else-if="!selectedAccount" class="flex h-64 flex-col items-center justify-center text-gray-500">
        <i class="fas fa-key mb-4 text-4xl" />
        <p>请选择一个账户查看 API Key 调用明细</p>
      </div>

      <!-- 数据展示 -->
      <div v-else-if="breakdown.length > 0">
        <!-- 汇总信息 -->
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div class="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div class="text-sm text-gray-600 dark:text-gray-400">API Key 总数</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ breakdown.length }}
            </div>
          </div>
          <div class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20">
            <div class="text-sm text-gray-600 dark:text-gray-400">总请求数</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ formatNumber(totalRequests) }}
            </div>
          </div>
          <div class="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:from-purple-900/20 dark:to-pink-900/20">
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
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  API Key
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  请求数
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  输入Token
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  输出Token
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  总Token
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  总成本
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  最后使用
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              <tr v-for="item in breakdown" :key="item.apiKeyId" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                <td class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ formatNumber(item.totalTokens) }}
                </td>
                <td class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                  ${{ (item.totalCost || 0).toFixed(6) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ formatDateTime(item.lastUsedAt) }}
                </td>
              </tr>
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

const totalRequests = computed(() => breakdown.value.reduce((sum, item) => sum + (item.requests || 0), 0))
const totalCost = computed(() => breakdown.value.reduce((sum, item) => sum + (item.totalCost || 0), 0))

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

const loadAccounts = async () => {
  try {
    const response = await apiClient.get('/admin/accounts/usage-stats', { params: { range: 'total' } })
    if (response.success) {
      accounts.value = response.data || []
    }
  } catch (error) {
    showToast('加载账户列表失败', 'error')
  }
}

const loadBreakdown = async () => {
  if (!selectedAccount.value) {
    breakdown.value = []
    return
  }

  loading.value = true
  try {
    const response = await apiClient.get(`/admin/accounts/${selectedAccount.value}/usage-breakdown`, {
      params: { ...filters.value, limit: 100 }
    })
    if (response.success) {
      breakdown.value = response.items || []
    }
  } catch (error) {
    showToast('加载 API Key 明细失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAccounts()
})
</script>
