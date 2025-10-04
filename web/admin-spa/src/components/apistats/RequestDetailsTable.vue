<template>
  <div class="glass-strong mt-6 rounded-3xl p-4 shadow-xl md:p-6">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 md:text-xl">
        <i class="fas fa-list-alt mr-2 text-blue-500" />
        请求明细记录
      </h3>
      <button
        v-if="!expanded"
        class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        @click="loadDetails"
      >
        <i class="fas fa-eye mr-2" />
        查看详情
      </button>
      <button
        v-else
        class="rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
        @click="expanded = false"
      >
        <i class="fas fa-eye-slash mr-2" />
        收起
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="loading-spinner h-12 w-12 border-4 border-blue-500" />
    </div>

    <!-- 详细列表 -->
    <div v-else-if="expanded && details.length > 0" class="overflow-x-auto">
      <div class="mb-3 text-sm text-gray-600 dark:text-gray-400">
        显示最近 {{ details.length }} 条请求记录
      </div>
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
            >
              时间
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
            >
              模型
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
            >
              输入
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
            >
              输出
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
              总计
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
            >
              费用
            </th>
            <th
              class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
            >
              状态
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          <tr
            v-for="detail in details"
            :key="detail.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              {{ formatDetailTime(detail.occurred_at) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
              <span class="rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900">
                {{ detail.model || 'unknown' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
              {{ formatNumber(detail.input_tokens) }}
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
              {{ formatNumber(detail.output_tokens) }}
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
              {{ formatNumber(detail.cache_create_tokens || 0) }}
            </td>
            <td class="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
              {{ formatNumber(detail.cache_read_tokens || 0) }}
            </td>
            <td class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ formatNumber(detail.total_tokens) }}
            </td>
            <td class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
              ${{ (detail.estimated_cost || 0).toFixed(6) }}
            </td>
            <td class="px-4 py-3 text-center text-sm">
              <span
                v-if="detail.metadata?._no_usage_data"
                class="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              >
                需核对
              </span>
              <span
                v-else-if="detail.metadata?._requires_manual_review"
                class="rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-800 dark:bg-orange-900 dark:text-orange-200"
              >
                已更新
              </span>
              <span
                v-else
                class="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                正常
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 无数据 -->
    <div
      v-else-if="expanded && details.length === 0"
      class="py-8 text-center text-gray-500 dark:text-gray-400"
    >
      <i class="fas fa-inbox mb-2 text-4xl" />
      <p>暂无请求记录</p>
    </div>

    <!-- 未展开提示 -->
    <div v-else class="py-8 text-center text-gray-500 dark:text-gray-400">
      <i class="fas fa-hand-pointer mb-2 text-4xl" />
      <p>点击"查看详情"按钮查看请求明细</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { apiClient } from '@/config/api'

const props = defineProps({
  apiId: {
    type: String,
    required: true
  },
  range: {
    type: String,
    default: 'today'
  }
})

const expanded = ref(false)
const loading = ref(false)
const details = ref([])

async function loadDetails() {
  if (expanded.value) {
    expanded.value = false
    return
  }

  loading.value = true
  expanded.value = true

  try {
    const response = await apiClient.get(`/admin/api-keys/${props.apiId}/usage-details`, {
      params: {
        range: props.range,
        limit: 100
      }
    })

    if (response.success && response.data) {
      details.value = response.data
    } else {
      details.value = []
    }
  } catch (error) {
    console.error('Failed to load request details:', error)
    details.value = []
  } finally {
    loading.value = false
  }
}

function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num.toString()
}

function formatDetailTime(value) {
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
</script>

<style scoped>
.loading-spinner {
  border-top-color: transparent;
  border-radius: 50%;
  animation: spinner 0.6s linear infinite;
}

@keyframes spinner {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
