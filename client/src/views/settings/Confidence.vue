<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="confidence-settings-page space-y-8">
    
    <!-- ==================== SECTION 1: Policy Engine Thresholds ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🎯 Policy Engine - Classification Thresholds</h2>
      </template>

      <p class="text-gray-400 mb-6">
        These thresholds determine how the PolicyEngine handles classifications at different confidence levels.
      </p>

      <div class="space-y-6">
        <!-- Auto-Classify Threshold -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="font-medium">Auto-Classify Threshold</label>
            <span class="text-2xl font-bold text-green-400">{{ policySettings.autoClassifyThreshold }}%</span>
          </div>
          <p class="text-sm text-gray-400">Items scoring at or above this confidence are automatically routed without user intervention</p>
          <Slider
            v-model="policySettings.autoClassifyThreshold"
            :min="70"
            :max="95"
            :step="5"
            @update:modelValue="validateThresholds"
          />
        </div>

        <!-- Prompt Threshold -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="font-medium">Prompt Confirmation Threshold</label>
            <span class="text-2xl font-bold text-yellow-400">{{ policySettings.promptThreshold }}%</span>
          </div>
          <p class="text-sm text-gray-400">Items between this and auto-classify threshold will prompt user for Yes/No confirmation</p>
          <Slider
            v-model="policySettings.promptThreshold"
            :min="40"
            :max="85"
            :step="5"
            @update:modelValue="validateThresholds"
          />
        </div>

        <!-- Threshold Ranges Visual -->
        <div class="mt-6 space-y-2">
          <h4 class="text-sm font-semibold mb-3">Classification Flow:</h4>
          
          <div class="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded">
            <div class="text-green-400 text-2xl">✓</div>
            <div class="flex-1">
              <div class="font-medium text-green-400">Auto-Classify ({{ policySettings.autoClassifyThreshold }}% - 100%)</div>
              <div class="text-sm text-gray-400">Immediate routing, no user input</div>
            </div>
          </div>
          
          <div class="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
            <div class="text-yellow-400 text-2xl">?</div>
            <div class="flex-1">
              <div class="font-medium text-yellow-400">Prompt Confirm ({{ policySettings.promptThreshold }}% - {{ Math.max(policySettings.autoClassifyThreshold - 1, policySettings.promptThreshold) }}%)</div>
              <div class="text-sm text-gray-400">Ask "Is this correct?"</div>
            </div>
          </div>
          
          <div class="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
            <div class="text-red-400 text-2xl">⚠</div>
            <div class="flex-1">
              <div class="font-medium text-red-400">Manual Selection (0% - {{ Math.max(policySettings.promptThreshold - 1, 0) }}%)</div>
              <div class="text-sm text-gray-400">Show all options with AI guidance</div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- ==================== SECTION 2: Discord Notification Thresholds ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🔔 Discord Notification - Behavior Thresholds</h2>
      </template>

      <p class="text-gray-400 mb-6">
        Control when Discord notifications are sent and what type of message users see based on classification confidence.
      </p>

      <div class="space-y-6">
        <!-- Auto-Route Threshold -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="font-medium">Auto-Route Notification Threshold</label>
            <span class="text-2xl font-bold text-blue-400">{{ discordSettings.autoRouteThreshold }}%</span>
          </div>
          <p class="text-sm text-gray-400">High-confidence items (≥ this threshold) send informational messages WITHOUT verification buttons</p>
          <Slider
            v-model="discordSettings.autoRouteThreshold"
            :min="75"
            :max="100"
            :step="5"
          />
        </div>

        <!-- Verification Threshold -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="font-medium">Verification Required Threshold</label>
            <span class="text-2xl font-bold text-purple-400">{{ discordSettings.verificationThreshold }}%</span>
          </div>
          <p class="text-sm text-gray-400">Medium-confidence items (≥ this threshold, &lt; auto-route) prompt for Yes/No verification</p>
          <Slider
            v-model="discordSettings.verificationThreshold"
            :min="50"
            :max="85"
            :step="5"
          />
        </div>

        <!-- Options -->
        <div class="space-y-3 pt-4 border-t border-gray-700">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="discordSettings.includeSignalBreakdown" class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900" />
            <span class="text-sm">Always include signal breakdown in verification messages</span>
          </label>
          
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="discordSettings.showSimilarItems" class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900" />
            <span class="text-sm">Show similar items already in library (top 3)</span>
          </label>
        </div>
      </div>
    </Card>

    <!-- ==================== SECTION 3: Auto-Learning Thresholds ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🧠 Auto-Learning - Feedback Thresholds</h2>
      </template>

      <p class="text-gray-400 mb-6">
        Control when user feedback automatically updates library policies.
      </p>

      <div class="space-y-8">
        <!-- Signal Preference Thresholds -->
        <div class="space-y-4">
          <h3 class="font-semibold">Signal Preference Thresholds</h3>
          
          <div class="grid md:grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">Genre Learning</label>
              <input
                v-model.number="learningSettings.genreLearnThreshold"
                type="number"
                :min="1"
                :max="10"
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-xs text-gray-400">Confirmations needed</p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Keyword Learning</label>
              <input
                v-model.number="learningSettings.keywordLearnThreshold"
                type="number"
                :min="1"
                :max="15"
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-xs text-gray-400">Confirmations needed (noisier)</p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Studio Learning</label>
              <input
                v-model.number="learningSettings.studioLearnThreshold"
                type="number"
                :min="1"
                :max="5"
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-xs text-gray-400">Confirmations needed (reliable)</p>
            </div>
          </div>

          <!-- Min Confidence Rate -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="font-medium">Minimum Confidence Rate</label>
              <span class="text-xl font-bold text-blue-400">{{ learningSettings.minConfidenceRate }}%</span>
            </div>
            <p class="text-sm text-gray-400">Ratio of confirmations to rejections (e.g., 75% = max 1 reject per 3 confirms)</p>
            <Slider
              v-model="learningSettings.minConfidenceRate"
              :min="50"
              :max="100"
              :step="5"
            />
          </div>
        </div>

        <!-- Conflict Resolution -->
        <div class="space-y-4 pt-6 border-t border-gray-700">
          <h3 class="font-semibold">Conflict Resolution Strategy</h3>
          
          <select v-model="learningSettings.conflictResolutionStrategy" class="w-full md:w-96 px-3 py-2 bg-gray-800 border border-gray-700 rounded">
            <option value="block">🚫 Block - Don't learn (Conservative)</option>
            <option value="escalate">📋 Escalate to Admin Review (Recommended)</option>
            <option value="auto_resolve">⚡ Auto-Resolve with High Threshold (Aggressive)</option>
          </select>

          <div v-if="learningSettings.conflictResolutionStrategy === 'auto_resolve'" class="space-y-2">
            <label class="text-sm font-medium">Auto-Resolve Threshold</label>
            <input
              v-model.number="learningSettings.autoResolveThreshold"
              type="number"
              :min="5"
              :max="15"
              class="w-full md:w-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-400">Confirmations needed to override an exclusion rule</p>
          </div>
        </div>

        <!-- Rate Limiting -->
        <div class="space-y-4 pt-6 border-t border-gray-700">
          <h3 class="font-semibold">🛡️ Rate Limiting &amp; Safety</h3>
          
          <div class="grid md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">Max Auto-Learns Per User Per Day</label>
              <input
                v-model.number="learningSettings.maxLearnsPerUserPerDay"
                type="number"
                :min="10"
                :max="200"
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Max Auto-Learns Per Library Per Hour</label>
              <input
                v-model.number="learningSettings.maxLearnsPerLibraryPerHour"
                type="number"
                :min="5"
                :max="100"
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- ==================== SECTION 4: Audit History ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">📜 Configuration Change History</h2>
      </template>

      <div v-if="auditHistory.length === 0" class="text-center py-8 text-gray-400">
        No configuration changes yet
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-gray-700">
            <tr class="text-left">
              <th class="pb-2 font-medium">Setting</th>
              <th class="pb-2 font-medium">Old Value</th>
              <th class="pb-2 font-medium">New Value</th>
              <th class="pb-2 font-medium">Changed By</th>
              <th class="pb-2 font-medium">When</th>
              <th class="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="audit in auditHistory" :key="audit.id" class="border-b border-gray-800">
              <td class="py-2">{{ formatSettingKey(audit.setting_key) }}</td>
              <td class="py-2 text-gray-400">{{ audit.old_value }}</td>
              <td class="py-2 text-blue-400">{{ audit.new_value }}</td>
              <td class="py-2">{{ audit.changed_by_username || 'System' }}</td>
              <td class="py-2 text-gray-400">{{ formatDate(audit.changed_at) }}</td>
              <td class="py-2">
                <Button @click="revertSetting(audit.id)" size="sm" variant="danger">
                  Revert
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Save Buttons -->
    <div class="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex gap-3 justify-end">
      <Button @click="exportSettings" variant="outline" size="lg">
        📥 Export Configuration
      </Button>
      <Button @click="resetToDefaults" variant="secondary" size="lg">
        🔄 Reset to Defaults
      </Button>
      <Button @click="saveAllSettings" variant="primary" size="lg" :disabled="isSaving">
        <span v-if="isSaving">Saving...</span>
        <span v-else>💾 Save All Settings</span>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useToast } from '@/stores/toast'
