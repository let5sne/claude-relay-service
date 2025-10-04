<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          成本配置 - {{ account.name }}
        </h3>
        <button class="close-btn" @click="$emit('close')">
          <i class="fas fa-times" />
        </button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <!-- 基础配置 -->
          <div class="mb-6">
            <label class="form-label">计价模式</label>
            <select v-model="form.billingType" class="form-input">
              <option value="standard">标准定价（使用公开价格表）</option>
              <option value="point_based">积分制计费</option>
              <option value="tiered">阶梯定价</option>
              <option value="hybrid">混合计费</option>
              <option value="estimated">估算模式</option>
            </select>
            <p class="form-hint">选择账户的计费方式</p>
          </div>

          <div class="mb-6">
            <label class="form-label">置信度级别</label>
            <select v-model="form.confidenceLevel" class="form-input">
              <option value="high">高 - 已验证准确</option>
              <option value="medium-high">较高 - 多次验证</option>
              <option value="medium">中等 - 部分验证</option>
              <option value="low-medium">较低 - 少量验证</option>
              <option value="low">低 - 未验证</option>
            </select>
            <p class="form-hint">指示成本计算的可信程度</p>
          </div>

          <!-- 积分制配置 -->
          <div v-if="form.billingType === 'point_based'" class="config-section">
            <h4 class="section-title">积分换算配置</h4>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label class="form-label">每请求积分</label>
                <input
                  v-model.number="form.pointConversion.pointsPerRequest"
                  class="form-input"
                  placeholder="1"
                  step="0.001"
                  type="number"
                />
              </div>
              <div>
                <label class="form-label">每Token积分</label>
                <input
                  v-model.number="form.pointConversion.pointsPerToken"
                  class="form-input"
                  placeholder="0.001"
                  step="0.00001"
                  type="number"
                />
              </div>
              <div>
                <label class="form-label">每积分成本 ($)</label>
                <input
                  v-model.number="form.pointConversion.costPerPoint"
                  class="form-input"
                  placeholder="0.01"
                  step="0.0001"
                  type="number"
                />
              </div>
            </div>
          </div>

          <!-- 阶梯定价配置 -->
          <div v-if="form.billingType === 'tiered'" class="config-section">
            <h4 class="section-title">阶梯定价配置</h4>
            <div v-for="(tier, index) in form.tieredPricing" :key="index" class="tier-item">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label class="form-label">最小Token</label>
                  <input
                    v-model.number="tier.minTokens"
                    class="form-input"
                    placeholder="0"
                    type="number"
                  />
                </div>
                <div>
                  <label class="form-label">最大Token</label>
                  <input
                    v-model.number="tier.maxTokens"
                    class="form-input"
                    placeholder="1000000"
                    type="number"
                  />
                </div>
                <div>
                  <label class="form-label">成本/百万Token ($)</label>
                  <input
                    v-model.number="tier.costPerMillion"
                    class="form-input"
                    placeholder="3.0"
                    step="0.01"
                    type="number"
                  />
                </div>
              </div>
              <button
                v-if="form.tieredPricing.length > 1"
                class="btn-sm btn-danger mt-2"
                type="button"
                @click="removeTier(index)"
              >
                <i class="fas fa-trash" /> 删除
              </button>
            </div>
            <button class="btn-secondary mt-2" type="button" @click="addTier">
              <i class="fas fa-plus" /> 添加阶梯
            </button>
          </div>

          <!-- 混合计费配置 -->
          <div v-if="form.billingType === 'hybrid'" class="config-section">
            <h4 class="section-title">混合计费公式</h4>
            <div class="mb-4">
              <label class="form-label">基础Token成本 ($)</label>
              <input
                v-model.number="form.pricingFormula.baseTokenCost"
                class="form-input"
                placeholder="0.000003"
                step="0.000001"
                type="number"
              />
            </div>
            <div class="mb-4">
              <label class="form-label">每请求固定费用 ($)</label>
              <input
                v-model.number="form.pricingFormula.perRequestFee"
                class="form-input"
                placeholder="0.002"
                step="0.0001"
                type="number"
              />
            </div>
            <div class="mb-4">
              <label class="form-label">权重系数</label>
              <input
                v-model.number="form.pricingFormula.weight"
                class="form-input"
                max="1"
                min="0"
                placeholder="0.5"
                step="0.1"
                type="number"
              />
              <p class="form-hint">0-1之间，表示Token成本和请求费用的混合比例</p>
            </div>
          </div>

          <!-- 估算模式配置 -->
          <div v-if="form.billingType === 'estimated'" class="config-section">
            <h4 class="section-title">估算参数</h4>
            <div class="mb-4">
              <label class="form-label">相对效率系数</label>
              <input
                v-model.number="form.relativeEfficiency"
                class="form-input"
                placeholder="1.0"
                step="0.1"
                type="number"
              />
              <p class="form-hint">相对于标准价格的倍数（如0.8表示比标准便宜20%）</p>
            </div>
          </div>

          <!-- 固定费用配置（可选） -->
          <div class="config-section">
            <h4 class="section-title">固定费用（可选）</h4>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label class="form-label">月度基础费用 ($)</label>
                <input
                  v-model.number="form.fixedCosts.monthly_base"
                  class="form-input"
                  placeholder="0"
                  step="0.01"
                  type="number"
                />
              </div>
              <div>
                <label class="form-label">API访问费 ($)</label>
                <input
                  v-model.number="form.fixedCosts.api_access_fee"
                  class="form-input"
                  placeholder="0"
                  step="0.01"
                  type="number"
                />
              </div>
            </div>
          </div>

          <!-- 备注 -->
          <div class="mb-6">
            <label class="form-label">备注说明</label>
            <textarea
              v-model="form.notes"
              class="form-input"
              placeholder="记录配置来源或特殊说明"
              rows="3"
            />
          </div>
        </form>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" type="button" @click="$emit('close')">取消</button>
        <button class="btn-primary" :disabled="saving" type="button" @click="handleSubmit">
          <i class="fas fa-save" :class="{ 'fa-spin': saving }" />
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import costTrackingApi from '@/services/costTrackingApi'

