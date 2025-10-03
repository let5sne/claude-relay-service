<template>
  <div class="cost-efficiency-analysis">
    <div class="card p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">账户性价比对比</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            对比不同账户的成本效率和使用情况
          </p>
        </div>
        <div class="flex gap-3">
          <select
            v-model="filters.range"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            @change="loadData"
          >
            <option value="today">今日</option>
            <option value="7days">7天</option>
            <option value="30d">30天</option>
            <option value="total">全部</option>
          </select>
          <select
            v-model="filters.platform"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            @change="loadData"
          >
            <option value="all">全部平台</option>
            <option value="claude">Claude</option>
            <option value="claude-console">Console</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex h-64 items-center justify-center">
        <div class="loading-spinner h-12 w-12 border-4 border-indigo-500" />
      </div>

      <!-- 数据展示 -->
      <div v-else>
        <!-- 汇总卡片 -->
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            class="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">总账户数</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ summary.totalAccounts || 0 }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">平均成本/百万Token</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${{ (summary.avgCostPerMillion || 0).toFixed(2) }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:from-purple-900/20 dark:to-pink-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">平均成功率</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ ((summary.avgSuccessRate || 0) * 100).toFixed(1) }}%
            </div>
          </div>
        </div>

        <!-- 账户列表 -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  账户
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  平台
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  请求数
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
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  成本/百万Token
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  成功率
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              <tr
                v-for="account in accounts"
                :key="account.accountId"
                class="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ account.accountName }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  <span class="rounded-full bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/30">
                    {{ account.platform }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  {{ formatNumber(account.totalRequests) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  {{ formatNumber(account.totalTokens) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ (account.totalCost || 0).toFixed(6) }}
                </td>
                <td
                  class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  ${{ (account.costPerMillion || 0).toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  <span
                    :class="[
                      'rounded-full px-2 py-1 text-xs',
                      account.successRate >= 0.95
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : account.successRate >= 0.8
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    ]"
                  >
                    {{ ((account.successRate || 0) * 100).toFixed(1) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const loading = ref(false)
const filters = ref({
  range: '30d',
  platform: 'all'
})
const summary = ref({})
const accounts = ref([])

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num?.toString() || '0'
}

const loadData = async () => {
  loading.value = true
  try {
    const params = { ...filters.value }
    const [summaryRes, accountsRes] = await Promise.all([
      apiClient.get('/admin/dashboard/cost-efficiency/summary', { params }),
      apiClient.get('/admin/dashboard/cost-efficiency/accounts', {
        params: { ...params, limit: 50 }
      })
    ])

    if (summaryRes.success) {
      summary.value = summaryRes.data || {}
    }
    if (accountsRes.success) {
      accounts.value = accountsRes.data?.items || []
    }
  } catch (error) {
    showToast('加载性价比数据失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
