<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="confidence-settings-page space-y-8">
    
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p class="text-gray-400 mt-4">Loading settings...</p>
      </div>
    </div>

    <!-- Content (only shown when not loading) -->
    <template v-else>
    
    <!-- ==================== SECTION 1: Policy Engine Thresholds ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🎯 Classification Thresholds</h2>
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
          <p class="text-sm text-gray-400">High-confidence items at or above this threshold are automatically classified, saving you time on obvious matches.</p>
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
            <label class="font-medium">Policy Builder Threshold</label>
            <span class="text-2xl font-bold text-yellow-400">{{ policySettings.promptThreshold }}%</span>
          </div>
          <p class="text-sm text-gray-400">Low-confidence items (below this threshold) guide you through creating classification rules, so the system learns and improves over time.</p>
          <Slider
            v-model="policySettings.promptThreshold"
            :min="40"
            :max="Math.max(40, policySettings.autoClassifyThreshold - 5)"
            :step="5"
            @update:modelValue="validateThresholds"
          />
        </div>

        <!-- Validation Warning -->
        <div v-if="!isValid" class="p-3 bg-red-900/30 text-red-400 rounded-lg text-sm border border-red-500/30">
          ⚠️ Invalid configuration: Auto-classify threshold must be at least 5% higher than policy builder threshold.
        </div>

        <!-- How It Works Summary -->
        <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="text-blue-400 text-xl">ℹ️</div>
            <div class="flex-1">
              <p class="text-sm text-gray-300">
                <span class="font-semibold text-blue-400">How it works:</span> Items scoring {{ policySettings.autoClassifyThreshold }}% or higher are auto-classified. Items between {{ policySettings.promptThreshold }}% - {{ policySettings.autoClassifyThreshold - 1 }}% prompt you for Yes/No confirmation. Items below {{ policySettings.promptThreshold }}% guide you through the Policy Builder to create rules.
              </p>
            </div>
          </div>
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
              <div class="text-sm text-gray-400">Medium-confidence items prompt you for quick Yes/No confirmation before routing.</div>
            </div>
          </div>
          
          <div class="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
            <div class="text-red-400 text-2xl">⚠</div>
            <div class="flex-1">
              <div class="font-medium text-red-400">Policy Builder (0% - {{ Math.max(policySettings.promptThreshold - 1, 0) }}%)</div>
              <div class="text-sm text-gray-400">Detailed signal breakdown with policy creation guidance</div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- ==================== SECTION 2: Rollout Safety Automation ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🛡️ Rollout Safety Automation</h2>
      </template>

      <p class="text-gray-400 mb-6">
        Control hands-off safety behavior for Issue 275 second-pass rollout.
      </p>

      <div class="space-y-4">
        <label class="flex items-start gap-3">
          <input
            v-model="ragLoopSettings.autoFallbackEnabled"
            type="checkbox"
            class="mt-1 w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          <div>
            <div class="font-medium">Automatic Safety Fallback</div>
            <div class="text-sm text-gray-400">
              Automatically switches rollout mode from <code>apply</code> to <code>shadow</code> when sustained regression gates are breached.
            </div>
          </div>
        </label>

        <label class="flex items-start gap-3">
          <input
            v-model="ragLoopSettings.autoRecoverEnabled"
            type="checkbox"
            class="mt-1 w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          <div>
            <div class="font-medium">Auto Re-enable After Upgrade</div>
            <div class="text-sm text-gray-400">
              After fallback, automatically attempts one version-aware switch back to <code>apply</code> on a newer release.
            </div>
          </div>
        </label>

        <div v-if="fallbackIncident" class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-red-400 font-semibold">Automatic fallback detected</span>
            <span class="text-sm text-gray-400">Incident: <code>{{ fallbackIncident.incident_id || 'unknown' }}</code></span>
            <span class="text-sm text-gray-400">Triggered: {{ formatDate(fallbackIncident.triggered_at) }}</span>
          </div>
          <div class="text-sm text-gray-300">
            Rollout switched from <code>{{ fallbackIncident.from_mode || 'apply' }}</code> to <code>{{ fallbackIncident.to_mode || 'shadow' }}</code>.
            Copy the report and open an issue so we can diagnose and fix quickly.
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" @click="copyFallbackIncidentReport">
              📋 Copy Report
            </Button>
            <Button size="sm" variant="secondary" @click="openFallbackIssue">
              🐛 Open Issue
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- ==================== SECTION 2: Discord Notification Display Options ==================== -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🔔 Discord Notification - Display Options</h2>
      </template>

      <p class="text-gray-400 mb-6">
        Configure what information is included in Discord notifications. Discord uses its own configurable tier system to determine notification behavior (auto-route, verification buttons, or clarification prompts).
      </p>

      <div class="space-y-6">
        <!-- Display Options -->
        <div class="space-y-3">
          <h3 class="font-medium text-sm text-gray-300">Message Content Options</h3>
          
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
              <th class="pb-2 font-medium">Reason</th>
              <th class="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="audit in auditHistory" :key="audit.id" class="border-b border-gray-800">
              <td class="py-2">{{ formatSettingKey(audit.settingKey) }}</td>
              <td class="py-2 text-gray-400">{{ formatSettingValue(audit.oldValue) }}</td>
              <td class="py-2 text-blue-400">{{ formatSettingValue(audit.newValue) }}</td>
              <td class="py-2">{{ audit.changedBy || 'System' }}</td>
              <td class="py-2 text-gray-400">{{ formatDate(audit.changedAt) }}</td>
              <td class="py-2 text-gray-400">{{ audit.changeReason || 'Manual update' }}</td>
              <td class="py-2">
                <Button @click="revertSetting(audit.id)" size="sm" variant="danger" :disabled="!audit.canRevert">
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
      <Button @click="saveAllSettings" variant="primary" size="lg" :disabled="isSaving || !isValid">
        <span v-if="isSaving">Saving...</span>
        <span v-else>💾 Save All Settings</span>
      </Button>
    </div>
    
    </template><!-- End of v-else for loading -->
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useToast } from '@/stores/toast'
import api from '@/api'

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

