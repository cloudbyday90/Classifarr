<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold mb-2">Classification Confidence</h2>
        <p class="text-gray-400 text-sm">Configure how media is classified and when to ask for help.</p>
      </div>
      <div v-if="!loading && !isEditing">
        <Button @click="startEditing" variant="primary">
          ✎ Configure
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <Spinner />
      <p class="text-gray-400 mt-4">Loading settings...</p>
    </div>

    <div v-else class="space-y-6">
      <!-- VIEW MODE -->
      <template v-if="!isEditing">
        <!-- Status Card -->
        <Card>
          <div class="flex flex-col md:flex-row gap-8">
            <!-- AI Clarification Status -->
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-4">
                <div :class="[
                  'w-3 h-3 rounded-full shadow-[0_0_10px]',
                  config.enable_clarification ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-500 shadow-gray-500/50'
                ]"></div>
                <h3 class="font-medium text-lg">AI Clarification</h3>
              </div>
              
              <div class="space-y-4">
                <div class="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-400 text-sm">Status</span>
                    <span :class="config.enable_clarification ? 'text-green-400' : 'text-gray-400'">
                      {{ config.enable_clarification ? 'Active' : 'Disabled' }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between" v-if="config.enable_clarification">
                    <span class="text-gray-400 text-sm">Threshold</span>
                    <span class="text-blue-400 font-bold">{{ config.clarification_threshold }}%</span>
                  </div>
                </div>
                <p class="text-sm text-gray-400 leading-relaxed">
                  {{ config.enable_clarification 
                    ? `The AI will ask via Discord when confidence is below ${config.clarification_threshold}%.`
                    : 'AI Clarification is disabled. The system will make its best guess.' }}
                </p>
              </div>
            </div>

            <div class="w-px bg-gray-700 hidden md:block"></div>

            <!-- Manual Confirmation Status -->
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-4">
                <div :class="[
                  'w-3 h-3 rounded-full shadow-[0_0_10px]',
                  config.require_all_confirmations ? 'bg-orange-500 shadow-orange-500/50' : 'bg-green-500 shadow-green-500/50'
                ]"></div>
                <h3 class="font-medium text-lg">Manual Confirmation</h3>
              </div>
               
              <div class="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 mb-4">
                <div class="flex items-center justify-between">
                  <span class="text-gray-400 text-sm">Mode</span>
                  <span :class="config.require_all_confirmations ? 'text-orange-400' : 'text-green-400'">
                    {{ config.require_all_confirmations ? 'Require All' : 'Automatic' }}
                  </span>
                </div>
              </div>
              <p class="text-sm text-gray-400 leading-relaxed">
                {{ config.require_all_confirmations
                  ? 'Currently verifying ALL classifications manually, regardless of confidence.'
                  : 'High confidence matches (90%+) are processed automatically.' }}
              </p>
            </div>
          </div>
        </Card>

        <!-- Stats Card -->
        <Card>
          <h3 class="text-lg font-semibold mb-4">Performance Statistics</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/50">
              <div class="text-2xl font-bold text-green-400">{{ stats.auto || 0 }}</div>
              <div class="text-xs text-gray-400 uppercase tracking-wider mt-1">Auto-Routed</div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/50">
              <div class="text-2xl font-bold text-yellow-400">{{ stats.clarified || 0 }}</div>
              <div class="text-xs text-gray-400 uppercase tracking-wider mt-1">Clarified</div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/50">
              <div class="text-2xl font-bold text-blue-400">{{ stats.manual || 0 }}</div>
              <div class="text-xs text-gray-400 uppercase tracking-wider mt-1">Manual</div>
            </div>
            <div class="bg-gray-900/50 rounded-lg p-4 text-center border border-gray-700/50">
              <div class="text-2xl font-bold text-gray-400">{{ stats.total || 0 }}</div>
              <div class="text-xs text-gray-400 uppercase tracking-wider mt-1">Total</div>
            </div>
          </div>
        </Card>

        <!-- Explanation Card -->
        <Card>
          <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
            💡 How AI Clarification Works
          </h3>
          <div class="grid md:grid-cols-2 gap-6">
            <div class="space-y-4 text-sm">
              <div class="flex gap-3">
                <div class="text-xl bg-gray-700 w-8 h-8 rounded flex items-center justify-center flex-none">1️⃣</div>
                <div>
                  <div class="font-medium text-white">Analysis</div>
                  <div class="text-gray-400 mt-0.5">AI examines TMDB data (genres, keywords, language).</div>
                </div>
              </div>
              <div class="flex gap-3">
                <div class="text-xl bg-gray-700 w-8 h-8 rounded flex items-center justify-center flex-none">2️⃣</div>
                <div>
                  <div class="font-medium text-white">Ambiguity Detection</div>
                  <div class="text-gray-400 mt-0.5">Using your threshold ({{config.clarification_threshold}}%), it decides if it's unsure.</div>
                </div>
              </div>
            </div>
            <div class="space-y-4 text-sm">
              <div class="flex gap-3">
                <div class="text-xl bg-gray-700 w-8 h-8 rounded flex items-center justify-center flex-none">3️⃣</div>
                <div>
                  <div class="font-medium text-white">Targeted Question</div>
                  <div class="text-gray-400 mt-0.5">Discord bot asks a specific question to resolve the conflict.</div>
                </div>
              </div>
              <div class="flex gap-3">
                <div class="text-xl bg-gray-700 w-8 h-8 rounded flex items-center justify-center flex-none">4️⃣</div>
                <div>
                  <div class="font-medium text-white">Learning</div>
                  <div class="text-gray-400 mt-0.5">Your answer routes the media and trains the decision model.</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </template>

      <!-- EDIT MODE -->
      <template v-else>
        <Card>
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-medium">Configuration</h3>
            <span class="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
              Editing
            </span>
          </div>

          <div class="space-y-8 max-w-3xl">
            <!-- Toggle Enable -->
            <div class="flex items-start justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
              <div>
                <h4 class="font-medium mb-1">AI Clarification via Discord</h4>
                <p class="text-sm text-gray-400">
                  Allow the AI to ask you questions when it's uncertain.
                </p>
              </div>
              <Toggle v-model="form.enable_clarification" />
            </div>

            <!-- Threshold Slider -->
            <div v-if="form.enable_clarification" class="p-4 bg-gray-900/30 rounded-lg border border-gray-700/50 transition-all">
              <div class="flex justify-between items-center mb-4">
                <div>
                  <h4 class="font-medium">Confidence Threshold</h4>
                  <p class="text-sm text-gray-400">Ask for help when confidence is below this value.</p>
                </div>
                <span class="text-2xl font-bold text-blue-400">{{ form.clarification_threshold }}%</span>
              </div>
              
              <Slider 
                v-model="form.clarification_threshold"
                :min="50"
                :max="95"
                :step="5"
              />
              
              <div class="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                <span>50% (Ask Less)</span>
                <span>95% (Ask More)</span>
              </div>
            </div>

            <!-- Manual Mode Toggle -->
            <div class="flex items-start justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
              <div>
                <h4 class="font-medium mb-1 flex items-center gap-2">
                  🔒 Manual Confirmation Mode
                </h4>
                <p class="text-sm text-gray-400">
                  Require manual approval for <strong>all</strong> classifications, regardless of confidence.
                </p>
              </div>
              <Toggle v-model="form.require_all_confirmations" />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-8 pt-6 border-t border-gray-700 flex justify-end gap-3">
            <Button variant="ghost" @click="cancelEditing" :disabled="isSaving">
              Cancel
            </Button>
            <Button variant="primary" @click="saveConfig" :disabled="isSaving">
              <span v-if="isSaving">Saving...</span>
              <span v-else>Save Changes</span>
            </Button>
          </div>
        </Card>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/stores/toast'
