<template>
  <div class="cost-trends-analysis">
    <div class="card p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">成本趋势分析</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">查看成本变化趋势和预测</p>
        </div>
        <div class="flex gap-3">
          <select
            v-model="filters.range"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            @change="loadData"
          >
            <option value="7days">7天</option>
            <option value="30d">30天</option>
            <option value="90d">90天</option>
          </select>
          <select
            v-model="filters.interval"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            @change="loadData"
          >
            <option value="hourly">按小时</option>
            <option value="daily">按天</option>
            <option value="weekly">按周</option>
          </select>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex h-64 items-center justify-center">
        <div class="loading-spinner h-12 w-12 border-4 border-indigo-500" />
      </div>

      <!-- 图表 -->
      <div v-else>
        <div class="mb-6 h-80">
          <canvas ref="chartCanvas" />
        </div>

        <!-- 统计卡片 -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div
            class="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">总成本</div>
            <div class="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
              ${{ stats.totalCost.toFixed(6) }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">平均成本</div>
            <div class="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
              ${{ stats.avgCost.toFixed(6) }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:from-purple-900/20 dark:to-pink-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">最高成本</div>
            <div class="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
              ${{ stats.maxCost.toFixed(6) }}
            </div>
          </div>
          <div
            class="rounded-lg bg-gradient-to-br from-orange-50 to-red-50 p-4 dark:from-orange-900/20 dark:to-red-900/20"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">增长率</div>
            <div
              class="mt-1 text-xl font-bold"
              :class="stats.growthRate >= 0 ? 'text-red-600' : 'text-green-600'"
            >
              {{ stats.growthRate >= 0 ? '+' : '' }}{{ stats.growthRate.toFixed(1) }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'
import Chart from 'chart.js/auto'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const themeStore = useThemeStore()
const { isDarkMode } = storeToRefs(themeStore)

const loading = ref(false)
const chartCanvas = ref(null)
let chartInstance = null

const filters = ref({
  range: '30d',
  interval: 'daily'
})

const trends = ref([])

const stats = computed(() => {
  if (trends.value.length === 0) {
    return { totalCost: 0, avgCost: 0, maxCost: 0, growthRate: 0 }
  }

  const costs = trends.value.map((t) => t.cost || 0)
  const totalCost = costs.reduce((sum, c) => sum + c, 0)
  const avgCost = totalCost / costs.length
  const maxCost = Math.max(...costs)

  // 计算增长率（最后一天 vs 第一天）
  const firstCost = costs[0] || 0
  const lastCost = costs[costs.length - 1] || 0
  const growthRate = firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0

  return { totalCost, avgCost, maxCost, growthRate }
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await apiClient.get('/admin/dashboard/cost-efficiency/trends', {
      params: filters.value
    })
    if (response.success) {
      trends.value = response.data?.data || []
      createChart()
    }
  } catch (error) {
    showToast('加载趋势数据失败', 'error')
  } finally {
    loading.value = false
  }
}

const createChart = () => {
  if (!chartCanvas.value || trends.value.length === 0) return

  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = trends.value.map((t) => t.date || t.label)
  const data = trends.value.map((t) => t.cost || 0)

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '成本',
          data,
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `成本: $${context.parsed.y.toFixed(6)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `$${value.toFixed(6)}`,
            color: isDarkMode.value ? '#9ca3af' : '#6b7280'
          },
          grid: {
            color: isDarkMode.value ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          ticks: {
            color: isDarkMode.value ? '#9ca3af' : '#6b7280'
          },
          grid: {
            color: isDarkMode.value ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0, 0, 0, 0.1)'
          }
        }
      }
    }
  })
}

watch(isDarkMode, () => {
  createChart()
})

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>