import axios from 'axios'

// Components
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Slider from '@/components/common/Slider.vue'

const toast = useToast()
const isSaving = ref(false)

const policySettings = reactive({
  autoClassifyThreshold: 85,
  promptThreshold: 60
})

const discordSettings = reactive({
  autoRouteThreshold: 85,
  verificationThreshold: 60,
  enhancedDetailsThreshold: 60,
  includeSignalBreakdown: true,
  showSimilarItems: true
})

const learningSettings = reactive({
  genreLearnThreshold: 3,
  keywordLearnThreshold: 5,
  studioLearnThreshold: 2,
  minConfidenceRate: 75,
  conflictResolutionStrategy: 'escalate',
  autoResolveThreshold: 7,
  maxLearnsPerUserPerDay: 50,
  maxLearnsPerLibraryPerHour: 20
})

const auditHistory = ref([])

onMounted(async () => {
  await loadSettings()
  await loadAuditHistory()
})

async function loadSettings() {
  try {
    const response = await axios.get('/api/settings/confidence')
    const data = response.data
    
    // Parse and populate settings
    if (data.policy_auto_classify_threshold) {
      policySettings.autoClassifyThreshold = parseInt(data.policy_auto_classify_threshold.value) || 85
    }
    if (data.policy_prompt_threshold) {
      policySettings.promptThreshold = parseInt(data.policy_prompt_threshold.value) || 60
    }
    if (data.discord_auto_route_threshold) {
      discordSettings.autoRouteThreshold = parseInt(data.discord_auto_route_threshold.value) || 85
    }
    if (data.discord_verify_threshold) {
      discordSettings.verificationThreshold = parseInt(data.discord_verify_threshold.value) || 60
    }
    if (data.learning_genre_threshold) {
      learningSettings.genreLearnThreshold = parseInt(data.learning_genre_threshold.value) || 3
    }
    if (data.learning_keyword_threshold) {
      learningSettings.keywordLearnThreshold = parseInt(data.learning_keyword_threshold.value) || 5
    }
    if (data.learning_studio_threshold) {
      learningSettings.studioLearnThreshold = parseInt(data.learning_studio_threshold.value) || 2
    }
    if (data.learning_min_confidence_rate) {
      learningSettings.minConfidenceRate = parseInt(data.learning_min_confidence_rate.value) || 75
    }
    if (data.learning_conflict_strategy) {
      learningSettings.conflictResolutionStrategy = data.learning_conflict_strategy.value || 'escalate'
    }
    if (data.learning_auto_resolve_threshold) {
      learningSettings.autoResolveThreshold = parseInt(data.learning_auto_resolve_threshold.value) || 7
    }
    if (data.learning_max_per_user_day) {
      learningSettings.maxLearnsPerUserPerDay = parseInt(data.learning_max_per_user_day.value) || 50
    }
    if (data.learning_max_per_library_hour) {
      learningSettings.maxLearnsPerLibraryPerHour = parseInt(data.learning_max_per_library_hour.value) || 20
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
    toast.error('Failed to load settings')
  }
}

async function loadAuditHistory() {
  try {
    const response = await axios.get('/api/settings/confidence/history', {
      params: { limit: 20 }
    })
    auditHistory.value = response.data || []
  } catch (error) {
    console.error('Failed to load audit history:', error)
    // Not critical, just log
  }
}

async function saveAllSettings() {
  isSaving.value = true
  try {
    await axios.put('/api/settings/confidence', {
      policy_auto_classify_threshold: policySettings.autoClassifyThreshold,
      policy_prompt_threshold: policySettings.promptThreshold,
      discord_auto_route_threshold: discordSettings.autoRouteThreshold,
      discord_verify_threshold: discordSettings.verificationThreshold,
      discord_enhanced_details_threshold: discordSettings.enhancedDetailsThreshold,
      learning_genre_threshold: learningSettings.genreLearnThreshold,
      learning_keyword_threshold: learningSettings.keywordLearnThreshold,
      learning_studio_threshold: learningSettings.studioLearnThreshold,
      learning_min_confidence_rate: learningSettings.minConfidenceRate,
      learning_conflict_strategy: learningSettings.conflictResolutionStrategy,
      learning_auto_resolve_threshold: learningSettings.autoResolveThreshold,
      learning_max_per_user_day: learningSettings.maxLearnsPerUserPerDay,
      learning_max_per_library_hour: learningSettings.maxLearnsPerLibraryPerHour,
      _reason: 'Manual update from settings UI'
    })
    
    toast.success('Settings saved successfully')
    await loadAuditHistory()
  } catch (error) {
    console.error('Failed to save settings:', error)
    toast.error('Failed to save settings')
  } finally {
    isSaving.value = false
  }
}

async function revertSetting(auditId) {
  if (!confirm('Are you sure you want to revert this setting change?')) {
    return
  }
  
  try {
    await axios.post(`/api/settings/confidence/revert/${auditId}`)
    toast.success('Setting reverted')
    await loadSettings()
    await loadAuditHistory()
  } catch (error) {
    console.error('Failed to revert setting:', error)
    toast.error('Failed to revert setting')
  }
}

async function exportSettings() {
  try {
    const response = await axios.post('/api/settings/confidence/export')
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `classifarr-confidence-settings-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Settings exported successfully')
  } catch (error) {
    console.error('Failed to export settings:', error)
    toast.error('Failed to export settings')
  }
}

async function resetToDefaults() {
  if (!confirm('Are you sure you want to reset all settings to defaults?')) {
    return
  }
  
  policySettings.autoClassifyThreshold = 85
  policySettings.promptThreshold = 60
  discordSettings.autoRouteThreshold = 85
  discordSettings.verificationThreshold = 60
  learningSettings.genreLearnThreshold = 3
  learningSettings.keywordLearnThreshold = 5
  learningSettings.studioLearnThreshold = 2
  learningSettings.minConfidenceRate = 75
  learningSettings.conflictResolutionStrategy = 'escalate'
  learningSettings.autoResolveThreshold = 7
  learningSettings.maxLearnsPerUserPerDay = 50
  learningSettings.maxLearnsPerLibraryPerHour = 20
  
  toast.info('Settings reset to defaults (not saved yet)')
}

function formatSettingKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleString()
}

function validateThresholds() {
  // Ensure auto-classify threshold is always higher than prompt threshold
  if (policySettings.autoClassifyThreshold <= policySettings.promptThreshold) {
    // Adjust prompt threshold to be 5% lower
    policySettings.promptThreshold = Math.max(40, policySettings.autoClassifyThreshold - 5)
    toast.warning('Auto-classify threshold must be higher than prompt threshold')
  }
  
  // Ensure prompt threshold is at least 5% higher than 0
  if (policySettings.promptThreshold < 5) {
    policySettings.promptThreshold = 5
  }
}
</script>
