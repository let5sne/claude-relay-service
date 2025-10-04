<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          录入账单 - {{ account.name }}
        </h3>
        <button class="close-btn" @click="$emit('close')">
          <i class="fas fa-times" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 单个账单录入 -->
        <div v-if="!showBatchImport" class="space-y-6">
          <form @submit.prevent="handleSubmit">
            <div class="mb-4">
              <label class="form-label">计费周期</label>
              <input
                v-model="form.billingPeriod"
                class="form-input"
                placeholder="2025-01"
                required
                type="month"
              />
              <p class="form-hint">格式：YYYY-MM（如 2025-01）</p>
            </div>

            <div class="mb-4">
              <label class="form-label">实际账单金额 ($)</label>
              <input
                v-model.number="form.totalCost"
                class="form-input"
                placeholder="123.45"
                required
                step="0.01"
                type="number"
              />
              <p class="form-hint">从账单中获取的实际费用</p>
            </div>

            <div class="mb-4">
              <label class="form-label">币种</label>
              <select v-model="form.currency" class="form-input">
                <option value="USD">美元 (USD)</option>
                <option value="CNY">人民币 (CNY)</option>
                <option value="EUR">欧元 (EUR)</option>
              </select>
            </div>

            <div class="mb-4">
              <label class="form-label">账单备注</label>
              <textarea
                v-model="form.notes"
                class="form-input"
                placeholder="记录账单来源、特殊情况等"
                rows="3"
              />
            </div>

            <div class="mb-4">
              <label class="form-label">账单文件（可选）</label>
              <input
                accept=".pdf,.png,.jpg,.jpeg"
                class="form-input"
                type="file"
                @change="handleFileUpload"
              />
              <p class="form-hint">支持PDF、图片格式</p>
            </div>
          </form>

          <div class="text-center">
            <button
              class="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              type="button"
              @click="showBatchImport = true"
            >
              <i class="fas fa-upload" /> 切换到批量导入
            </button>
          </div>
        </div>

        <!-- 批量导入 -->
        <div v-else class="space-y-6">
          <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <h4 class="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-300">
              <i class="fas fa-info-circle" /> CSV 格式说明
            </h4>
            <p class="mb-2 text-xs text-blue-800 dark:text-blue-400">
              CSV 文件应包含以下列（第一行为表头）：
            </p>
            <code class="block rounded bg-white p-2 text-xs dark:bg-gray-800 dark:text-gray-300">
              billingPeriod,totalCost,currency,notes<br />
              2025-01,123.45,USD,一月账单<br />
              2025-02,145.67,USD,二月账单
            </code>
          </div>

          <div>
            <label class="form-label">选择 CSV 文件</label>
            <input accept=".csv" class="form-input" type="file" @change="handleCSVUpload" />
          </div>

          <div v-if="csvPreview.length > 0" class="overflow-x-auto">
            <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              预览（前5条）
            </h4>
            <table class="min-w-full text-xs">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-2 py-1 text-left">计费周期</th>
                  <th class="px-2 py-1 text-right">金额</th>
                  <th class="px-2 py-1 text-left">币种</th>
                  <th class="px-2 py-1 text-left">备注</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="(row, index) in csvPreview.slice(0, 5)" :key="index">
                  <td class="px-2 py-1">{{ row.billingPeriod }}</td>
                  <td class="px-2 py-1 text-right">${{ row.totalCost }}</td>
                  <td class="px-2 py-1">{{ row.currency }}</td>
                  <td class="px-2 py-1 text-gray-600 dark:text-gray-400">
                    {{ row.notes || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="mt-2 text-xs text-gray-500">共 {{ csvPreview.length }} 条记录</p>
          </div>

          <div class="text-center">
            <button
              class="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              type="button"
              @click="showBatchImport = false"
            >
              <i class="fas fa-arrow-left" /> 返回单个录入
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" type="button" @click="$emit('close')">取消</button>
        <button
          class="btn-primary"
          :disabled="saving || (showBatchImport && csvPreview.length === 0)"
          type="button"
          @click="handleSubmit"
        >
          <i class="fas fa-save" :class="{ 'fa-spin': saving }" />
          {{
            saving ? '提交中...' : showBatchImport ? `批量提交 (${csvPreview.length})` : '提交账单'
          }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import costTrackingApi from '@/services/costTrackingApi'

const props = defineProps({
  account: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const showBatchImport = ref(false)
const csvPreview = ref([])
const form = reactive({
  billingPeriod: '',
  totalCost: null,
  currency: 'USD',
  notes: '',
  attachment: null
})

// 处理文件上传
function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    form.attachment = file
  }
}

// 处理CSV上传
function handleCSVUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target.result
      const lines = text.split('\n').filter((line) => line.trim())
      const headers = lines[0].split(',').map((h) => h.trim())

      csvPreview.value = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      })
    } catch (error) {
      alert('CSV 解析失败: ' + error.message)
    }
  }
  reader.readAsText(file)
}

// 提交表单
async function handleSubmit() {
  saving.value = true
  try {
    if (showBatchImport.value) {
      // 批量提交
      for (const row of csvPreview.value) {
        await costTrackingApi.createBill(props.account.id, {
          billingPeriod: row.billingPeriod,
          totalCost: parseFloat(row.totalCost),
          currency: row.currency || 'USD',
          notes: row.notes || ''
        })
      }
      alert(`成功录入 ${csvPreview.value.length} 条账单`)
    } else {
      // 单个提交
      await costTrackingApi.createBill(props.account.id, {
        billingPeriod: form.billingPeriod,
        totalCost: form.totalCost,
        currency: form.currency,
        notes: form.notes
      })
      alert('账单录入成功')
    }
    emit('saved')
    emit('close')
  } catch (error) {
    alert(`录入失败: ${error.response?.data?.error || error.message}`)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4;
}

.modal-content {
  @apply max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800;
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

.btn-primary {
  @apply rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600;
}

.btn-secondary {
  @apply rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600;
}
</style>
