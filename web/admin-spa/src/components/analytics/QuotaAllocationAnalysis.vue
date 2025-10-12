<template>
  <div class="quota-allocation-analysis">
    <div class="card p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">额度配置监控</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            监控各API Key的额度配置情况,避免超额分配
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
        <!-- 超额分配警告 -->
        <div
          v-if="stats.overAllocatedAccountsCount > 0"
          class="mb-6 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-900/20"
        >
          <div class="flex items-start">
            <i class="fas fa-exclamation-triangle mr-3 mt-1 text-red-600 dark:text-red-400" />
            <div class="flex-1">
              <h4 class="font-semibold text-red-800 dark:text-red-300">⚠️ 检测到超额分配风险</h4>
              <p class="mt-1 text-sm text-red-700 dark:text-red-400">
                发现 {{ stats.overAllocatedAccountsCount }} 个账户的API
                Key总额度超过了账户本身的每日限额，可能导致部分API Key无法正常使用。
              </p>
              <div class="mt-3 space-y-2">
                <div
                  v-for="account in stats.accountQuotaComparison.filter((a) => a.isOverAllocated)"
                  :key="account.accountId"
                  class="rounded-md bg-white p-3 dark:bg-gray-800"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-gray-100">
                        {{ account.accountName }}
                        <span class="ml-2 text-xs text-gray-500">({{ account.platform }})</span>
                      </div>
                      <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        账户额度: ${{ account.accountDailyQuota.toFixed(2) }} | API Key总分配: ${{
                          account.totalAllocated.toFixed(2)
                        }}
                        | 超额:
                        <span class="font-semibold text-red-600 dark:text-red-400">
                          ${{ account.overAllocated.toFixed(2) }}
                        </span>
                      </div>
                    </div>
                    <div class="ml-4 text-right">
                      <div class="text-lg font-bold text-red-600 dark:text-red-400">
                        {{ account.allocationRate }}%
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {{ account.relatedKeysCount }} 个Key
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p class="mt-3 text-xs text-red-600 dark:text-red-400">
                💡 建议：调整API Key的额度配置，或增加账户的每日限额
              </p>
            </div>
          </div>
        </div>

        <!-- 汇总卡片 -->
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            class="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">活跃API Keys</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {{ stats.activeKeys }} / {{ stats.totalKeys }}
            </div>
          </div>

          <div
            class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">日额度配置总计</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${{ stats.totalDailyQuotaAllocated.toFixed(2) }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              已用: ${{ stats.totalDailyUsed.toFixed(2) }} ({{ stats.dailyUtilizationRate }}%)
            </div>
          </div>

          <div
            class="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:from-purple-900/20 dark:to-pink-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">日剩余额度</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${{ stats.totalDailyRemaining.toFixed(2) }}
            </div>
            <div
              class="mt-1 text-xs"
              :class="
                stats.dailyUtilizationRate > 80
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              "
            >
              <i
                :class="
                  stats.dailyUtilizationRate > 80
                    ? 'fas fa-exclamation-triangle'
                    : 'fas fa-check-circle'
                "
              />
              {{ stats.dailyUtilizationRate > 80 ? '使用率偏高' : '使用正常' }}
            </div>
          </div>

          <div
            class="rounded-lg bg-gradient-to-br from-orange-50 to-yellow-50 p-4 dark:from-orange-900/20 dark:to-yellow-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">本月总使用</div>
            <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${{ (stats.totalMonthlyUsed || 0).toFixed(2) }}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              活跃Key: {{ stats.activeKeys }}个
            </div>
          </div>
        </div>

        <!-- 筛选和搜索 -->
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            placeholder="搜索 API Key 名称或所有者..."
            type="text"
          />
          <select
            v-model="statusFilter"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="all">全部状态</option>
            <option value="active">活跃</option>
            <option value="inactive">未激活</option>
          </select>
          <select
            v-model="sortBy"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="dailyRemaining">按日剩余额度</option>
            <option value="dailyUtilization">按日使用率</option>
            <option value="totalRemaining">按总剩余额度</option>
            <option value="name">按名称</option>
          </select>
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
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  状态
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  所有者
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  日额度
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  日已用
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  日剩余
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  日使用率
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  总额度
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  总已用
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                >
                  总使用率
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              <tr
                v-for="key in filteredKeys"
                :key="key.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td class="px-4 py-3">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ key.name }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {{ key.id.substring(0, 8) }}...
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                      key.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    ]"
                  >
                    {{ key.status === 'active' ? '活跃' : '未激活' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {{ key.owner }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ key.dailyLimit.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ key.dailyUsed.toFixed(2) }}
                </td>
                <td
                  class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  ${{ key.dailyRemaining.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        :class="[
                          'h-full transition-all',
                          parseFloat(key.dailyUtilization) > 80
                            ? 'bg-red-500'
                            : parseFloat(key.dailyUtilization) > 50
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        ]"
                        :style="{ width: Math.min(100, parseFloat(key.dailyUtilization)) + '%' }"
                      />
                    </div>
                    <span class="text-sm text-gray-900 dark:text-gray-100">
                      {{ key.dailyUtilization }}%
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ key.totalLimit.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                  ${{ key.totalAccumulated.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        :class="[
                          'h-full transition-all',
                          parseFloat(key.totalUtilization) > 80
                            ? 'bg-red-500'
                            : parseFloat(key.totalUtilization) > 50
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        ]"
                        :style="{ width: Math.min(100, parseFloat(key.totalUtilization)) + '%' }"
                      />
                    </div>
                    <span class="text-sm text-gray-900 dark:text-gray-100">
                      {{ key.totalUtilization }}%
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 无数据提示 -->
        <div v-if="filteredKeys.length === 0" class="py-12 text-center">
          <i class="fas fa-search mb-3 text-4xl text-gray-400" />
          <p class="text-gray-600 dark:text-gray-400">没有找到匹配的API Key</p>
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
const sortBy = ref('dailyRemaining')
const lastUpdated = ref('')
const errorMessage = ref('')

const filteredKeys = computed(() => {
  if (!stats.value?.keyDetails) return []

  let keys = [...stats.value.keyDetails]

  // 状态筛选
  if (statusFilter.value !== 'all') {
    keys = keys.filter((key) => key.status === statusFilter.value)
  }

  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    keys = keys.filter(
      (key) =>
        key.name.toLowerCase().includes(query) ||
        key.owner.toLowerCase().includes(query) ||
        key.id.toLowerCase().includes(query)
    )
  }

  // 排序
  keys.sort((a, b) => {
    switch (sortBy.value) {
      case 'dailyRemaining':
        return b.dailyRemaining - a.dailyRemaining
      case 'dailyUtilization':
        return parseFloat(b.dailyUtilization) - parseFloat(a.dailyUtilization)
      case 'totalRemaining':
        return b.totalRemaining - a.totalRemaining
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  return keys
})

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiClient.get('/admin/quota-allocation-stats')
    if (response.success) {
      stats.value = response.data
      lastUpdated.value = new Date(response.timestamp).toLocaleString('zh-CN')
    } else {
      errorMessage.value = response.error || '加载失败'
      stats.value = null
    }
  } catch (error) {
    console.error('Failed to load quota allocation stats:', error)
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