const props = defineProps({
  account: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const form = reactive({
  billingType: 'standard',
  confidenceLevel: 'low',
  pointConversion: {
    pointsPerRequest: 1,
    pointsPerToken: 0.001,
    costPerPoint: 0.01
  },
  tieredPricing: [
    {
      minTokens: 0,
      maxTokens: 1000000,
      costPerMillion: 3.0
    }
  ],
  pricingFormula: {
    baseTokenCost: 0.000003,
    perRequestFee: 0.002,
    weight: 0.5
  },
  relativeEfficiency: 1.0,
  fixedCosts: {
    monthly_base: 0,
    api_access_fee: 0
  },
  notes: ''
})

// 加载现有配置
async function loadProfile() {
  if (!props.account.costProfile) return

  const profile = props.account.costProfile
  form.billingType = profile.billingType || 'standard'
  form.confidenceLevel = profile.confidenceLevel || 'low'
  form.notes = profile.notes || ''

  if (profile.pointConversion) {
    form.pointConversion = { ...profile.pointConversion }
  }
  if (profile.tieredPricing && profile.tieredPricing.length > 0) {
    form.tieredPricing = [...profile.tieredPricing]
  }
  if (profile.pricingFormula) {
    form.pricingFormula = { ...profile.pricingFormula }
  }
  if (profile.relativeEfficiency) {
    form.relativeEfficiency = profile.relativeEfficiency
  }
  if (profile.fixedCosts) {
    form.fixedCosts = { ...profile.fixedCosts }
  }
}

// 添加阶梯
function addTier() {
  form.tieredPricing.push({
    minTokens: 0,
    maxTokens: 1000000,
    costPerMillion: 3.0
  })
}

// 删除阶梯
function removeTier(index) {
  form.tieredPricing.splice(index, 1)
}

// 提交表单
async function handleSubmit() {
  saving.value = true
  try {
    await costTrackingApi.updateCostProfile(props.account.id, form)
    emit('saved')
  } catch (error) {
    alert(`保存失败: ${error.response?.data?.error || error.message}`)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4;
}

.modal-content {
  @apply max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800;
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
  @apply w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100;
}

.form-hint {
  @apply mt-1 text-xs text-gray-500 dark:text-gray-400;
}

.config-section {
  @apply mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700;
}

.section-title {
  @apply mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100;
}

.tier-item {
  @apply mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900;
}

.btn-primary {
  @apply rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600;
}

.btn-secondary {
  @apply rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600;
}

.btn-sm {
  @apply rounded px-2 py-1 text-xs transition-colors;
}

.btn-danger {
  @apply bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50;
}
</style>
