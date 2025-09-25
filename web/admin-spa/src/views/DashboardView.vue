<template>
  <div>
    <!-- 主要统计 -->
    <div
      class="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 md:mb-8 md:gap-6 lg:grid-cols-4"
    >
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              总API Keys
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ dashboardData.totalApiKeys }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              活跃: {{ dashboardData.activeApiKeys || 0 }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
            <i class="fas fa-key" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              服务账户
            </p>
            <div class="flex flex-wrap items-baseline gap-x-2">
              <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                {{ dashboardData.totalAccounts }}
              </p>
              <!-- 各平台账户数量展示 -->
              <div v-if="dashboardData.accountsByPlatform" class="flex items-center gap-2">
                <!-- Claude账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.claude &&
                    dashboardData.accountsByPlatform.claude.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Claude: ${dashboardData.accountsByPlatform.claude.total} 个 (正常: ${dashboardData.accountsByPlatform.claude.normal})`"
                >
                  <i class="fas fa-brain text-xs text-indigo-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.claude.total
                  }}</span>
                </div>
                <!-- Claude Console账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform['claude-console'] &&
                    dashboardData.accountsByPlatform['claude-console'].total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Console: ${dashboardData.accountsByPlatform['claude-console'].total} 个 (正常: ${dashboardData.accountsByPlatform['claude-console'].normal})`"
                >
                  <i class="fas fa-terminal text-xs text-purple-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform['claude-console'].total
                  }}</span>
                </div>
                <!-- Gemini账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.gemini &&
                    dashboardData.accountsByPlatform.gemini.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Gemini: ${dashboardData.accountsByPlatform.gemini.total} 个 (正常: ${dashboardData.accountsByPlatform.gemini.normal})`"
                >
                  <i class="fas fa-robot text-xs text-yellow-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.gemini.total
                  }}</span>
                </div>
                <!-- Bedrock账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.bedrock &&
                    dashboardData.accountsByPlatform.bedrock.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Bedrock: ${dashboardData.accountsByPlatform.bedrock.total} 个 (正常: ${dashboardData.accountsByPlatform.bedrock.normal})`"
                >
                  <i class="fab fa-aws text-xs text-orange-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.bedrock.total
                  }}</span>
                </div>
                <!-- OpenAI账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.openai &&
                    dashboardData.accountsByPlatform.openai.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`OpenAI: ${dashboardData.accountsByPlatform.openai.total} 个 (正常: ${dashboardData.accountsByPlatform.openai.normal})`"
                >
                  <i class="fas fa-openai text-xs text-gray-100" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.openai.total
                  }}</span>
                </div>
                <!-- Azure OpenAI账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.azure_openai &&
                    dashboardData.accountsByPlatform.azure_openai.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Azure OpenAI: ${dashboardData.accountsByPlatform.azure_openai.total} 个 (正常: ${dashboardData.accountsByPlatform.azure_openai.normal})`"
                >
                  <i class="fab fa-microsoft text-xs text-blue-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.azure_openai.total
                  }}</span>
                </div>
                <!-- OpenAI-Responses账户 -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform['openai-responses'] &&
                    dashboardData.accountsByPlatform['openai-responses'].total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`OpenAI Responses: ${dashboardData.accountsByPlatform['openai-responses'].total} 个 (正常: ${dashboardData.accountsByPlatform['openai-responses'].normal})`"
                >
                  <i class="fas fa-server text-xs text-cyan-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform['openai-responses'].total
                  }}</span>
                </div>
              </div>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              正常: {{ dashboardData.normalAccounts || 0 }}
              <span v-if="dashboardData.abnormalAccounts > 0" class="text-red-600">
                | 异常: {{ dashboardData.abnormalAccounts }}
              </span>
              <span
                v-if="dashboardData.pausedAccounts > 0"
                class="text-gray-600 dark:text-gray-400"
              >
                | 停止调度: {{ dashboardData.pausedAccounts }}
              </span>
              <span v-if="dashboardData.rateLimitedAccounts > 0" class="text-yellow-600">
                | 限流: {{ dashboardData.rateLimitedAccounts }}
              </span>
            </p>
          </div>
          <div class="stat-icon ml-2 flex-shrink-0 bg-gradient-to-br from-green-500 to-green-600">
            <i class="fas fa-user-circle" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              今日请求
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ dashboardData.todayRequests }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              总请求: {{ formatNumber(dashboardData.totalRequests || 0) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-purple-500 to-purple-600">
            <i class="fas fa-chart-line" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              系统状态
            </p>
            <p class="text-2xl font-bold text-green-600 sm:text-3xl">
              {{ dashboardData.systemStatus }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              运行时间: {{ formattedUptime }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-yellow-500 to-orange-500">
            <i class="fas fa-heartbeat" />
          </div>
        </div>
      </div>
    </div>

    <!-- Token统计和性能指标 -->
    <div
      class="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 md:mb-8 md:gap-6 lg:grid-cols-4"
    >
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="mr-8 flex-1">
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              今日Token
            </p>
            <div class="mb-2 flex flex-wrap items-baseline gap-2">
              <p class="text-xl font-bold text-blue-600 sm:text-2xl md:text-3xl">
                {{
                  formatNumber(
                    (dashboardData.todayInputTokens || 0) +
                      (dashboardData.todayOutputTokens || 0) +
                      (dashboardData.todayCacheCreateTokens || 0) +
                      (dashboardData.todayCacheReadTokens || 0)
                  )
                }}
              </p>
              <span class="text-sm font-medium text-green-600"
                >/ {{ costsData.todayCosts.formatted.totalCost }}</span
              >
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              <div class="flex flex-wrap items-center justify-between gap-x-4">
                <span
                  >输入:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayInputTokens || 0)
                  }}</span></span
                >
                <span
                  >输出:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayOutputTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.todayCacheCreateTokens || 0) > 0" class="text-purple-600"
                  >缓存创建:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayCacheCreateTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.todayCacheReadTokens || 0) > 0" class="text-purple-600"
                  >缓存读取:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayCacheReadTokens || 0)
                  }}</span></span
                >
              </div>
            </div>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-600">
            <i class="fas fa-coins" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="mr-8 flex-1">
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              总Token消耗
            </p>
            <div class="mb-2 flex flex-wrap items-baseline gap-2">
              <p class="text-xl font-bold text-emerald-600 sm:text-2xl md:text-3xl">
                {{
                  formatNumber(
                    (dashboardData.totalInputTokens || 0) +
                      (dashboardData.totalOutputTokens || 0) +
                      (dashboardData.totalCacheCreateTokens || 0) +
                      (dashboardData.totalCacheReadTokens || 0)
                  )
                }}
              </p>
              <span class="text-sm font-medium text-green-600"
                >/ {{ costsData.totalCosts.formatted.totalCost }}</span
              >
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              <div class="flex flex-wrap items-center justify-between gap-x-4">
                <span
                  >输入:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalInputTokens || 0)
                  }}</span></span
                >
                <span
                  >输出:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalOutputTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.totalCacheCreateTokens || 0) > 0" class="text-purple-600"
                  >缓存创建:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalCacheCreateTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.totalCacheReadTokens || 0) > 0" class="text-purple-600"
                  >缓存读取:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalCacheReadTokens || 0)
                  }}</span></span
                >
              </div>
            </div>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-600">
            <i class="fas fa-database" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              实时RPM
              <span class="text-xs text-gray-400">({{ dashboardData.metricsWindow }}分钟)</span>
            </p>
            <p class="text-2xl font-bold text-orange-600 sm:text-3xl">
              {{ dashboardData.realtimeRPM || 0 }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              每分钟请求数
              <span v-if="dashboardData.isHistoricalMetrics" class="text-yellow-600">
                <i class="fas fa-exclamation-circle" /> 历史数据
              </span>
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-orange-500 to-orange-600">
            <i class="fas fa-tachometer-alt" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              实时TPM
              <span class="text-xs text-gray-400">({{ dashboardData.metricsWindow }}分钟)</span>
            </p>
            <p class="text-2xl font-bold text-rose-600 sm:text-3xl">
              {{ formatNumber(dashboardData.realtimeTPM || 0) }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              每分钟Token数
              <span v-if="dashboardData.isHistoricalMetrics" class="text-yellow-600">
                <i class="fas fa-exclamation-circle" /> 历史数据
              </span>
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-rose-500 to-rose-600">
            <i class="fas fa-rocket" />
          </div>
        </div>
      </div>
    </div>

    <!-- 模型消费统计 -->
    <div class="mb-8">
      <div class="mb-4 flex flex-col gap-4 sm:mb-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
          模型使用分布与Token使用趋势
        </h3>
        <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
          <!-- 快捷日期选择 -->
          <div
            class="flex flex-shrink-0 gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-700"
          >
            <button
              v-for="option in dateFilter.presetOptions"
              :key="option.value"
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                dateFilter.preset === option.value && dateFilter.type === 'preset'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setDateFilterPreset(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <!-- 粒度切换按钮 -->
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                trendGranularity === 'day'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setTrendGranularity('day')"
            >
              <i class="fas fa-calendar-day mr-1" />按天
            </button>
            <button
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                trendGranularity === 'hour'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setTrendGranularity('hour')"
            >
              <i class="fas fa-clock mr-1" />按小时
            </button>
          </div>

          <!-- Element Plus 日期范围选择器 -->
          <div class="flex items-center gap-2">
            <el-date-picker
              v-model="dateFilter.customRange"
              class="custom-date-picker w-full lg:w-auto"
              :default-time="defaultTime"
              :disabled-date="disabledDate"
              end-placeholder="结束日期"
              format="YYYY-MM-DD HH:mm:ss"
              range-separator="至"
              size="default"
              start-placeholder="开始日期"
              style="max-width: 400px"
              type="datetimerange"
              value-format="YYYY-MM-DD HH:mm:ss"
              @change="onCustomDateRangeChange"
            />
            <span v-if="trendGranularity === 'hour'" class="text-xs text-orange-600">
              <i class="fas fa-info-circle" /> 最多24小时
            </span>
          </div>

          <!-- 刷新控制 -->
          <div class="flex items-center gap-2">
            <!-- 自动刷新控制 -->
            <div class="flex items-center rounded-lg bg-gray-100 px-3 py-1 dark:bg-gray-700">
              <label class="relative inline-flex cursor-pointer items-center">
                <input v-model="autoRefreshEnabled" class="peer sr-only" type="checkbox" />
                <!-- 更小的开关 -->
                <div
                  class="peer relative h-5 w-9 rounded-full bg-gray-300 transition-all duration-200 after:absolute after:left-[2px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:content-[''] peer-checked:bg-blue-500 peer-checked:after:translate-x-4 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:bg-gray-600 dark:after:bg-gray-300 dark:peer-focus:ring-blue-600"
                />
                <span
                  class="ml-2.5 flex select-none items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  <i class="fas fa-redo-alt text-xs text-gray-500 dark:text-gray-400" />
                  <span>自动刷新</span>
                  <span
                    v-if="autoRefreshEnabled"
                    class="ml-1 font-mono text-xs text-blue-600 transition-opacity"
                    :class="refreshCountdown > 0 ? 'opacity-100' : 'opacity-0'"
                  >
                    {{ refreshCountdown }}s
                  </span>
                </span>
              </label>
            </div>

            <!-- 刷新按钮 -->
            <button
              class="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 sm:gap-2"
              :disabled="isRefreshing"
              title="立即刷新数据"
              @click="refreshAllData()"
            >
              <i :class="['fas fa-sync-alt text-xs', { 'animate-spin': isRefreshing }]" />
              <span class="hidden sm:inline">{{ isRefreshing ? '刷新中' : '刷新' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- 饼图 -->
        <div class="card p-4 sm:p-6">
          <h4 class="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200 sm:text-lg">
            Token使用分布
          </h4>
          <div class="relative" style="height: 250px">
            <canvas ref="modelUsageChart" />
          </div>
        </div>

        <!-- 详细数据表格 -->
        <div class="card p-4 sm:p-6">
          <h4 class="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200 sm:text-lg">
            详细统计数据
          </h4>
          <div v-if="dashboardModelStats.length === 0" class="py-8 text-center">
            <p class="text-sm text-gray-500 sm:text-base">暂无模型使用数据</p>
          </div>
          <div v-else class="max-h-[250px] overflow-auto sm:max-h-[300px]">
            <table class="min-w-full">
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    class="px-2 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 sm:px-4"
                  >
                    模型
                  </th>
                  <th
                    class="hidden px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:table-cell sm:px-4"
                  >
                    请求数
                  </th>
                  <th
                    class="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:px-4"
                  >
                    总Token
                  </th>
                  <th
                    class="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:px-4"
                  >
                    费用
                  </th>
                  <th
                    class="hidden px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:table-cell sm:px-4"
                  >
                    占比
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                <tr
                  v-for="stat in dashboardModelStats"
                  :key="stat.model"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td class="px-2 py-2 text-xs text-gray-900 dark:text-gray-100 sm:px-4 sm:text-sm">
                    <span class="block max-w-[100px] truncate sm:max-w-none" :title="stat.model">
                      {{ stat.model }}
                    </span>
                  </td>
                  <td
                    class="hidden px-2 py-2 text-right text-xs text-gray-600 dark:text-gray-400 sm:table-cell sm:px-4 sm:text-sm"
                  >
                    {{ formatNumber(stat.requests) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right text-xs text-gray-600 dark:text-gray-400 sm:px-4 sm:text-sm"
                  >
                    {{ formatNumber(stat.allTokens) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right text-xs font-medium text-green-600 sm:px-4 sm:text-sm"
                  >
                    {{ stat.formatted ? stat.formatted.total : '$0.000000' }}
                  </td>
                  <td
                    class="hidden px-2 py-2 text-right text-xs font-medium sm:table-cell sm:px-4 sm:text-sm"
                  >
                    <span
                      class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {{ calculatePercentage(stat.allTokens, dashboardModelStats) }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Token使用趋势图 -->
    <div class="mb-4 sm:mb-6 md:mb-8">
      <div class="card p-4 sm:p-6">
        <div class="sm:h-[300px]" style="height: 250px">
          <canvas ref="usageTrendChart" />
        </div>
      </div>
    </div>

    <!-- API Keys 使用趋势图 -->
    <div class="mb-4 sm:mb-6 md:mb-8">
      <div class="card p-4 sm:p-6">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
            API Keys 使用趋势
          </h3>
          <!-- 维度切换按钮 -->
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              :class="[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                apiKeysTrendMetric === 'requests'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="((apiKeysTrendMetric = 'requests'), updateApiKeysUsageTrendChart())"
            >
              <i class="fas fa-exchange-alt mr-1" /><span class="hidden sm:inline">请求次数</span
              ><span class="sm:hidden">请求</span>
            </button>
            <button
              :class="[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                apiKeysTrendMetric === 'tokens'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="((apiKeysTrendMetric = 'tokens'), updateApiKeysUsageTrendChart())"
            >
              <i class="fas fa-coins mr-1" /><span class="hidden sm:inline">Token 数量</span
              ><span class="sm:hidden">Token</span>
            </button>
          </div>
        </div>
        <div class="mb-4 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
          <span v-if="apiKeysTrendData.totalApiKeys > 10">
            共 {{ apiKeysTrendData.totalApiKeys }} 个 API Key，显示使用量前 10 个
          </span>
          <span v-else> 共 {{ apiKeysTrendData.totalApiKeys }} 个 API Key </span>
        </div>
        <div class="sm:h-[350px]" style="height: 300px">
          <canvas ref="apiKeysUsageTrendChart" />
        </div>
      </div>
    </div>

    <!-- 账户性价比分析 -->
    <div class="mb-10">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
            账户性价比分析
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">按成本与成功率综合评估各账户表现</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              v-for="option in efficiencyRangeOptions"
              :key="option.value"
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                efficiencyRangeValue === option.value
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setCostEfficiencyRange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <select
            class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            :value="efficiencyPlatformValue"
            @change="setCostEfficiencyPlatform($event.target.value)"
          >
            <option
              v-for="option in efficiencyPlatformOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <button
            class="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-blue-400"
            :disabled="efficiencyLoading"
            @click="loadCostEfficiencyData()"
          >
            <i class="fas fa-sync-alt" :class="{ 'animate-spin': efficiencyLoading }" />
          </button>
        </div>
      </div>

      <div
        v-if="efficiencyLoading"
        class="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <i class="fas fa-circle-notch mr-2 animate-spin" /> 正在加载性价比数据...
      </div>
      <div v-else>
        <div class="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div v-for="card in efficiencyHighlightCards" :key="card.key" class="card p-4">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {{ card.label }}
              </p>
              <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {{ card.value }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ card.description }}
              </p>
            </div>
          </div>
          <div class="card p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                成本 vs 成功率
              </h4>
              <span
                v-if="efficiencyAccountsMeta.total"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                共 {{ efficiencyAccountsMeta.total }} 个账户
              </span>
            </div>
            <div v-if="hasEfficiencyData" class="h-72 sm:h-80">
              <canvas ref="costEfficiencyChart" />
            </div>
            <div
              v-else
              class="flex h-36 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              暂无符合筛选条件的数据
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              泡泡大小表示请求量，颜色代表平台。
            </p>
          </div>
        </div>

        <div class="card mt-6 p-4 sm:p-6">
          <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100">账户性价比排行</h4>
            <div class="flex flex-wrap items-center gap-2">
              <button
                :class="[
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors sm:text-sm',
                  costEfficiencyFilters.sortBy === 'tokensPerDollar'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                ]"
                @click="toggleCostEfficiencySort('tokensPerDollar')"
              >
                Tokens / $
                <i
                  v-if="costEfficiencyFilters.sortBy === 'tokensPerDollar'"
                  class="fas ml-1"
                  :class="costEfficiencyFilters.order === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'"
                />
              </button>
              <button
                :class="[
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors sm:text-sm',
                  costEfficiencyFilters.sortBy === 'costPerMillion'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                ]"
                @click="toggleCostEfficiencySort('costPerMillion')"
              >
                $ / 百万 Tokens
                <i
                  v-if="costEfficiencyFilters.sortBy === 'costPerMillion'"
                  class="fas ml-1"
                  :class="costEfficiencyFilters.order === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'"
                />
              </button>
              <button
                :class="[
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors sm:text-sm',
                  costEfficiencyFilters.sortBy === 'successRate'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                ]"
                @click="toggleCostEfficiencySort('successRate')"
              >
                成功率
                <i
                  v-if="costEfficiencyFilters.sortBy === 'successRate'"
                  class="fas ml-1"
                  :class="costEfficiencyFilters.order === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'"
                />
              </button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table
              class="min-w-full divide-y divide-gray-200 text-xs text-gray-600 dark:divide-gray-700 dark:text-gray-300 sm:text-sm"
            >
              <thead
                class="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"
              >
                <tr>
                  <th class="px-3 py-2 text-left">账户</th>
                  <th class="px-3 py-2 text-right">费用</th>
                  <th class="px-3 py-2 text-right">Tokens</th>
                  <th class="px-3 py-2 text-right">Tokens / $</th>
                  <th class="px-3 py-2 text-right">$ / 百万 Tokens</th>
                  <th class="px-3 py-2 text-right">成功率</th>
                  <th class="px-3 py-2 text-right">平均延迟</th>
                  <th class="px-3 py-2 text-right">请求数</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-if="!hasEfficiencyData">
                  <td class="px-3 py-4 text-center text-gray-500 dark:text-gray-400" colspan="8">
                    暂无数据
                  </td>
                </tr>
                <tr
                  v-for="item in efficiencyAccounts"
                  :key="item.account.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                >
                  <td class="px-3 py-3">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-flex h-2 w-2 flex-shrink-0 rounded-full"
                        :style="{ backgroundColor: getPlatformColor(item.account.platform) }"
                      />
                      <div>
                        <p class="font-medium text-gray-900 dark:text-gray-100">
                          {{ item.account.name || item.account.id }}
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          {{
                            platformLabels[item.account.platform] ||
                            item.account.platform ||
                            '未知平台'
                          }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{ formatCurrency(item.metrics.totalCost, 4) }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{ formatNumber(item.metrics.totalTokens || 0) }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{
                      item.metrics.tokensPerDollar !== null &&
                      item.metrics.tokensPerDollar !== undefined
                        ? item.metrics.tokensPerDollar.toFixed(2)
                        : '--'
                    }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{
                      item.metrics.costPerMillion !== null &&
                      item.metrics.costPerMillion !== undefined
                        ? item.metrics.costPerMillion.toFixed(2)
                        : '--'
                    }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{
                      item.metrics.successRate !== null && item.metrics.successRate !== undefined
                        ? (item.metrics.successRate * 100).toFixed(1) + '%'
                        : '--'
                    }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{ formatLatency(item.metrics.avgLatencyMs) }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    {{ (item.metrics.totalRequests || 0).toLocaleString() }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import { useThemeStore } from '@/stores/theme'
import Chart from 'chart.js/auto'

const dashboardStore = useDashboardStore()
const themeStore = useThemeStore()
const { isDarkMode } = storeToRefs(themeStore)

const {
  dashboardData,
  costsData,
  dashboardModelStats,
  trendData,
  apiKeysTrendData,
  efficiencyLoading,
  efficiencySummary,
  efficiencyAccounts,
  efficiencyAccountsMeta,
  costEfficiencyFilters,
  formattedUptime,
  dateFilter,
  trendGranularity,
  apiKeysTrendMetric,
  defaultTime
} = storeToRefs(dashboardStore)

const {
  loadDashboardData,
  loadApiKeysTrend,
  loadCostEfficiencyData,
  setDateFilterPreset,
  onCustomDateRangeChange,
  setTrendGranularity,
  refreshChartsData,
  disabledDate,
  setCostEfficiencyRange,
  setCostEfficiencyPlatform,
  toggleCostEfficiencySort
} = dashboardStore

// Chart 实例
const modelUsageChart = ref(null)
const usageTrendChart = ref(null)
const apiKeysUsageTrendChart = ref(null)
let modelUsageChartInstance = null
let usageTrendChartInstance = null
let apiKeysUsageTrendChartInstance = null
const costEfficiencyChart = ref(null)
let costEfficiencyChartInstance = null

// 自动刷新相关
const autoRefreshEnabled = ref(false)
const autoRefreshInterval = ref(30) // 秒
const autoRefreshTimer = ref(null)
const refreshCountdown = ref(0)
const countdownTimer = ref(null)
const isRefreshing = ref(false)

// 计算倒计时显示
// const refreshCountdownDisplay = computed(() => {
//   if (!autoRefreshEnabled.value || refreshCountdown.value <= 0) return ''
//   return `${refreshCountdown.value}秒后刷新`
// })

// 图表颜色配置（根据主题动态调整）
const chartColors = computed(() => ({
  text: isDarkMode.value ? '#e5e7eb' : '#374151',
  grid: isDarkMode.value ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0, 0, 0, 0.1)',
  legend: isDarkMode.value ? '#e5e7eb' : '#374151'
}))

const platformColorMap = {
  claude: '#4F46E5',
  'claude-console': '#7C3AED',
  gemini: '#0EA5E9',
  bedrock: '#F97316',
  openai: '#16A34A',
  azure_openai: '#2563EB',
  'openai-responses': '#14B8A6',
  ccr: '#D97706'
}

const platformLabels = {
  claude: 'Claude',
  'claude-console': 'Console',
  gemini: 'Gemini',
  bedrock: 'Bedrock',
  openai: 'OpenAI',
  azure_openai: 'Azure OpenAI',
  'openai-responses': 'Responses',
  ccr: 'CCR'
}

const efficiencyRangeOptions = [
  { value: 'today', label: '今日' },
  { value: '7days', label: '7天' },
  { value: '30d', label: '30天' },
  { value: 'total', label: '全部' }
]

const efficiencyPlatformOptions = [
  { value: 'all', label: '全部平台' },
  { value: 'claude', label: 'Claude' },
  { value: 'claude-console', label: 'Console' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'bedrock', label: 'Bedrock' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure_openai', label: 'Azure OpenAI' }
]

// 格式化数字
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }
  return num.toString()
}

function formatCurrency(value, decimals = 2) {
  if (value === null || value === undefined) return '--'
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return `$${num.toFixed(decimals)}`
}

function formatLatency(value) {
  if (value === null || value === undefined) return '--'
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return `${Math.round(num)}ms`
}

function getPlatformColor(platform) {
  return platformColorMap[platform] || '#64748B'
}

const efficiencyTotals = computed(() => efficiencySummary.value?.totals || null)
const hasEfficiencyData = computed(() => (efficiencyAccounts.value || []).length > 0)
const efficiencyRangeValue = computed(() => costEfficiencyFilters.value.range || '30d')
const efficiencyPlatformValue = computed(() => costEfficiencyFilters.value.platform || 'all')

const efficiencyHighlightCards = computed(() => {
  const totals = efficiencyTotals.value

  if (!totals) {
    return [
      {
        key: 'tokensPerDollar',
        label: 'Tokens / $',
        value: '--',
        description: '平均每美元可用Token量'
      },
      {
        key: 'costPerMillion',
        label: '$ / 百万 Tokens',
        value: '--',
        description: '产出一百万Token的平均成本'
      },
      { key: 'successRate', label: '成功率', value: '--', description: '请求成功占比' },
      { key: 'latency', label: '平均延迟', value: '--', description: '平均响应耗时 (P95)' }
    ]
  }

  return [
    {
      key: 'tokensPerDollar',
      label: 'Tokens / $',
      value:
        totals.tokensPerDollar !== null && totals.tokensPerDollar !== undefined
          ? totals.tokensPerDollar.toFixed(2)
          : '--',
      description: '平均每美元可用Token量'
    },
    {
      key: 'costPerMillion',
      label: '$ / 百万 Tokens',
      value:
        totals.costPerMillion !== null && totals.costPerMillion !== undefined
          ? totals.costPerMillion.toFixed(2)
          : '--',
      description: '产出一百万Token的平均成本'
    },
    {
      key: 'successRate',
      label: '成功率',
      value:
        totals.successRate !== null && totals.successRate !== undefined
          ? `${(totals.successRate * 100).toFixed(1)}%`
          : '--',
      description: `请求总数 ${totals.totalRequests?.toLocaleString?.() || totals.totalRequests || 0}`
    },
    {
      key: 'latency',
      label: '平均延迟',
      value: formatLatency(totals.avgLatencyMs),
      description: `P95 ${formatLatency(totals.p95LatencyMs)}`
    }
  ]
})

// 计算百分比
function calculatePercentage(value, stats) {
  if (!stats || stats.length === 0) return 0
  const total = stats.reduce((sum, stat) => sum + stat.allTokens, 0)
  if (total === 0) return 0
  return ((value / total) * 100).toFixed(1)
}

// 创建模型使用饼图
function createModelUsageChart() {
  if (!modelUsageChart.value) return

  if (modelUsageChartInstance) {
    modelUsageChartInstance.destroy()
  }

  const data = dashboardModelStats.value || []
  const chartData = {
    labels: data.map((d) => d.model),
    datasets: [
      {
        data: data.map((d) => d.allTokens),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
          '#EC4899',
          '#14B8A6',
          '#F97316',
          '#6366F1',
          '#84CC16'
        ],
        borderWidth: 0
      }
    ]
  }

  modelUsageChartInstance = new Chart(modelUsageChart.value, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            font: {
              size: 12
            },
            color: chartColors.value.legend
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || ''
              const value = formatNumber(context.parsed)
              const percentage = calculatePercentage(context.parsed, data)
              return `${label}: ${value} (${percentage}%)`
            }
          }
        }
      }
    }
  })
}

// 创建使用趋势图
function createUsageTrendChart() {
  if (!usageTrendChart.value) return

  if (usageTrendChartInstance) {
    usageTrendChartInstance.destroy()
  }

  const data = trendData.value || []

  // 准备多维度数据
  const inputData = data.map((d) => d.inputTokens || 0)
  const outputData = data.map((d) => d.outputTokens || 0)
  const cacheCreateData = data.map((d) => d.cacheCreateTokens || 0)
  const cacheReadData = data.map((d) => d.cacheReadTokens || 0)
  const requestsData = data.map((d) => d.requests || 0)
  const costData = data.map((d) => d.cost || 0)

  // 根据数据类型确定标签字段和格式
  const labelField = data[0]?.date ? 'date' : 'hour'
  const labels = data.map((d) => {
    // 优先使用后端提供的label字段
    if (d.label) {
      return d.label
    }

    if (labelField === 'hour') {
      // 格式化小时显示
      const date = new Date(d.hour)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      return `${month}/${day} ${hour}:00`
    }
    // 按天显示时，只显示月/日，不显示年份
    const dateStr = d.date
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-')
      if (parts.length >= 3) {
        return `${parts[1]}/${parts[2]}`
      }
    }
    return d.date
  })

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: '输入Token',
        data: inputData,
        borderColor: 'rgb(102, 126, 234)',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.3
      },
      {
        label: '输出Token',
        data: outputData,
        borderColor: 'rgb(240, 147, 251)',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        tension: 0.3
      },
      {
        label: '缓存创建Token',
        data: cacheCreateData,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3
      },
      {
        label: '缓存读取Token',
        data: cacheReadData,
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        tension: 0.3
      },
      {
        label: '费用 (USD)',
        data: costData,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.3,
        yAxisID: 'y2'
      },
      {
        label: '请求数',
        data: requestsData,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  }

  usageTrendChartInstance = new Chart(usageTrendChart.value, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: 'Token使用趋势',
          font: {
            size: 16,
            weight: 'bold'
          },
          color: chartColors.value.text
        },
        legend: {
          position: 'top',
          labels: {
            color: chartColors.value.legend
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          itemSort: function (a, b) {
            // 按值倒序排列，费用和请求数特殊处理
            const aLabel = a.dataset.label || ''
            const bLabel = b.dataset.label || ''

            // 费用和请求数使用不同的轴，单独处理
            if (aLabel === '费用 (USD)' || bLabel === '费用 (USD)') {
              return aLabel === '费用 (USD)' ? -1 : 1
            }
            if (aLabel === '请求数' || bLabel === '请求数') {
              return aLabel === '请求数' ? 1 : -1
            }

            // 其他按token值倒序
            return b.parsed.y - a.parsed.y
          },
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || ''
              let value = context.parsed.y

              if (label === '费用 (USD)') {
                // 格式化费用显示
                if (value < 0.01) {
                  return label + ': $' + value.toFixed(6)
                } else {
                  return label + ': $' + value.toFixed(4)
                }
              } else if (label === '请求数') {
                return label + ': ' + value.toLocaleString() + ' 次'
              } else {
                // 格式化token数显示
                if (value >= 1000000) {
                  return label + ': ' + (value / 1000000).toFixed(2) + 'M tokens'
                } else if (value >= 1000) {
                  return label + ': ' + (value / 1000).toFixed(2) + 'K tokens'
                } else {
                  return label + ': ' + value.toLocaleString() + ' tokens'
                }
              }
            }
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          title: {
            display: true,
            text: trendGranularity === 'hour' ? '时间' : '日期',
            color: chartColors.value.text
          },
          ticks: {
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Token数量',
            color: chartColors.value.text
          },
          ticks: {
            callback: function (value) {
              return formatNumber(value)
            },
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '请求数',
            color: chartColors.value.text
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function (value) {
              return value.toLocaleString()
            },
            color: chartColors.value.text
          }
        },
        y2: {
          type: 'linear',
          display: false, // 隐藏费用轴，在tooltip中显示
          position: 'right'
        }
      }
    }
  })
}

// 创建API Keys使用趋势图
function createApiKeysUsageTrendChart() {
  if (!apiKeysUsageTrendChart.value) return

  if (apiKeysUsageTrendChartInstance) {
    apiKeysUsageTrendChartInstance.destroy()
  }

  const data = apiKeysTrendData.value.data || []
  const metric = apiKeysTrendMetric.value

  // 颜色数组
  const colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
    '#6366F1',
    '#84CC16'
  ]

  // 准备数据集
  const datasets =
    apiKeysTrendData.value.topApiKeys?.map((apiKeyId, index) => {
      const data = apiKeysTrendData.value.data.map((item) => {
        if (!item.apiKeys || !item.apiKeys[apiKeyId]) return 0
        return metric === 'tokens'
          ? item.apiKeys[apiKeyId].tokens
          : item.apiKeys[apiKeyId].requests || 0
      })

      // 获取API Key名称
      const apiKeyName =
        apiKeysTrendData.value.data.find((item) => item.apiKeys && item.apiKeys[apiKeyId])?.apiKeys[
          apiKeyId
        ]?.name || `API Key ${apiKeyId}`

      return {
        label: apiKeyName,
        data: data,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        tension: 0.4,
        fill: false
      }
    }) || []

  // 根据数据类型确定标签字段
  const labelField = data[0]?.date ? 'date' : 'hour'

  const chartData = {
    labels: data.map((d) => {
      // 优先使用后端提供的label字段
      if (d.label) {
        return d.label
      }

      if (labelField === 'hour') {
        // 格式化小时显示
        const date = new Date(d.hour)
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hour = String(date.getHours()).padStart(2, '0')
        return `${month}/${day} ${hour}:00`
      }
      // 按天显示时，只显示月/日，不显示年份
      const dateStr = d.date
      if (dateStr && dateStr.includes('-')) {
        const parts = dateStr.split('-')
        if (parts.length >= 3) {
          return `${parts[1]}/${parts[2]}`
        }
      }
      return d.date
    }),
    datasets: datasets
  }

  apiKeysUsageTrendChartInstance = new Chart(apiKeysUsageTrendChart.value, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            font: {
              size: 12
            },
            color: chartColors.value.legend
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          itemSort: function (a, b) {
            // 按值倒序排列
            return b.parsed.y - a.parsed.y
          },
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              const dataIndex = context.dataIndex
              const dataPoint = apiKeysTrendData.value.data[dataIndex]

              // 获取所有数据集在这个时间点的值，用于排名
              const allValues = context.chart.data.datasets
                .map((dataset, idx) => ({
                  value: dataset.data[dataIndex] || 0,
                  index: idx
                }))
                .sort((a, b) => b.value - a.value)

              // 找出当前数据集的排名
              const rank = allValues.findIndex((item) => item.index === context.datasetIndex) + 1

              // 准备排名标识
              let rankIcon = ''
              if (rank === 1) rankIcon = '🥇 '
              else if (rank === 2) rankIcon = '🥈 '
              else if (rank === 3) rankIcon = '🥉 '

              if (apiKeysTrendMetric.value === 'tokens') {
                // 格式化token显示
                let formattedValue = ''
                if (value >= 1000000) {
                  formattedValue = (value / 1000000).toFixed(2) + 'M'
                } else if (value >= 1000) {
                  formattedValue = (value / 1000).toFixed(2) + 'K'
                } else {
                  formattedValue = value.toLocaleString()
                }

                // 获取对应API Key的费用信息
                const apiKeyId = apiKeysTrendData.value.topApiKeys[context.datasetIndex]
                const apiKeyData = dataPoint?.apiKeys?.[apiKeyId]
                const cost = apiKeyData?.formattedCost || '$0.00'

                return `${rankIcon}${label}: ${formattedValue} tokens (${cost})`
              } else {
                return `${rankIcon}${label}: ${value.toLocaleString()} 次`
              }
            }
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          title: {
            display: true,
            text: trendGranularity === 'hour' ? '时间' : '日期',
            color: chartColors.value.text
          },
          ticks: {
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: apiKeysTrendMetric.value === 'tokens' ? 'Token 数量' : '请求次数',
            color: chartColors.value.text
          },
          ticks: {
            callback: function (value) {
              return formatNumber(value)
            },
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        }
      }
    }
  })
}

function createCostEfficiencyChart() {
  if (!costEfficiencyChart.value) return

  if (costEfficiencyChartInstance) {
    costEfficiencyChartInstance.destroy()
  }

  const accounts = efficiencyAccounts.value || []
  if (accounts.length === 0) {
    return
  }

  const points = accounts
    .filter((item) => item && item.metrics)
    .map((item) => {
      const metrics = item.metrics
      const account = item.account || {}
      const totalRequests = Number(metrics.totalRequests || 0)
      const radius = Math.max(4, Math.min(18, Math.sqrt(totalRequests + 1)))
      return {
        x:
          metrics.costPerMillion !== null && metrics.costPerMillion !== undefined
            ? Number(metrics.costPerMillion)
            : 0,
        y:
          metrics.successRate !== null && metrics.successRate !== undefined
            ? Number(metrics.successRate) * 100
            : 0,
        r: radius,
        account,
        metrics,
        platform: account.platform || 'unknown'
      }
    })

  if (points.length === 0) {
    return
  }

  const dataset = {
    label: '账户性价比',
    data: points,
    backgroundColor: points.map((point) => `${getPlatformColor(point.platform)}33`),
    borderColor: points.map((point) => getPlatformColor(point.platform)),
    borderWidth: 1,
    hoverBackgroundColor: points.map((point) => getPlatformColor(point.platform)),
    hoverBorderWidth: 1
  }

  costEfficiencyChartInstance = new Chart(costEfficiencyChart.value, {
    type: 'bubble',
    data: { datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const raw = context.raw || {}
              const account = raw.account || {}
              const metrics = raw.metrics || {}

              const tokensPerDollar =
                metrics.tokensPerDollar !== null && metrics.tokensPerDollar !== undefined
                  ? metrics.tokensPerDollar.toFixed(2)
                  : '--'
              const costPerMillion =
                metrics.costPerMillion !== null && metrics.costPerMillion !== undefined
                  ? metrics.costPerMillion.toFixed(2)
                  : '--'
              const successRate =
                metrics.successRate !== null && metrics.successRate !== undefined
                  ? `${(metrics.successRate * 100).toFixed(1)}%`
                  : '--'
              const cost = formatCurrency(metrics.totalCost, 4)
              const tokens = formatNumber(metrics.totalTokens || 0)
              const requests = (metrics.totalRequests || 0).toLocaleString()

              return [
                `${account.name || account.id || '未知账户'}`,
                `Tokens/$: ${tokensPerDollar}`,
                `$ / 百万 Tokens: ${costPerMillion}`,
                `成功率: ${successRate}`,
                `费用: ${cost}`,
                `Tokens: ${tokens}`,
                `请求数: ${requests}`
              ]
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '$ / 百万 Tokens',
            color: chartColors.value.text
          },
          ticks: {
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y: {
          title: {
            display: true,
            text: '成功率 (%)',
            color: chartColors.value.text
          },
          ticks: {
            callback: (value) => `${value}%`,
            color: chartColors.value.text
          },
          beginAtZero: true,
          suggestedMax: 100,
          grid: {
            color: chartColors.value.grid
          }
        }
      }
    }
  })
}

// 更新API Keys使用趋势图
async function updateApiKeysUsageTrendChart() {
  await loadApiKeysTrend(apiKeysTrendMetric.value)
  await nextTick()
  createApiKeysUsageTrendChart()
}

// 监听数据变化更新图表
watch(dashboardModelStats, () => {
  nextTick(() => createModelUsageChart())
})

watch(trendData, () => {
  nextTick(() => createUsageTrendChart())
})

watch(apiKeysTrendData, () => {
  nextTick(() => createApiKeysUsageTrendChart())
})

watch(efficiencyAccounts, () => {
  nextTick(() => createCostEfficiencyChart())
})

// 刷新所有数据
async function refreshAllData() {
  if (isRefreshing.value) return

  isRefreshing.value = true
  try {
    await Promise.all([loadDashboardData(), refreshChartsData(), loadCostEfficiencyData()])
  } finally {
    isRefreshing.value = false
  }
}

// 启动自动刷新
function startAutoRefresh() {
  if (!autoRefreshEnabled.value) return

  // 重置倒计时
  refreshCountdown.value = autoRefreshInterval.value

  // 清除现有定时器
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }
  if (autoRefreshTimer.value) {
    clearTimeout(autoRefreshTimer.value)
  }

  // 启动倒计时
  countdownTimer.value = setInterval(() => {
    refreshCountdown.value--
    if (refreshCountdown.value <= 0) {
      clearInterval(countdownTimer.value)
    }
  }, 1000)

  // 设置刷新定时器
  autoRefreshTimer.value = setTimeout(async () => {
    await refreshAllData()
    // 递归调用以继续自动刷新
    if (autoRefreshEnabled.value) {
      startAutoRefresh()
    }
  }, autoRefreshInterval.value * 1000)
}

// 停止自动刷新
function stopAutoRefresh() {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
  if (autoRefreshTimer.value) {
    clearTimeout(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
  refreshCountdown.value = 0
}

// 切换自动刷新
// function toggleAutoRefresh() {
//   autoRefreshEnabled.value = !autoRefreshEnabled.value
//   if (autoRefreshEnabled.value) {
//     startAutoRefresh()
//   } else {
//     stopAutoRefresh()
//   }
// }

// 监听自动刷新状态变化
watch(autoRefreshEnabled, (newVal) => {
  if (newVal) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

// 监听主题变化，重新创建图表
watch(isDarkMode, () => {
  nextTick(() => {
    createModelUsageChart()
    createUsageTrendChart()
    createApiKeysUsageTrendChart()
    createCostEfficiencyChart()
  })
})

// 初始化
onMounted(async () => {
  // 加载所有数据
  await refreshAllData()

  // 创建图表
  await nextTick()
  createModelUsageChart()
  createUsageTrendChart()
  createApiKeysUsageTrendChart()
  createCostEfficiencyChart()
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
  // 销毁图表实例
  if (modelUsageChartInstance) {
    modelUsageChartInstance.destroy()
  }
  if (usageTrendChartInstance) {
    usageTrendChartInstance.destroy()
  }
  if (apiKeysUsageTrendChartInstance) {
    apiKeysUsageTrendChartInstance.destroy()
  }
  if (costEfficiencyChartInstance) {
    costEfficiencyChartInstance.destroy()
  }
})
</script>

<style scoped>
/* 日期选择器基本样式调整 - 让Element Plus官方暗黑模式生效 */
.custom-date-picker {
  font-size: 13px;
}

/* 旋转动画 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
