<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Classification History</h1>

    <Card>
      <div v-if="loading" class="text-center py-12 text-gray-400">
        Loading history...
      </div>

      <div v-else-if="history.length === 0" class="text-center py-12 text-gray-400">
        No classification history yet
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-gray-800">
            <tr class="text-left text-sm text-gray-400">
              <th class="pb-3 w-8"></th>
              <th class="pb-3">Title</th>
              <th class="pb-3">Type</th>
              <th class="pb-3">Library</th>
              <th class="pb-3">Method</th>
              <th class="pb-3">Confidence</th>
              <th class="pb-3">Clarification</th>
              <th class="pb-3">Date</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in history" :key="item.id">
              <tr
                class="border-b border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
                @click="toggleExpand(item.id)"
              >
                <td class="py-3">
                  <span v-if="hasClarifications(item)">
                    {{ expandedRows.has(item.id) ? '▼' : '▶' }}
                  </span>
                </td>
                <td class="py-3">
                  <div class="font-medium">{{ item.title }}</div>
                  <div class="text-sm text-gray-400">{{ item.year }}</div>
                </td>
                <td class="py-3">
                  <Badge>{{ item.media_type }}</Badge>
                </td>
                <td class="py-3">{{ item.library_name }}</td>
                <td class="py-3">
                  <Badge :variant="getMethodVariant(item.method)">
                    {{ item.method }}
                  </Badge>
                </td>
                <td class="py-3">
                  <div class="flex flex-col gap-1">
                    <Badge :variant="getConfidenceVariant(item.confidence)">
                      {{ item.confidence }}%
                    </Badge>
                    <span v-if="item.confidence_after_clarification" class="text-xs text-green-400">
                      → {{ item.confidence_after_clarification }}%
                    </span>
                  </div>
                </td>
                <td class="py-3">
                  <Badge v-if="item.clarification_status === 'pending'" variant="warning">
                    ⏳ {{ item.clarification_questions_answered }}/{{ item.clarification_questions_asked }}
                  </Badge>
                  <Badge v-else-if="item.clarification_status === 'completed'" variant="success">
                    ✓ Clarified
                  </Badge>
                  <span v-else class="text-gray-500 text-sm">—</span>
                </td>
                <td class="py-3 text-sm text-gray-400">
                  {{ formatDate(item.created_at) }}
                </td>
              </tr>

              <!-- Expanded Row for Clarifications -->
              <tr v-if="expandedRows.has(item.id) && clarifications[item.id]" class="bg-gray-900">
                <td colspan="8" class="py-4 px-6">
                  <div class="space-y-4">
                    <h3 class="font-semibold text-lg mb-3">Clarification Q&A</h3>
                    
                    <div
                      v-for="(clarification, idx) in clarifications[item.id]"
                      :key="idx"
                      class="border border-gray-700 rounded p-4 bg-gray-800"
                    >
                      <div class="flex items-start gap-3">
                        <span class="text-2xl">❓</span>
                        <div class="flex-1">
                          <p class="font-medium mb-2">{{ clarification.question_text }}</p>
                          <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-400">Answer:</span>
                            <Badge variant="info">
                              {{ getSelectedLabel(clarification.selected_option) }}
                            </Badge>
                          </div>
                          <div v-if="clarification.applied_labels?.length" class="mt-2 text-sm">
                            <span class="text-gray-400">Applied labels:</span>
                            <span class="ml-2 text-blue-400">
                              {{ clarification.applied_labels.join(', ') }}
                            </span>
                          </div>
                          <div class="text-xs text-gray-500 mt-2">
                            Answered by {{ clarification.responded_by }} • {{ formatDate(clarification.created_at) }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="item.confidence_before_clarification" class="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
                      <p class="text-sm">
                        <span class="text-gray-400">Confidence improvement:</span>
                        <span class="ml-2 font-semibold">
                          {{ item.confidence_before_clarification }}% → {{ item.confidence_after_clarification }}%
                        </span>
                        <span class="ml-2 text-green-400">
                          (+{{ (item.confidence_after_clarification - item.confidence_before_clarification).toFixed(1) }}%)
                        </span>
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <div v-if="pagination" class="flex items-center justify-between mt-6">
          <div class="text-sm text-gray-400">
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </div>
          <div class="flex gap-2">
            <Button
              @click="loadPage(pagination.page - 1)"
              :disabled="pagination.page <= 1"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              @click="loadPage(pagination.page + 1)"
              :disabled="pagination.page >= pagination.totalPages"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'

const history = ref([])
const loading = ref(true)
const pagination = ref(null)
const expandedRows = ref(new Set())
const clarifications = ref({})

onMounted(async () => {
  await loadPage(1)
})

const loadPage = async (page) => {
  loading.value = true
  try {
    const response = await api.getHistory({ page, limit: 50 })
    history.value = response.data.data
    pagination.value = response.data.pagination
  } catch (error) {
    console.error('Failed to load history:', error)
  } finally {
    loading.value = false
  }
}

const hasClarifications = (item) => {
  return item.clarification_status && item.clarification_status !== 'none'
}

const toggleExpand = async (id) => {
  const item = history.value.find(h => h.id === id)
  if (!hasClarifications(item)) return

  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
    // Load clarifications if not already loaded
    if (!clarifications.value[id]) {
      try {
        const response = await api.getClarifications(id)
        clarifications.value[id] = response.data
      } catch (error) {
        console.error('Failed to load clarifications:', error)
      }
    }
  }
}

const getSelectedLabel = (selectedOption) => {
  if (typeof selectedOption === 'string') {
    try {
      const parsed = JSON.parse(selectedOption)
      return parsed.label || 'Unknown'
    } catch {
      return selectedOption
    }
  }
  return selectedOption?.label || 'Unknown'
}

const getMethodVariant = (method) => {
  const variants = {
    exact_match: 'success',
    learned_pattern: 'info',
    rule_match: 'default',
    ai_fallback: 'warning',
  }
  return variants[method] || 'default'
}

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'info'
  if (confidence >= 50) return 'warning'
  return 'error'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}
</script>
