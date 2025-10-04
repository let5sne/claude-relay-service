<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content-large">
      <div class="modal-header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          成本验证 - {{ account.name }}
        </h3>
        <button class="close-btn" @click="$emit('close')">
          <i class="fas fa-times" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 选择计费周期 -->
        <div class="mb-6">
          <label class="form-label">选择验证周期</label>
          <div class="flex gap-3">
            <input
              v-model="validationPeriod"
              class="form-input flex-1"
              placeholder="2025-01"
              type="month"
            />
            <button class="btn-primary" :disabled="validating" @click="runValidation">
              <i class="fas fa-play" :class="{ 'fa-spin': validating }" />
              {{ validating ? '验证中...' : '开始验证' }}
            </button>
          </div>
        </div>

        <!-- 验证结果 -->
        <div v-if="validationResult" class="space-y-6">
          <!-- 对比卡片 -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div class="stat-card">
              <div class="stat-label">计算成本</div>
              <div class="stat-value text-blue-600 dark:text-blue-400">
                ${{ validationResult.calculatedCost?.toFixed(4) || '0.0000' }}
              </div>
              <div class="stat-hint">基于使用量计算</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">实际账单</div>
              <div class="stat-value text-green-600 dark:text-green-400">
                ${{ validationResult.actualBill?.toFixed(4) || '0.0000' }}
              </div>
              <div class="stat-hint">从账单记录获取</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">偏差率</div>
              <div class="stat-value" :class="getDeviationClass(validationResult.deviationPercent)">
                {{ Math.abs(validationResult.deviationPercent || 0).toFixed(2) }}%
              </div>
              <div class="stat-hint">
                {{ validationResult.deviationPercent > 0 ? '高估' : '低估' }}
              </div>
            </div>
          </div>

          <!-- 质量评分 -->
          <div v-if="validationResult.quality" class="quality-section">
            <h4 class="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              推导质量评分
            </h4>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="quality-metric">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600 dark:text-gray-400">总分</span>
                  <span class="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {{ (validationResult.quality.score * 100).toFixed(1) }}%
                  </span>
                </div>
                <div class="progress-bar mt-2">
                  <div
                    class="progress-fill bg-green-500"
                    :style="{ width: validationResult.quality.score * 100 + '%' }"
                  />
                </div>
              </div>

              <div class="quality-metric">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600 dark:text-gray-400">R² 决定系数</span>
                  <span class="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {{ (validationResult.quality.r_squared * 100).toFixed(1) }}%
                  </span>
                </div>
                <div class="progress-bar mt-2">
                  <div
                    class="progress-fill bg-blue-500"
                    :style="{ width: validationResult.quality.r_squared * 100 + '%' }"
                  />
                </div>
              </div>

              <div class="quality-metric">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600 dark:text-gray-400">平均绝对误差</span>
                  <span class="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {{ (validationResult.quality.mean_absolute_error * 100).toFixed(2) }}%
                  </span>
                </div>
                <div class="progress-bar mt-2">
                  <div
                    class="progress-fill bg-yellow-500"
                    :style="{
                      width: (1 - validationResult.quality.mean_absolute_error) * 100 + '%'
                    }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 详细信息 -->
          <div class="details-section">
            <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">验证详情</h4>
            <div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div class="detail-item">
                <span class="detail-label">计费周期:</span>
                <span class="detail-value">{{ validationResult.billingPeriod }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">计算方法:</span>
                <span class="detail-value">{{ validationResult.calculationMethod }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">数据来源:</span>
                <span class="detail-value">{{ validationResult.costSource }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">置信度:</span>
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="getConfidenceBadgeClass(validationResult.confidenceLevel)"
                >
                  {{ getConfidenceLevelLabel(validationResult.confidenceLevel) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 成本对比报告 -->
          <div v-if="comparisonData" class="comparison-section">
            <div class="mb-4 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">成本对比趋势</h4>
              <button class="btn-sm btn-secondary" @click="loadComparisonReport">
                <i class="fas fa-sync-alt" :class="{ 'fa-spin': loadingComparison }" />
                刷新
              </button>
            </div>
            <div ref="chartContainer" class="chart-container" />
          </div>

          <!-- 建议 -->
          <div v-if="validationResult.suggestions" class="suggestions-section">
            <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <i class="fas fa-lightbulb text-yellow-500" /> 优化建议
            </h4>
            <ul class="space-y-2">
              <li
                v-for="(suggestion, index) in validationResult.suggestions"
                :key="index"
                class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <i class="fas fa-check-circle mt-0.5 text-green-500" />
                <span>{{ suggestion }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <i class="fas fa-chart-line mb-3 text-4xl text-gray-300 dark:text-gray-600" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            选择计费周期并点击"开始验证"以查看结果
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" type="button" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import costTrackingApi from '@/services/costTrackingApi'
import * as echarts from 'echarts'

const props = defineProps({
  account: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])

const validating = ref(false)
const validationPeriod = ref('')
const validationResult = ref(null)
const comparisonData = ref(null)
const loadingComparison = ref(false)
const chartContainer = ref(null)
let chartInstance = null

// 运行验证
async function runValidation() {
  if (!validationPeriod.value) {
    alert('请选择验证周期')
    return
  }

  validating.value = true
  try {
    const result = await costTrackingApi.validateCosts(props.account.id, validationPeriod.value)

    // 调试：查看返回的数据结构
    console.log('Validation result:', result)

    // 安全检查：确保 result 存在
    if (!result) {
      alert('验证失败：未收到服务器响应')
      return
    }

    // 检查是否因数据库未启用而失败
    if (result.validated === false && result.reason === 'database_disabled') {
      alert(
        '成本验证功能需要 PostgreSQL 数据库支持。\n\n请在环境变量中设置 POSTGRES_ENABLED=true 并配置数据库连接参数后重启服务。'
      )
      return
    }

    // 检查是否因缺少账单数据而失败
    if (result.validated === false && result.reason === 'no_bill_data') {
      alert(
        result.message ||
          `未找到 ${validationPeriod.value} 的账单数据。\n\n请先录入该周期的账单数据。`
      )
      return
    }

    validationResult.value = result

    // 生成建议
    generateSuggestions()

    // 加载对比报告
    await loadComparisonReport()
  } catch (error) {
    console.error('Validation error:', error)
    alert(`验证失败: ${error.response?.data?.error || error.message}`)
  } finally {
    validating.value = false
  }
}

// 加载成本对比报告
async function loadComparisonReport() {
  loadingComparison.value = true
  try {
    const endDate = new Date(validationPeriod.value + '-01')
    const startDate = new Date(endDate)
    startDate.setMonth(startDate.getMonth() - 5) // 前6个月

    const report = await costTrackingApi.getCostComparison(
      props.account.id,
      startDate.toISOString().slice(0, 10),
      endDate.toISOString().slice(0, 10)
    )
    comparisonData.value = report

    await nextTick()
    renderChart()
  } catch (err) {
    console.error('Failed to load comparison:', err)
  } finally {
    loadingComparison.value = false
  }
}

// 渲染图表
function renderChart() {
  if (!chartContainer.value || !comparisonData.value) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartContainer.value)

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textStyle: { color: '#fff' }
    },
    legend: {
      data: ['计算成本', '实际账单'],
      textStyle: {
        color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#4B5563'
      }
    },
    xAxis: {
      type: 'category',
      data: comparisonData.value.periods || [],
      axisLabel: {
        color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
      }
    },
    yAxis: {
      type: 'value',
      name: '成本 ($)',
      axisLabel: {
        color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
      }
    },
    series: [
      {
        name: '计算成本',
        type: 'line',
        data: comparisonData.value.calculatedCosts || [],
        smooth: true,
        itemStyle: { color: '#3B82F6' }
      },
      {
        name: '实际账单',
        type: 'line',
        data: comparisonData.value.actualBills || [],
        smooth: true,
        itemStyle: { color: '#10B981' }
      }
    ]
  }

  chartInstance.setOption(option)
}

// 生成建议
function generateSuggestions() {
  if (!validationResult.value) return

  const suggestions = []
  const deviation = Math.abs(validationResult.value.deviationPercent || 0)

  if (deviation > 20) {
    suggestions.push('偏差较大，建议重新推导计价参数或检查账单数据准确性')
  } else if (deviation > 10) {
    suggestions.push('偏差适中，可考虑录入更多账单数据以提高推导精度')
  } else if (deviation < 5) {
    suggestions.push('计算精度优秀，当前配置可靠')
  }

  if (validationResult.value.quality?.r_squared < 0.8) {
    suggestions.push('R²系数较低，推导模型可能不够准确，建议手动调整参数')
  }

  validationResult.value.suggestions = suggestions
}

// 工具函数
function getDeviationClass(deviation) {
  const absDeviation = Math.abs(deviation || 0)
  if (absDeviation < 5) return 'text-green-600 dark:text-green-400'
  if (absDeviation < 10) return 'text-yellow-600 dark:text-yellow-400'
  if (absDeviation < 20) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function getConfidenceBadgeClass(level) {
  const classes = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'medium-high': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'low-medium': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    low: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  }
  return classes[level] || 'bg-gray-100 text-gray-800'
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

onMounted(() => {
  // 设置默认为当前月份
  const now = new Date()
  validationPeriod.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4;
}

.modal-content-large {
  @apply max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800;
  display: flex;
  flex-direction: column;
}

.modal-header {
  @apply flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700;
}

.modal-body {
  @apply overflow-y-auto p-6;
}

.modal-footer {
  @apply flex justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-700;
}

.close-btn {
  @apply text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
}

.form-label {
  @apply mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.form-input {
  @apply rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100;
}

.stat-card {
  @apply rounded-lg border border-gray-200 p-4 dark:border-gray-700;
}

.stat-label {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.stat-value {
  @apply mt-1 text-2xl font-bold;
}

.stat-hint {
  @apply mt-1 text-xs text-gray-400;
}

.quality-section {
  @apply rounded-lg border border-gray-200 p-4 dark:border-gray-700;
}

.quality-metric {
  @apply rounded-lg bg-gray-50 p-3 dark:bg-gray-900;
}

.progress-bar {
  @apply h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700;
}

.progress-fill {
  @apply h-full transition-all duration-300;
}

.details-section {
  @apply rounded-lg border border-gray-200 p-4 dark:border-gray-700;
}

.detail-item {
  @apply flex items-center gap-2;
}

.detail-label {
  @apply text-gray-500 dark:text-gray-400;
}

.detail-value {
  @apply font-medium text-gray-900 dark:text-gray-100;
}

.comparison-section {
  @apply rounded-lg border border-gray-200 p-4 dark:border-gray-700;
}

.chart-container {
  @apply h-64 w-full;
}

.suggestions-section {
  @apply rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12;
}

.btn-primary {
  @apply rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600;
}

.btn-secondary {
  @apply rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600;
}

.btn-sm {
  @apply rounded px-2 py-1 text-xs;
}
</style>
