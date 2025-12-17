<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-bold mb-2">Confidence & Clarification Settings</h2>
      <p class="text-gray-400 text-sm">
        Configure how the AI handles different confidence levels when classifying media.
      </p>
    </div>

    <!-- Confidence Thresholds -->
    <Card title="Confidence Thresholds" description="Define confidence ranges for different actions">
      <div class="space-y-6">
        <div v-for="threshold in thresholds" :key="threshold.action_type" class="border-b border-gray-700 pb-4 last:border-0">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ getIcon(threshold.action_type) }}</span>
              <div>
                <h3 class="font-semibold">{{ formatActionType(threshold.action_type) }}</h3>
                <p class="text-sm text-gray-400">{{ threshold.description }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                v-model="threshold.enabled"
                :id="`enabled-${threshold.action_type}`"
                class="w-4 h-4"
              />
              <label :for="`enabled-${threshold.action_type}`" class="text-sm">Enabled</label>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label class="block text-sm mb-2">Min Confidence</label>
              <input
                type="number"
                v-model.number="threshold.min_confidence"
                min="0"
                max="100"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label class="block text-sm mb-2">Max Confidence</label>
              <input
                type="number"
                v-model.number="threshold.max_confidence"
                min="0"
                max="100"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              v-model="threshold.notify_discord"
              :id="`notify-${threshold.action_type}`"
              class="w-4 h-4"
            />
            <label :for="`notify-${threshold.action_type}`" class="text-sm">Send Discord notifications</label>
          </div>
        </div>

        <div class="pt-4">
          <Button @click="saveThresholds" :loading="savingThresholds" variant="success">
            Save Thresholds
          </Button>
        </div>
      </div>
    </Card>

    <!-- Clarification Questions -->
    <Card title="Clarification Questions" description="Manage questions the AI can ask to improve classification">
      <div class="space-y-4">
        <div class="mb-4">
          <label class="block text-sm mb-2">Filter by Type</label>
          <select v-model="questionFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white">
            <option value="all">All Questions</option>
            <option value="content_type">Content Type</option>
            <option value="genre">Genre</option>
            <option value="audience">Audience</option>
            <option value="format">Format</option>
            <option value="special">Special</option>
            <option value="regional">Regional</option>
          </select>
        </div>

        <div class="space-y-3 max-h-96 overflow-y-auto">
          <div
            v-for="question in filteredQuestions"
            :key="question.id"
            class="p-4 bg-gray-700 rounded border border-gray-600"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs px-2 py-1 bg-gray-600 rounded">{{ question.question_type }}</span>
                  <span class="text-xs px-2 py-1 bg-blue-600 rounded">{{ question.applies_to }}</span>
                </div>
                <p class="font-medium mb-2">{{ question.question_text }}</p>
                <div class="text-sm text-gray-400">
                  <span v-if="question.trigger_keywords?.length" class="block">
                    Keywords: {{ question.trigger_keywords.join(', ') }}
                  </span>
                  <span v-if="question.trigger_genres?.length" class="block">
                    Genres: {{ question.trigger_genres.join(', ') }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 ml-4">
                <input
                  type="checkbox"
                  :checked="question.enabled"
                  @change="toggleQuestion(question.id, !question.enabled)"
                  :id="`question-${question.id}`"
                  class="w-4 h-4"
                />
                <label :for="`question-${question.id}`" class="text-sm">Enabled</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Preview -->
    <Card title="Confidence Preview" description="See how different confidence levels are handled">
      <div class="space-y-4">
        <div>
          <label class="block text-sm mb-2">Test Confidence Level</label>
          <input
            type="range"
            v-model.number="previewConfidence"
            min="0"
            max="100"
            class="w-full"
          />
          <div class="text-center text-2xl font-bold mt-2">{{ previewConfidence }}%</div>
        </div>

        <div v-if="previewAction" class="p-4 bg-gray-700 rounded border-2" :style="{ borderColor: getActionColor(previewAction.action_type) }">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-3xl">{{ getIcon(previewAction.action_type) }}</span>
            <div>
              <h3 class="font-bold text-lg">{{ formatActionType(previewAction.action_type) }}</h3>
              <p class="text-sm text-gray-400">{{ previewAction.description }}</p>
            </div>
          </div>
          <div class="text-sm mt-3 pt-3 border-t border-gray-600">
            <p><strong>Range:</strong> {{ previewAction.min_confidence }}% - {{ previewAction.max_confidence }}%</p>
            <p><strong>Discord Notifications:</strong> {{ previewAction.notify_discord ? 'Enabled' : 'Disabled' }}</p>
          </div>
        </div>
      </div>
    </Card>

    <!-- Statistics -->
    <Card v-if="stats.length > 0" title="Clarification Statistics" description="Performance metrics">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="stat in stats" :key="stat.clarification_status" class="p-4 bg-gray-700 rounded">
          <div class="text-sm text-gray-400 mb-1">{{ stat.clarification_status }}</div>
          <div class="text-2xl font-bold">{{ stat.count }}</div>
          <div v-if="stat.avg_improvement" class="text-sm text-green-400 mt-1">
            +{{ stat.avg_improvement.toFixed(1) }}% avg improvement
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const thresholds = ref([])
const questions = ref([])
const stats = ref([])
const savingThresholds = ref(false)
const questionFilter = ref('all')
const previewConfidence = ref(75)

const filteredQuestions = computed(() => {
  if (questionFilter.value === 'all') {
    return questions.value
  }
  return questions.value.filter(q => q.question_type === questionFilter.value)
})

const previewAction = computed(() => {
  return thresholds.value.find(t => 
    previewConfidence.value >= t.min_confidence && 
    previewConfidence.value <= t.max_confidence &&
    t.enabled
  ) || null
})

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    const [thresholdsRes, questionsRes, statsRes] = await Promise.all([
      api.getConfidenceThresholds(),
      api.getClarificationQuestions(),
      api.getClarificationStats(),
    ])

    thresholds.value = thresholdsRes.data
    questions.value = questionsRes.data
    stats.value = statsRes.data
  } catch (error) {
    console.error('Failed to load confidence settings:', error)
  }
}

const saveThresholds = async () => {
  savingThresholds.value = true
  try {
    await api.updateConfidenceThresholds(thresholds.value)
    alert('Confidence thresholds saved successfully!')
  } catch (error) {
    alert('Failed to save thresholds: ' + error.message)
  } finally {
    savingThresholds.value = false
  }
}

const toggleQuestion = async (questionId, enabled) => {
  try {
    await api.updateClarificationQuestion(questionId, { enabled })
    // Update local state
    const question = questions.value.find(q => q.id === questionId)
    if (question) {
      question.enabled = enabled
    }
  } catch (error) {
    alert('Failed to update question: ' + error.message)
  }
}

const getIcon = (actionType) => {
  const icons = {
    auto_route: '✅',
    verify: '⚠️',
    clarify: '❓',
    manual: '🛑'
  }
  return icons[actionType] || '❓'
}

const formatActionType = (actionType) => {
  return actionType.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const getActionColor = (actionType) => {
  const colors = {
    auto_route: '#22c55e',
    verify: '#f59e0b',
    clarify: '#3b82f6',
    manual: '#ef4444'
  }
  return colors[actionType] || '#3b82f6'
}
</script>
