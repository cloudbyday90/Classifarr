<template>
  <div class="space-y-8">
    <Card>
      <template #title>Confidence Thresholds</template>
      <template #description>
        Configure how Classifarr handles classifications based on confidence levels
      </template>

      <div v-if="loading" class="flex justify-center py-8">
        <Spinner />
      </div>

      <div v-else class="space-y-6">
        <!-- Threshold Sliders -->
        <div v-for="threshold in thresholds" :key="threshold.tier" class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium capitalize">
                {{ threshold.tier }} 
                <Badge 
                  :variant="threshold.enabled ? 'success' : 'secondary'"
                  class="ml-2"
                >
                  {{ threshold.enabled ? 'Enabled' : 'Disabled' }}
                </Badge>
              </h3>
              <p class="text-sm text-gray-400 mt-1">
                {{ getActionDescription(threshold.action) }}
              </p>
            </div>
            <Toggle 
              v-model="threshold.enabled"
              @update:modelValue="handleThresholdChange"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">
                Min Confidence: {{ threshold.min_confidence }}%
              </label>
              <Slider
                v-model="threshold.min_confidence"
                :min="0"
                :max="100"
                :step="5"
                :disabled="!threshold.enabled"
                @update:modelValue="handleThresholdChange"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">
                Max Confidence: {{ threshold.max_confidence }}%
              </label>
              <Slider
                v-model="threshold.max_confidence"
                :min="0"
                :max="100"
                :step="5"
                :disabled="!threshold.enabled"
                @update:modelValue="handleThresholdChange"
              />
            </div>
          </div>

          <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              :class="[
                'h-full',
                getTierColor(threshold.tier)
              ]"
              :style="{
                marginLeft: `${threshold.min_confidence}%`,
                width: `${threshold.max_confidence - threshold.min_confidence}%`
              }"
            ></div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end pt-4">
          <Button
            @click="saveThresholds"
            :disabled="saving"
            variant="primary"
          >
            {{ saving ? 'Saving...' : 'Save Thresholds' }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- Clarification Questions -->
    <Card>
      <template #title>Clarification Questions</template>
      <template #description>
        Manage questions used to clarify uncertain classifications
      </template>

      <div v-if="loadingQuestions" class="flex justify-center py-8">
        <Spinner />
      </div>

      <div v-else class="space-y-4">
        <Table>
          <template #header>
            <tr>
              <th class="text-left">Question</th>
              <th class="text-left">Type</th>
              <th class="text-left">Media</th>
              <th class="text-left">Priority</th>
              <th class="text-left">Status</th>
              <th class="text-left">Actions</th>
            </tr>
          </template>
          <template #body>
            <tr v-for="question in questions" :key="question.id">
              <td>{{ question.question_text }}</td>
              <td>
                <Badge variant="secondary">{{ question.question_type }}</Badge>
              </td>
              <td>
                <Badge variant="info">{{ question.applies_to }}</Badge>
              </td>
              <td>{{ question.priority }}</td>
              <td>
                <Toggle
                  v-model="question.enabled"
                  @update:modelValue="() => updateQuestion(question)"
                  size="sm"
                />
              </td>
              <td>
                <Button
                  @click="editQuestion(question)"
                  variant="secondary"
                  size="sm"
                >
                  Edit
                </Button>
              </td>
            </tr>
          </template>
        </Table>
      </div>
    </Card>

    <!-- Statistics -->
    <Card>
      <template #title>Clarification Statistics</template>
      <template #description>
        Track the effectiveness of clarification questions
      </template>

      <div v-if="loadingStats" class="flex justify-center py-8">
        <Spinner />
      </div>

      <div v-else-if="stats.overall" class="grid grid-cols-3 gap-6">
        <div class="bg-gray-800 p-4 rounded-lg">
          <div class="text-sm text-gray-400">Total Clarifications</div>
          <div class="text-2xl font-bold mt-1">
            {{ stats.overall.total_clarifications || 0 }}
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg">
          <div class="text-sm text-gray-400">Avg Confidence Improvement</div>
          <div class="text-2xl font-bold mt-1 text-green-400">
            +{{ (stats.overall.avg_improvement || 0).toFixed(1) }}%
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg">
          <div class="text-sm text-gray-400">Success Rate</div>
          <div class="text-2xl font-bold mt-1">
            {{ stats.overall.total_clarifications > 0 
              ? ((stats.overall.successful_count / stats.overall.total_clarifications) * 100).toFixed(0) 
              : 0 
            }}%
          </div>
        </div>
      </div>
    </Card>

    <!-- Edit Question Modal -->
    <Modal v-if="editingQuestion" @close="editingQuestion = null">
      <template #title>Edit Question</template>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Question Text</label>
          <Input
            v-model="editingQuestion.question_text"
            type="text"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Priority</label>
          <Input
            v-model.number="editingQuestion.priority"
            type="number"
            min="1"
            max="100"
          />
        </div>
        <div class="flex justify-end space-x-2">
          <Button @click="editingQuestion = null" variant="secondary">
            Cancel
          </Button>
          <Button @click="saveQuestion" variant="primary">
            Save
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Card, Button, Toggle, Slider, Badge, Table, Spinner, Input, Modal } from '@/components/common'
import { useToast } from '@/stores/toast'
import api from '@/api'