const ragLoopSettings = reactive({
  autoFallbackEnabled: true,
  autoRecoverEnabled: false
})

const fallbackIncident = ref(null)
const fallbackState = ref(null)
const fallbackCheckedAt = ref(null)
const auditHistory = ref([])
const loading = ref(true)

// Validation state for thresholds
const isValid = computed(() => {
  return policySettings.autoClassifyThreshold >= policySettings.promptThreshold + 5
})

onMounted(async () => {
  await Promise.all([
    loadSettings(),
    loadRagLoopSettings(),
    loadFallbackIncident()
  ])
  await loadAuditHistory()
  loading.value = false
})

async function loadSettings() {
  try {
    const response = await api.getConfidenceSettings()
    const data = response.data
    
    // Parse and populate settings with fallbacks
    if (data.policy_auto_classify_threshold) {
      const value = parseInt(data.policy_auto_classify_threshold.value)
      policySettings.autoClassifyThreshold = !isNaN(value) ? value : 85
    }
    if (data.policy_prompt_threshold) {
      const value = parseInt(data.policy_prompt_threshold.value)
      policySettings.promptThreshold = !isNaN(value) ? value : 60
    }
    
    if (data.learning_genre_threshold) {
      const value = parseInt(data.learning_genre_threshold.value)
      learningSettings.genreLearnThreshold = !isNaN(value) ? value : 3
    }
    if (data.learning_keyword_threshold) {
      const value = parseInt(data.learning_keyword_threshold.value)
      learningSettings.keywordLearnThreshold = !isNaN(value) ? value : 5
    }
    if (data.learning_studio_threshold) {
      const value = parseInt(data.learning_studio_threshold.value)
      learningSettings.studioLearnThreshold = !isNaN(value) ? value : 2
    }
    if (data.learning_min_confidence_rate) {
      const value = parseInt(data.learning_min_confidence_rate.value)
      learningSettings.minConfidenceRate = !isNaN(value) ? value : 75
    }
    if (data.learning_conflict_strategy) {
      learningSettings.conflictResolutionStrategy = data.learning_conflict_strategy.value || 'escalate'
    }
    if (data.learning_auto_resolve_threshold) {
      const value = parseInt(data.learning_auto_resolve_threshold.value)
      learningSettings.autoResolveThreshold = !isNaN(value) ? value : 7
    }
    if (data.learning_max_per_user_day) {
      const value = parseInt(data.learning_max_per_user_day.value)
      learningSettings.maxLearnsPerUserPerDay = !isNaN(value) ? value : 50
    }
    if (data.learning_max_per_library_hour) {
      const value = parseInt(data.learning_max_per_library_hour.value)
      learningSettings.maxLearnsPerLibraryPerHour = !isNaN(value) ? value : 20
    }
    
    // Load Discord display options
    if (data.discord_include_signal_breakdown !== undefined) {
      discordSettings.includeSignalBreakdown = data.discord_include_signal_breakdown.value === 'true'
    }
    if (data.discord_show_similar_items !== undefined) {
      discordSettings.showSimilarItems = data.discord_show_similar_items.value === 'true'
    }
    
  } catch (error) {
    console.error('Failed to load confidence settings:', error)
    toast.error('Failed to load settings: ' + (error.message || 'Unknown error'))
  }
}