import axios from 'axios'

// Components
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Toggle from '@/components/common/Toggle.vue'
import Slider from '@/components/common/Slider.vue'
import Spinner from '@/components/common/Spinner.vue'

const toast = useToast()
const loading = ref(true)
const isEditing = ref(false)
const isSaving = ref(false)

const config = ref({
  enable_clarification: true,
  clarification_threshold: 75,
  require_all_confirmations: false
})

const form = reactive({
  enable_clarification: true,
  clarification_threshold: 75,
  require_all_confirmations: false
})

const stats = ref({
  auto: 0,
  clarified: 0,
  manual: 0,
  total: 0
})

onMounted(async () => {
  await Promise.all([loadSettings(), loadStats()])
})

const loadSettings = async () => {
  try {
    const response = await axios.get('/api/settings')
    const data = response.data
    
    config.value = {
      enable_clarification: data.enable_clarification !== 'false',
      clarification_threshold: parseInt(data.clarification_threshold) || 75,
      require_all_confirmations: data.require_all_confirmations === 'true'
    }
    loading.value = false
  } catch (error) {
    console.error('Failed to load settings:', error)
    toast.error('Failed to load configuration')
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const response = await axios.get('/api/classification/stats')
    if (response.data) {
      stats.value = {
        auto: response.data.auto || response.data.highConfidence || 0,
        clarified: response.data.clarified || response.data.mediumConfidence || 0,
        manual: response.data.manual || response.data.lowConfidence || 0,
        total: response.data.total || 0
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const startEditing = () => {
  // Copy current config to form
  Object.assign(form, config.value)
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const saveConfig = async () => {
  isSaving.value = true
  try {
    // Send all settings at once
    await axios.put('/api/settings', {
      enable_clarification: form.enable_clarification.toString(),
      clarification_threshold: form.clarification_threshold.toString(),
      require_all_confirmations: form.require_all_confirmations.toString()
    })

    // Update local state
    config.value = { ...form }
    isEditing.value = false
    toast.success('Configuration saved successfully')
    
  } catch (error) {
    console.error('Failed to save settings:', error)
    toast.error('Failed to save configuration')
  } finally {
    isSaving.value = false
  }
}
</script>
