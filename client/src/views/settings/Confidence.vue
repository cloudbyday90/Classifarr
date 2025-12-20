<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Confidence Settings</h2>
      <p class="text-gray-400 text-sm">Configure confidence thresholds and clarification questions</p>
    </div>

    <!-- Manual Confirmation Mode -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold flex items-center gap-2">
            🔒 Manual Confirmation Mode
          </h3>
          <p class="text-gray-400 text-sm mt-2">
            When enabled, all classifications will require your confirmation before being sent to Radarr/Sonarr,
            even when confidence is 90% or higher.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            v-model="requireAllConfirmations"
            @change="saveRequireAllConfirmations"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>

    <!-- Confidence Thresholds -->
    <div class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-4">Confidence Thresholds</h3>
      <p class="text-gray-400 text-sm mb-4">
        Control how classifications are handled based on confidence levels
      </p>

      <div class="space-y-6">
        <div v-for="threshold in thresholds" :key="threshold.tier" class="border-l-4 pl-4" :style="{ borderColor: getTierColor(threshold.tier) }">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h4 class="font-medium" :style="{ color: getTierColor(threshold.tier) }">
                {{ threshold.tier.toUpperCase() }}: {{ threshold.min_confidence }}% - {{ threshold.max_confidence }}%
              </h4>
              <p class="text-sm text-gray-400">{{ threshold.description }}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold" :style="{ backgroundColor: getTierColor(threshold.tier) + '33', color: getTierColor(threshold.tier) }">
              {{ threshold.action.replace('_', ' ').toUpperCase() }}
            </span>
          </div>
          
          <div class="flex items-center gap-4 mt-3">
            <div class="flex-1">
              <label class="block text-xs text-gray-500 mb-1">Min Confidence</label>
              <input
                v-model.number="threshold.min_confidence"
                type="range"
                min="0"
                max="100"
                class="w-full"
                @change="updateThreshold(threshold)"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-500 mb-1">Max Confidence</label>
              <input
                v-model.number="threshold.max_confidence"
                type="range"
                min="0"
                max="100"
                class="w-full"
                @change="updateThreshold(threshold)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Clarification Questions -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Clarification Questions</h3>
        <button
          @click="showAddQuestion = true"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
        >
          + Add Question
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-900">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Question</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Priority</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr v-for="question in questions" :key="question.id" class="hover:bg-gray-750">
              <td class="px-4 py-3 text-sm">{{ question.question_text }}</td>
              <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 bg-gray-700 rounded text-xs">{{ question.question_type }}</span>
              </td>
              <td class="px-4 py-3 text-sm">{{ question.priority }}</td>
              <td class="px-4 py-3 text-sm">
                <span :class="question.enabled ? 'text-green-400' : 'text-gray-500'">
                  {{ question.enabled ? '✓ Enabled' : '✗ Disabled' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-right space-x-2">
                <button
                  @click="toggleQuestion(question)"
                  class="text-blue-400 hover:text-blue-300"
                >
                  {{ question.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button
                  @click="editQuestion(question)"
                  class="text-yellow-400 hover:text-yellow-300"
                >
                  Edit
                </button>
                <button
                  @click="deleteQuestion(question.id)"
                  class="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Question Modal -->
    <div v-if="showAddQuestion || editingQuestion" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold mb-4">{{ editingQuestion ? 'Edit' : 'Add' }} Question</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Question Text</label>
            <input
              v-model="questionForm.question_text"
              type="text"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
              placeholder="Is this a stand-up comedy special?"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Question Type</label>
            <select
              v-model="questionForm.question_type"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
            >
              <option value="content_type">Content Type</option>
              <option value="language">Language</option>
              <option value="genre">Genre</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Priority (0-100)</label>
            <input
              v-model.number="questionForm.priority"
              type="number"
              min="0"
              max="100"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Trigger Keywords (comma-separated)</label>
            <input
              v-model="triggerKeywordsInput"
              type="text"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
              placeholder="stand-up, comedy special, standup"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Trigger Genres (comma-separated)</label>
            <input
              v-model="triggerGenresInput"
              type="text"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
              placeholder="Documentary, Comedy"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Response Options (JSON)</label>
            <textarea
              v-model="responseOptionsInput"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg font-mono text-xs"
              rows="6"
              placeholder='{"yes": {"label": "Yes", "confidence_boost": 30}, "no": {"label": "No", "confidence_boost": -10}}'
            ></textarea>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="questionForm.enabled"
              type="checkbox"
              id="enabled"
              class="w-4 h-4"
            />
            <label for="enabled" class="text-sm">Enabled</label>
          </div>
        </div>

        <div class="flex gap-2 mt-6">
          <button
            @click="saveQuestion"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            @click="closeQuestionModal"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Status Message -->
    <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
      {{ status.message }}
    </div>

    <!-- Statistics -->
    <div class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-4">Statistics</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-gray-700 rounded-lg p-4">
          <div class="text-2xl font-bold text-green-400">{{ stats.auto || 0 }}</div>
          <div class="text-sm text-gray-400">Auto-routed (90-100%)</div>
        </div>
        <div class="bg-gray-700 rounded-lg p-4">
          <div class="text-2xl font-bold text-yellow-400">{{ stats.verify || 0 }}</div>
          <div class="text-sm text-gray-400">Verified (70-89%)</div>
        </div>
        <div class="bg-gray-700 rounded-lg p-4">
          <div class="text-2xl font-bold text-blue-400">{{ stats.clarify || 0 }}</div>
          <div class="text-sm text-gray-400">Clarified (50-69%)</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const thresholds = ref([])
const questions = ref([])
const showAddQuestion = ref(false)
const editingQuestion = ref(null)
const status = ref(null)
const stats = ref({})
const requireAllConfirmations = ref(false)

const questionForm = ref({
  question_text: '',
  question_type: 'content_type',
  priority: 0,
  trigger_keywords: [],
  trigger_genres: [],
  response_options: {},
  enabled: true,
})

const triggerKeywordsInput = ref('')
const triggerGenresInput = ref('')
const responseOptionsInput = ref('{"yes": {"label": "Yes", "confidence_boost": 30}, "no": {"label": "No", "confidence_boost": -10}}')

onMounted(async () => {
  await loadRequireAllConfirmations()
  await loadThresholds()
  await loadQuestions()
  await loadStats()
})

const loadRequireAllConfirmations = async () => {
  try {
    const response = await axios.get('/api/settings')
    requireAllConfirmations.value = response.data.require_all_confirmations === 'true'
  } catch (error) {
    console.error('Failed to load require_all_confirmations setting:', error)
  }
}

const saveRequireAllConfirmations = async () => {
  try {
    await axios.put('/api/settings', {
      require_all_confirmations: requireAllConfirmations.value ? 'true' : 'false'
    })
    showStatus('Setting saved successfully', 'success')
  } catch (error) {
    showStatus('Failed to save setting', 'error')
  }
}

const loadThresholds = async () => {
  try {
    const response = await axios.get('/api/clarifications/settings/confidence')
    thresholds.value = response.data
  } catch (error) {
    console.error('Failed to load thresholds:', error)
  }
}

const loadQuestions = async () => {
  try {
    const response = await axios.get('/api/clarifications/settings/questions')
    questions.value = response.data
  } catch (error) {
    console.error('Failed to load questions:', error)
  }
}

const loadStats = async () => {
  try {
    // Mock stats for now - would need actual endpoint
    stats.value = {
      auto: 45,
      verify: 23,
      clarify: 12,
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const getTierColor = (tier) => {
  const colors = {
    auto: '#00ff00',
    verify: '#ffff00',
    clarify: '#0099ff',
    manual: '#ff0000',
  }
  return colors[tier] || '#888888'
}

const updateThreshold = async (threshold) => {
  try {
    await axios.put(`/api/clarifications/settings/confidence/${threshold.tier}`, {
      min_confidence: threshold.min_confidence,
      max_confidence: threshold.max_confidence,
    })
    showStatus('Threshold updated successfully', 'success')
  } catch (error) {
    showStatus('Failed to update threshold', 'error')
  }
}

const toggleQuestion = async (question) => {
  try {
    await axios.put(`/api/clarifications/settings/questions/${question.id}`, {
      enabled: !question.enabled,
    })
    question.enabled = !question.enabled
    showStatus('Question updated successfully', 'success')
  } catch (error) {
    showStatus('Failed to update question', 'error')
  }
}

const editQuestion = (question) => {
  editingQuestion.value = question
  questionForm.value = {
    question_text: question.question_text,
    question_type: question.question_type,
    priority: question.priority,
    trigger_keywords: question.trigger_keywords || [],
    trigger_genres: question.trigger_genres || [],
    response_options: question.response_options,
    enabled: question.enabled,
  }
  triggerKeywordsInput.value = (question.trigger_keywords || []).join(', ')
  triggerGenresInput.value = (question.trigger_genres || []).join(', ')
  responseOptionsInput.value = JSON.stringify(question.response_options, null, 2)
}

const deleteQuestion = async (id) => {
  if (!confirm('Are you sure you want to delete this question?')) return

  try {
    await axios.delete(`/api/clarifications/settings/questions/${id}`)
    questions.value = questions.value.filter(q => q.id !== id)
    showStatus('Question deleted successfully', 'success')
  } catch (error) {
    showStatus('Failed to delete question', 'error')
  }
}

const saveQuestion = async () => {
  try {
    // Parse inputs
    questionForm.value.trigger_keywords = triggerKeywordsInput.value
      .split(',')
      .map(k => k.trim())
      .filter(k => k)
    
    questionForm.value.trigger_genres = triggerGenresInput.value
      .split(',')
      .map(g => g.trim())
      .filter(g => g)
    
    questionForm.value.response_options = JSON.parse(responseOptionsInput.value)

    if (editingQuestion.value) {
      await axios.put(`/api/clarifications/settings/questions/${editingQuestion.value.id}`, questionForm.value)
      showStatus('Question updated successfully', 'success')
    } else {
      await axios.post('/api/clarifications/settings/questions', questionForm.value)
      showStatus('Question created successfully', 'success')
    }

    await loadQuestions()
    closeQuestionModal()
  } catch (error) {
    showStatus('Failed to save question: ' + error.message, 'error')
  }
}

const closeQuestionModal = () => {
  showAddQuestion.value = false
  editingQuestion.value = null
  questionForm.value = {
    question_text: '',
    question_type: 'content_type',
    priority: 0,
    trigger_keywords: [],
    trigger_genres: [],
    response_options: {},
    enabled: true,
  }
  triggerKeywordsInput.value = ''
  triggerGenresInput.value = ''
  responseOptionsInput.value = '{"yes": {"label": "Yes", "confidence_boost": 30}, "no": {"label": "No", "confidence_boost": -10}}'
}

const showStatus = (message, type) => {
  status.value = { message, type }
  setTimeout(() => {
    status.value = null
  }, 3000)
}
</script>