async function loadAuditHistory() {
  try {
    const response = await api.getConfidenceHistory({ limit: 20 })
    const rows = Array.isArray(response.data) ? response.data : []
    auditHistory.value = rows
      .map(normalizeAuditRow)
      // Hide rows that contain no actionable detail.
      .filter(row => row.settingKey || row.oldValue !== null || row.newValue !== null)
  } catch (error) {
    console.error('Failed to load audit history:', error)
    // Not critical, just log
  }
}

async function loadRagLoopSettings() {
  try {
    const response = await api.getAIConfig()
    const data = response.data || {}
    ragLoopSettings.autoFallbackEnabled = data.rag_loop_auto_fallback_enabled !== false
    ragLoopSettings.autoRecoverEnabled = data.rag_loop_auto_recover_enabled === true
  } catch (error) {
    console.error('Failed to load rag loop safety settings:', error)
  }
}

async function loadFallbackIncident() {
  try {
    const response = await api.getLatestRagFallbackIncident()
    fallbackIncident.value = response.data?.incident || null
    fallbackState.value = response.data?.fallback_state || null
    fallbackCheckedAt.value = response.data?.checked_at || null
  } catch (error) {
    fallbackIncident.value = null
    fallbackState.value = null
    fallbackCheckedAt.value = null
  }
}

const fallbackIncidentReportText = computed(() => {
  if (!fallbackIncident.value) return ''
  return JSON.stringify({
    incident: fallbackIncident.value,
    fallback_state: fallbackState.value,
    checked_at: fallbackCheckedAt.value
  }, null, 2)
})

async function copyFallbackIncidentReport() {
  if (!fallbackIncident.value) {
    toast.warning('No fallback incident report is available')
    return
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fallbackIncidentReportText.value)
      toast.success('Fallback report copied to clipboard')
      return
    }

    const textArea = document.createElement('textarea')
    textArea.value = fallbackIncidentReportText.value
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    toast.success('Fallback report copied to clipboard')
  } catch (error) {
    console.error('Failed to copy fallback report:', error)
    toast.error('Failed to copy fallback report')
  }
}

