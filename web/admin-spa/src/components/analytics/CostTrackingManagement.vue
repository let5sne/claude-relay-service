<template>
  <div class="cost-tracking-management">
    <div class="card p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">成本配置与验证</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            管理账户计价模式、录入账单、推导参数和验证成本准确性
          </p>
        </div>
        <div class="flex gap-3">
          <select
            v-model="filters.platform"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            @change="loadAccounts"
          >
            <option value="all">全部平台</option>
            <option value="claude">Claude</option>
            <option value="claude-console">Console</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="openai-responses">OpenAI Responses</option>
          </select>
          <button
            class="btn-primary flex items-center gap-2"
            :disabled="loading"
            @click="loadAccounts"
          >
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" />
            刷新
          </button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex h-64 items-center justify-center">
        <div class="loading-spinner h-12 w-12 border-4 border-indigo-500" />
      </div>

      <!-- 账户列表 -->
      <div v-else class="overflow-x-auto">
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
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
              >
                计价模式
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
              >
                置信度
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
              >
                最后验证
              </th>
              <th
                class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
              >
                操作
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
                  {{ account.id }}
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                  :class="getPlatformBadgeClass(account.platform)"
                >
                  {{ account.platform }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm text-gray-900 dark:text-gray-100">
                  {{ getBillingTypeLabel(account.costProfile?.billingType) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="account.costProfile?.confidenceLevel"
                  class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                  :class="getConfidenceBadgeClass(account.costProfile.confidenceLevel)"
                >
                  {{ getConfidenceLevelLabel(account.costProfile.confidenceLevel) }}
                </span>
                <span v-else class="text-xs text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {{
                  account.costProfile?.lastValidatedAt
                    ? formatDate(account.costProfile.lastValidatedAt)
                    : '-'
                }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    class="btn-sm btn-secondary"
                    title="配置成本"
                    @click="openCostProfileModal(account)"
                  >
                    <i class="fas fa-cog" />
                  </button>
                  <button
                    class="btn-sm btn-secondary"
                    title="录入账单"
                    @click="openBillEntryModal(account)"
                  >
                    <i class="fas fa-file-invoice-dollar" />
                  </button>
                  <button
                    class="btn-sm btn-secondary"
                    :disabled="inferringAccountId === account.id"
                    title="推导参数"
                    @click="inferPricing(account)"
                  >
                    <i
                      class="fas fa-robot"
                      :class="{ 'fa-spin': inferringAccountId === account.id }"
                    />
                  </button>
                  <button
                    class="btn-sm btn-primary"
                    title="验证成本"
                    @click="openValidationPanel(account)"
                  >
                    <i class="fas fa-check-circle" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 空状态 -->
        <div v-if="filteredAccounts.length === 0" class="py-12 text-center">
          <i class="fas fa-inbox mb-3 text-4xl text-gray-300 dark:text-gray-600" />
          <p class="text-sm text-gray-500 dark:text-gray-400">暂无账户数据</p>
        </div>
      </div>
    </div>

    <!-- 成本配置模态框 -->
    <CostProfileModal
      v-if="showCostProfileModal"
      :account="selectedAccount"
      @close="showCostProfileModal = false"
      @saved="handleProfileSaved"
    />

    <!-- 账单录入模态框 -->
    <BillEntryModal
      v-if="showBillEntryModal"
      :account="selectedAccount"
      @close="showBillEntryModal = false"
      @saved="handleBillSaved"
    />

    <!-- 验证面板模态框 -->
    <InferenceValidationPanel
      v-if="showValidationPanel"
      :account="selectedAccount"
      @close="showValidationPanel = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/config/api'
import costTrackingApi from '@/services/costTrackingApi'
import CostProfileModal from './cost-tracking/CostProfileModal.vue'
import BillEntryModal from './cost-tracking/BillEntryModal.vue'
import InferenceValidationPanel from './cost-tracking/InferenceValidationPanel.vue'

const loading = ref(false)
const accounts = ref([])
const filters = ref({
  platform: 'all'
})
const selectedAccount = ref(null)
const showCostProfileModal = ref(false)
const showBillEntryModal = ref(false)
const showValidationPanel = ref(false)
const inferringAccountId = ref(null)

// 过滤后的账户列表
const filteredAccounts = computed(() => {
  if (filters.value.platform === 'all') {
    return accounts.value
  }
  return accounts.value.filter((account) => account.platform === filters.value.platform)
})

// 加载账户列表和成本配置
async function loadAccounts() {
  loading.value = true
  try {
    // 获取所有账���（使用 apiClient，返回格式为 { success: true, data: [...] }）
    let allAccounts = []

    // Claude OAuth 账户
    try {
      const claudeData = await apiClient.get('/admin/claude-accounts')
      if (claudeData.success && claudeData.data) {
        allAccounts.push(
          ...claudeData.data.map((acc) => ({
            ...acc,
            platform: acc.platform || 'claude'
          }))
        )
      }
    } catch (err) {
      console.warn('Failed to load Claude accounts:', err.message)
    }

    // Claude Console 账户
    try {
      const consoleData = await apiClient.get('/admin/claude-console-accounts')
      if (consoleData.success && consoleData.data) {
        allAccounts.push(
          ...consoleData.data.map((acc) => ({
            ...acc,
            platform: acc.platform || 'claude-console'
          }))
        )
      }
    } catch (err) {
      console.warn('Failed to load Claude Console accounts:', err.message)
    }

    // Gemini 账户
    try {
      const geminiData = await apiClient.get('/admin/gemini-accounts')
      if (geminiData.success && geminiData.data) {
        allAccounts.push(
          ...geminiData.data.map((acc) => ({
            ...acc,
            platform: acc.platform || 'gemini'
          }))
        )
      }
    } catch (err) {
      console.warn('Failed to load Gemini accounts:', err.message)
    }

    // OpenAI 账户
    try {
      const openaiData = await apiClient.get('/admin/openai-accounts')
      if (openaiData.success && openaiData.data) {
        allAccounts.push(
          ...openaiData.data.map((acc) => ({
            ...acc,
            platform: acc.platform || 'openai'
          }))
        )
      }
    } catch (err) {
      console.warn('Failed to load OpenAI accounts:', err.message)
    }

    // OpenAI Responses 账户
    try {
      const openaiResData = await apiClient.get('/admin/openai-responses-accounts')
      if (openaiResData.success && openaiResData.data) {
        allAccounts.push(
          ...openaiResData.data.map((acc) => ({
            ...acc,
            platform: acc.platform || 'openai-responses'
          }))
        )
      }
    } catch (err) {
      console.warn('Failed to load OpenAI Responses accounts:', err.message)
    }

    console.log('All accounts:', allAccounts)

    // 如果没有账户，直接返回
    if (allAccounts.length === 0) {
      accounts.value = []
      loading.value = false
      return
    }

    // 为每个账户加载成本配置（静默失败）
    const accountsWithProfiles = await Promise.all(
      allAccounts.map(async (account) => {
        try {
          const profileData = await costTrackingApi.getAccountCostProfile(account.id)
          return {
            ...account,
            costProfile: profileData?.profile || null
          }
        } catch (error) {
          // 成本配置可能不存在或功能未启用，这是正常的，不显示错误
          console.log(`No cost profile for account ${account.id}:`, error.message)
          return {
            ...account,
            costProfile: null
          }
        }
      })
    )

    accounts.value = accountsWithProfiles
    console.log('Accounts with profiles:', accountsWithProfiles)
  } catch (err) {
    // 只有在完全无法加载时才显示错误
    console.error('Unexpected error loading accounts:', err)
  } finally {
    loading.value = false
  }
}

// 打开成本配置模态框
function openCostProfileModal(account) {
  selectedAccount.value = account
  showCostProfileModal.value = true
}

// 打开账单录入模态框
function openBillEntryModal(account) {
  selectedAccount.value = account
  showBillEntryModal.value = true
}

// 打开验证面板
function openValidationPanel(account) {
  selectedAccount.value = account
  showValidationPanel.value = true
}

// 推导计价参数
async function inferPricing(account) {
  if (!confirm(`确定要为账户 "${account.name}" 推导计价参数吗？这将基于历史账单数据进行分析。`)) {
    return
  }

  inferringAccountId.value = account.id
  try {
    const result = await costTrackingApi.inferPricing(account.id)
    alert(
      `推导成功！\n质量分数: ${(result.quality?.score * 100 || 0).toFixed(1)}%\nR²: ${(result.quality?.r_squared * 100 || 0).toFixed(1)}%`
    )
    await loadAccounts() // 重新加载以更新配置
  } catch (error) {
    alert(`推导失败: ${error.response?.data?.error || error.message}`)
  } finally {
    inferringAccountId.value = null
  }
}

// 处理配置保存
function handleProfileSaved() {
  showCostProfileModal.value = false
  loadAccounts()
}

// 处理账单保存
function handleBillSaved() {
  showBillEntryModal.value = false
}

// 工具函数
function getPlatformBadgeClass(platform) {
  const classes = {
    claude: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'claude-console': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    gemini: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    openai: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }
  return classes[platform] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

function getConfidenceBadgeClass(level) {
  const classes = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'medium-high': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'low-medium': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    low: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  }
  return classes[level] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

function getConfidenceLevelLabel(level) {
  const labels = {
    high: '高',
    'medium-high': '较高',
    medium: '中等',
    'low-medium': '较低',
    low: '低'
  }
  return labels[level] || level
}

function getBillingTypeLabel(type) {
  const labels = {
    standard: '标准定价',
    point_based: '积分制',
    tiered: '阶梯定价',
    hybrid: '混合计费',
    estimated: '估算模式'
  }
  return labels[type] || '未配置'
}

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.loading-spinner {
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-sm {
  @apply rounded px-2 py-1 text-xs transition-colors;
}

.btn-primary {
  @apply rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600;
}

.card {
  @apply rounded-lg bg-white shadow-sm dark:bg-gray-900;
}
</style>
