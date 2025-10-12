<template>
  <div class="account-quota-analysis">
    <div class="card p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">账户每日额度监控</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            监控各账户的每日额度配置和使用情况，避免超额使用
          </p>
        </div>
        <button
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          @click="loadData"
        >
          <i class="fas fa-sync-alt mr-2" />
          刷新数据
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex h-64 items-center justify-center">
        <div class="loading-spinner h-12 w-12 border-4 border-indigo-500" />
      </div>

      <!-- 数据展示 -->
      <div v-else-if="stats">
        <!-- 汇总卡片 -->
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            class="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">配置额度的账户</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ stats.accountsWithQuota }} / {{ stats.totalAccounts }}
            </div>
          </div>

          <div
            class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">总每日额度</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${{ stats.totalDailyQuota.toFixed(2) }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              已用: ${{ stats.totalDailyUsage.toFixed(2) }} ({{ stats.overallUtilizationRate }}%)
            </div>
          </div>

          <div
            class="rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 p-4 dark:from-yellow-900/20 dark:to-orange-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">接近限额账户</div>
            <div class="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {{ stats.accountsNearLimit }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">使用率 ≥ 80%</div>
          </div>

          <div
            class="rounded-lg bg-gradient-to-br from-red-50 to-pink-50 p-4 dark:from-red-900/20 dark:to-pink-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">超限账户</div>
            <div class="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
              {{ stats.accountsOverLimit }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">使用率 ≥ 100%</div>
          </div>
        </div>

        <!-- 筛选和搜索 -->
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            placeholder="搜索账户名称..."
            type="text"
          />
          <select
            v-model="statusFilter"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="all">全部状态</option>
            <option value="over_limit">超限</option>
            <option value="near_limit">接近限额</option>
            <option value="normal">正常</option>
          </select>
          <select
            v-model="platformFilter"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="all">全部平台</option>
            <option value="claude-console">Claude Console</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <!-- 账户列表 -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  账户名称
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  平台
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  状态
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  每日额度
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  已使用
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  剩余
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  使用率
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  重置时间
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              <tr
                v-for="account in filteredAccounts"
                :key="account.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td class="px-4 py-3">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ account.name }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {{ account.id.substring(0, 8) }}...
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                      getPlatformColor(account.platform)
                    ]"
                  >
                    {{ getPlatformLabel(account.platform) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                      getStatusColor(account.status)
                    ]"
                  >
                    {{ getStatusLabel(account.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ account.dailyQuota.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ account.dailyUsage.toFixed(2) }}
                </td>
                <td
                  class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  ${{ account.dailyRemaining.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        :class="[
                          'h-full transition-all',
                          parseFloat(account.utilizationRate) >= 100
                            ? 'bg-red-500'
                            : parseFloat(account.utilizationRate) >= 80
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        ]"
                        :style="{ width: Math.min(100, parseFloat(account.utilizationRate)) + '%' }"
                      />
                    </div>
                    <span class="text-sm text-gray-900 dark:text-gray-100">
                      {{ account.utilizationRate }}%
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  {{ account.quotaResetTime }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 无数据提示 -->
        <div v-if="filteredAccounts.length === 0" class="py-12 text-center">
          <i class="fas fa-search mb-3 text-4xl text-gray-400" />
          <p class="text-gray-600 dark:text-gray-400">没有找到匹配的账户</p>
        </div>

        <!-- 更新时间 -->
        <div class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          最后更新: {{ lastUpdated }}
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-else class="py-12 text-center">
        <i class="fas fa-exclamation-triangle mb-3 text-4xl text-yellow-500" />
        <p class="text-gray-600 dark:text-gray-400">加载数据失败,请稍后重试</p>
        <p v-if="errorMessage" class="mt-2 text-sm text-red-500">{{ errorMessage }}</p>
        <button
          class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          @click="loadData"
        >
          重试
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/config/api'

const loading = ref(false)
const stats = ref(null)
const searchQuery = ref('')
const statusFilter = ref('all')
const platformFilter = ref('all')
const lastUpdated = ref('')
const errorMessage = ref('')

const filteredAccounts = computed(() => {
  if (!stats.value?.accounts) return []

  let accounts = [...stats.value.accounts]

  // 状态筛选
  if (statusFilter.value !== 'all') {
    accounts = accounts.filter((account) => account.status === statusFilter.value)
  }

  // 平台筛选
  if (platformFilter.value !== 'all') {
    accounts = accounts.filter((account) => account.platform === platformFilter.value)
  }

  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    accounts = accounts.filter(
      (account) =>
        account.name.toLowerCase().includes(query) || account.id.toLowerCase().includes(query)
    )
  }

  return accounts
})

const getPlatformColor = (platform) => {
  const colors = {
    'claude-console': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    claude: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    gemini: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    openai: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  }
  return colors[platform] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
}

const getPlatformLabel = (platform) => {
  const labels = {
    'claude-console': 'Console',
    claude: 'Claude',
    gemini: 'Gemini',
    openai: 'OpenAI'
  }
  return labels[platform] || platform
}

const getStatusColor = (status) => {
  const colors = {
    over_limit: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    near_limit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    normal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  }
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
}

const getStatusLabel = (status) => {
  const labels = {
    over_limit: '超限',
    near_limit: '接近限额',
    normal: '正常'
  }
  return labels[status] || status
}

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiClient.get('/admin/account-daily-quota-stats')
    if (response.success) {
      stats.value = response.data
      lastUpdated.value = new Date(response.timestamp).toLocaleString('zh-CN')
    } else {
      errorMessage.value = response.error || '加载失败'
      stats.value = null
    }
  } catch (error) {
    console.error('Failed to load account daily quota stats:', error)
    errorMessage.value = error.message || '网络请求失败'
    stats.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.loading-spinner {
  border-color: rgba(99, 102, 241, 0.2);
  border-top-color: rgb(99, 102, 241);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.card {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.dark .card {
  background: rgb(17, 24, 39);
}
</style>