function openFallbackIssue() {
  if (!fallbackIncident.value || typeof window === 'undefined') {
    return
  }

  const title = `[Auto Fallback] ${fallbackIncident.value.incident_id || 'Unknown Incident'}`
  const body = [
    'Automatic fallback report from Classifarr:',
    '',
    '```json',
    fallbackIncidentReportText.value,
    '```'
  ].join('\n')

  const url = `https://github.com/cloudbyday90/Classifarr/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function saveAllSettings() {
  isSaving.value = true
  try {
    const payload = {
      policy_auto_classify_threshold: policySettings.autoClassifyThreshold,
      policy_prompt_threshold: policySettings.promptThreshold,
      discord_include_signal_breakdown: discordSettings.includeSignalBreakdown,
      discord_show_similar_items: discordSettings.showSimilarItems,
      learning_genre_threshold: learningSettings.genreLearnThreshold,
      learning_keyword_threshold: learningSettings.keywordLearnThreshold,
      learning_studio_threshold: learningSettings.studioLearnThreshold,
      learning_min_confidence_rate: learningSettings.minConfidenceRate,
      learning_conflict_strategy: learningSettings.conflictResolutionStrategy,
      learning_auto_resolve_threshold: learningSettings.autoResolveThreshold,
      learning_max_per_user_day: learningSettings.maxLearnsPerUserPerDay,
      learning_max_per_library_hour: learningSettings.maxLearnsPerLibraryPerHour,
      _reason: 'Manual update from settings UI'
    }
    
    await api.updateConfidenceSettings(payload)
    await api.updateAIConfig({
      rag_loop_auto_fallback_enabled: ragLoopSettings.autoFallbackEnabled,
      rag_loop_auto_recover_enabled: ragLoopSettings.autoRecoverEnabled
    })
    toast.success('Settings saved successfully')
    await loadAuditHistory()
    await loadFallbackIncident()
  } catch (error) {
    console.error('Failed to save settings:', error)
    toast.error('Failed to save settings: ' + (error.response?.data?.error || error.message || 'Unknown error'))
  } finally {
    isSaving.value = false
  }
}

async function revertSetting(auditId) {
  if (!confirm('Are you sure you want to revert this setting change?')) {
    return
  }
  
  try {
    await api.revertConfidenceSetting(auditId)
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
    const response = await api.exportConfidenceSettings()
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
  discordSettings.includeSignalBreakdown = true
  discordSettings.showSimilarItems = true
  learningSettings.genreLearnThreshold = 3
  learningSettings.keywordLearnThreshold = 5
  learningSettings.studioLearnThreshold = 2
  learningSettings.minConfidenceRate = 75
  learningSettings.conflictResolutionStrategy = 'escalate'
  learningSettings.autoResolveThreshold = 7
  learningSettings.maxLearnsPerUserPerDay = 50
  learningSettings.maxLearnsPerLibraryPerHour = 20
  ragLoopSettings.autoFallbackEnabled = true
  ragLoopSettings.autoRecoverEnabled = false
  
  toast.info('Settings reset to defaults (not saved yet)')
}

function formatSettingKey(key) {
  if (!key) return 'Unknown'
  const labels = {
    policy_auto_classify_threshold: 'Auto-Classify Threshold',
    policy_prompt_threshold: 'Policy Builder Threshold',
    discord_include_signal_breakdown: 'Discord: Include Signal Breakdown',
    discord_show_similar_items: 'Discord: Show Similar Items',
    learning_genre_threshold: 'Learning: Genre Threshold',
    learning_keyword_threshold: 'Learning: Keyword Threshold',
    learning_studio_threshold: 'Learning: Studio Threshold',
    learning_min_confidence_rate: 'Learning: Minimum Confidence Rate',
    learning_conflict_strategy: 'Learning: Conflict Strategy',
    learning_auto_resolve_threshold: 'Learning: Auto Resolve Threshold',
    learning_max_per_user_day: 'Learning: Max Per User/Day',
    learning_max_per_library_hour: 'Learning: Max Per Library/Hour',
    rag_loop_auto_fallback_enabled: 'RAG: Auto Fallback Enabled',
    rag_loop_auto_recover_enabled: 'RAG: Auto Recover Enabled'
  }

  if (labels[key]) return labels[key]

  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function normalizeAuditRow(row = {}) {
  const settingKey = row.setting_key ?? row.settingKey ?? row.key ?? null
  const changedAt = row.changed_at ?? row.changedAt ?? row.created_at ?? row.createdAt ?? null
  const changedBy = row.changed_by_username ?? row.changedByUsername ?? row.username ?? null
  const oldValue = row.old_value ?? row.oldValue ?? null
  const newValue = row.new_value ?? row.newValue ?? null
  const changeReason = row.change_reason ?? row.changeReason ?? null
  const id = row.id ?? row.audit_id ?? row.auditId ?? `${settingKey || 'unknown'}-${changedAt || Date.now()}`

  return {
    id,
    settingKey,
    oldValue,
    newValue,
    changedBy,
    changedAt,
    changeReason,
    canRevert: Number.isInteger(Number(row.id ?? row.audit_id ?? row.auditId))
  }
}

function formatSettingValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (value === 'true') return 'Enabled'
  if (value === 'false') return 'Disabled'

  try {
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      return JSON.stringify(JSON.parse(value))
    }
  } catch {
    // Keep original value when not valid JSON.
  }

  return String(value)
}

function validateThresholds() {
  // Enforce minimum 5% gap between thresholds
  const gap = policySettings.autoClassifyThreshold - policySettings.promptThreshold
  
  if (gap < 5) {
    // Adjust auto-classify threshold to maintain 5% gap
    policySettings.autoClassifyThreshold = Math.min(95, policySettings.promptThreshold + 5)
    toast.warning('Auto-classify threshold must be at least 5% higher than policy builder threshold')
  }
  
  // Ensure prompt threshold doesn't exceed auto - 5
  if (policySettings.promptThreshold > policySettings.autoClassifyThreshold - 5) {
    policySettings.promptThreshold = Math.max(40, policySettings.autoClassifyThreshold - 5)
  }
}
</script>
