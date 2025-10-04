<template>
  <div class="analytics-container">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">统计分析</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        深度分析账户性价比、API Key 使用情况和成本趋势
      </p>
    </div>

    <!-- 标签页导航 -->
    <div class="mb-6">
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav aria-label="Tabs" class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              'group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors'
            ]"
            @click="activeTab = tab.id"
          >
            <i :class="[tab.icon, 'mr-2']" />
            {{ tab.name }}
          </button>
        </nav>
      </div>
    </div>

    <!-- 标签页内容 -->
    <div class="tab-content">
      <!-- 账户性价比对比 -->
      <div v-show="activeTab === 'cost-efficiency'" class="space-y-6">
        <CostEfficiencyAnalysis />
      </div>

      <!-- API Key 调用明细 -->
      <div v-show="activeTab === 'api-key-breakdown'" class="space-y-6">
        <ApiKeyBreakdownAnalysis />
      </div>

      <!-- 成本趋势分析 -->
      <div v-show="activeTab === 'cost-trends'" class="space-y-6">
        <CostTrendsAnalysis />
      </div>

      <!-- 成本配置与验证 - 使用 v-if 懒加载 -->
      <div v-if="activeTab === 'cost-tracking'" class="space-y-6">
        <CostTrackingManagement />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CostEfficiencyAnalysis from '@/components/analytics/CostEfficiencyAnalysis.vue'
import ApiKeyBreakdownAnalysis from '@/components/analytics/ApiKeyBreakdownAnalysis.vue'
import CostTrendsAnalysis from '@/components/analytics/CostTrendsAnalysis.vue'
import CostTrackingManagement from '@/components/analytics/CostTrackingManagement.vue'

const activeTab = ref('cost-efficiency')

const tabs = [
  {
    id: 'cost-efficiency',
    name: '账户性价比对比',
    icon: 'fas fa-chart-line'
  },
  {
    id: 'api-key-breakdown',
    name: 'API Key 调用明细',
    icon: 'fas fa-key'
  },
  {
    id: 'cost-trends',
    name: '成本趋势分析',
    icon: 'fas fa-chart-area'
  },
  {
    id: 'cost-tracking',
    name: '成本配置与验证',
    icon: 'fas fa-cog'
  }
]
</script>

<style scoped>
.analytics-container {
  padding: 1.5rem;
}
</style>