const toast = useToast()

// State
const loading = ref(true)
const saving = ref(false)
const thresholds = ref([])

const loadingQuestions = ref(true)
const questions = ref([])
const editingQuestion = ref(null)

const loadingStats = ref(true)
const stats = ref({ overall: {}, byQuestion: [] })

// Load thresholds
const loadThresholds = async () => {
  try {
    loading.value = true
    const response = await api.get('/api/settings/confidence')
    thresholds.value = response.data
  } catch (error) {
    toast.error('Failed to load confidence thresholds')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// Load questions
const loadQuestions = async () => {
  try {
    loadingQuestions.value = true
    const response = await api.get('/api/settings/clarification-questions')
    questions.value = response.data
  } catch (error) {
    toast.error('Failed to load clarification questions')
    console.error(error)
  } finally {
    loadingQuestions.value = false
  }
}

// Load stats
const loadStats = async () => {
  try {
    loadingStats.value = true
    const response = await api.get('/api/clarifications/stats')
    stats.value = response.data
  } catch (error) {
    toast.error('Failed to load statistics')
    console.error(error)
  } finally {
    loadingStats.value = false
  }
}

// Save thresholds
const saveThresholds = async () => {
  try {
    saving.value = true
    await api.put('/api/settings/confidence', thresholds.value)
    toast.success('Confidence thresholds saved')
  } catch (error) {
    toast.error('Failed to save thresholds')
    console.error(error)
  } finally {
    saving.value = false
  }
}

// Update question
const updateQuestion = async (question) => {
  try {
    await api.put(`/api/settings/clarification-questions/${question.id}`, question)
    toast.success('Question updated')
  } catch (error) {
    toast.error('Failed to update question')
    console.error(error)
  }
}

// Edit question
const editQuestion = (question) => {
  editingQuestion.value = { ...question }
}

// Save edited question
const saveQuestion = async () => {
  try {
    await api.put(
      `/api/settings/clarification-questions/${editingQuestion.value.id}`,
      editingQuestion.value
    )
    await loadQuestions()
    editingQuestion.value = null
    toast.success('Question saved')
  } catch (error) {
    toast.error('Failed to save question')
    console.error(error)
  }
}

// Handle threshold change (for immediate visual feedback)
const handleThresholdChange = () => {
  // Could add debounced auto-save here
}

// Helper functions
const getActionDescription = (action) => {
  const descriptions = {
    auto_route: 'Automatically route to library without confirmation',
    route_and_verify: 'Route to library but ask for verification',
    ask_questions: 'Ask clarification questions before routing',
    manual_review: 'Require manual review and classification'
  }
  return descriptions[action] || action
}

const getTierColor = (tier) => {
  const colors = {
    auto: 'bg-green-500',
    verify: 'bg-yellow-500',
    clarify: 'bg-blue-500',
    manual: 'bg-red-500'
  }
  return colors[tier] || 'bg-gray-500'
}

// Lifecycle
onMounted(() => {
  loadThresholds()
  loadQuestions()
  loadStats()
})
</script>
